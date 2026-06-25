/**
 * OAuth authentication handlers for Atelier.
 *
 * Endpoints:
 *   GET  /oauth/start                  — initiate OAuth flow
 *   GET  /oauth/callback/github        — GitHub OAuth callback
 *   GET  /oauth/callback/google        — Google OAuth callback
 *   GET  /api/auth/me                  — fetch authenticated user
 *   POST /api/auth/logout              — sign out current session
 *   POST /api/auth/devices/remove      — remove a specific session/device
 *   POST /api/auth/cli-token           — issue a CLI device token
 *   POST /api/auth/email/start         — send magic-link email
 *   GET  /api/auth/email/verify        — verify magic-link token
 */

export type AuthEnv = Env & {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_DB: D1Database; // atelier-auth: users, sessions, oauth states, email logins
  LICENSE_DB: D1Database; // atelier-licenses: subscriptions (plan bridge, read-only)
};

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const CLI_SESSION_TTL_SECONDS = 24 * 60 * 60; // 1 day — auto-renewed on activity
const CLI_DEVICE_LIMIT = 3;
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

function getRedirectBase(request: Request): string {
  const url = new URL(request.url);
  // In prod the origin is https://atelier.ws; in local dev it is http://localhost:PORT.
  // Deriving it from the request means we never need to touch this file for local dev.
  return url.origin;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isoNow(offsetSeconds = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return null;
}

function extractCookieToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)atelier_auth_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractToken(request: Request): string | null {
  return extractBearerToken(request) ?? extractCookieToken(request);
}

async function resolveSession(
  token: string,
  db: D1Database,
): Promise<{ user_id: string; email: string; plan: string } | null> {
  const now = isoNow();
  const row = await db
    .prepare(
      `SELECT s.user_id, u.email, u.plan
         FROM auth_sessions s
         JOIN auth_users u ON u.user_id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?`,
    )
    .bind(token, now)
    .first<{ user_id: string; email: string; plan: string }>();
  if (!row) return null;
  // Update last_seen_at (fire-and-forget)
  void db
    .prepare(`UPDATE auth_sessions SET last_seen_at = ? WHERE token = ?`)
    .bind(isoNow(), token)
    .run();
  return row;
}

function methodNotAllowed(allow: string): Response {
  return new Response(null, {
    status: 405,
    headers: { Allow: allow },
  });
}

// ── Plan bridge: check old licenses table ─────────────────────────────────────

async function resolveUserPlan(db: D1Database, email: string): Promise<string> {
  try {
    const row = await db
      .prepare(
        `SELECT plan FROM licenses
          WHERE LOWER(email) = LOWER(?)
            AND revoked = 0
            AND (expires_at IS NULL OR expires_at > unixepoch())
          LIMIT 1`,
      )
      .bind(email)
      .first<{ plan: string }>();
    if (row && (row.plan === "pro" || row.plan === "enterprise")) {
      return row.plan;
    }
  } catch {
    // licenses table may not exist or have a different schema — fail open
  }
  return "free";
}

// ── Upsert user and return user_id + plan ─────────────────────────────────────

async function upsertUser(
  authDb: D1Database, // AUTH_DB — owns auth_users
  planDb: D1Database, // LICENSE_DB   — owns licenses (plan bridge)
  email: string,
  providerField: "github_id" | "google_id",
  providerId: string,
): Promise<{ user_id: string; plan: string }> {
  const now = isoNow();

  // Try to find by email first
  const existing = await authDb
    .prepare(
      `SELECT user_id, plan FROM auth_users WHERE LOWER(email) = LOWER(?)`,
    )
    .bind(email)
    .first<{ user_id: string; plan: string }>();

  if (existing) {
    // Update provider id and updated_at
    await authDb
      .prepare(
        `UPDATE auth_users SET ${providerField} = ?, updated_at = ? WHERE user_id = ?`,
      )
      .bind(providerId, now, existing.user_id)
      .run();

    // Sync plan from licenses table if currently free
    let plan = existing.plan;
    if (plan === "free") {
      plan = await resolveUserPlan(planDb, email);
      if (plan !== "free") {
        await authDb
          .prepare(
            `UPDATE auth_users SET plan = ?, updated_at = ? WHERE user_id = ?`,
          )
          .bind(plan, now, existing.user_id)
          .run();
      }
    }
    return { user_id: existing.user_id, plan };
  }

  // New user
  const userId = crypto.randomUUID();
  const plan = await resolveUserPlan(planDb, email);
  await authDb
    .prepare(
      `INSERT INTO auth_users (user_id, email, ${providerField}, plan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(userId, email.toLowerCase(), providerId, plan, now, now)
    .run();
  return { user_id: userId, plan };
}

// ── GET /oauth/start ──────────────────────────────────────────────────────────

export async function handleOAuthStart(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const deviceName = url.searchParams.get("device_name") ?? null;
  const cliRedirect = url.searchParams.get("cli_redirect") ?? null;

  if (provider !== "github" && provider !== "google") {
    return json({ error: "invalid_provider" }, 400);
  }
  if (!redirectUri) {
    return json({ error: "missing_redirect_uri" }, 400);
  }

  const state = crypto.randomUUID();
  const expiresAt = isoNow(OAUTH_STATE_TTL_SECONDS);

  await env.AUTH_DB.prepare(
    `INSERT INTO auth_oauth_states (state, provider, redirect_uri, device_name, cli_redirect, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      state,
      provider,
      redirectUri,
      deviceName,
      cliRedirect,
      isoNow(),
      expiresAt,
    )
    .run();

  const redirectBase = getRedirectBase(request);
  let oauthUrl: string;
  if (provider === "github") {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${redirectBase}/oauth/callback/github`,
      scope: "read:user user:email",
      state,
    });
    oauthUrl = `https://github.com/login/oauth/authorize?${params}`;
  } else {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${redirectBase}/oauth/callback/google`,
      response_type: "code",
      scope: "openid email profile",
      state,
    });
    oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  return new Response(null, { status: 302, headers: { Location: oauthUrl } });
}

// ── OAuth callback (shared logic) ─────────────────────────────────────────────

async function exchangeGitHub(
  code: string,
  env: AuthEnv,
  redirectBase: string,
): Promise<{ email: string; providerId: string }> {
  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      // redirect_uri omitted — optional for GitHub; including it would require
      // the exact URL registered in the OAuth app, which breaks local dev.
    }),
  });
  const tokenData = (await tokenRes.json()) as Record<string, unknown>;
  console.error("[github_token_exchange] response:", JSON.stringify(tokenData));
  const accessToken = tokenData.access_token as string;
  if (!accessToken)
    throw new Error(
      `github_token_exchange_failed: ${JSON.stringify(tokenData)}`,
    );

  // Fetch user profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "atelier-landing/1.0",
    },
  });
  const user = (await userRes.json()) as Record<string, unknown>;
  const providerId = String(user.id);

  // Get primary email (may be private)
  let email = typeof user.email === "string" ? user.email : null;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "atelier-landing/1.0",
      },
    });
    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primary = emails.find((e) => e.primary && e.verified);
    email = primary?.email ?? null;
  }
  if (!email) throw new Error("github_email_not_found");

  return { email, providerId };
}

async function exchangeGoogle(
  code: string,
  env: AuthEnv,
  redirectBase: string,
): Promise<{ email: string; providerId: string }> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${redirectBase}/oauth/callback/google`,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenRes.json()) as Record<string, unknown>;
  const accessToken = tokenData.access_token as string;
  if (!accessToken) throw new Error("google_token_exchange_failed");

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const user = (await userRes.json()) as Record<string, unknown>;
  const email = typeof user.email === "string" ? user.email : null;
  const providerId = typeof user.sub === "string" ? user.sub : null;
  if (!email || !providerId) throw new Error("google_user_info_failed");

  return { email, providerId };
}

export async function handleOAuthCallback(
  request: Request,
  env: AuthEnv,
  provider: "github" | "google",
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");

  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!code || !state) {
    return json({ error: "missing_params" }, 400);
  }

  const now = isoNow();

  // Look up and validate state
  const stateRow = await env.AUTH_DB.prepare(
    `SELECT redirect_uri, device_name, cli_redirect FROM auth_oauth_states
      WHERE state = ? AND provider = ? AND expires_at > ?`,
  )
    .bind(state, provider, now)
    .first<{
      redirect_uri: string;
      device_name: string | null;
      cli_redirect: string | null;
    }>();

  if (!stateRow) {
    return json({ error: "invalid_or_expired_state" }, 400);
  }

  try {
    // Exchange code for user identity
    let email: string;
    let providerId: string;
    const redirectBase = getRedirectBase(request);
    if (provider === "github") {
      ({ email, providerId } = await exchangeGitHub(code, env, redirectBase));
    } else {
      ({ email, providerId } = await exchangeGoogle(code, env, redirectBase));
    }

    const providerField: "github_id" | "google_id" =
      provider === "github" ? "github_id" : "google_id";

    // Upsert user
    const { user_id } = await upsertUser(
      env.AUTH_DB,
      env.LICENSE_DB,
      email,
      providerField,
      providerId,
    );

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = isoNow(SESSION_TTL_SECONDS);
    await env.AUTH_DB.prepare(
      `INSERT INTO auth_sessions (token, user_id, device_name, created_at, expires_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        sessionToken,
        user_id,
        stateRow.device_name,
        isoNow(),
        expiresAt,
        isoNow(),
      )
      .run();

    // Delete used state
    await env.AUTH_DB.prepare(`DELETE FROM auth_oauth_states WHERE state = ?`)
      .bind(state)
      .run();

    // Always land on /account with the session token.
    // If a CLI is waiting (cli_redirect set), also pass pending_cli=1 so the
    // account page shows the Authorize/Decline consent screen before the token
    // is forwarded to the local CLI callback server.
    const dest = new URL("/account", getRedirectBase(request));
    dest.searchParams.set("token", sessionToken);
    dest.searchParams.set("email", email);
    if (stateRow.cli_redirect) {
      dest.searchParams.set("cli_redirect", stateRow.cli_redirect);
      dest.searchParams.set("pending_cli", "1");
    }
    const destStr = dest.toString();

    return new Response(null, {
      status: 302,
      headers: { Location: destStr },
    });
  } catch (err) {
    console.error("[oauth_callback] error:", err);
    void env.AUTH_DB.prepare(`DELETE FROM auth_oauth_states WHERE state = ?`)
      .bind(state)
      .run();
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: "oauth_failed", detail: msg }, 502);
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

export async function handleAuthMe(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");

  const token = extractToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const user = await resolveSession(token, env.AUTH_DB);
  if (!user) return json({ error: "unauthorized" }, 401);

  // Auto-renew CLI tokens on every use (rolling 24h window)
  const sessionRow = await env.AUTH_DB.prepare(
    `SELECT kind FROM auth_sessions WHERE token = ? LIMIT 1`,
  )
    .bind(token)
    .first<{ kind: string }>();
  if (sessionRow?.kind === "cli") {
    await env.AUTH_DB.prepare(
      `UPDATE auth_sessions SET expires_at = ?, last_seen_at = ? WHERE token = ?`,
    )
      .bind(isoNow(CLI_SESSION_TTL_SECONDS), isoNow(), token)
      .run();
  }

  // Fetch CLI sessions for this user (devices) — web sessions are not shown as devices
  const sessionsResult = await env.AUTH_DB.prepare(
    `SELECT token, device_id, device_name, created_at, last_seen_at
       FROM auth_sessions
      WHERE user_id = ? AND kind = 'cli'
      ORDER BY last_seen_at DESC`,
  )
    .bind(user.user_id)
    .all<{
      token: string;
      device_id: string | null;
      device_name: string | null;
      created_at: string;
      last_seen_at: string;
    }>();

  const devices = (sessionsResult.results ?? []).map((s) => ({
    token_prefix: s.token.slice(0, 8),
    device_id: s.device_id ?? s.token.slice(0, 8),
    device_name: s.device_name ?? "Unknown device",
    created_at: s.created_at,
    last_seen_at: s.last_seen_at,
  }));

  // Include current session device_id if this is a CLI token
  const currentDeviceId =
    sessionRow?.kind === "cli"
      ? await env.AUTH_DB.prepare(
          `SELECT device_id FROM auth_sessions WHERE token = ? LIMIT 1`,
        )
          .bind(token)
          .first<{ device_id: string | null }>()
          .then((r) => r?.device_id ?? token.slice(0, 8))
      : undefined;

  return json({
    user_id: user.user_id,
    email: user.email,
    plan: user.plan,
    device_id: currentDeviceId,
    devices,
    cli_device_count: devices.length,
    cli_device_limit: CLI_DEVICE_LIMIT,
  });
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

export async function handleAuthLogout(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const token = extractToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  await env.AUTH_DB.prepare(`DELETE FROM auth_sessions WHERE token = ?`)
    .bind(token)
    .run();

  return json({ ok: true });
}

// ── POST /api/auth/devices/remove ─────────────────────────────────────────────

export async function handleAuthDevicesRemove(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const token = extractToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const user = await resolveSession(token, env.AUTH_DB);
  if (!user) return json({ error: "unauthorized" }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const tokenPrefix =
    typeof body.token_prefix === "string" && body.token_prefix.length === 8
      ? body.token_prefix
      : null;
  if (!tokenPrefix) return json({ error: "missing_token_prefix" }, 400);

  // Only allow removing CLI sessions
  await env.AUTH_DB.prepare(
    `DELETE FROM auth_sessions
      WHERE token LIKE ? AND user_id = ? AND kind = 'cli'`,
  )
    .bind(tokenPrefix + "%", user.user_id)
    .run();

  // Return updated CLI devices list
  const sessionsResult = await env.AUTH_DB.prepare(
    `SELECT token, device_id, device_name, created_at, last_seen_at
       FROM auth_sessions
      WHERE user_id = ? AND kind = 'cli'
      ORDER BY last_seen_at DESC`,
  )
    .bind(user.user_id)
    .all<{
      token: string;
      device_id: string | null;
      device_name: string | null;
      created_at: string;
      last_seen_at: string;
    }>();

  const devices = (sessionsResult.results ?? []).map((s) => ({
    token_prefix: s.token.slice(0, 8),
    device_id: s.device_id ?? s.token.slice(0, 8),
    device_name: s.device_name ?? "Unknown device",
    created_at: s.created_at,
    last_seen_at: s.last_seen_at,
  }));

  return json({ ok: true, devices });
}

// ── POST /api/auth/cli-token ───────────────────────────────────────────────────

export async function handleAuthCliToken(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const token = extractToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const user = await resolveSession(token, env.AUTH_DB);
  if (!user) return json({ error: "unauthorized" }, 401);

  // Parse optional device_name and stable_device_id from body
  let deviceName: string | null = null;
  let stableDeviceId: string | null = null;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    deviceName =
      typeof body.device_name === "string"
        ? body.device_name.slice(0, 100)
        : null;
    stableDeviceId =
      typeof body.stable_device_id === "string"
        ? body.stable_device_id.slice(0, 64)
        : null;
  } catch {
    // ignore — body is optional
  }

  // If a session already exists for this stable_device_id or device_name, replace it
  // (same machine re-logging in should not accumulate slots).
  if (stableDeviceId) {
    await env.AUTH_DB.prepare(
      `DELETE FROM auth_sessions WHERE user_id = ? AND kind = 'cli' AND device_id = ?`,
    )
      .bind(user.user_id, stableDeviceId)
      .run();
  } else if (deviceName) {
    await env.AUTH_DB.prepare(
      `DELETE FROM auth_sessions WHERE user_id = ? AND kind = 'cli' AND device_name = ?`,
    )
      .bind(user.user_id, deviceName)
      .run();
  }

  // Count remaining active CLI sessions for this user
  const countRow = await env.AUTH_DB.prepare(
    `SELECT COUNT(*) as cnt FROM auth_sessions
      WHERE user_id = ? AND kind = 'cli' AND expires_at > ?`,
  )
    .bind(user.user_id, isoNow())
    .first<{ cnt: number }>();

  const cliCount = countRow?.cnt ?? 0;
  if (cliCount >= CLI_DEVICE_LIMIT) {
    return json(
      {
        error: "device_limit_reached",
        limit: CLI_DEVICE_LIMIT,
        count: cliCount,
      },
      403,
    );
  }

  // Create new CLI session
  const cliToken = crypto.randomUUID();
  const expiresAt = isoNow(CLI_SESSION_TTL_SECONDS);
  await env.AUTH_DB.prepare(
    `INSERT INTO auth_sessions (token, user_id, device_name, device_id, kind, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, 'cli', ?, ?, ?)`,
  )
    .bind(
      cliToken,
      user.user_id,
      deviceName,
      stableDeviceId,
      isoNow(),
      expiresAt,
      isoNow(),
    )
    .run();

  return json({
    token: cliToken,
    device_id: stableDeviceId ?? cliToken.slice(0, 8),
    expires_at: expiresAt,
    device_limit: CLI_DEVICE_LIMIT,
    device_count: cliCount + 1,
  });
}

// ── Email magic-link helpers ──────────────────────────────────────────────────

const SENDPULSE_API_BASE_AUTH = "https://api.sendpulse.com";

async function getSendPulseToken(env: AuthEnv): Promise<string> {
  const res = await fetch(`${SENDPULSE_API_BASE_AUTH}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.SENDPULSE_API_ID,
      client_secret: env.SENDPULSE_API_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`SendPulse auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function utf8ToBase64Auth(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function sendMagicLinkEmail(
  env: AuthEnv,
  to: string,
  token: string,
): Promise<void> {
  const site = env.SITE_URL ?? "https://atelier.ws";
  const link = `${site}/account?email_token=${encodeURIComponent(token)}`;
  const subject = "Sign in to Atelier";
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table align="center" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin:0 auto">
  <tr><td style="padding:32px 24px 16px;text-align:center">
    <span style="font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7b46cb">Atelier</span>
  </td></tr>
  <tr><td style="padding:0 24px">
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border:1px solid #e5e5e5;border-radius:8px">
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#171717">Sign in to Atelier</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#525252">Click the link below to sign in to your Atelier account:</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%">
          <tr><td style="background:#7b46cb;border-radius:6px;text-align:center">
            <a href="${link}" style="display:block;padding:12px 24px;font-size:13px;font-weight:600;color:#fff;text-decoration:none">Sign in to Atelier &rarr;</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:12px;color:#a3a3a3">This link expires in 15 minutes. If you did not request this, ignore this email.</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px;text-align:center;font-size:12px;color:#a3a3a3">
    <p style="margin:0">Questions? <a href="mailto:contact@atelier.ws" style="color:#7b46cb;text-decoration:none">contact@atelier.ws</a></p>
  </td></tr>
</table>
</body></html>`;
  const text = `Sign in to Atelier\n\nClick the link to sign in to your Atelier account:\n\n${link}\n\nThis link expires in 15 minutes.`;

  const spToken = await getSendPulseToken(env);
  await fetch(`${SENDPULSE_API_BASE_AUTH}/smtp/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${spToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: {
        html: utf8ToBase64Auth(html),
        text,
        subject,
        from: {
          name: "Atelier",
          email: env.LICENSE_FROM_EMAIL ?? "noreply@atelier.ws",
        },
        to: [{ name: "", email: to }],
      },
    }),
  });
}

// ── POST /api/auth/email/start ────────────────────────────────────────────────

export async function handleAuthEmailStart(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const cliRedirect =
      typeof body.cli_redirect === "string" && body.cli_redirect.length > 0
        ? body.cli_redirect
        : null;

    // Basic validation — fail silently so we don't reveal whether email exists
    if (!email.includes("@") || !email.includes(".")) {
      return json({ ok: true });
    }

    const token = crypto.randomUUID();
    const expiresAt = isoNow(15 * 60); // 15 minutes

    await env.AUTH_DB.prepare(
      `INSERT INTO auth_email_logins (token, email, cli_redirect, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(token, email, cliRedirect, isoNow(), expiresAt)
      .run();

    await sendMagicLinkEmail(env, email, token);
  } catch {
    // Fail silently — never reveal what went wrong
  }

  return json({ ok: true });
}

// ── GET /api/auth/email/verify ────────────────────────────────────────────────

export async function handleAuthEmailVerify(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");

  const url = new URL(request.url);
  const token = url.searchParams.get("email_token") ?? "";

  if (!token) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/account?error=invalid_link" },
    });
  }

  const now = isoNow();

  const row = await env.AUTH_DB.prepare(
    `SELECT email, cli_redirect FROM auth_email_logins
      WHERE token = ? AND used = 0 AND expires_at > ?`,
  )
    .bind(token, now)
    .first<{ email: string; cli_redirect: string | null }>();

  if (!row) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/account?error=invalid_link" },
    });
  }

  // Mark token used
  await env.AUTH_DB.prepare(
    `UPDATE auth_email_logins SET used = 1 WHERE token = ?`,
  )
    .bind(token)
    .run();

  // Upsert user in AUTH_DB
  const existing = await env.AUTH_DB.prepare(
    `SELECT user_id, plan FROM auth_users WHERE LOWER(email) = LOWER(?)`,
  )
    .bind(row.email)
    .first<{ user_id: string; plan: string }>();

  let userId: string;
  if (existing) {
    userId = existing.user_id;
    await env.AUTH_DB.prepare(
      `UPDATE auth_users SET updated_at = ? WHERE user_id = ?`,
    )
      .bind(isoNow(), userId)
      .run();
  } else {
    userId = crypto.randomUUID();
    const plan = await resolveUserPlan(env.LICENSE_DB, row.email);
    const ts = isoNow();
    await env.AUTH_DB.prepare(
      `INSERT INTO auth_users (user_id, email, plan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(userId, row.email.toLowerCase(), plan, ts, ts)
      .run();
  }

  // Create 30-day session
  const sessionToken = crypto.randomUUID();
  const expiresAt = isoNow(SESSION_TTL_SECONDS);
  await env.AUTH_DB.prepare(
    `INSERT INTO auth_sessions (token, user_id, device_name, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(sessionToken, userId, null, isoNow(), expiresAt, isoNow())
    .run();

  // Redirect
  let dest: string;
  if (row.cli_redirect) {
    dest = `/account?token=${encodeURIComponent(sessionToken)}&email=${encodeURIComponent(row.email)}&cli_redirect=${encodeURIComponent(row.cli_redirect)}&pending_cli=1`;
  } else {
    dest = `/account?token=${encodeURIComponent(sessionToken)}&email=${encodeURIComponent(row.email)}`;
  }

  return new Response(null, { status: 302, headers: { Location: dest } });
}
