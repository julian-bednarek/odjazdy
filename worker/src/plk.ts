import { cached } from "./cache";
import { candidatesFromSchedule, realtimeIndex } from "./departures";
import type { Candidate, Env, PlkOperations, PlkSchedules, PlkStations, Profile, Realtime, Station } from "./types";

const BASE = "https://pdp-api.plk-sa.pl/api/v1";
const SCHEDULE_TTL_S = 36 * 3600;
const REALTIME_TTL_S = 90;
// PLK's maximum: operations span several days, so smaller pages drop today's trains.
const REALTIME_PAGE_SIZE = 5000;
const STATIONS_TTL_S = 24 * 3600;
// PLK's maximum, more than there are stations: the wizard searches the whole list locally.
const STATIONS_PAGE_SIZE = 10000;

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

export function getStations(env: Env): Promise<Station[]> {
  return cached(env.TS_KV, "stations", STATIONS_TTL_S, async () => {
    const { stations } = await plkGet<PlkStations>(env, "/dictionaries/stations", { pageSize: `${STATIONS_PAGE_SIZE}` });
    return (stations ?? []).map(({ id, name }): Station => [id, name ?? `${id}`]);
  });
}
