# Train Status

Glance i widget na Garmin Forerunner 165 pokazujący, o której i za ile odjeżdża
najbliższy bezpośredni pociąg (z opóźnieniem na żywo) dla relacji dobranej do
miejsca, w którym jesteś.

```
zegarek ──(Garmin Connect, makeWebRequest)──▶ Cloudflare Worker ──▶ PKP PLK Open Data API
                                               └ KV: konfiguracja profili
```

- `worker/` – Cloudflare Worker (TypeScript): wybór profilu po lokalizacji, rozkład + realtime z PLK, ~1 KB JSON dla zegarka. W `worker/public/` jest wizard na telefon (mapa stref + wyszukiwarka stacji).
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
   npx wrangler secret put SETUP_PASSWORD   # hasło do parowania nowych zegarków
   ```
   `SETUP_PASSWORD` wygeneruj w menedżerze haseł (20+ losowych znaków). Bez niego nie da się sparować nowego zegarka. Lokalnie (`wrangler dev`) oba sekrety idą do `worker/.dev.vars` (wzór: `.dev.vars.example`).
   Deploy dopisuje id KV do `wrangler.jsonc`. Można je zostawić albo odrzucić (`git checkout wrangler.jsonc`), bo kolejne deploye znajdą KV po bindingu.
3. **Zegarek:** SDK i symulator na Windowsie (SDK Manager + urządzenie fr165), build z WSL Windowsową Javą:
   ```sh
   watch/ciq.sh        # build → watch/bin/train-status.prg
   watch/ciq.sh run    # build + uruchomienie w symulatorze
   ```
   Klucz deweloperski: `~/.config/garmin/developer_key.der` (albo `CIQ_KEY=...`). Adres Workera: `cp watch/.env.example watch/.env` i ustaw `WORKER_URL` na sam adres bez ścieżki (`https://train-status.<subdomena>.workers.dev`). `ciq.sh` wkompilowuje go w build, a `watch/.env` jest w `.gitignore`.
4. **Na zegarek:** skopiuj `watch/bin/train-status.prg` przez USB do `GARMIN/APPS`.
5. **Parowanie i profile:** otwórz apkę i naciśnij START („konfiguruj w telefonie”). Garmin Connect pokaże na telefonie powiadomienie, a po kliknięciu otworzy się wizard. Ustaw strefy na mapie, wybierz stacje skąd i dokąd i zapisz, podając `SETUP_PASSWORD`. Zegarek sam pobierze profile w ciągu minuty. Później do edycji wystarczy przytrzymać UP na zegarku, bez hasła.

## API Workera

Zegarek:

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

`POST /v1/pair` zwraca `{"code"}`, jednorazowy kod do wizarda, ważny 10 min. Niesparowany zegarek wysyła `{"secret":"<hex>"}`. To jedyny raz, kiedy sekret opuszcza zegarek. Sparowany wysyła `{"timestamp"}` i te same nagłówki co wyżej, z podpisem `HMAC(sekret, "timestamp\npair")`.

Telefon:

- `GET /open?c=<kod>` zużywa kod, ustawia cookie sesji `__Host-session` (`HttpOnly; Secure; SameSite=Strict`, 30 min) i przekierowuje na `/setup`.
- `GET /setup` to wizard (pliki statyczne z `worker/public/`).
- `GET /api/config` zwraca `{"registered","profiles"}`. `PUT /api/config` przyjmuje `{"profiles","password"?}`, a hasło jest wymagane tylko dla nowego zegarka. `DELETE /api/config` odłącza zegarek.
- `GET /api/stations` zwraca słownik stacji PLK `[[id, nazwa], ...]`, trzymany w cache na dobę.

Wszystkie `/api/*` wymagają cookie sesji. Błędy: `unauthorized` (brak sesji), `password` (złe hasło; po 5 próbach sesja wygasa), `closed` (brak `SETUP_PASSWORD`), `bad_request` (zła lista profili).

## Bezpieczeństwo

- **Sekrety:**
  - sekret zegarka (Storage zegarka i `cfg:` w KV);
  - `SETUP_PASSWORD`;
  - `PLK_API_KEY`.

  Sekrety Workera są tylko do zapisu: po `wrangler secret put` nie da się ich odczytać.
- **Nie są sekretami:**
  - adres Workera;
  - nazwa Workera;
  - id KV.

  Bezpieczeństwo opiera się na sekrecie zegarka i haśle, nie na tajności URL-a.
- **Link z zegarka** działa raz i najwyżej 10 min, więc z historii przeglądarki nic się nie odzyska. Token sesji siedzi w cookie `HttpOnly`, poza zasięgiem JS-a i URL-a.
- **Hasło** chroni tylko przed parowaniem obcych zegarków, które zużywałyby Twój limit PLK. Twoich profili nie odsłania. Zmiana: ponowne `npx wrangler secret put SETUP_PASSWORD`.
- **Unieważnienie zegarka:** w wizardzie „Odłącz zegarek” (albo `npx wrangler kv key list --binding TS_KV --remote --prefix cfg:`, potem `kv key delete`), a potem reinstalacja apki, która tworzy nowy sekret.
- KV trzyma sekrety i współrzędne stref jawnym tekstem, więc włącz 2FA na koncie Cloudflare.
- Publiczny URL można zalać żądaniami. Wyczerpie to darmowe dzienne limity (Workers, KV, PLK) i zegarek przestanie działać do resetu.
- Kafelki mapy w wizardzie pobierasz prosto z serwerów OpenStreetMap, więc OSMF widzi oglądany obszar.
