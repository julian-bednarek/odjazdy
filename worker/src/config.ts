import type { Profile } from "./types";

const MAX_PROFILES = 8;
const PROFILE_ID = /^[a-z0-9]{1,12}$/;
const MAX_NAME_LENGTH = 40;
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 50_000;
const MAX_FROM = 3;
const MAX_TO = 10;

const inRange = (v: unknown, min: number, max: number): v is number => typeof v === "number" && v >= min && v <= max;
const isStationId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) > 0;

function stationIds(value: unknown, max: number): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) return null;
  return value.every(isStationId) && new Set(value).size === value.length ? value : null;
}

// Rebuilt field by field, so nothing the wizard sends beyond a Profile reaches KV.
function parseProfile(input: unknown): Profile | null {
  if (typeof input !== "object" || input === null) return null;
  const { id, name, lat, lon, r, from, to } = input as Record<string, unknown>;
  const label = typeof name === "string" ? name.trim() : "";
  if (typeof id !== "string" || !PROFILE_ID.test(id) || !label || label.length > MAX_NAME_LENGTH) return null;
  if (!inRange(lat, -90, 90) || !inRange(lon, -180, 180) || !inRange(r, MIN_RADIUS_M, MAX_RADIUS_M) || !Number.isInteger(r)) return null;
  const fromIds = stationIds(from, MAX_FROM);
  const toIds = stationIds(to, MAX_TO);
  return fromIds && toIds ? { id, name: label, lat, lon, r, from: fromIds, to: toIds } : null;
}

export function parseProfiles(input: unknown): Profile[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_PROFILES) return null;
  const profiles = input.map(parseProfile);
  if (!profiles.every((p): p is Profile => p !== null)) return null;
  return new Set(profiles.map((p) => p.id)).size === profiles.length ? profiles : null;
}
