import type { SignedFields } from "./types";

const MAX_CLOCK_SKEW_S = 300;

const encoder = new TextEncoder();
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16));
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// The watch never sends its secret: it is identified by the secret's hash
// and proves possession with an HMAC over the request fields.
export async function deviceId(secretHex: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", fromHex(secretHex)));
}

export function canonical({ timestamp, lat, lon, profile }: SignedFields): string {
  return [timestamp, lat, lon, profile].join("\n");
}

export async function verify(secretHex: string, fields: SignedFields, signatureHex: string, now: number): Promise<boolean> {
  const sent = Number(fields.timestamp);
  if (!Number.isSafeInteger(sent) || Math.abs(now - sent) > MAX_CLOCK_SKEW_S) return false;
  const key = await crypto.subtle.importKey("raw", fromHex(secretHex), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, fromHex(signatureHex), encoder.encode(canonical(fields)));
}
