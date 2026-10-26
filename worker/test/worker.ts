import worker from "../src/index";
import type { Env } from "../src/types";

export const BASE = "https://worker.test";
export const kv = new Map<string, string>();

const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

const env = (vars: Partial<Env>) =>
  ({
    ...vars,
    TS_KV: {
      get: async (key: string, type?: string) => {
        const value = kv.get(key) ?? null;
        return value !== null && type === "json" ? JSON.parse(value) : value;
      },
      put: async (key: string, value: string) => void kv.set(key, value),
      delete: async (key: string) => void kv.delete(key),
    },
  }) as unknown as Env;

export async function fetchWorker(req: Request, vars: Partial<Env> = {}): Promise<Response> {
  return worker.fetch(req as Request<unknown, IncomingRequestCfProperties>, env(vars), ctx);
}
