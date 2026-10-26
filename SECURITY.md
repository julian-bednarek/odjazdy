# Security

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's "Report a vulnerability" button on the repository's Security tab, not in a public issue.

## Notes for your own deployment

- **Secrets:**
  - the watch secret (watch Storage and `cfg:` in KV);
  - `SETUP_PASSWORD`;
  - `PLK_API_KEY`.

  Worker secrets are write-only: after `wrangler secret put` they can't be read back.
- **Not secrets:**
  - the worker's URL;
  - the worker's name;
  - the KV id.

  Security rests on the watch secret and the password, not on keeping the URL hidden.
- **The link from the watch** works once and for at most 10 min, so nothing can be recovered from the browser history. The worker can't tell it apart from a link planted by a stranger, because Garmin Connect opens it in the browser as a navigation from another site. So only open the Garmin Connect notification, right after pressing START or UP on the watch. The session token lives in an `HttpOnly` cookie, out of reach of scripts and the URL.
- **The password** only stops strangers from pairing their watches and using up your PLK quota. It doesn't expose your profiles. The 5-try limit applies per session and anyone can open a new session, so the password's length is what stops guessing. To change it, run `npx wrangler secret put SETUP_PASSWORD` again.
- **Revoking a watch:** "Unpair watch" in the wizard (or `npx wrangler kv key list --binding TS_KV --remote --prefix cfg:`, then `kv key delete`), then reinstall the app, which creates a new secret.
- KV stores the secrets and the zone coordinates in plain text, so turn on 2FA for your Cloudflare account.
- The public URL can be flooded with requests. That exhausts the free daily limits (Workers, KV, PLK), and the watch stops working until they reset.
- The wizard's map tiles come straight from the OpenStreetMap servers, so the OSMF sees which area you look at.

The request signing, pairing and session flow is described in the API section of the [README](README.md#worker-api).
