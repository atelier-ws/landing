# atelier-landing

Marketing and documentation landing page for [Atelier](https://github.com/atelier-ws/atelier) — the open-source runtime engineering platform for AI agents.

Built with [Astro](https://astro.build) + React + Tailwind CSS.

## Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:4321`.

## Build

```bash
npm run build
```

Static output goes to `dist/`.

## Public Metrics

The hero savings strip reads from `/api/public-metrics`, backed by Cloudflare
Pages Functions. Installs can publish sanitized session rollups to
`/api/telemetry/rollup`.

Create the Cloudflare storage once:

```bash
npx wrangler d1 create atelier-public-telemetry
npx wrangler kv namespace create METRICS_CACHE
npx wrangler d1 execute atelier-public-telemetry --file migrations/0001_public_telemetry_rollups.sql
```

Bind them to the Pages project:

- D1 binding name: `TELEMETRY_DB`
- KV binding name: `METRICS_CACHE`

You can bind them in the Cloudflare dashboard under the Pages project settings,
or copy `wrangler.example.toml` to `wrangler.toml` and replace the placeholder
IDs. Do not commit real IDs until the production Pages project is meant to use
that Wrangler file.

Rollup payload shape:

```json
{
  "anon_id": "anonymous-install-id",
  "session_id": "session-id",
  "atelier_version": "0.1.0",
  "source": "atelier",
  "saved_usd": 0.16,
  "tokens_saved": 9240,
  "calls_avoided": 3,
  "occurred_at": "2026-06-16T10:00:00Z"
}
```

The Function hashes install/session identifiers before storage, dedupes by
session, bounds metric values, and refreshes the public KV aggregate after each
accepted rollup.

## Deploy

The main site is hosted at **https://atelier.ws**. Push to `main` to deploy via the configured CI/CD pipeline. Documentation lives at **https://docs.atelier.ws** (deployed separately).

## Contact

**contact@atelier.ws**
