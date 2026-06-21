const CHECKOUT_CLAIM_TTL_SECONDS = 48 * 60 * 60;
const RECOVERY_COOLDOWN_SECONDS = 10 * 60;

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
    const checkout = await fetchCheckoutIdentity(sessionId, env.STRIPE_SECRET_KEY);
    if (checkout.createdAt + CHECKOUT_CLAIM_TTL_SECONDS < unixNow()) {
      return json({ error: "claim_expired" }, 410);
    }

    const license = await findCheckoutLicense(env.LICENSE_DB, checkout);
    if (!license) return json({ status: "pending" }, 202);

    if (env.TELEMETRY_DB && env.EMAIL) {
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

export async function handleLicenseRecovery(
  request: Request,
  env: LicenseEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!env.TELEMETRY_DB || !env.LICENSE_DB || !env.EMAIL) {
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
      const previous = await env.TELEMETRY_DB.prepare(
        "SELECT last_sent_at FROM license_recovery_requests WHERE email_hash = ?",
      )
        .bind(emailHash)
        .first<{ last_sent_at: number }>();
      if (previous && now - previous.last_sent_at < RECOVERY_COOLDOWN_SECONDS) {
        return json({ accepted: true }, 202);
      }

      await env.TELEMETRY_DB.prepare(
        `INSERT INTO license_recovery_requests (email_hash, last_sent_at, request_count)
         VALUES (?, ?, 1)
         ON CONFLICT(email_hash) DO UPDATE SET
           last_sent_at = excluded.last_sent_at,
           request_count = license_recovery_requests.request_count + 1`,
      )
        .bind(emailHash, now)
        .run();

      ctx.waitUntil(
        sendLicenseEmail(env, email, licenses.results, "recovery").catch(
          (error: unknown) => {
            console.error(
              JSON.stringify({
                message: "license_recovery_email_failed",
                error: errorMessage(error),
              }),
            );
          },
        ),
      );
    }

    // Deliberately identical for known and unknown addresses.
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
  const email = normalizeEmail(customerDetails?.email ?? session?.customer_email);
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

async function sendLicenseEmail(
  env: LicenseEnv,
  to: string,
  licenses: StoredLicense[],
  reason: "purchase" | "recovery",
): Promise<void> {
  const heading =
    reason === "recovery"
      ? "Your recovered Atelier Pro license"
      : "Your Atelier Pro license";
  const rows = licenses
    .map(({ token, expires_at }) => {
      const expiry =
        expires_at === null
          ? "Lifetime"
          : new Date(expires_at * 1000).toISOString().slice(0, 10);
      return `${token}\n\nActivate with:\natelier license activate ${token}\n\nValid through: ${expiry}`;
    })
    .join("\n\n---\n\n");
  const htmlRows = licenses
    .map(({ token, expires_at }) => {
      const expiry =
        expires_at === null
          ? "Lifetime"
          : new Date(expires_at * 1000).toISOString().slice(0, 10);
      const command = `atelier license activate ${token}`;
      return `<p>License key:</p><pre style="white-space:pre-wrap;word-break:break-all;background:#111827;color:#f9fafb;padding:16px">${escapeHtml(token)}</pre><p>Activate with:</p><pre style="white-space:pre-wrap;word-break:break-all;background:#111827;color:#f9fafb;padding:16px">${escapeHtml(command)}</pre><p>Valid through: ${expiry}</p>`;
    })
    .join("");

  await env.EMAIL.send({
    to,
    from: { email: env.LICENSE_FROM_EMAIL, name: "Atelier" },
    replyTo: "contact@atelier.ws",
    subject: heading,
    text: `${heading}\n\n${rows}\n\nAfter activation, the key is stored at ~/.atelier/license.key.\n\nSupport: contact@atelier.ws`,
    html: `<h1>${heading}</h1>${htmlRows}<p>After activation, the key is stored at <code>~/.atelier/license.key</code>.</p><p>Support: <a href="mailto:contact@atelier.ws">contact@atelier.ws</a></p>`,
  });
}

async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
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
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
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
