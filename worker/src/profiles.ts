import type { DeviceConfig, Profile } from "./types";

type Point = { lat: number; lon: number };

export function distanceM(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function pickProfile(
  { profiles }: DeviceConfig,
  loc: Point | null,
  forcedId: string | null,
  lastId: string | null,
): { profile: Profile; matched: boolean } | null {
  if (profiles.length === 0) return null;
  const byId = (id: string | null) => profiles.find((p) => p.id === id);
  const inside = loc ? profiles.filter((p) => distanceM(loc, p) <= p.r).sort((a, b) => a.r - b.r) : [];

  const forced = byId(forcedId);
  if (forced) return { profile: forced, matched: inside.includes(forced) };
  if (inside.length > 0) return { profile: inside[0], matched: true };
  return { profile: byId(lastId) ?? profiles[0], matched: false };
}
