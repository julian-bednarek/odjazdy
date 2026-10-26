import type { SignedFields } from "./types";

const MAX_CLOCK_SKEW_S = 300;

const encoder = new TextEncoder();
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16));
const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (data: Uint8Array) => toHex(await crypto.subtle.digest("SHA-256", data));

// The watch sends its secret only once, when it pairs. Afterwards the worker knows it
// by the secret's hash, and the watch proves possession with an HMAC over the request fields.
export function deviceId(secretHex: string): Promise<string> {
  return sha256(fromHex(secretHex));
}

export function canonical({ timestamp, lat, lon, profile }: SignedFields): string[] {
  return [timestamp, lat, lon, profile];
}

// parts[0] is the timestamp the watch signed.
export async function verify(secretHex: string, parts: string[], signatureHex: string, now: number): Promise<boolean> {
  const sent = Number(parts[0]);
  if (!Number.isSafeInteger(sent) || Math.abs(now - sent) > MAX_CLOCK_SKEW_S) return false;
  const key = await crypto.subtle.importKey("raw", fromHex(secretHex), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, fromHex(signatureHex), encoder.encode(parts.join("\n")));
}

export function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

// Comparing digests makes the comparison time independent of the password.
export async function samePassword(given: string, expected: string): Promise<boolean> {
  return (await sha256(encoder.encode(given))) === (await sha256(encoder.encode(expected)));
}
