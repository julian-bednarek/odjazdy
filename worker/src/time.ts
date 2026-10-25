const fmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const CEST_MS = 2 * 3_600_000;
const CET_MS = 3_600_000;

function wallClock(ms: number): number[] {
  const p = Object.fromEntries(fmt.formatToParts(ms).map(({ type, value }) => [type, Number(value)]));
  return [p.year, p.month, p.day, p.hour, p.minute, p.second];
}

function offsetMs(ms: number): number {
  const [y, mo, d, h, mi, s] = wallClock(ms);
  return Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(ms / 1000) * 1000;
}

// Prefers CEST, so the earlier instant wins in the autumn overlap; times in
// the spring gap fall through to CET and end up an hour later.
function fromWallClock(naiveMs: number): number {
  const off = [CEST_MS, CET_MS].find((o) => offsetMs(naiveMs - o) === o) ?? CET_MS;
  return (naiveMs - off) / 1000;
}

// PLK times are Warsaw wall clock; `time` is a .NET TimeSpan ("14:32:00", "1.00:15:00").
export function plkDateTime(date: string, time: string, dayOffset = 0): number {
  const [, days, h, mi, s] = /^(?:(\d+)\.)?(\d+):(\d+)(?::(\d+))?/.exec(time)!;
  const [y, mo, d] = date.split("-").map(Number);
  return fromWallClock(Date.UTC(y, mo - 1, d + dayOffset + Number(days ?? 0), +h, +mi, Number(s ?? 0)));
}

export function plkLocalIso(iso: string): number {
  const [date, time] = iso.split("T");
  return plkDateTime(date, time);
}

export function warsawDate(epochS: number, addDays = 0): string {
  const [y, mo, d] = wallClock(epochS * 1000);
  return new Date(Date.UTC(y, mo - 1, d + addDays)).toISOString().slice(0, 10);
}

export function warsawHour(epochS: number): number {
  return wallClock(epochS * 1000)[3];
}
