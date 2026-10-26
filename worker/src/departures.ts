import { plkDateTime, plkLocalIso } from "./time";
import type { Candidate, PlkOperations, PlkRoute, PlkSchedules, Realtime, Row, TrainRef } from "./types";

const STATUS_CANCELLED = "X";
const DEPARTED_GRACE_S = 60;
const MAX_ROWS = 6;

const rtKey = (t: TrainRef, date: string, station: number) =>
  `${t.scheduleId}:${t.trainOrderId ?? t.orderId}|${date}|${station}`;

function candidate(route: PlkRoute, date: string, from: number[], to: number[], names: PlkSchedules["dictionaries"]): Candidate | null {
  const stops = [...(route.stations ?? [])].sort((a, b) => a.orderNumber - b.orderNumber);
  const i = stops.findIndex((s) => from.includes(s.stationId) && s.departureTime);
  if (i < 0 || !stops.slice(i + 1).some((s) => to.includes(s.stationId))) return null;

  const stop = stops[i];
  const category = stop.departureCommercialCategory ?? route.commercialCategorySymbol ?? route.carrierCode;
  const number = stop.departureTrainNumber ?? route.nationalNumber;
  return {
    rtKey: rtKey(route, date, stop.stationId),
    dep: plkDateTime(date, stop.departureTime!, stop.departureDay ?? 0),
    station: names?.stations?.[stop.stationId]?.name ?? `${stop.stationId}`,
    platform: stop.departurePlatform ?? "",
    label: [category, number].filter(Boolean).join(" "),
  };
}

export function candidatesFromSchedule(resp: PlkSchedules, date: string, from: number[], to: number[]): Candidate[] {
  return (resp.routes ?? [])
    .filter((route) => route.operatingDates?.includes(date))
    .flatMap((route) => candidate(route, date, from, to, resp.dictionaries) ?? []);
}

export function realtimeIndex(resp: PlkOperations, stations: number[]): Record<string, Realtime> {
  const index: Record<string, Realtime> = {};
  for (const train of resp.trains ?? []) {
    for (const stop of train.stations ?? []) {
      if (!stations.includes(stop.stationId)) continue;
      index[rtKey(train, train.operatingDate, stop.stationId)] = {
        delay: stop.departureDelayMinutes ?? 0,
        actual: stop.actualDeparture ?? null,
        cancelled: train.trainStatus === STATUS_CANCELLED || !!stop.isCancelled,
      };
    }
  }
  return index;
}

export function upcoming(rows: Row[], now: number): Row[] {
  return rows.filter(([time]) => time >= now - DEPARTED_GRACE_S);
}

export function buildRows(candidates: Candidate[], realtime: Record<string, Realtime>, now: number): Row[] {
  const rows = candidates.map((c): Row => {
    const rt = realtime[c.rtKey];
    const delay = rt?.delay ?? 0;
    const time = rt?.actual ? plkLocalIso(rt.actual) : c.dep + delay * 60;
    return [time, delay, c.label, c.station, c.platform, rt?.cancelled ?? false];
  });
  return upcoming(rows, now)
    .sort((a, b) => a[0] - b[0])
    .slice(0, MAX_ROWS);
}
