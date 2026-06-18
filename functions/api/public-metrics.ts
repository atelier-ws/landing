type D1PreparedStatement = {
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type KVNamespace = {
  get(key: string, type: "json"): Promise<unknown>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
};

type Env = {
  TELEMETRY_DB?: D1Database;
  METRICS_CACHE?: KVNamespace;
};

type PagesContext = {
  request: Request;
  env: Env;
};

type PublicMetrics = {
  saved_usd: number;
  tokens_saved: number;
  calls_avoided: number;
  turns: number;
  sessions: number;
  installs: number;
  updated_at: string | null;
};

const CACHE_KEY = "public_metrics";

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405, {
      Allow: "GET, HEAD",
    });
  }

  const cached = await context.env.METRICS_CACHE?.get(CACHE_KEY, "json");
  const cachedMetrics = normalizeMetrics(cached);
  if (cachedMetrics) {
    return json({ ...cachedMetrics, source: "cache" }, 200, cacheHeaders());
  }

  if (!context.env.TELEMETRY_DB) {
    return json({ error: "metrics_unavailable" }, 503, {
      "Cache-Control": "no-store",
    });
  }

  const metrics = await aggregateMetrics(context.env.TELEMETRY_DB);
  await context.env.METRICS_CACHE?.put(CACHE_KEY, JSON.stringify(metrics), {
    expirationTtl: 300,
  });
  return json({ ...metrics, source: "database" }, 200, cacheHeaders());
}

async function aggregateMetrics(db: D1Database): Promise<PublicMetrics> {
  const row = await db
    .prepare(
      `
      SELECT
        COALESCE(SUM(saved_usd + carry_usd), 0) AS saved_usd,
        COALESCE(SUM(tokens_saved + carry_tokens), 0) AS tokens_saved,
        COALESCE(SUM(calls_avoided), 0) AS calls_avoided,
        COALESCE(SUM(turns), 0) AS turns,
        COUNT(*) AS sessions,
        COUNT(DISTINCT install_key) AS installs,
        MAX(received_at) AS updated_at
      FROM telemetry_rollups
    `,
    )
    .first<Record<string, unknown>>();

  return {
    saved_usd: roundMoney(numberValue(row?.saved_usd)),
    tokens_saved: intValue(row?.tokens_saved),
    calls_avoided: intValue(row?.calls_avoided),
    turns: intValue(row?.turns),
    sessions: intValue(row?.sessions),
    installs: intValue(row?.installs),
    updated_at:
      typeof row?.updated_at === "string" && row.updated_at
        ? row.updated_at
        : null,
  };
}

function normalizeMetrics(value: unknown): PublicMetrics | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const metrics = {
    saved_usd: roundMoney(numberValue(candidate.saved_usd)),
    tokens_saved: intValue(candidate.tokens_saved),
    calls_avoided: intValue(candidate.calls_avoided),
    turns: intValue(candidate.turns),
    sessions: intValue(candidate.sessions),
    installs: intValue(candidate.installs),
    updated_at:
      typeof candidate.updated_at === "string" && candidate.updated_at
        ? candidate.updated_at
        : null,
  };
  return metrics;
}

function intValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function cacheHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
    "Access-Control-Allow-Origin": "*",
  };
}

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
