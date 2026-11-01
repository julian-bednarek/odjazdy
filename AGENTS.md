# AGENTS.md

Odjazdy: a Garmin Forerunner 165 glance and widget (`watch/`, Monkey C) that asks a Cloudflare Worker (`worker/`, TypeScript + KV) for the next direct trains from PKP PLK. The worker also serves the phone setup wizard (`worker/public/`, vanilla JS modules). Read [README.md](README.md) for the architecture and the worker API, [SETUP.md](SETUP.md) for deploys and builds, and [SECURITY.md](SECURITY.md) before you touch pairing, sessions or secrets.

The owner writes in Polish, so reply in Polish. Code, comments and docs are in English.

## Checks

- Worker: `cd worker && npm test && npm run typecheck`. `wrangler` needs Node ≥ 22.
- Watch: `watch/ciq.sh` builds `watch/bin/odjazdy.prg` with strict type checking (`-l 3`). It calls the Windows SDK and Java through WSL interop, so a Linux sandbox blocks it. Run it without the sandbox. The owner runs the simulator (`ciq.sh run`) and the real watch themselves.
- `wrangler dev` inside a sandbox: set `XDG_CONFIG_HOME=$TMPDIR/xdg`, pass `--persist-to $TMPDIR/wrangler`, and start the server and `curl --noproxy '*' localhost:8787` in the same command. Calls to PLK fail there, so check that path with demo data (leave `PLK_API_KEY` empty).
- `worker/wrangler.jsonc` is marked `skip-worktree` to keep the KV id out of git. Your edits to it never show up in `git diff`, so tell the owner about them.

## Watch ↔ worker contract

The two sides share field names with no shared code. A change on one side needs the same change on the other, plus the README API section:

- the signed request fields and their order: `Api.request` in `watch/source/Api.mc` ↔ `canonical` in `worker/src/auth.ts`;
- the response fields: the constants in `Api.mc` and the `Row` enum in `Board.mc` ↔ `WatchResponse` and `Row` in `worker/src/types.ts`.

The worker picks the profile (`worker/src/profiles.ts`: the smallest zone that contains the point wins; otherwise the last profile). The watch only sends a point and an optional manual profile.

## Monkey C

- Code used by the glance or the background service needs the `(:glance)` or `(:background)` annotation. That code runs in a separate, memory-capped process.
- The background service can't write `Storage`. Its result goes to `Background.exit` and is saved in `TrainApp.onBackgroundData`.
- The glance and the background have no GPS. `watch/source/Loc.mc` uses only positions the watch already has.
- The layout targets the 390×390 FR165 screen. The watch font has no "→".
- Watch strings: `watch/resources/strings/strings.xml` (English base) and `watch/resources-pol/`. Add every new string to both.

## Wizard

- i18n: `worker/public/i18n/<code>.js`, with English as the base. Adding a language means adding one file and nothing else. `worker/test/i18n.test.ts` checks key and placeholder parity.
- `worker/public/vendor/` is vendored and pinned by SRI hashes. Keep it byte-identical.

## Rules

- Lean code: short functions, no duplication, comments only for a non-obvious "why". Derive values; avoid hand-written lookup tables.
- Coordinates in tests, examples and docs are public landmarks (Stadion Narodowy: 52.2395, 21.0458), never anything that could be someone's home.
- Session tokens live only in the `__Host-session` HttpOnly cookie.
- `GET /open` must accept `Sec-Fetch-Site: cross-site`, because Garmin Connect opens the pairing link that way (pinned by a test). Never add a Sec-Fetch-Site check there.
- Keep the PLK data attribution (the `Attribution` string) wherever PLK data is shown. The PLK terms require it.
- Local config stays out of the repo. The PLK key and `SETUP_PASSWORD` go in worker secrets or `worker/.dev.vars`, and the worker URL goes in `watch/.env`.
