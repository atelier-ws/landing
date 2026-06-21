# atelier-landing

Marketing and documentation landing page for [Atelier](https://github.com/atelier-ws/atelier) — the source-available runtime engineering platform for AI agents.

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

Bind them to the Worker:

- D1 binding name: `TELEMETRY_DB`
- KV binding name: `METRICS_CACHE`

Copy `wrangler.example.toml` to `wrangler.toml` and replace the placeholder IDs.
`wrangler.toml` is gitignored because it holds real Cloudflare resource IDs, so
keep the committed `wrangler.example.toml` template in sync (bindings **and**
`routes`) -- a drift there is how the apex custom domain got missed.

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

## Pro License Delivery

The authoritative signer is the separate `services/license-issuer` Worker in
the parent Atelier repository. It receives Stripe webhooks, signs the exact
two-segment token format accepted by the CLI, and stores tokens in the
`atelier-licenses` D1 database. This landing Worker never mints licenses.

After checkout, `/license/success` verifies the Stripe session and reads the
issued token through its `LICENSE_DB` binding. `/license/recover` resends active
tokens through Cloudflare Email Service without revealing whether an address
exists in the database.

Apply the landing-side recovery tables to the telemetry database:

```bash
npx wrangler d1 execute atelier-telemetry --remote \
  --file migrations/0004_license_issuance.sql
npx wrangler d1 execute atelier-telemetry --remote \
  --file migrations/0005_remove_duplicate_license_issuer.sql
npx wrangler d1 execute atelier-telemetry --remote \
  --file migrations/0006_license_checkout_delivery.sql
```

Enable Email Sending for the sender domain and keep the `EMAIL` binding in the
Wrangler config:

```bash
npx wrangler email sending enable atelier.ws
npx wrangler email sending dns get atelier.ws
```

Configure the Stripe API secret used to verify checkout sessions:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
```

In Stripe:

- Replace `PRO_MONTHLY_CHECKOUT_URL` and `PRO_YEARLY_CHECKOUT_URL` with live
  Payment Links before production deployment.
- Set both Payment Links' post-payment redirect to
  `https://atelier.ws/license/success?session_id={CHECKOUT_SESSION_ID}`.
- Keep the existing `services/license-issuer` Stripe webhook enabled. Do not
  create a second signing webhook on the landing Worker.
- `STRIPE_SECRET_KEY` is used only to verify a paid Checkout Session before the
  landing page reveals its matching token.

Recovery is rate-limited per hashed email address. Checkout-session claims are
available for 48 hours; after that, recovery email is required.

## Deploy

The main site is hosted at **https://atelier.ws** as a Cloudflare Worker (static
`dist/` assets + `src/worker.ts` for the `/api/*` routes). There is **no CI/CD
pipeline** -- deploys are manual:

```bash
npm run build        # regenerate dist/
npx wrangler deploy  # upload worker + assets, bind custom domains
```

`wrangler deploy` binds the custom domains declared under `routes` in
`wrangler.toml` -- both **atelier.ws** and **www.atelier.ws**. If only `www` is
bound, the apex serves a stale target and `atelier.ws/api/*` 404s. Verify both
after deploying: `curl https://atelier.ws/api/badge?metric=savings`.

Documentation lives at **https://docs.atelier.ws** (deployed separately).

## Contact

**contact@atelier.ws**
