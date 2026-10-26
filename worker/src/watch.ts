import { canonical, deviceId, randomHex, verify } from "./auth";
import { cacheGet, cachePut } from "./cache";
import { buildRows, upcoming } from "./departures";
import { demoRows } from "./demo";
import { Errors, json, readJson } from "./http";
import { Keys } from "./keys";
import { getCandidates, getRealtime } from "./plk";
import { pickProfile } from "./profiles";
import { warsawDate, warsawHour } from "./time";
import type { DeviceConfig, Env, Pairing, Profile, Row, SignedFields, WatchResponse } from "./types";

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SECRET_HEX = /^[0-9a-f]{32}$/;
const FALLBACK_TTL_S = 6 * 3600;
const YESTERDAY_UNTIL_HOUR = 4;
const TOMORROW_FROM_HOUR = 21;
const PAIR_PURPOSE = "pair";
const PAIRING_TTL_S = 10 * 60;
const PAIRING_CODE_BYTES = 16;

const Header = { device: "X-Device", signature: "X-Signature" } as const;

const nowS = () => Math.floor(Date.now() / 1000);

async function signedFields(req: Request): Promise<SignedFields | null> {
  const body = await readJson(req);
  const fields = { timestamp: body?.timestamp, lat: body?.lat, lon: body?.lon, profile: body?.profile };
  return Object.values(fields).every((v) => typeof v === "string") ? (fields as SignedFields) : null;
}

// The watch's config when the headers carry a valid signature of parts, else the error to send.
async function signedConfig(req: Request, env: Env, parts: string[]): Promise<{ device: string; cfg: DeviceConfig } | Response> {
  const device = req.headers.get(Header.device)?.toLowerCase() ?? "";
  const signature = req.headers.get(Header.signature)?.toLowerCase() ?? "";
  if (!SHA256_HEX.test(device) || !SHA256_HEX.test(signature)) return json({ error: Errors.badRequest }, 400);

  const cfg = await env.TS_KV.get<DeviceConfig>(Keys.config(device), "json");
  if (!cfg) return json({ error: Errors.noConfig });
  if (!(await verify(cfg.secret, parts, signature, nowS()))) return json({ error: Errors.unauthorized }, 401);
  return { device, cfg };
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

export async function handleDepartures(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const fields = await signedFields(req);
  if (!fields) return json({ error: Errors.badRequest }, 400);
  const signed = await signedConfig(req, env, canonical(fields));
  if (signed instanceof Response) return signed;
  const { device, cfg } = signed;

  const now = nowS();
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

async function introduced(secret: string): Promise<Pairing | Response> {
  const hex = secret.toLowerCase();
  return SECRET_HEX.test(hex) ? { device: await deviceId(hex), secret: hex } : json({ error: Errors.badRequest }, 400);
}

async function signed(req: Request, env: Env, timestamp: unknown): Promise<Pairing | Response> {
  if (typeof timestamp !== "string") return json({ error: Errors.badRequest }, 400);
  const result = await signedConfig(req, env, [timestamp, PAIR_PURPOSE]);
  return result instanceof Response ? result : { device: result.device, secret: result.cfg.secret };
}

// A new watch introduces itself with its secret, the only time the secret leaves it;
// a paired one signs instead. Either way the phone gets a one-time wizard link.
export async function handlePair(req: Request, env: Env): Promise<Response> {
  const body = await readJson(req);
  const pairing = typeof body?.secret === "string" ? await introduced(body.secret) : await signed(req, env, body?.timestamp);
  if (pairing instanceof Response) return pairing;

  const code = randomHex(PAIRING_CODE_BYTES);
  await env.TS_KV.put(Keys.pairing(code), JSON.stringify(pairing), { expirationTtl: PAIRING_TTL_S });
  return json({ code });
}
