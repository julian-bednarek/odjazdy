import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, Profile } from "../src/types";
import { DEVICE, SECRET, signParts } from "./signing";
import { BASE, fetchWorker, kv } from "./worker";

const PASSWORD = "correct horse battery staple";
const vars: Partial<Env> = { SETUP_PASSWORD: PASSWORD, PLK_API_KEY: "key" };
const dom: Profile = { id: "dom", name: "Dom - Centralna", lat: 52.2395, lon: 21.0458, r: 1500, from: [1], to: [2] };
const waw: Profile = { ...dom, id: "waw", name: "Warszawa - Łódź", r: 15000 };

const storedConfig = () => JSON.parse(kv.get(`cfg:${DEVICE}`) ?? "null");

async function pair(body: object, headers: Record<string, string> = {}) {
  const res = await fetchWorker(new Request(`${BASE}/v1/pair`, { method: "POST", headers, body: JSON.stringify(body) }), vars);
  return { status: res.status, body: (await res.json()) as Record<string, string> };
}

async function signedPair(secret = SECRET) {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  return pair({ timestamp }, { "X-Device": DEVICE, "X-Signature": await signParts([timestamp, "pair"], secret) });
}

const open = (code: string, headers: Record<string, string> = {}) => fetchWorker(new Request(`${BASE}/open?c=${code}`, { headers }), vars);
const cookieOf = (res: Response) => res.headers.get("Set-Cookie")?.split(";")[0];

async function login(pairing: Promise<{ body: Record<string, string> }> = pair({ secret: SECRET })) {
  return cookieOf(await open((await pairing).body.code))!;
}

async function api(method: string, path: string, cookie?: string, body?: unknown, env = vars) {
  const headers: Record<string, string> = cookie ? { Cookie: cookie } : {};
  const res = await fetchWorker(new Request(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  return { status: res.status, body: await res.json(), headers: res.headers };
}

beforeEach(() => {
  kv.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pairing a new watch", () => {
  it("turns the watch's link into an HttpOnly session cookie", async () => {
    const res = await open((await pair({ secret: SECRET })).body.code);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/setup");
    expect(res.headers.get("Set-Cookie")).toMatch(/^__Host-session=[0-9a-f]{64}; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=1800$/);
  });

  it("saves the profiles once the owner's password is given", async () => {
    const cookie = await login();
    expect((await api("GET", "/api/config", cookie)).body).toEqual({ registered: false, profiles: [] });
    expect(await api("PUT", "/api/config", cookie, { profiles: [dom] })).toMatchObject({ status: 401, body: { error: "password" } });
    expect((await api("PUT", "/api/config", cookie, { profiles: [dom], password: PASSWORD })).status).toBe(200);
    expect(storedConfig()).toEqual({ secret: SECRET, profiles: [dom] });
  });

  it("opens each link only once", async () => {
    const { code } = (await pair({ secret: SECRET })).body;
    await open(code);
    const again = await open(code);
    expect(again.status).toBe(302);
    expect(again.headers.get("Set-Cookie")).toBeNull();
  });

  it("opens the watch's link although Garmin Connect makes it look cross-site", async () => {
    const { code } = (await pair({ secret: SECRET })).body;
    expect((await open(code, { "Sec-Fetch-Site": "cross-site" })).headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
  });

  it("ends the session after five wrong passwords", async () => {
    const cookie = await login();
    for (let i = 0; i < 5; i++) await api("PUT", "/api/config", cookie, { profiles: [dom], password: "guess" });
    expect((await api("GET", "/api/config", cookie)).status).toBe(401);
    expect(storedConfig()).toBeNull();
  });

  it.each([undefined, "under twenty chars"])("is closed while SETUP_PASSWORD is %j", async (password) => {
    const cookie = await login();
    const res = await api("PUT", "/api/config", cookie, { profiles: [dom], password }, { PLK_API_KEY: "key", SETUP_PASSWORD: password });
    expect(res).toMatchObject({ status: 403, body: { error: "closed" } });
  });

  it("rejects a malformed secret", async () => {
    expect((await pair({ secret: "not hex" })).status).toBe(400);
  });
});

describe("a paired watch", () => {
  beforeEach(() => {
    kv.set(`cfg:${DEVICE}`, JSON.stringify({ secret: SECRET, profiles: [dom] }));
  });

  it("opens its profiles with a signed request and saves without the password", async () => {
    const cookie = await login(signedPair());
    expect((await api("GET", "/api/config", cookie)).body).toEqual({ registered: true, profiles: [dom] });
    expect((await api("PUT", "/api/config", cookie, { profiles: [waw, dom] })).status).toBe(200);
    expect(storedConfig()).toEqual({ secret: SECRET, profiles: [waw, dom] });
  });

  it("can't pair with a signature from another secret", async () => {
    expect(await signedPair("ff".repeat(16))).toEqual({ status: 401, body: { error: "unauthorized" } });
  });

  it("refuses invalid profiles", async () => {
    const cookie = await login(signedPair());
    expect((await api("PUT", "/api/config", cookie, { profiles: [{ ...dom, lat: 200 }] })).status).toBe(400);
    expect(storedConfig().profiles).toEqual([dom]);
  });

  it("unpairs and clears the cookie", async () => {
    const cookie = await login(signedPair());
    const res = await api("DELETE", "/api/config", cookie);
    expect(res.headers.get("Set-Cookie")).toMatch(/Max-Age=0$/);
    expect(storedConfig()).toBeNull();
    expect((await api("GET", "/api/config", cookie)).status).toBe(401);
  });
});

describe("the wizard API", () => {
  it("needs a session", async () => {
    expect((await api("GET", "/api/config")).status).toBe(401);
    expect((await api("GET", "/api/stations", "__Host-session=" + "0".repeat(64))).status).toBe(401);
  });

  it("keeps responses out of caches and content sniffing", async () => {
    const { headers } = await api("GET", "/api/config", await login());
    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("serves PLK's station list from cache", async () => {
    const plk = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ stations: [{ id: 33605, name: "Warszawa Centralna" }] }));
    const cookie = await login();
    expect((await api("GET", "/api/stations", cookie)).body).toEqual([[33605, "Warszawa Centralna"]]);
    await api("GET", "/api/stations", cookie);
    expect(plk).toHaveBeenCalledTimes(1);
  });
});
