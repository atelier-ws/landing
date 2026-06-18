type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type KVNamespace = {
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

type RollupPayload = {
  anon_id?: unknown;
  install_id?: unknown;
  session_id?: unknown;
  atelier_version?: unknown;
  source?: unknown;
  saved_usd?: unknown;
  tokens_saved?: unknown;
  calls_avoided?: unknown;
  carry_usd?: unknown;
  carry_tokens?: unknown;
  turn_count?: unknown;
  occurred_at?: unknown;
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
const MAX_BODY_BYTES = 4096;
const MAX_SESSION_USD = 1_000;
const MAX_SESSION_TOKENS = 100_000_000;
const MAX_SESSION_CALLS = 1_000_000;

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (context.request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, {
      ...corsHeaders(),
      Allow: "POST, OPTIONS",
    });
  }
  if (!context.env.TELEMETRY_DB) {
    return json({ error: "telemetry_db_not_configured" }, 503, corsHeaders());
  }

  const contentLength = Number(
    context.request.headers.get("content-length") ?? 0,
  );
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413, corsHeaders());
  }

  let payload: RollupPayload;
  try {
    payload = (await context.request.json()) as RollupPayload;
  } catch {
    return json({ error: "invalid_json" }, 400, corsHeaders());
  }

  const installId =
    stringValue(payload.anon_id) || stringValue(payload.install_id);
  const sessionId = stringValue(payload.session_id);
  if (!installId || !sessionId) {
    return json(
      { error: "install_id_and_session_id_required" },
      400,
      corsHeaders(),
    );
  }

  const savedUsd = boundedNumber(payload.saved_usd, MAX_SESSION_USD);
  const tokensSaved = boundedInt(payload.tokens_saved, MAX_SESSION_TOKENS);
  const callsAvoided = boundedInt(payload.calls_avoided, MAX_SESSION_CALLS);
  const carryUsd = boundedNumber(payload.carry_usd, MAX_SESSION_USD) ?? 0;
  const carryTokens = boundedInt(payload.carry_tokens, 1_000_000_000) ?? 0;
  const MAX_SESSION_TURNS = 10_000;
  const turnCount = boundedInt(payload.turn_count, MAX_SESSION_TURNS);
  if (savedUsd === null || tokensSaved === null || callsAvoided === null) {
    return json({ error: "invalid_metric_value" }, 400, corsHeaders());
  }
  if (turnCount === null) {
    return json({ error: "invalid_metric_value" }, 400, corsHeaders());
  }
  if (
    savedUsd <= 0 &&
    tokensSaved <= 0 &&
    callsAvoided <= 0 &&
    carryUsd <= 0 &&
    carryTokens <= 0 &&
    turnCount <= 0
  ) {
    return json({ ok: true, stored: false }, 202, corsHeaders());
  }

  const now = new Date().toISOString();
  const occurredAt = timestampValue(payload.occurred_at) || now;
  const installKey = await sha256Hex(installId);
  const sessionKey = await sha256Hex(`${installId}:${sessionId}`);
  const version = labelValue(payload.atelier_version, "unknown", 64);
  const source = labelValue(payload.source, "atelier", 40);

  await context.env.TELEMETRY_DB.prepare(
    `
    INSERT INTO telemetry_rollups (
      session_key,
      install_key,
      occurred_at,
      received_at,
      -- carry columns added in migration 0003
      atelier_version,
      source,
      saved_usd,
      tokens_saved,
      calls_avoided,
      carry_usd,
      carry_tokens,
      turns
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_key) DO UPDATE SET
      install_key = excluded.install_key,
      occurred_at = excluded.occurred_at,
      received_at = excluded.received_at,
      atelier_version = excluded.atelier_version,
      source = excluded.source,
      saved_usd = max(telemetry_rollups.saved_usd, excluded.saved_usd),
      tokens_saved = max(telemetry_rollups.tokens_saved, excluded.tokens_saved),
      calls_avoided = max(telemetry_rollups.calls_avoided, excluded.calls_avoided),
      carry_usd = max(telemetry_rollups.carry_usd, excluded.carry_usd),
      carry_tokens = max(telemetry_rollups.carry_tokens, excluded.carry_tokens),
      turns = max(telemetry_rollups.turns, excluded.turns)
  `,
  )
    .bind(
      sessionKey,
      installKey,
      occurredAt,
      now,
      version,
      source,
      roundMoney(savedUsd),
      tokensSaved,
      callsAvoided,
      roundMoney(carryUsd),
      carryTokens,
      turnCount,
    )
    .run();

  const metrics = await aggregateMetrics(context.env.TELEMETRY_DB);
  await context.env.METRICS_CACHE?.put(CACHE_KEY, JSON.stringify(metrics), {
    expirationTtl: 300,
  });

  return json({ ok: true, stored: true, metrics }, 200, corsHeaders());
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

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function labelValue(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  const raw = stringValue(value) || fallback;
  const cleaned = raw.replace(/[^A-Za-z0-9_.:+\/-]/g, "").slice(0, maxLength);
  return cleaned || fallback;
}

function boundedInt(value: unknown, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.floor(n);
}

function boundedNumber(value: unknown, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return n;
}

function intValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function timestampValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function roundMoney(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
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
