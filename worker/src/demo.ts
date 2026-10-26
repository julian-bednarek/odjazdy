import { upcoming } from "./departures";
import type { Profile, Row } from "./types";

const INTERVAL_S = 15 * 60;
const MINUTE_PAST_SLOT = 7;
const DELAY_MIN = 5;
const DELAYED_EVERY = 3;
const CANCELLED_EVERY = 7;
const PLATFORMS = 4;
const FIRST_TRAIN_NUMBER = 19000;
const TRAIN_NUMBERS = 1000;
const COUNT = 6;

// Fake departures served until PLK_API_KEY is set.
export function demoRows(profile: Profile, now: number): Row[] {
  const first = Math.floor(now / INTERVAL_S);
  const rows = Array.from({ length: COUNT }, (_, i): Row => {
    const n = first + i;
    const delay = n % DELAYED_EVERY === 0 ? DELAY_MIN : 0;
    const time = n * INTERVAL_S + (MINUTE_PAST_SLOT + delay) * 60;
    return [time, delay, `KM ${FIRST_TRAIN_NUMBER + (n % TRAIN_NUMBERS)}`, profile.name, `${(n % PLATFORMS) + 1}`, n % CANCELLED_EVERY === 0];
  });
  return upcoming(rows, now);
}
