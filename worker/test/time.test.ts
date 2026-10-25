import { describe, expect, it } from "vitest";
import { plkDateTime, plkLocalIso, warsawDate, warsawHour } from "../src/time";

const utc = (iso: string) => Date.parse(iso) / 1000;

describe("plkDateTime", () => {
  it("handles summer time (UTC+2)", () => {
    expect(plkDateTime("2026-07-01", "14:32:00")).toBe(utc("2026-07-01T12:32:00Z"));
  });

  it("handles winter time (UTC+1)", () => {
    expect(plkDateTime("2026-12-01", "14:32:00")).toBe(utc("2026-12-01T13:32:00Z"));
  });

  it("applies the day offset across midnight", () => {
    expect(plkDateTime("2026-12-31", "00:15:00", 1)).toBe(utc("2026-12-31T23:15:00Z"));
  });

  it("parses TimeSpans with a day component", () => {
    expect(plkDateTime("2026-12-01", "1.00:15:00")).toBe(utc("2026-12-01T23:15:00Z"));
  });

  it("picks the earlier instant in the autumn DST overlap", () => {
    // 2026-10-25: clocks go back from 03:00 CEST to 02:00 CET.
    expect(plkDateTime("2026-10-25", "02:30:00")).toBe(utc("2026-10-25T00:30:00Z"));
    expect(plkDateTime("2026-10-25", "03:30:00")).toBe(utc("2026-10-25T02:30:00Z"));
  });

  it("pushes non-existent spring-gap times forward", () => {
    // 2026-03-29: 02:00 CET jumps to 03:00 CEST; 02:30 is shown as 03:30.
    expect(plkDateTime("2026-03-29", "02:30:00")).toBe(utc("2026-03-29T01:30:00Z"));
  });
});

describe("plkLocalIso", () => {
  it("reads offset-less local timestamps", () => {
    expect(plkLocalIso("2026-07-01T14:32:00")).toBe(utc("2026-07-01T12:32:00Z"));
    expect(plkLocalIso("2026-07-01T14:32:00.000")).toBe(utc("2026-07-01T12:32:00Z"));
  });
});

describe("warsawDate / warsawHour", () => {
  it("uses the Warsaw calendar day, not UTC", () => {
    const t = utc("2026-07-01T22:30:00Z"); // 00:30 on 2 July in Warsaw
    expect(warsawDate(t)).toBe("2026-07-02");
    expect(warsawDate(t, -1)).toBe("2026-07-01");
    expect(warsawHour(t)).toBe(0);
  });
});
