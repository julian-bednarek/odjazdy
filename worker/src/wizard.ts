import { randomHex, samePassword } from "./auth";
import { parseProfiles } from "./config";
import { Errors, json, readJson } from "./http";
import { Keys } from "./keys";
import { getStations } from "./plk";
import type { DeviceConfig, Env, Pairing, Session } from "./types";

const SESSION_TTL_S = 30 * 60;
const SESSION_TOKEN_BYTES = 32;
const MAX_PASSWORD_TRIES = 5;
const MIN_PASSWORD_LENGTH = 20;
const PAIRING_CODE = /^[0-9a-f]{32}$/;
const SESSION_COOKIE = /(?:^|;\s*)__Host-session=([0-9a-f]{64})(?:;|$)/;
const SETUP_PAGE = "/setup";

type Authed = { token: string; session: Session };
type AuthedHandler = (req: Request, env: Env, auth: Authed) => Promise<Response>;

const sessionCookie = (token: string, maxAgeS: number) =>
  `__Host-session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeS}`;

const putSession = (env: Env, token: string, session: Session) =>
  env.TS_KV.put(Keys.session(token), JSON.stringify(session), { expirationTtl: SESSION_TTL_S });

function redirectToSetup(cookie?: string): Response {
  const headers = new Headers({ Location: SETUP_PAGE, "Cache-Control": "no-store" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

// The watch's link works once and leaves only an HttpOnly cookie behind, so the
// address bar, the history and the page's scripts never hold a usable credential.
// Sec-Fetch-Site can't vet it: Garmin Connect opens it as "cross-site", just like a planted link.
export async function handleOpen(req: Request, env: Env): Promise<Response> {
  const code = new URL(req.url).searchParams.get("c") ?? "";
  if (!PAIRING_CODE.test(code)) return redirectToSetup();
  const pairing = await env.TS_KV.get<Pairing>(Keys.pairing(code), "json");
  if (!pairing) return redirectToSetup();

  const token = randomHex(SESSION_TOKEN_BYTES);
  await Promise.all([env.TS_KV.delete(Keys.pairing(code)), putSession(env, token, { ...pairing, passwordTries: 0 })]);
  return redirectToSetup(sessionCookie(token, SESSION_TTL_S));
}

function authed(handler: AuthedHandler) {
  return async (req: Request, env: Env): Promise<Response> => {
    const token = req.headers.get("Cookie")?.match(SESSION_COOKIE)?.[1];
    const session = token ? await env.TS_KV.get<Session>(Keys.session(token), "json") : null;
    return token && session ? handler(req, env, { token, session }) : json({ error: Errors.unauthorized }, 401);
  };
}

// Only a watch the worker doesn't know yet needs the owner's password; wrong guesses use up the session.
// Anyone can open new sessions, so the password's length, not the try limit, is what stops guessing.
async function passwordRejection(env: Env, { token, session }: Authed, password: unknown): Promise<Response | null> {
  const expected = env.SETUP_PASSWORD ?? "";
  if (expected.length < MIN_PASSWORD_LENGTH) return json({ error: Errors.closed }, 403);
  if (typeof password === "string" && (await samePassword(password, expected))) return null;
  const passwordTries = session.passwordTries + 1;
  await (passwordTries < MAX_PASSWORD_TRIES
    ? putSession(env, token, { ...session, passwordTries })
    : env.TS_KV.delete(Keys.session(token)));
  return json({ error: Errors.password }, 401);
}

export const getConfig = authed(async (_req, env, { session }) => {
  const cfg = await env.TS_KV.get<DeviceConfig>(Keys.config(session.device), "json");
  return json({ registered: cfg !== null, profiles: cfg?.profiles ?? [] });
});

export const putConfig = authed(async (req, env, auth) => {
  const body = await readJson(req);
  const profiles = parseProfiles(body?.profiles);
  if (!profiles) return json({ error: Errors.badRequest }, 400);

  const key = Keys.config(auth.session.device);
  const rejection = (await env.TS_KV.get(key)) ? null : await passwordRejection(env, auth, body?.password);
  if (rejection) return rejection;

  const cfg: DeviceConfig = { secret: auth.session.secret, profiles };
  await env.TS_KV.put(key, JSON.stringify(cfg));
  return json({ ok: true });
});

export const deleteConfig = authed(async (_req, env, { token, session }) => {
  const keys = [Keys.config(session.device), Keys.lastProfile(session.device), Keys.session(token)];
  await Promise.all(keys.map((key) => env.TS_KV.delete(key)));
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
});

export const getStationList = authed(async (_req, env) => {
  try {
    return json(await getStations(env));
  } catch (err) {
    console.error(err);
    return json({ error: Errors.upstream }, 502);
  }
});
