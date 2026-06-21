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
import {
  handleCheckoutClaim,
  handleLicenseRecovery,
  type LicenseEnv,
} from "../functions/api/license";

export default {
  async fetch(
    request: Request,
    env: LicenseEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Consolidate www -> apex (301) so link equity and indexing target one host.
    if (url.hostname === "www.atelier.ws") {
      url.hostname = "atelier.ws";
      return Response.redirect(url.toString(), 301);
    }

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
    if (url.pathname === "/api/license/checkout") {
      return handleCheckoutClaim(request, env, ctx);
    }
    if (url.pathname === "/api/license/recover") {
      return handleLicenseRecovery(request, env, ctx);
    }

    // Pro purchase -> the selected Stripe Payment Link. Enterprise -> contact.
    if (url.pathname === "/pro" || url.pathname === "/pro/") {
      const dest =
        url.searchParams.get("billing") === "monthly"
          ? env.PRO_MONTHLY_CHECKOUT_URL
          : env.PRO_YEARLY_CHECKOUT_URL;
      return new Response(null, { status: 302, headers: { Location: dest } });
    }
    if (url.pathname === "/enterprise" || url.pathname === "/enterprise/") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "mailto:contact@atelier.ws?subject=Atelier%20Enterprise",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<LicenseEnv>;
