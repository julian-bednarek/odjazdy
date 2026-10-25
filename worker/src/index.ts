import { verify } from "./auth";
import { cacheGet, cachePut } from "./cache";
import { buildRows, upcoming } from "./departures";
import { demoRows } from "./demo";
import { getCandidates, getRealtime } from "./plk";
import { pickProfile } from "./profiles";
import { warsawDate, warsawHour } from "./time";
import type { DeviceConfig, Env, Profile, Row, SignedFields, WatchResponse } from "./types";

const SHA256_HEX = /^[0-9a-f]{64}$/;
const FALLBACK_TTL_S = 6 * 3600;
const YESTERDAY_UNTIL_HOUR = 4;
const TOMORROW_FROM_HOUR = 21;

const Headers = { device: "X-Device", signature: "X-Signature" } as const;

const Errors = {
  badRequest: "bad_request",
  noConfig: "no_config",
  unauthorized: "unauthorized",
  upstream: "upstream",
  notFound: "not_found",
} as const;

const Keys = {
  config: (device: string) => `cfg:${device}`,
  lastProfile: (device: string) => `last:${device}`,
  fallbackRows: (device: string, profile: string) => `rows/${device}/${profile}`,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

async function signedFields(req: Request): Promise<SignedFields | null> {
  const body = await req.json<Record<string, unknown>>().catch(() => null);
  const fields = { timestamp: body?.timestamp, lat: body?.lat, lon: body?.lon, profile: body?.profile };
  return Object.values(fields).every((v) => typeof v === "string") ? (fields as SignedFields) : null;
}

function location({ lat, lon }: SignedFields) {
  const point = { lat: parseFloat(lat), lon: parseFloat(lon) };
  return Number.isFinite(point.lat) && Number.isFinite(point.lon) ? point : null;
}

// Yesterday's late trains run past midnight; late evening needs tomorrow's.
function relevantDates(now: number): string[] {
  const hour = warsawHour(now);
  return [
    hour < YESTERDAY_UNTIL_HOUR && warsawDate(now, -1),
    warsawDate(now),
    hour >= TOMORROW_FROM_HOUR && warsawDate(now, 1),
  ].filter((date) => date !== false);
}

async function departures(env: Env, profile: Profile, now: number): Promise<Row[]> {
  if (!env.PLK_API_KEY) return demoRows(profile, now);
  const [candidates, realtime] = await Promise.all([
    Promise.all(relevantDates(now).map((date) => getCandidates(env, profile, date))),
    getRealtime(env, profile.from),
  ]);
  return buildRows(candidates.flat(), realtime, now);
}

// Serves the last good rows, marked stale, when PLK is down or rate-limited.
async function departuresWithFallback(env: Env, ctx: ExecutionContext, key: string, profile: Profile, now: number) {
  try {
    const rows = await departures(env, profile, now);
    ctx.waitUntil(cachePut(env.TS_KV, key, rows, FALLBACK_TTL_S));
    return { rows, stale: false };
  } catch (err) {
    console.error(err);
    const rows = await cacheGet<Row[]>(env.TS_KV, key);
    return rows && { rows: upcoming(rows, now), stale: true };
  }
}

async function handleDepartures(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const device = req.headers.get(Headers.device)?.toLowerCase() ?? "";
  const signature = req.headers.get(Headers.signature)?.toLowerCase() ?? "";
  const fields = await signedFields(req);
  if (!SHA256_HEX.test(device) || !SHA256_HEX.test(signature) || !fields) return json({ error: Errors.badRequest }, 400);

  const cfg = await env.TS_KV.get<DeviceConfig>(Keys.config(device), "json");
  if (!cfg) return json({ error: Errors.noConfig });

  const now = Math.floor(Date.now() / 1000);
  if (!(await verify(cfg.secret, fields, signature, now))) return json({ error: Errors.unauthorized }, 401);

  const lastId = await env.TS_KV.get(Keys.lastProfile(device));
  const pick = pickProfile(cfg, location(fields), fields.profile || null, lastId);
  if (!pick) return json({ error: Errors.noConfig });

  const { profile, matched } = pick;
  if (profile.id !== lastId) ctx.waitUntil(env.TS_KV.put(Keys.lastProfile(device), profile.id));

  const result = await departuresWithFallback(env, ctx, Keys.fallbackRows(device, profile.id), profile, now);
  if (!result) return json({ error: Errors.upstream }, 502);

  const body: WatchResponse = {
    time: now,
    profile: profile.id,
    name: profile.name,
    matched,
    stale: result.stale,
    profiles: cfg.profiles.map((p) => p.id),
    departures: result.rows,
  };
  return json(body);
}

export default {
  fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/v1/departures") return handleDepartures(req, env, ctx);
    return json({ error: Errors.notFound }, 404);
  },
} satisfies ExportedHandler<Env>;
