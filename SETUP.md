# Setup

1. **PLK key:** apply at <https://pdp-api.plk-sa.pl/>; approval takes 3–5 working days. Until then the worker serves demo data.
2. **Worker (WSL, needs Node ≥ 22 – wrangler does not run on Node 20):**
   ```sh
   cd worker
   npm install
   npm test
   npx wrangler login
   npx wrangler deploy                      # the first deploy also creates the KV namespace
   npx wrangler secret put PLK_API_KEY      # once the key arrives
   npx wrangler secret put SETUP_PASSWORD   # password for pairing new watches
   ```
   Generate `SETUP_PASSWORD` in a password manager (20+ random characters). Without it, or with a shorter one, the worker won't pair a new watch. Locally (`wrangler dev`) both secrets go in `worker/.dev.vars` (template: `.dev.vars.example`).
   The deploy writes the KV id into `wrangler.jsonc`. Keep it or discard it (`git checkout wrangler.jsonc`); later deploys find the namespace by its binding.
3. **Watch:** SDK and simulator on Windows (SDK Manager + the fr165 device), built from WSL with the Windows Java:
   ```sh
   watch/ciq.sh        # build → watch/bin/odjazdy.prg
   watch/ciq.sh run    # build + run in the simulator
   ```
   Developer key: `~/.config/garmin/developer_key.der` (or `CIQ_KEY=...`). Worker address: `cp watch/.env.example watch/.env` and set `WORKER_URL` to the bare origin, without a path (`https://train-status.<subdomain>.workers.dev`). `ciq.sh` compiles it into the build; `watch/.env` is in `.gitignore`.
4. **Onto the watch:** copy `watch/bin/odjazdy.prg` over USB to `GARMIN/APPS`.
5. **Pairing and profiles:** open the app and press START ("set up on phone"). Garmin Connect shows a notification on the phone; tapping it opens the wizard. Set the zones on the map, pick the stations to leave from and go to, and save with `SETUP_PASSWORD`. The watch picks up the profiles within a minute. To edit them later, hold UP on the watch; no password needed.

See [SECURITY.md](SECURITY.md) before exposing the worker: what is secret, and how to revoke a watch.
