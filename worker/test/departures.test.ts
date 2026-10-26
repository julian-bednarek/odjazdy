import { describe, expect, it } from "vitest";
import { buildRows, candidatesFromSchedule, realtimeIndex } from "../src/departures";
import { demoRows } from "../src/demo";
import { plkDateTime } from "../src/time";
import type { PlkOperations, PlkSchedules, Profile, WatchResponse } from "../src/types";

// Synthetic, shaped after the PLK swagger; swap for recorded responses once the key arrives.
const [WWA_C, WWA_Z, LODZ, SKIER] = [100, 101, 200, 300];
const DATE = "2026-12-01";
const FROM = [WWA_C, WWA_Z];
const TO = [LODZ];
const at = (time: string) => plkDateTime(DATE, time);

const schedules: PlkSchedules = {
  routes: [
    {
      scheduleId: 26,
      orderId: 1,
      commercialCategorySymbol: "IC",
      nationalNumber: "5112",
      operatingDates: [DATE],
      stations: [
        { stationId: WWA_Z, orderNumber: 2, departureTime: "14:40:00", departurePlatform: "II" },
        { stationId: WWA_C, orderNumber: 1, departureTime: "14:32:00", departurePlatform: "IV" },
        { stationId: LODZ, orderNumber: 3 },
      ],
    },
    {
      scheduleId: 26,
      orderId: 2,
      trainOrderId: 7,
      carrierCode: "ŁKA",
      operatingDates: [DATE],
      stations: [
        { stationId: WWA_Z, orderNumber: 1, departureTime: "15:05:00", departureCommercialCategory: "ŁS", departureTrainNumber: "9148" },
        { stationId: LODZ, orderNumber: 2 },
      ],
    },
    {
      scheduleId: 26,
      orderId: 3,
      nationalNumber: "5122",
      operatingDates: ["2026-12-02"],
      stations: [
        { stationId: WWA_C, orderNumber: 1, departureTime: "15:00:00" },
        { stationId: LODZ, orderNumber: 2 },
      ],
    },
    {
      scheduleId: 26,
      orderId: 4,
      nationalNumber: "1521",
      operatingDates: [DATE],
      stations: [
        { stationId: LODZ, orderNumber: 1, departureTime: "13:00:00" },
        { stationId: WWA_C, orderNumber: 2, departureTime: "14:10:00" },
        { stationId: SKIER, orderNumber: 3 },
      ],
    },
    {
      scheduleId: 26,
      orderId: 5,
      commercialCategorySymbol: "R",
      nationalNumber: "19999",
      operatingDates: [DATE],
      stations: [
        { stationId: WWA_C, orderNumber: 1, departureTime: "00:20:00", departureDay: 1 },
        { stationId: LODZ, orderNumber: 2 },
      ],
    },
  ],
  dictionaries: {
    stations: { [WWA_C]: { name: "Warszawa Centralna" }, [WWA_Z]: { name: "Warszawa Zachodnia" } },
  },
};

const operations: PlkOperations = {
  trains: [
    { scheduleId: 26, orderId: 1, trainOrderId: 1, operatingDate: DATE, stations: [{ stationId: WWA_C, departureDelayMinutes: 5 }] },
    { scheduleId: 26, orderId: 2, trainOrderId: 8, operatingDate: DATE, trainStatus: "X", stations: [{ stationId: WWA_Z }] },
    { scheduleId: 26, orderId: 2, trainOrderId: 7, operatingDate: DATE, stations: [{ stationId: WWA_Z, departureDelayMinutes: 12 }] },
  ],
};

const candidates = candidatesFromSchedule(schedules, DATE, FROM, TO);
const realtime = realtimeIndex(operations, FROM);

describe("candidatesFromSchedule", () => {
  it("keeps routes running on the date towards the destination", () => {
    expect(candidates.map((c) => c.label)).toEqual(["IC 5112", "ŁS 9148", "R 19999"]);
  });

  it("departs from the first origin station on the route", () => {
    expect(candidates[0]).toMatchObject({ station: "Warszawa Centralna", platform: "IV", dep: at("14:32:00") });
  });

  it("applies the departure day offset", () => {
    expect(candidates[2].dep).toBe(plkDateTime("2026-12-02", "00:20:00"));
  });
});

describe("buildRows", () => {
  it("applies delays, matching trains by trainOrderId", () => {
    expect(buildRows(candidates, realtime, at("14:00:00")).slice(0, 2)).toEqual([
      [at("14:37:00"), 5, "IC 5112", "Warszawa Centralna", "IV", false],
      [at("15:17:00"), 12, "ŁS 9148", "Warszawa Zachodnia", "", false],
    ]);
  });

  it("drops trains that left over a minute ago, by expected time", () => {
    expect(buildRows(candidates, realtime, at("14:37:30"))[0][2]).toBe("IC 5112");
    expect(buildRows(candidates, realtime, at("14:38:30"))[0][2]).toBe("ŁS 9148");
  });

  it("flags cancelled trains", () => {
    const cancelled = realtimeIndex(
      { trains: [{ scheduleId: 26, orderId: 1, operatingDate: DATE, trainStatus: "X", stations: [{ stationId: WWA_C }] }] },
      FROM,
    );
    expect(buildRows(candidates, cancelled, at("14:00:00"))[0][5]).toBe(true);
  });

  it("uses the planned time without realtime data", () => {
    expect(buildRows(candidates, {}, at("14:00:00"))[0][0]).toBe(at("14:32:00"));
  });

  it("prefers the actual departure reported by PLK", () => {
    const actual = realtimeIndex(
      { trains: [{ scheduleId: 26, orderId: 1, operatingDate: DATE, stations: [{ stationId: WWA_C, departureDelayMinutes: 5, actualDeparture: `${DATE}T14:39:00` }] }] },
      FROM,
    );
    expect(buildRows(candidates, actual, at("14:00:00"))[0][0]).toBe(at("14:39:00"));
  });
});

describe("demoRows", () => {
  const profile: Profile = { id: "waw", name: "Warszawa→Łódź", lat: 0, lon: 0, r: 1, from: [], to: [] };

  it("returns upcoming departures in order", () => {
    const now = at("14:00:00");
    const rows = demoRows(profile, now);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(([time]) => time >= now - 60)).toBe(true);
    expect(rows.map(([time]) => time)).toEqual(rows.map(([time]) => time).sort((a, b) => a - b));
  });

  it("keeps the watch payload under 1 KB", () => {
    const body: WatchResponse = {
      time: at("14:00:00"),
      profile: "waw",
      name: profile.name,
      matched: true,
      stale: false,
      profiles: ["dom", "waw", "lodz"],
      departures: demoRows(profile, at("14:00:00")),
    };
    expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeLessThan(1024);
  });
});
