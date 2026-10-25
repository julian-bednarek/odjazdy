import { describe, expect, it } from "vitest";
import { deviceId, verify } from "../src/auth";
import type { SignedFields } from "../src/types";
import { DEVICE, SECRET, sign } from "./signing";

const NOW = 1_800_000_000;
const fields: SignedFields = { timestamp: `${NOW}`, lat: "52.240", lon: "21.046", profile: "" };

describe("deviceId", () => {
  it("is the SHA-256 of the secret bytes", async () => {
    expect(await deviceId(SECRET)).toBe(DEVICE);
  });
});

describe("verify", () => {
  it("accepts a valid signature", async () => {
    expect(await verify(SECRET, fields, await sign(fields), NOW)).toBe(true);
  });

  it("rejects tampered fields", async () => {
    expect(await verify(SECRET, { ...fields, lat: "52.241" }, await sign(fields), NOW)).toBe(false);
  });

  it("rejects a signature made with another secret", async () => {
    expect(await verify(SECRET, fields, await sign(fields, "ff".repeat(16)), NOW)).toBe(false);
  });

  it("rejects requests outside the clock-skew window", async () => {
    const signature = await sign(fields);
    expect(await verify(SECRET, fields, signature, NOW + 301)).toBe(false);
    expect(await verify(SECRET, fields, signature, NOW - 301)).toBe(false);
  });

  it("rejects a non-numeric timestamp even when signed", async () => {
    const odd = { ...fields, timestamp: "x" };
    expect(await verify(SECRET, odd, await sign(odd), NOW)).toBe(false);
  });
});
