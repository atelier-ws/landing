/**
 * /api/stats.svg — dynamic SVG stats card for README embed.
 * Matches the landing page brand palette and mono font style.
 *
 * Usage in README:
 *   [![Savings](https://atelier.ws/api/stats.svg)](https://atelier.ws)
 */

export interface Env {
  TELEMETRY_DB?: D1Database;
  METRICS_CACHE?: KVNamespace;
}

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}

function fmtCalls(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export async function onRequest(ctx: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { env } = ctx;

  let saved_usd = 0,
    tokens_saved = 0,
    calls_avoided = 0;

  try {
    if (env.METRICS_CACHE) {
      const cached = await env.METRICS_CACHE.get("public_metrics");
      if (cached) {
        const d = JSON.parse(cached);
        saved_usd = d.saved_usd ?? 0;
        tokens_saved = d.tokens_saved ?? 0;
        calls_avoided = d.calls_avoided ?? 0;
      }
    }
    if (!saved_usd && env.TELEMETRY_DB) {
      const row = await env.TELEMETRY_DB.prepare(
        `SELECT COALESCE(SUM(saved_usd+carry_usd),0) AS s,
                COALESCE(SUM(tokens_saved+carry_tokens),0) AS t,
                COALESCE(SUM(calls_avoided),0) AS c FROM telemetry_rollups`,
      ).first<{ s: number; t: number; c: number }>();
      if (row) {
        saved_usd = row.s;
        tokens_saved = row.t;
        calls_avoided = row.c;
      }
    }
  } catch {
    /* fallback zeros */
  }

  const usd = fmtUsd(saved_usd);
  const tok = fmtTokens(tokens_saved);
  const cal = fmtCalls(calls_avoided);

  // Layout: 3 equal columns of 200px, total 600×78
  const W = 600,
    H = 78;
  const col = [100, 300, 500]; // center x per column
  const brand = "#6a39b3"; // brand-700
  const muted = "#64748b"; // slate-500
  const bg = "#f7f8fb";
  const border = "#e2e8f0";
  const sep = "#ddd6fe"; // brand-200 approx

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" rx="6" fill="${bg}" stroke="${border}" stroke-width="1"/>
  <!-- separators -->
  <line x1="200" y1="14" x2="200" y2="${H - 14}" stroke="${sep}" stroke-width="1"/>
  <line x1="400" y1="14" x2="400" y2="${H - 14}" stroke="${sep}" stroke-width="1"/>
  <!-- col 1: cost -->
  <text x="${col[0]}" y="36" text-anchor="middle" font-family="monospace" font-size="22" font-weight="700" fill="${brand}">${usd}</text>
  <text x="${col[0]}" y="56" text-anchor="middle" font-family="monospace" font-size="11" fill="${muted}">cost saved</text>
  <!-- col 2: tokens -->
  <text x="${col[1]}" y="36" text-anchor="middle" font-family="monospace" font-size="22" font-weight="700" fill="${brand}">${tok}</text>
  <text x="${col[1]}" y="56" text-anchor="middle" font-family="monospace" font-size="11" fill="${muted}">tokens saved</text>
  <!-- col 3: calls -->
  <text x="${col[2]}" y="36" text-anchor="middle" font-family="monospace" font-size="22" font-weight="700" fill="${brand}">${cal}</text>
  <text x="${col[2]}" y="56" text-anchor="middle" font-family="monospace" font-size="11" fill="${muted}">calls avoided</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
