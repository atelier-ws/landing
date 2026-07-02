const CHECKOUT_CLAIM_TTL_SECONDS = 48 * 60 * 60;

export type LicenseEnv = Env & {
  STRIPE_SECRET_KEY?: string;
};

type StoredLicense = {
  plan: string;
  expires_at: number | null;
};

type CheckoutIdentity = {
  customerId: string | null;
  email: string;
  createdAt: number;
};

// ── Checkout claim ────────────────────────────────────────────────────────────

export async function handleCheckoutClaim(
  request: Request,
  env: LicenseEnv,
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

    return json({
      email: checkout.email,
      plan: license.plan,
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
      `SELECT plan, expires_at
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
