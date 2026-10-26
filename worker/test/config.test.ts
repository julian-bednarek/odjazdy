import { describe, expect, it } from "vitest";
import { parseProfiles } from "../src/config";
import type { Profile } from "../src/types";

const dom: Profile = { id: "dom", name: "Dom - Centralna", lat: 52.2395, lon: 21.0458, r: 1500, from: [1, 2], to: [3] };

describe("parseProfiles", () => {
  it("keeps a valid profile and only its known fields", () => {
    expect(parseProfiles([{ ...dom, name: "  Dom - Centralna ", secret: "x" }])).toEqual([dom]);
  });

  it.each([
    ["no profiles", []],
    ["too many profiles", Array.from({ length: 9 }, (_, i) => ({ ...dom, id: `p${i}` }))],
    ["duplicate ids", [dom, { ...dom }]],
    ["an id with odd characters", [{ ...dom, id: "Dom!" }]],
    ["an empty name", [{ ...dom, name: "  " }]],
    ["latitude out of range", [{ ...dom, lat: 91 }]],
    ["a fractional radius", [{ ...dom, r: 1500.5 }]],
    ["a tiny radius", [{ ...dom, r: 50 }]],
    ["four origin stations", [{ ...dom, from: [1, 2, 3, 4] }]],
    ["no destination", [{ ...dom, to: [] }]],
    ["a repeated station", [{ ...dom, from: [1, 1] }]],
    ["a non-numeric station", [{ ...dom, to: ["3"] }]],
    ["not an array", { profiles: [dom] }],
  ])("rejects %s", (_, input) => {
    expect(parseProfiles(input)).toBeNull();
  });
});
