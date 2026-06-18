/**
 * Cloudflare Worker entry point for atelier-landing.
 *
 * Routes /api/* requests to the function handlers and delegates
 * everything else (static assets) to the ASSETS binding.
 */
import { onRequest as handlePublicMetrics } from "../functions/api/public-metrics";
import { onRequest as handleRollup } from "../functions/api/telemetry/rollup";

export interface Env {
  TELEMETRY_DB?: D1Database;
  METRICS_CACHE?: KVNamespace;
  ASSETS: Fetcher;
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

    return env.ASSETS.fetch(request);
  },
};
