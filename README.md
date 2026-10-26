# Train Status

Glance i widget na Garmin Forerunner 165 pokazujący, o której i za ile odjeżdża
najbliższy bezpośredni pociąg (z opóźnieniem na żywo) dla relacji dobranej do
miejsca, w którym jesteś.

```
zegarek ──(Garmin Connect, makeWebRequest)──▶ Cloudflare Worker ──▶ PKP PLK Open Data API
                                               └ KV: konfiguracja profili
```

- `worker/` – Cloudflare Worker (TypeScript): wybór profilu po lokalizacji, rozkład + realtime z PLK, ~1 KB JSON dla zegarka.
- `watch/` – aplikacja Connect IQ (Monkey C): glance, widok szczegółów, odświeżanie w tle co 30 min.

Języki zegarka: angielski (bazowy) i polski – wybierane według ustawień zegarka, teksty w `watch/resources*/strings/strings.xml`.

Kod: licencja MIT ([LICENSE](LICENSE)). Dane: PKP Polskie Linie Kolejowe S.A., na warunkach PLK Open Data.

## Setup

1. **Klucz PLK:** formularz na <https://pdp-api.plk-sa.pl/>, akceptacja trwa 3–5 dni roboczych. Do tego czasu Worker zwraca dane demo.
2. **Worker (WSL, wymaga Node ≥ 22 – wrangler nie działa na Node 20):**
   ```sh
   cd worker
   npm install
   npm test
   npx wrangler login
   npx wrangler deploy                      # za pierwszym razem tworzy też KV
   npx wrangler secret put PLK_API_KEY      # gdy przyjdzie klucz
   ```
   Deploy dopisuje id KV do `wrangler.jsonc`. Można je zostawić albo odrzucić (`git checkout wrangler.jsonc`) – kolejne deploye i `npm run register` znajdą KV po bindingu.
3. **Zegarek:** SDK i symulator na Windowsie (SDK Manager + urządzenie fr165), build z WSL Windowsową Javą:
   ```sh
   watch/ciq.sh        # build → watch/bin/train-status.prg
   watch/ciq.sh run    # build + uruchomienie w symulatorze
   ```
   Klucz deweloperski: `~/.config/garmin/developer_key.der` (albo `CIQ_KEY=...`). Adres Workera: `cp watch/.env.example watch/.env` i ustaw `WORKER_URL` – `ciq.sh` wkompilowuje go w build (`watch/.env` jest w `.gitignore`).
4. **Rejestracja zegarka:** otwórz apkę – dopóki Worker jej nie zna, widok szczegółów pokazuje *kod konfiguracji* (losowy sekret zegarka). Skopiuj `worker/config.example.json` do `worker/config.json` (gitignored – są tam współrzędne domu), uzupełnij profile i ID stacji:
   ```sh
   curl -H "X-API-Key: $PLK_API_KEY" "https://pdp-api.plk-sa.pl/api/v1/dictionaries/stations?search=Warszawa%20Centralna"
   cd worker && npm run register -- "<kod z zegarka>"
   ```
5. **Na zegarek:** skopiuj `watch/bin/train-status.prg` przez USB do `GARMIN/APPS`.

## API Workera

`POST /v1/departures` z nagłówkami `X-Device: sha256(sekret)` i `X-Signature: HMAC-SHA256(sekret, "timestamp\nlat\nlon\nprofile")`:

```json
{"timestamp":"1761400000","lat":"52.240","lon":"21.046","profile":""}
```

Sekret zna tylko zegarek i KV; podpis obejmuje lokalizację i profil, a zapytania starsze niż 5 min są odrzucane. Odpowiedź:

```json
{"time":1761400000,"profile":"dom","name":"Dom - Centralna","matched":true,"stale":false,
 "profiles":["dom","waw"],
 "departures":[[1761400420,5,"KM 1234","Warszawa Centralna","3",false]]}
```

Wiersz w `departures` = [przewidywany odjazd (epoch s), opóźnienie (min), pociąg, stacja odjazdu, peron, odwołany]. `matched` – profil pasuje do lokalizacji; `stale` – PLK nie odpowiada, dane z ostatniej udanej odpowiedzi. Błędy: `{"error":"no_config" | "unauthorized" | "bad_request" | "upstream"}`.
