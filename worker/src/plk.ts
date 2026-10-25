import { cached } from "./cache";
import { candidatesFromSchedule, realtimeIndex } from "./departures";
import type { Candidate, Env, PlkOperations, PlkSchedules, Profile, Realtime } from "./types";

const BASE = "https://pdp-api.plk-sa.pl/api/v1";
const SCHEDULE_TTL_S = 36 * 3600;
const REALTIME_TTL_S = 90;
const REALTIME_PAGE_SIZE = 2000;

async function plkGet<T>(env: Env, path: string, params: Record<string, string>): Promise<T> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { "X-API-Key": env.PLK_API_KEY ?? "" } });
  if (!res.ok) throw new Error(`PLK ${path}: HTTP ${res.status}`);
  return res.json<T>();
}

export function getCandidates(env: Env, { from, to }: Profile, date: string): Promise<Candidate[]> {
  return cached(env.TS_KV, `schedules/${from}/${to}/${date}`, SCHEDULE_TTL_S, async () => {
    const params = { fromStations: `${from}`, toStations: `${to}`, dateFrom: date, dateTo: date };
    return candidatesFromSchedule(await plkGet<PlkSchedules>(env, "/schedules", params), date, from, to);
  });
}

export function getRealtime(env: Env, stations: number[]): Promise<Record<string, Realtime>> {
  return cached(env.TS_KV, `operations/${stations}`, REALTIME_TTL_S, async () => {
    const params = { stations: `${stations}`, withPlanned: "true", pageSize: `${REALTIME_PAGE_SIZE}` };
    return realtimeIndex(await plkGet<PlkOperations>(env, "/operations", params), stations);
  });
}
