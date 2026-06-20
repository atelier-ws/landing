/**
 * Cloudflare Worker entry point for atelier-landing.
 *
 * Routes /api/* requests to the function handlers and delegates
 * everything else (static assets) to the ASSETS binding.
 */
import { onRequest as handlePublicMetrics } from "../functions/api/public-metrics";
import { onRequest as handleRollup } from "../functions/api/telemetry/rollup";
import { onRequest as handleBadge } from "../functions/api/badge";
import { onRequest as handleStatsSvg } from "../functions/api/stats.svg";

export interface Env {
  TELEMETRY_DB?: D1Database;
  METRICS_CACHE?: KVNamespace;
  ASSETS: Fetcher;
  // Stripe Payment Link for Pro. Set via wrangler [vars] or a secret; until it
  // is configured, /pro lands on the pricing page.
  PRO_CHECKOUT_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/public-metrics") {
      return handlePublicMetrics({ request, env });
    }

    if (url.pathname === "/api/telemetry/rollup") {
      return handleRollup({ request, env });
    }
    if (url.pathname === "/api/badge") {
      return handleBadge({ request, env });
    }
    if (url.pathname === "/api/stats.svg") {
      return handleStatsSvg({ request, env });
    }

    // Pro purchase -> Stripe Payment Link (PRO_CHECKOUT_URL); falls back to the
    // pricing page until that's configured. Enterprise -> contact email.
    if (url.pathname === "/pro" || url.pathname === "/pro/") {
      const dest = env.PRO_CHECKOUT_URL || new URL("/pricing/", url).toString();
      return new Response(null, { status: 302, headers: { Location: dest } });
    }
    if (url.pathname === "/enterprise" || url.pathname === "/enterprise/") {
      return new Response(null, {
        status: 302,
        headers: { Location: "mailto:contact@atelier.ws?subject=Atelier%20Enterprise" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
