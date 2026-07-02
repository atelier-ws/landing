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
  handleAccountBillingPortal,
  handleAccountCheckout,
  handleCheckoutClaim,
  type LicenseEnv,
} from "../functions/api/license";
import {
  handleAuthCliToken,
  handleAuthDevicesRemove,
  handleAuthEmailStart,
  handleAuthEmailVerify,
  handleAuthLogout,
  handleAuthMe,
  handleOAuthCallback,
  handleOAuthStart,
  type AuthEnv,
} from "../functions/api/auth";

type CombinedEnv = LicenseEnv & AuthEnv;

export default {
  async fetch(
    request: Request,
    env: CombinedEnv,
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
      return handleCheckoutClaim(request, env);
    }
    if (url.pathname === "/api/account/billing-portal") {
      return handleAccountBillingPortal(request, env);
    }
    if (url.pathname === "/api/account/checkout" && request.method === "POST") {
      return handleAccountCheckout(request, env);
    }

    // ── OAuth / auth endpoints ──────────────────────────────────────────────────
    if (url.pathname === "/oauth/start") {
      return handleOAuthStart(request, env);
    }
    if (url.pathname === "/oauth/callback/github") {
      return handleOAuthCallback(request, env, "github");
    }
    if (url.pathname === "/oauth/callback/google") {
      return handleOAuthCallback(request, env, "google");
    }
    if (url.pathname === "/api/auth/me") {
      return handleAuthMe(request, env);
    }
    if (url.pathname === "/api/auth/logout") {
      return handleAuthLogout(request, env);
    }
    if (url.pathname === "/api/auth/devices/remove") {
      return handleAuthDevicesRemove(request, env);
    }
    if (url.pathname === "/api/auth/cli-token" && request.method === "POST") {
      return handleAuthCliToken(request, env);
    }
    if (url.pathname === "/api/auth/email/start") {
      return handleAuthEmailStart(request, env);
    }
    if (url.pathname === "/api/auth/email/verify") {
      return handleAuthEmailVerify(request, env);
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
} satisfies ExportedHandler<CombinedEnv>;
