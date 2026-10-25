import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { DeviceConfig, Env, SignedFields } from "../src/types";
import { DEVICE, SECRET, sign } from "./signing";

const URL = "https://worker.test/v1/departures";
const config: DeviceConfig = {
  secret: SECRET,
  profiles: [{ id: "dom", name: "Dom→Centralna", lat: 52.2395, lon: 21.0458, r: 1500, from: [1], to: [2] }],
};

const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;
let kv: Map<string, string>;
const env = (vars: Partial<Env>) =>
  ({
    ...vars,
    TS_KV: {
      get: async (key: string, type?: string) => {
        const value = kv.get(key) ?? null;
        return value !== null && type === "json" ? JSON.parse(value) : value;
      },
      put: async (key: string, value: string) => void kv.set(key, value),
    },
  }) as unknown as Env;

async function request(fields: Partial<SignedFields> = {}, signWith = SECRET, method = "POST") {
  const body: SignedFields = { timestamp: `${Math.floor(Date.now() / 1000)}`, lat: "52.240", lon: "21.046", profile: "", ...fields };
  const signature = await sign(body, signWith);
  return new Request(URL, {
    method,
    headers: { "X-Device": DEVICE, "X-Signature": signature },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

const call = async (req: Request | Promise<Request>, vars: Partial<Env> = {}) => {
  const res = await worker.fetch((await req) as Request<unknown, IncomingRequestCfProperties>, env(vars), ctx);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

beforeEach(() => {
  kv = new Map([[`cfg:${DEVICE}`, JSON.stringify(config)]]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /v1/departures", () => {
  it("answers a correctly signed request", async () => {
    const { status, body } = await call(request());
    expect(status).toBe(200);
    expect(body).toMatchObject({ profile: "dom", matched: true, stale: false, profiles: ["dom"] });
  });

  it("serves the last rows, marked stale, when PLK is down", async () => {
    const rows = [[Math.floor(Date.now() / 1000) + 600, 0, "KM 1", "Start", "1", false]];
    kv.set(`cache:rows/${DEVICE}/dom`, JSON.stringify(rows));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { body } = await call(request(), { PLK_API_KEY: "key" });
    expect(body).toMatchObject({ stale: true, departures: rows });
  });

  it("rejects a request signed with another secret", async () => {
    expect(await call(request({}, "ff".repeat(16)))).toEqual({ status: 401, body: { error: "unauthorized" } });
  });

  it("rejects a replayed request", async () => {
    const stale = `${Math.floor(Date.now() / 1000) - 600}`;
    expect((await call(request({ timestamp: stale }))).status).toBe(401);
  });

  it("does not reveal anything for unknown devices", async () => {
    kv.clear();
    expect(await call(request())).toEqual({ status: 200, body: { error: "no_config" } });
  });

  it("rejects malformed requests", async () => {
    const req = new Request(URL, { method: "POST", body: "{}" });
    expect((await call(req)).status).toBe(400);
  });

  it("only serves POST", async () => {
    expect((await call(request({}, SECRET, "GET"))).status).toBe(404);
  });
});
