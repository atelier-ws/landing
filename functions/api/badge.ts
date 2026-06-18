/**
 * /api/badge — shields.io-compatible endpoint for README live meter.
 *
 * shields.io endpoint badge:
 *   https://img.shields.io/endpoint?url=https%3A%2F%2Fatelier.ws%2Fapi%2Fbadge
 *
 * Query params:
 *   ?metric=savings  (default) — "$12.34 saved"
 *   ?metric=tokens               — "1.2M tokens"
 *   ?metric=calls                — "553 calls avoided"
 *   ?metric=all                  — combined label
 */

export interface Env {
  TELEMETRY_DB?: D1Database;
  METRICS_CACHE?: KVNamespace;
}

interface ShieldsPayload {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
  cacheSeconds: number;
  logoColor?: string;
}

function fmt(n: number, unit: "usd" | "tokens" | "calls"): string {
  if (unit === "usd") {
    return `$${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} saved`;
  }
  if (unit === "tokens") {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tokens`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k tokens`;
    return `${n} tokens`;
  }
  // calls
  return `${n.toLocaleString("en")} calls avoided`;
}

export async function onRequest(ctx: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const metric = url.searchParams.get("metric") ?? "all";

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
        `SELECT COALESCE(SUM(saved_usd),0) AS saved_usd,
                COALESCE(SUM(tokens_saved),0) AS tokens_saved,
                COALESCE(SUM(calls_avoided),0) AS calls_avoided
         FROM telemetry_rollups`,
      ).first<{
        saved_usd: number;
        tokens_saved: number;
        calls_avoided: number;
      }>();
      if (row) {
        saved_usd = row.saved_usd;
        tokens_saved = row.tokens_saved;
        calls_avoided = row.calls_avoided;
      }
    }
  } catch {
    // fall through with zeros
  }

  let label: string;
  let message: string;

  if (metric === "savings" || metric === "usd") {
    label = "cost saved";
    message =
      saved_usd >= 1000
        ? `$${(saved_usd / 1000).toFixed(1)}k`
        : `$${saved_usd.toFixed(0)}`;
  } else if (metric === "tokens") {
    label = "tokens saved";
    message =
      tokens_saved >= 1_000_000_000
        ? `${(tokens_saved / 1_000_000_000).toFixed(1)}B`
        : tokens_saved >= 1_000_000
          ? `${(tokens_saved / 1_000_000).toFixed(0)}M`
          : `${Math.round(tokens_saved / 1000)}k`;
  } else if (metric === "calls") {
    label = "calls avoided";
    message =
      calls_avoided >= 1000
        ? `${(calls_avoided / 1000).toFixed(1)}k`
        : `${calls_avoided}`;
  } else {
    label = "atelier savings";
    const t =
      tokens_saved >= 1_000_000
        ? `${(tokens_saved / 1_000_000).toFixed(0)}M tokens`
        : `${Math.round(tokens_saved / 1000)}k tokens`;
    const u =
      saved_usd >= 1000
        ? `$${(saved_usd / 1000).toFixed(1)}k`
        : `$${saved_usd.toFixed(0)}`;
    message = `${u} · ${t} · ${calls_avoided} calls`;
  }

  const payload: ShieldsPayload = {
    schemaVersion: 1,
    label,
    message,
    color: "9b75d9", // brand-400 (atelier purple)
    cacheSeconds: 300,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
