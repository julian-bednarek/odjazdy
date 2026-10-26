# Odjazdy

*Odjazdy* is Polish for "Departures": a glance and widget for the Garmin Forerunner 165
that shows when the next direct train leaves, and how soon, with live delays, for a
route picked by where you are.

```
watch ──(Garmin Connect, makeWebRequest)──▶ Cloudflare Worker ──▶ PKP PLK Open Data API
                                             └ KV: profile config
```

- `worker/` – Cloudflare Worker (TypeScript): picks the profile by location, merges the PLK timetable with realtime data, sends the watch ~1 KB of JSON. `worker/public/` holds the phone wizard (zone map + station search).
- `watch/` – Connect IQ app (Monkey C): glance, detail view, background refresh every 30 min.

Watch languages: English (base) and Polish, chosen by the watch settings; strings in `watch/resources*/strings/strings.xml`.

Wizard languages: English (base) and Polish, chosen by the browser language (`/setup?lang=en` forces one); strings in `worker/public/i18n/`. A new language is just a new file, `i18n/<code>.js` (e.g. `de.js`), loaded on demand; nothing else needs registering. `worker/test/i18n.test.ts` finds every file there and checks that it has every key and the same `{…}` placeholders as English.

- [SETUP.md](SETUP.md) – deploying the worker, building the watch app, pairing.
- [SECURITY.md](SECURITY.md) – what is secret, how pairing is protected, revoking a watch.

Code: MIT licence ([LICENSE](LICENSE)). Exception: Leaflet 1.9.4 in `worker/public/vendor/leaflet/` (BSD-2-Clause, [LICENSE](worker/public/vendor/leaflet/LICENSE)), kept locally so the wizard loads no scripts from a CDN. Data: PKP Polskie Linie Kolejowe S.A., under the PLK Open Data terms.

## Worker API

Watch:

`POST /v1/departures` with headers `X-Device: sha256(secret)` and `X-Signature: HMAC-SHA256(secret, "timestamp\nlat\nlon\nprofile")`:

```json
{"timestamp":"1761400000","lat":"52.240","lon":"21.046","profile":""}
```

Only the watch and KV know the secret; the signature covers the location and the profile, and requests more than 5 min old are rejected. Response:

```json
{"time":1761400000,"profile":"home","name":"Home - Centralna","matched":true,"stale":false,
 "profiles":["home","waw"],
 "departures":[[1761400420,5,"KM 1234","Warszawa Centralna","3",false]]}
```

A `departures` row is [expected departure (epoch s), delay (min), train, departure station, platform, cancelled]. `matched`: the profile fits the location; `stale`: PLK is not answering, so the rows come from the last good response. Errors: `{"error":"no_config" | "unauthorized" | "bad_request" | "upstream"}`.

`POST /v1/pair` returns `{"code"}`, a one-time wizard code valid for 10 min. An unpaired watch sends `{"secret":"<hex>"}`, the only time the secret leaves the watch. A paired one sends `{"timestamp"}` with the same headers as above, signed as `HMAC(secret, "timestamp\npair")`.

Phone:

- `GET /open?c=<code>` uses up the code, sets the `__Host-session` cookie (`HttpOnly; Secure; SameSite=Strict`, 30 min) and redirects to `/setup`.
- `GET /setup` is the wizard (static files from `worker/public/`).
- `GET /api/config` returns `{"registered","profiles"}`. `PUT /api/config` takes `{"profiles","password"?}`; the password is required only for a new watch. `DELETE /api/config` unpairs the watch.
- `GET /api/stations` returns the PLK station dictionary `[[id, name], ...]`, cached for a day.

Every `/api/*` call needs the session cookie. Errors: `unauthorized` (no session), `password` (wrong password; the session ends after 5 tries), `closed` (`SETUP_PASSWORD` missing or shorter than 20 characters), `bad_request` (invalid profile list).
