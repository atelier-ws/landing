const CHECKOUT_CLAIM_TTL_SECONDS = 48 * 60 * 60;
const MANAGE_TOKEN_TTL_SECONDS = 10 * 60;

export type LicenseEnv = Env & {
  STRIPE_SECRET_KEY?: string;
};

type StoredLicense = {
  token: string;
  plan: string;
  expires_at: number | null;
};

type CheckoutIdentity = {
  customerId: string | null;
  email: string;
  createdAt: number;
};

// ── Existing: checkout claim ──────────────────────────────────────────────────

export async function handleCheckoutClaim(
  request: Request,
  env: LicenseEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  if (!env.LICENSE_DB || !env.STRIPE_SECRET_KEY) {
    return json({ error: "license_service_unavailable" }, 503);
  }

  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!/^cs_[A-Za-z0-9_]{8,250}$/.test(sessionId)) {
    return json({ error: "invalid_session" }, 400);
  }

  try {
    const checkout = await fetchCheckoutIdentity(
      sessionId,
      env.STRIPE_SECRET_KEY,
    );
    if (checkout.createdAt + CHECKOUT_CLAIM_TTL_SECONDS < unixNow()) {
      return json({ error: "claim_expired" }, 410);
    }

    const license = await findCheckoutLicense(env.LICENSE_DB, checkout);
    if (!license) return json({ status: "pending" }, 202);

    if (env.TELEMETRY_DB && env.SENDPULSE_API_SECRET) {
      const delivered = await env.TELEMETRY_DB.prepare(
        "SELECT session_id FROM license_checkout_deliveries WHERE session_id = ?",
      )
        .bind(sessionId)
        .first<{ session_id: string }>();
      if (!delivered) {
        ctx.waitUntil(
          (async () => {
            await sendLicenseEmail(env, checkout.email, [license], "purchase");
            await env.TELEMETRY_DB.prepare(
              `INSERT OR IGNORE INTO license_checkout_deliveries
                 (session_id, email_hash, sent_at)
               VALUES (?, ?, ?)`,
            )
              .bind(sessionId, await sha256Hex(checkout.email), unixNow())
              .run();
          })().catch((error: unknown) => {
            console.error(
              JSON.stringify({
                message: "license_purchase_email_failed",
                error: errorMessage(error),
              }),
            );
          }),
        );
      }
    }

    return json({
      license_key: license.token,
      expires_at:
        license.expires_at === null
          ? null
          : new Date(license.expires_at * 1000).toISOString(),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "license_checkout_claim_failed",
        error: errorMessage(error),
      }),
    );
    return json({ error: "license_lookup_failed" }, 502);
  }
}

// ── Existing: license recovery (request by email) ─────────────────────────────

export async function handleLicenseRecovery(
  request: Request,
  env: LicenseEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!env.TELEMETRY_DB || !env.LICENSE_DB) {
    return json({ error: "license_service_unavailable" }, 503);
  }

  try {
    const body: unknown = JSON.parse(await readBoundedText(request, 4096));
    const email = normalizeEmail(record(body)?.email);
    if (!email) return json({ error: "invalid_email" }, 400);

    const emailHash = await sha256Hex(email);
    const now = unixNow();
    const licenses = await env.LICENSE_DB.prepare(
      `SELECT token, plan, expires_at
         FROM licenses
        WHERE lower(email) = ?
          AND revoked = 0
          AND (expires_at IS NULL OR expires_at >= ?)
        ORDER BY updated_at DESC
        LIMIT 10`,
    )
      .bind(email, now)
      .all<StoredLicense>();

    if (licenses.results.length > 0) {
      // Track request count (no cooldown — user can request a new token freely).
      await env.TELEMETRY_DB.prepare(
        `INSERT INTO license_recovery_requests (email_hash, last_sent_at, request_count)
         VALUES (?, ?, 1)
         ON CONFLICT(email_hash) DO UPDATE SET
           last_sent_at = excluded.last_sent_at,
           request_count = license_recovery_requests.request_count + 1`,
      )
        .bind(emailHash, now)
        .run();

      // Generate a short-lived manage token for the email link.
      const rawToken = crypto.randomUUID();
      await env.TELEMETRY_DB.prepare(
        `INSERT INTO license_manage_tokens (token, email_hash, email, created_at, expires_at, used)
         VALUES (?, ?, ?, ?, ?, 0)`,
      )
        .bind(rawToken, emailHash, email, now, now + MANAGE_TOKEN_TTL_SECONDS)
        .run();

      try {
        await sendLicenseEmail(
          env,
          email,
          licenses.results,
          "recovery",
          rawToken,
        );
        return json({ sent: true }, 200);
      } catch (error: unknown) {
        console.error(
          JSON.stringify({
            message: "license_recovery_email_failed",
            error: errorMessage(error),
          }),
        );
        return json(
          {
            sent: false,
            error:
              "The email could not be delivered. Try again shortly or contact support.",
          },
          502,
        );
      }
    }

    // No matching license — don't reveal whether the address exists.
    return json({ accepted: true }, 202);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "license_recovery_failed",
        error: errorMessage(error),
      }),
    );
    return json({ accepted: true }, 202);
  }
}

// ── Manage page — fetch licenses by manage token ──────────────────────────────

export async function handleLicenseManage(
  request: Request,
  env: LicenseEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return json({ error: "missing_token" }, 400);

  const row = await env.TELEMETRY_DB?.prepare(
    `SELECT email, expires_at, created_at FROM license_manage_tokens
      WHERE token = ? AND used = 0 AND expires_at > ?`,
  )
    .bind(token, unixNow())
    .first<{ email: string; expires_at: number; created_at: number }>();
  if (!row || !row.email)
    return json({ error: "invalid_or_expired_token" }, 401);

  const email = normalizeEmail(row.email);
  if (!email) return json({ error: "invalid_or_expired_token" }, 401);

  const licenses = await env.LICENSE_DB.prepare(
    `SELECT token, plan, expires_at
       FROM licenses
      WHERE lower(email) = ?
        AND revoked = 0
        AND (expires_at IS NULL OR expires_at >= ?)
      ORDER BY updated_at DESC
      LIMIT 10`,
  )
    .bind(email, unixNow())
    .all<StoredLicense>();

  return json({
    licenses: licenses.results,
    email,
    token,
    expires_at: row.expires_at,
    max_expires_at: row.created_at + MAX_SESSION_SECONDS,
  });
}

const MAX_SESSION_SECONDS = 3600; // 1 hr hard cap from creation

// ── Renew a manage token (extend expiry while page is active) ─────────────────

export async function handleManageRenew(
  request: Request,
  env: LicenseEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const body = record(await readJson(request));
  const token = text(body?.manage_token, 512);
  if (!token) return json({ error: "missing_token" }, 400);

  const now = unixNow();
  const row = await env.TELEMETRY_DB?.prepare(
    `SELECT email, created_at FROM license_manage_tokens
      WHERE token = ? AND used = 0 AND expires_at > ?`,
  )
    .bind(token, now)
    .first<{ email: string; created_at: number }>();

  if (!row) return json({ error: "invalid_or_expired_token" }, 401);

  // Hard cap: never extend past created_at + MAX_SESSION_SECONDS
  const maxExpiry = row.created_at + MAX_SESSION_SECONDS;
  const newExpiry = Math.min(now + MANAGE_TOKEN_TTL_SECONDS, maxExpiry);
  await env.TELEMETRY_DB?.prepare(
    `UPDATE license_manage_tokens SET expires_at = ? WHERE token = ?`,
  )
    .bind(newExpiry, token)
    .run();

  return json({ ok: true, expires_at: newExpiry, max_expires_at: maxExpiry });
}

// ── Revoke a license key (authenticated by manage token) ──────────────────────

export async function handleManageRevokeKey(
  request: Request,
  env: LicenseEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const body = record(await readJson(request));
  const token = text(body?.manage_token, 512);
  const licenseToken = text(body?.license_token, 8192);
  if (!token || !licenseToken) return json({ error: "missing_fields" }, 400);

  // Validate manage token and get the associated email
  const row = await env.TELEMETRY_DB?.prepare(
    `SELECT email FROM license_manage_tokens
      WHERE token = ? AND used = 0 AND expires_at > ?`,
  )
    .bind(token, unixNow())
    .first<{ email: string }>();

  if (!row) return json({ error: "invalid_or_expired_token" }, 401);

  const email = normalizeEmail(row.email);
  if (!email) return json({ error: "invalid_or_expired_token" }, 401);

  // Revoke only if the license key belongs to this user's email
  const result = await env.LICENSE_DB.prepare(
    `UPDATE licenses SET revoked = 1, revoked_at = ?
      WHERE token = ? AND lower(email) = ? AND revoked = 0`,
  )
    .bind(unixNow(), licenseToken, email)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: "license_not_found" }, 404);
  }

  return json({ ok: true });
}

// ── List devices (authenticated by manage token) ─────────────────────────────

type ManageDevice = {
  device_id: string;
  name: string;
  created_at: number;
  last_seen_at: number;
};

export async function handleManageListDevices(
  request: Request,
  env: LicenseEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return json({ error: "missing_token" }, 400);

  const row = await env.TELEMETRY_DB?.prepare(
    `SELECT email FROM license_manage_tokens
      WHERE token = ? AND used = 0 AND expires_at > ?`,
  )
    .bind(token, unixNow())
    .first<{ email: string }>();

  if (!row) return json({ error: "invalid_or_expired_token" }, 401);

  const email = normalizeEmail(row.email);
  if (!email) return json({ error: "invalid_or_expired_token" }, 401);

  const devices = await env.LICENSE_DB.prepare(
    `SELECT d.device_id, d.name, d.created_at, d.last_seen_at
       FROM devices d
       JOIN licenses l ON d.license_id = l.license_id
      WHERE lower(l.email) = ?
        AND d.revoked_at IS NULL
      ORDER BY d.last_seen_at DESC`,
  )
    .bind(email)
    .all<ManageDevice>();

  return json({ devices: devices.results });
}

// ── Remove a device (authenticated by manage token) ──────────────────────────

export async function handleManageRemoveDevice(
  request: Request,
  env: LicenseEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const body = record(await readJson(request));
  const token = text(body?.manage_token, 512);
  const deviceId = text(body?.device_id, 512);
  if (!token || !deviceId) return json({ error: "missing_fields" }, 400);

  const row = await env.TELEMETRY_DB?.prepare(
    `SELECT email FROM license_manage_tokens
      WHERE token = ? AND used = 0 AND expires_at > ?`,
  )
    .bind(token, unixNow())
    .first<{ email: string }>();

  if (!row) return json({ error: "invalid_or_expired_token" }, 401);

  const email = normalizeEmail(row.email);
  if (!email) return json({ error: "invalid_or_expired_token" }, 401);

  const result = await env.LICENSE_DB.prepare(
    `UPDATE devices SET revoked_at = ?
      WHERE device_id = ?
        AND revoked_at IS NULL
        AND license_id IN (
          SELECT license_id FROM licenses WHERE lower(email) = ?
        )`,
  )
    .bind(unixNow(), deviceId, email)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: "device_not_found" }, 404);
  }

  return json({ ok: true });
}

// ── Account login (email magic link, 7-day token) ─────────────────────────────

const ACCOUNT_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function handleAccountLogin(
  request: Request,
  env: LicenseEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!env.TELEMETRY_DB || !env.LICENSE_DB) {
    return json({ error: "license_service_unavailable" }, 503);
  }

  try {
    const body: unknown = JSON.parse(await readBoundedText(request, 4096));
    const email = normalizeEmail(record(body)?.email);
    if (!email) return json({ error: "invalid_email" }, 400);

    const emailHash = await sha256Hex(email);
    const now = unixNow();

    // Check if the email has any license (active, expired, or revoked)
    const license = await env.LICENSE_DB.prepare(
      `SELECT token FROM licenses WHERE lower(email) = ? LIMIT 1`,
    )
      .bind(email)
      .first<{ token: string }>();

    if (license) {
      // Generate a 7-day account token
      const rawToken = crypto.randomUUID();
      await env.TELEMETRY_DB.prepare(
        `INSERT INTO license_manage_tokens (token, email_hash, email, created_at, expires_at, used)
         VALUES (?, ?, ?, ?, ?, 0)`,
      )
        .bind(rawToken, emailHash, email, now, now + ACCOUNT_TOKEN_TTL_SECONDS)
        .run();

      try {
        await sendAccountEmail(env, email, rawToken);
        return json({ sent: true }, 200);
      } catch (error: unknown) {
        console.error(
          JSON.stringify({
            message: "account_login_email_failed",
            error: errorMessage(error),
          }),
        );
        return json(
          {
            sent: false,
            error:
              "The email could not be delivered. Try again shortly or contact support.",
          },
          502,
        );
      }
    }

    // No matching email — don't reveal whether the address exists.
    return json({ accepted: true }, 202);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "account_login_failed",
        error: errorMessage(error),
      }),
    );
    return json({ accepted: true }, 202);
  }
}

// ── Account data — return licenses + devices for authenticated user ──────────

type AccountLicense = {
  token: string;
  plan: string;
  expires_at: number | null;
  revoked: number;
  stripe_customer: string | null;
  status: "active" | "expired" | "revoked";
};

function parseCookieHeader(cookie: string, name: string): string | null {
  const match = cookie.match(
    new RegExp(
      `(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`,
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export async function handleAccountMe(
  request: Request,
  env: LicenseEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const cookie = request.headers.get("Cookie") ?? "";
  const token =
    parseCookieHeader(cookie, "manage_token") ||
    url.searchParams.get("token") ||
    "";
  if (!token) return json({ error: "missing_token" }, 400);

  const now = unixNow();
  const row = await env.TELEMETRY_DB?.prepare(
    `SELECT email, expires_at, created_at FROM license_manage_tokens
      WHERE <redacted-credential>`,
  )
    .bind(token, now)
    .first<{ email: string; expires_at: number; created_at: number }>();
  if (!row) return json({ error: "invalid_or_expired_token" }, 401);

  const email = normalizeEmail(row.email);
  if (!email) return json({ error: "invalid_or_expired_token" }, 401);

  // Get all licenses (including expired and revoked)
  const licenses = await env.LICENSE_DB.prepare(
    `SELECT token, plan, expires_at, revoked, stripe_customer
       FROM licenses
      WHERE lower(email) = ?
      ORDER BY updated_at DESC
      LIMIT 50`,
  )
    .bind(email)
    .all<{
      token: string;
      plan: string;
      expires_at: number | null;
      revoked: number;
      stripe_customer: string | null;
    }>();

  const accountLicenses: AccountLicense[] = licenses.results.map((l) => ({
    ...l,
    stripe_customer: l.stripe_customer ?? null,
    status: l.revoked
      ? "revoked"
      : l.expires_at !== null && l.expires_at < now
        ? "expired"
        : "active",
  }));

  // Get active devices
  const devices = await env.LICENSE_DB.prepare(
    `SELECT d.device_id, d.name, d.created_at, d.last_seen_at
       FROM devices d
       JOIN licenses l ON d.license_id = l.license_id
      WHERE lower(l.email) = ?
        AND d.revoked_at IS NULL
      ORDER BY d.last_seen_at DESC`,
  )
    .bind(email)
    .all<ManageDevice>();

  return json({
    email,
    licenses: accountLicenses,
    devices: devices.results,
    token,
    expires_at: row.expires_at,
  });
}

// ── Account: remove device ───────────────────────────────────────────────────

export async function handleAccountDevicesRemove(
  request: Request,
  env: LicenseEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const cookie = request.headers.get("Cookie") ?? "";
  const token =
    parseCookieHeader(cookie, "manage_token") ||
    request.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ||
    "";
  if (!token) return json({ error: "missing_token" }, 400);

  const row = await env.TELEMETRY_DB?.prepare(
    `SELECT email FROM license_manage_tokens
      WHERE token = ? AND used = 0 AND expires_at > ?`,
  )
    .bind(token, unixNow())
    .first<{ email: string }>();
  if (!row) return json({ error: "invalid_or_expired_token" }, 401);

  const email = normalizeEmail(row.email);
  if (!email) return json({ error: "invalid_or_expired_token" }, 401);

  const body = record(await readJson(request));
  const deviceId = text(body?.device_id, 512);
  if (!deviceId) return json({ error: "missing_fields" }, 400);

  const result = await env.LICENSE_DB.prepare(
    `UPDATE devices SET revoked_at = ?
      WHERE device_id = ?
        AND revoked_at IS NULL
        AND license_id IN (
          SELECT license_id FROM licenses WHERE lower(email) = ?
        )`,
  )
    .bind(unixNow(), deviceId, email)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: "device_not_found" }, 404);
  }

  return json({ ok: true });
}

// ── Account: revoke key ───────────────────────────────────────────────────────

export async function handleAccountRevokeKey(
  request: Request,
  env: LicenseEnv,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const cookie = request.headers.get("Cookie") ?? "";
  const token =
    parseCookieHeader(cookie, "manage_token") ||
    request.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ||
    "";
  if (!token) return json({ error: "missing_token" }, 400);

  const row = await env.TELEMETRY_DB?.prepare(
    `SELECT email FROM license_manage_tokens
      WHERE token = ? AND used = 0 AND expires_at > ?`,
  )
    .bind(token, unixNow())
    .first<{ email: string }>();
  if (!row) return json({ error: "invalid_or_expired_token" }, 401);

  const email = normalizeEmail(row.email);
  if (!email) return json({ error: "invalid_or_expired_token" }, 401);

  const body = record(await readJson(request));
  const licenseToken = text(body?.license_token, 8192);
  if (!licenseToken) return json({ error: "missing_fields" }, 400);

  const result = await env.LICENSE_DB.prepare(
    `UPDATE licenses SET revoked = 1, revoked_at = ?
      WHERE token = ? AND lower(email) = ? AND revoked = 0`,
  )
    .bind(unixNow(), licenseToken, email)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: "license_not_found" }, 404);
  }

  return json({ ok: true });
}

// ── Account: Stripe billing portal ───────────────────────────────────────────

// ── Shared auth helpers (OAuth session) ──────────────────────────────────────

function extractCookieToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)atelier_auth_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isoNow(offsetSeconds = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");
}

export async function handleAccountBillingPortal(
  request: Request,
  env: LicenseEnv & { AUTH_DB: D1Database },
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!env.STRIPE_SECRET_KEY)
    return json({ error: "billing_unavailable" }, 503);

  // Resolve OAuth session
  const token =
    request.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ||
    extractCookieToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const sessionRow = await env.AUTH_DB.prepare(
    `SELECT u.email, u.stripe_customer
       FROM auth_sessions s
       JOIN auth_users u ON u.user_id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`,
  )
    .bind(token, isoNow())
    .first<{ email: string; stripe_customer: string | null }>();

  if (!sessionRow) return json({ error: "unauthorized" }, 401);

  // Use stripe_customer from auth_users if available, else fall back to licenses table
  let stripeCustomer = sessionRow.stripe_customer;
  if (!stripeCustomer) {
    const lic = await env.LICENSE_DB.prepare(
      `SELECT stripe_customer FROM licenses
        WHERE lower(email) = ? AND stripe_customer IS NOT NULL
        ORDER BY updated_at DESC LIMIT 1`,
    )
      .bind(sessionRow.email.toLowerCase())
      .first<{ stripe_customer: string }>();
    stripeCustomer = lic?.stripe_customer ?? null;
  }

  if (!stripeCustomer) return json({ error: "no_billing_account" }, 404);

  const site =
    (env as unknown as { SITE_URL?: string }).SITE_URL ?? "https://atelier.ws";
  const params = new URLSearchParams({
    customer: stripeCustomer,
    return_url: `${site}/account`,
  });

  const stripeRes = await fetch(
    "https://api.stripe.com/v1/billing_portal/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (!stripeRes.ok) {
    return json({ error: "billing_portal_failed" }, 502);
  }

  const portal = (await stripeRes.json()) as { url: string };
  return json({ url: portal.url });
}

// Payment link URLs — set STRIPE_LINK_MONTHLY / STRIPE_LINK_YEARLY in wrangler secrets
const STRIPE_LINK_MONTHLY_DEFAULT =
  "https://buy.stripe.com/test_fZu00bfXU4iufWJ5zWe7m00";
const STRIPE_LINK_YEARLY_DEFAULT =
  "https://buy.stripe.com/test_eVq7sD9zwaGS5i58M8e7m01";

export async function handleAccountCheckout(
  request: Request,
  env: LicenseEnv & { AUTH_DB: D1Database },
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const token =
    request.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ||
    extractCookieToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const sessionRow = await env.AUTH_DB.prepare(
    `SELECT u.user_id, u.email
       FROM auth_sessions s
       JOIN auth_users u ON u.user_id = s.user_id
      WHERE s.token = ? AND s.expires_at > ? LIMIT 1`,
  )
    .bind(token, isoNow())
    .first<{ user_id: string; email: string }>();
  if (!sessionRow) return json({ error: "unauthorized" }, 401);

  // Pick plan from body
  let billing: "monthly" | "yearly" = "monthly";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.billing === "yearly") billing = "yearly";
  } catch {
    /* default */
  }

  const envAny = env as unknown as Record<string, string>;
  const baseLink =
    billing === "yearly"
      ? (envAny.STRIPE_LINK_YEARLY ?? STRIPE_LINK_YEARLY_DEFAULT)
      : (envAny.STRIPE_LINK_MONTHLY ?? STRIPE_LINK_MONTHLY_DEFAULT);

  const url = new URL(baseLink);
  url.searchParams.set("prefilled_email", sessionRow.email);
  url.searchParams.set("client_reference_id", sessionRow.user_id);

  return json({ url: url.toString() });
}

// ── Account email ────────────────────────────────────────────────────────────

async function sendAccountEmail(
  env: LicenseEnv,
  to: string,
  manageToken: string,
): Promise<void> {
  const site = env.SITE_URL ?? "https://atelier.ws";
  const manageUrl = `${site}/account?token=${encodeURIComponent(manageToken)}`;

  const heading = "Sign in to your account";
  const message =
    "Click the button below to sign in and manage your licenses and devices.";

  const text = `${heading}\n\n${message}\n\n${manageUrl}\n\nIf you did not request this, you can ignore this email.\n\nSupport: contact@atelier.ws`;

  const html = emailHtmlTemplate({ heading, message, manageUrl });

  const token = await getAccessToken(
    env.SENDPULSE_API_ID,
    env.SENDPULSE_API_SECRET,
  );

  const response = await fetch(`${SENDPULSE_API_BASE}/smtp/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: {
        html: utf8ToBase64(html),
        text,
        subject: heading,
        from: {
          name: "Atelier",
          email: "licenses@atelier.ws",
        },
        to: [{ name: "", email: to }],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `SendPulse rejected the email (${response.status}): ${await response.text()}`,
    );
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function fetchCheckoutIdentity(
  sessionId: string,
  stripeSecretKey: string,
): Promise<CheckoutIdentity> {
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
  );
  if (!response.ok) {
    throw new Error(`stripe_checkout_lookup_failed_${response.status}`);
  }

  const session = record(await response.json<unknown>());
  const paymentStatus = stringValue(session?.payment_status);
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    throw new Error("checkout_not_paid");
  }

  const customerDetails = record(session?.customer_details);
  const email = normalizeEmail(
    customerDetails?.email ?? session?.customer_email,
  );
  const customerId = objectId(session?.customer);
  const createdAt = positiveInt(session?.created);
  if (!email || !createdAt) throw new Error("checkout_missing_identity");
  return { customerId, email, createdAt };
}

async function findCheckoutLicense(
  db: D1Database,
  checkout: CheckoutIdentity,
): Promise<StoredLicense | null> {
  return db
    .prepare(
      `SELECT token, plan, expires_at
         FROM licenses
        WHERE revoked = 0
          AND (
            (? IS NOT NULL AND stripe_customer = ?)
            OR lower(email) = ?
          )
        ORDER BY updated_at DESC
        LIMIT 1`,
    )
    .bind(checkout.customerId, checkout.customerId, checkout.email)
    .first<StoredLicense>();
}

// ── Email sending ─────────────────────────────────────────────────────────────

const SENDPULSE_API_BASE = "https://api.sendpulse.com";

const SENDER_BY_PLAN: Record<string, string> = {
  free: "free@atelier.ws",
  pro: "licenses@atelier.ws",
  enterprise: "licenses@atelier.ws",
};

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function getAccessToken(
  apiId: string,
  apiSecret: string,
): Promise<string> {
  const res = await fetch(`${SENDPULSE_API_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: apiId,
      client_secret: apiSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`SendPulse auth failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function emailHtmlTemplate(opts: {
  heading: string;
  message: string;
  manageUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table align="center" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin:0 auto">
  <tr><td style="padding:32px 24px 16px;text-align:center">
    <span style="font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7b46cb">Atelier Pro</span>
  </td></tr>
  <tr><td style="padding:0 24px">
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border:1px solid #e5e5e5;border-radius:8px">
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#171717">${escapeHtml(opts.heading)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.5;color:#525252">${escapeHtml(opts.message)}</p>
        <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;width:100%">
            <tr><td style="background:#7b46cb;border-radius:6px;text-align:center">
            <a href="${escapeHtml(opts.manageUrl)}" style="display:block;padding:12px 24px;font-size:13px;font-weight:600;color:#fff;text-decoration:none">Manage your licenses →</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px;text-align:center;font-size:12px;color:#a3a3a3">
    <p style="margin:0">Questions? <a href="mailto:contact@atelier.ws" style="color:#7b46cb;text-decoration:none">contact@atelier.ws</a></p>
  </td></tr>
</table>
</body>
</html>`;
}

async function sendLicenseEmail(
  env: LicenseEnv,
  to: string,
  licenses: StoredLicense[],
  reason: "purchase" | "recovery",
  manageToken?: string,
): Promise<void> {
  const site = env.SITE_URL ?? "https://atelier.ws";
  const manageUrl = manageToken
    ? `${site}/license/manage?token=${encodeURIComponent(manageToken)}`
    : `${site}/license/manage`;

  const heading =
    reason === "recovery"
      ? "Your Atelier Pro license"
      : "Your Atelier Pro license";

  const message =
    reason === "recovery"
      ? "We received your license recovery request. Sign in to view your license keys and manage your devices."
      : "Thank you for purchasing Atelier Pro. Sign in to view your license key and manage your devices.";

  const text = `${heading}\n\n${message}\n\nManage your licenses: ${manageUrl}\n\nSupport: contact@atelier.ws`;

  const html = emailHtmlTemplate({
    heading,
    message,
    manageUrl,
  });

  const token = await getAccessToken(
    env.SENDPULSE_API_ID,
    env.SENDPULSE_API_SECRET,
  );

  const response = await fetch(`${SENDPULSE_API_BASE}/smtp/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: {
        html: utf8ToBase64(html),
        text,
        subject: heading,
        from: {
          name: "Atelier",
          email: SENDER_BY_PLAN[licenses[0].plan] ?? "licenses@atelier.ws",
        },
        to: [{ name: "", email: to }],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `SendPulse rejected the email (${response.status}): ${await response.text()}`,
    );
  }
}

async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > maxBytes) throw new Error("request_too_large");
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function objectId(value: unknown): string | null {
  return stringValue(value) ?? stringValue(record(value)?.id);
}

async function readJson(request: Request): Promise<unknown> {
  return request.json();
}

function text(value: unknown, maxLength: number): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength
    ? value
    : null;
}

function positiveInt(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    ? email
    : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return value.replace(
    /[&<>"']/g,
    (character) => entities[character] ?? character,
  );
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function methodNotAllowed(allow: string): Response {
  return json({ error: "method_not_allowed" }, 405, { Allow: allow });
}

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
