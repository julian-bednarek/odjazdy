import { describe, expect, it } from "vitest";
import { distanceM, pickProfile } from "../src/profiles";
import type { DeviceConfig, Profile } from "../src/types";

const profile = (id: string, lat: number, lon: number, r: number): Profile => ({
  id,
  name: id,
  lat,
  lon,
  r,
  from: [1],
  to: [2],
});

// "dom" sits inside the much larger "waw" zone.
const cfg: DeviceConfig = {
  secret: "",
  profiles: [profile("waw", 52.2297, 21.0122, 15000), profile("dom", 52.2395, 21.0458, 1000), profile("lodz", 51.7592, 19.456, 10000)],
};
const atHome = { lat: 52.24, lon: 21.045 };
const inCentre = { lat: 52.2297, lon: 21.0122 };
const inKrakow = { lat: 50.0647, lon: 19.945 };

describe("distanceM", () => {
  it("is roughly right for Warsaw–Łódź", () => {
    const d = distanceM({ lat: 52.2297, lon: 21.0122 }, { lat: 51.7592, lon: 19.456 });
    expect(d).toBeGreaterThan(115_000);
    expect(d).toBeLessThan(125_000);
  });
});

describe("pickProfile", () => {
  it("prefers the smallest zone containing the location", () => {
    expect(pickProfile(cfg, atHome, null, null)).toMatchObject({ profile: { id: "dom" }, matched: true });
    expect(pickProfile(cfg, inCentre, null, null)).toMatchObject({ profile: { id: "waw" }, matched: true });
  });

  it("honours a forced profile and reports whether it matches", () => {
    expect(pickProfile(cfg, atHome, "waw", null)).toMatchObject({ profile: { id: "waw" }, matched: true });
    expect(pickProfile(cfg, atHome, "lodz", null)).toMatchObject({ profile: { id: "lodz" }, matched: false });
    expect(pickProfile(cfg, null, "lodz", null)).toMatchObject({ profile: { id: "lodz" }, matched: false });
  });

  it("falls back to the last profile outside every zone or without location", () => {
    expect(pickProfile(cfg, inKrakow, null, "lodz")).toMatchObject({ profile: { id: "lodz" }, matched: false });
    expect(pickProfile(cfg, null, null, "dom")).toMatchObject({ profile: { id: "dom" }, matched: false });
  });

  it("falls back to the first profile when last is unknown", () => {
    expect(pickProfile(cfg, inKrakow, null, "gone")).toMatchObject({ profile: { id: "waw" }, matched: false });
    expect(pickProfile(cfg, null, "gone", null)).toMatchObject({ profile: { id: "waw" }, matched: false });
  });

  it("returns null without profiles", () => {
    expect(pickProfile({ secret: "", profiles: [] }, atHome, null, null)).toBeNull();
  });
});
