import { canonical } from "../src/auth";
import type { SignedFields } from "../src/types";

export const SECRET = "00112233445566778899aabbccddeeff";
// sha256(SECRET bytes), computed independently.
export const DEVICE = "a8faed6abbf35c12a4b26e40f6feb19d736d90045c83b9f9a31f638d323e6811";

const bytes = (hex: string) => Uint8Array.from(hex.match(/../g)!, (b) => parseInt(b, 16));

export async function signParts(parts: string[], secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts.join("\n")));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const sign = (fields: SignedFields, secret = SECRET) => signParts(canonical(fields), secret);
