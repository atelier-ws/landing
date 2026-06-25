import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Device = {
  token_prefix: string; // used as React key + remove identifier
  device_id: string; // stable machine-derived ID for display
  device_name: string;
  created_at: string;
  last_seen_at: string;
};

type AuthUser = {
  user_id: string;
  email: string;
  plan: string;
  stripe_customer: string | null;
  devices: Device[];
  cli_device_count: number;
  cli_device_limit: number;
};

type View = "loading" | "loggedout" | "account";

const COOKIE_NAME = "atelier_auth_token";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// ── Cookie helpers ──────────────────────────────────────────────────────────

function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(
      `(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`,
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; secure; samesite=lax`;
}

function removeCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; secure; samesite=lax`;
}

function formatDate(isoOrUnix: string | number): string {
  const ms =
    typeof isoOrUnix === "number"
      ? isoOrUnix * 1000
      : new Date(isoOrUnix).getTime();
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Provider icons ──────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Logged-out view ────────────────────────────────────────────────

function LoggedOutView({ cliRedirect }: { cliRedirect: string | null }) {
  const [emailInput, setEmailInput] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );

  function startOAuth(provider: "github" | "google") {
    const params = new URLSearchParams({
      provider,
      redirect_uri: "/account",
    });
    if (cliRedirect) params.set("cli_redirect", cliRedirect);
    window.location.href = `/oauth/start?${params}`;
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setEmailState("sending");
    try {
      await fetch("/api/auth/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput,
          ...(cliRedirect ? { cli_redirect: cliRedirect } : {}),
        }),
      });
    } catch {
      // fail silently — always show success
    }
    setEmailState("sent");
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* ── Header ── */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Sign in
          </h1>
          <p className="mt-1.5 text-xs uppercase tracking-widest text-neutral-500">
            to your Atelier account
          </p>
        </div>

        {/* ── Card ── */}
        <div className="border border-neutral-200 bg-white p-8">
          {/* GitHub */}
          <button
            type="button"
            onClick={() => startOAuth("github")}
            className="flex w-full items-center justify-center gap-3 bg-neutral-950 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            <GitHubIcon />
            Continue with GitHub
          </button>

          {/* Google */}
          <button
            type="button"
            onClick={() => startOAuth("google")}
            className="mt-3 flex w-full items-center justify-center gap-3 border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* ── Divider ── */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-neutral-100" />
            <span className="text-xs uppercase tracking-widest text-neutral-400">
              or
            </span>
            <div className="flex-1 border-t border-neutral-100" />
          </div>

          {/* ── Email ── */}
          {emailState === "sent" ? (
            <div className="flex flex-col items-center gap-2 py-1 text-center">
              <span className="text-2xl">✉️</span>
              <p className="text-sm text-neutral-600">
                Check your inbox — link sent.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => void submitEmail(e)}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full border border-neutral-200 bg-[#f7f8fb] px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-brand"
              />
              <button
                type="submit"
                disabled={emailState === "sending"}
                className="w-full border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
              >
                {emailState === "sending" ? "Sending…" : "Send sign-in link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Logged-in view ──────────────────────────────────────────────────────────

function AccountPanel({
  user,
  sessionToken,
  upgraded,
  onSignOut,
}: {
  user: AuthUser;
  sessionToken: string | null;
  upgraded: boolean;
  onSignOut: () => void;
}) {
  const [devices, setDevices] = useState<Device[]>(user.devices);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isPro = user.plan === "pro" || user.plan === "enterprise";

  async function openBillingPortal() {
    try {
      const res = await fetch("/api/account/billing-portal", {
        method: "POST",
        credentials: "include",
        headers: sessionToken
          ? { Authorization: `Bearer ${sessionToken}` }
          : {},
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setActionError(data.error ?? "Could not open billing portal.");
      }
    } catch {
      setActionError("Network error. Try again.");
    }
  }

  async function openCheckout(billing: "monthly" | "yearly") {
    setBusy(`checkout-${billing}`);
    try {
      const res = await fetch("/api/account/checkout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ billing }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else setActionError(data.error ?? "Could not start checkout.");
    } catch {
      setActionError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function removeDevice(tokenPrefix: string) {
    setBusy(tokenPrefix);
    setActionError(null);
    try {
      const res = await fetch("/api/auth/devices/remove", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_prefix: tokenPrefix }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        devices?: Device[];
        error?: string;
      };
      if (data.ok && data.devices) {
        setDevices(data.devices);
      } else {
        setActionError(data.error ?? "Failed to remove device.");
      }
    } catch {
      setActionError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy("signout");
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // proceed regardless
    }
    removeCookie(COOKIE_NAME);
    onSignOut();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Signed in as</p>
          <p className="mt-0.5 text-base font-bold text-neutral-950">
            {user.email}
          </p>
        </div>
        <span
          className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
            isPro
              ? "bg-green-100 text-green-800"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {isPro ? user.plan : "Free"}
        </span>
      </div>

      {/* ── Upgrade success banner ─────────────────────────────────────── */}
      {upgraded && (
        <div className="mt-4 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Welcome to Pro! Your plan has been upgraded.
        </div>
      )}

      {/* ── Billing ─────────────────────────────────────────────────────── */}
      {isPro && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => void openBillingPortal()}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Manage billing →
          </button>
        </div>
      )}
      {!isPro && (
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => void openCheckout("monthly")}
            disabled={busy === "checkout-monthly"}
            className="text-sm font-medium text-brand hover:opacity-80 disabled:opacity-50"
          >
            {busy === "checkout-monthly" ? "Redirecting…" : "Upgrade monthly →"}
          </button>
          <span className="text-neutral-300">or</span>
          <button
            type="button"
            onClick={() => void openCheckout("yearly")}
            disabled={busy === "checkout-yearly"}
            className="text-sm font-medium text-neutral-500 hover:text-brand disabled:opacity-50"
          >
            {busy === "checkout-yearly"
              ? "Redirecting…"
              : "Yearly (save 20%) →"}
          </button>
        </div>
      )}

      {/* ── Devices ──────────────────────────────────────────────────── */}
      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-700">
          CLI Devices
        </h2>
        <span className="text-xs text-neutral-500">
          {user.cli_device_count} of {user.cli_device_limit} used
        </span>
      </div>

      {devices.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No active sessions.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-200 border border-neutral-200">
          {devices.map((device) => (
            <li
              key={device.token_prefix}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <div className="text-sm font-bold text-neutral-950">
                  {device.device_name}
                </div>
                <div className="font-mono text-xs text-neutral-400">
                  {device.device_id}
                </div>
                <div className="text-xs text-neutral-500">
                  Last seen {formatDate(device.last_seen_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void removeDevice(device.token_prefix)}
                disabled={busy !== null}
                className="shrink-0 border border-neutral-300 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {busy === device.token_prefix
                  ? "Removing…"
                  : "Sign out this device"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {actionError && (
        <p role="alert" className="mt-4 text-xs text-red-700">
          {actionError}
        </p>
      )}

      {/* ── Sign-out actions ─────────────────────────────────────────────── */}
      <div className="mt-8 flex gap-4 border-t border-neutral-200 pt-6">
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy === "signout"}
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900 disabled:opacity-60"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Root component ──────────────────────────────────────────────────────

export default function AccountView() {
  const [view, setView] = useState<View>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingCli, setPendingCli] = useState(false);
  const [cliRedirectUrl, setCliRedirectUrl] = useState<string | null>(null);
  const [cliDeviceName, setCliDeviceName] = useState<string>("Atelier CLI");
  const [cliDeviceId, setCliDeviceId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [cliAuthError, setCliAuthError] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    // 1. Check URL params for token from OAuth/email callback
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const pendingCliParam = params.get("pending_cli");
    const cliRedirectParam = params.get("cli_redirect");
    const deviceNameParam = params.get("device_name");
    const deviceIdParam = params.get("stable_device_id");
    const emailToken = params.get("email_token");

    // Check for post-checkout success flag
    if (params.get("upgraded") === "1") {
      setUpgraded(true);
      params.delete("upgraded");
      const newSearch = params.toString();
      history.replaceState(
        null,
        "",
        window.location.pathname + (newSearch ? `?${newSearch}` : ""),
      );
    }

    // If we have an email_token, redirect to the verify endpoint
    if (emailToken) {
      window.location.href = `/api/auth/email/verify?email_token=${encodeURIComponent(emailToken)}`;
      return;
    }

    if (urlToken) {
      setCookie(COOKIE_NAME, urlToken, COOKIE_MAX_AGE);
      setSessionToken(urlToken);
      params.delete("token");
      params.delete("email");
      params.delete("pending_cli");
      params.delete("cli_redirect");
      const newSearch = params.toString();
      history.replaceState(
        null,
        "",
        window.location.pathname + (newSearch ? `?${newSearch}` : ""),
      );
    }

    // 2. Check for cookie
    const token = getCookie(COOKIE_NAME);
    if (!token) {
      setView("loggedout");
      return;
    }

    // Ensure sessionToken is always set (needed for CLI authorize button)
    if (!urlToken) setSessionToken(token);

    // 3. Fetch user from server
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        removeCookie(COOKIE_NAME);
        setView("loggedout");
        return;
      }
      const data = (await res.json()) as AuthUser;
      setUser(data);
      setView("account");

      // Show consent screen whenever cli_redirect is present (already-logged-in
      // users land here directly from `atelier login`; post-OAuth users arrive
      // with pending_cli=1 — both cases need the authorize/decline screen).
      if (cliRedirectParam) {
        setPendingCli(true);
        setCliRedirectUrl(cliRedirectParam);
        if (deviceNameParam) setCliDeviceName(deviceNameParam);
        if (deviceIdParam) setCliDeviceId(deviceIdParam);
      }
    } catch {
      removeCookie(COOKIE_NAME);
      setView("loggedout");
    }
  }

  if (view === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="text-sm text-neutral-400">Loading…</span>
      </div>
    );
  }

  if (view === "loggedout" || user === null) {
    const cliRedirect = new URLSearchParams(window.location.search).get(
      "cli_redirect",
    );
    return <LoggedOutView cliRedirect={cliRedirect} />;
  }

  // ── Pending CLI authorization screen (full-screen overlay, covers Nav)
  if (pendingCli && cliRedirectUrl) {
    const isPro = user.plan === "pro" || user.plan === "enterprise";
    async function authorize() {
      if (!cliRedirectUrl || !sessionToken) return;
      setCliAuthError(null);
      try {
        const res = await fetch("/api/auth/cli-token", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            device_name: cliDeviceName,
            stable_device_id: cliDeviceId,
          }),
        });
        if (res.status === 403) {
          setCliAuthError(
            "Device limit reached (3). Remove a device from your account first.",
          );
          return;
        }
        if (!res.ok) {
          setCliAuthError("Failed to authorize. Please try again.");
          return;
        }
        const data = (await res.json()) as { token: string };
        const u = new URL(cliRedirectUrl);
        u.searchParams.set("token", data.token);
        u.searchParams.set("email", user!.email);
        window.location.href = u.toString();
      } catch {
        setCliAuthError("Failed to authorize. Please try again.");
      }
    }

    function decline() {
      setPendingCli(false);
      setCliRedirectUrl(null);
      history.replaceState({}, "", "/account");
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950 px-4">
        <div className="w-full max-w-sm">
          {/* Brand mark */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-brand text-lg font-bold text-white">
              ❯
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-white">
              Atelier
            </span>
          </div>

          {/* Card */}
          <div className="border border-neutral-800 bg-neutral-900 p-8">
            <h1 className="text-lg font-bold tracking-tight text-white">
              Authorize CLI access
            </h1>
            <p className="mt-1.5 text-sm text-neutral-400">
              CLI on this machine is requesting access.
            </p>

            {/* Account info */}
            <div className="mt-6 border border-neutral-800 bg-neutral-950 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-neutral-500">
                Signed in as
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {user.email}
              </p>
              <span
                className={`mt-2 inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  isPro
                    ? "bg-brand/20 text-brand"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {isPro ? user.plan : "Free"}
              </span>
            </div>

            {cliAuthError && (
              <p role="alert" className="mt-4 text-xs text-red-400">
                {cliAuthError}
              </p>
            )}

            {/* Actions */}
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => void authorize()}
                className="flex-1 bg-brand px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-brand-600"
              >
                Authorize
              </button>
              <button
                type="button"
                onClick={decline}
                className="flex-1 border border-neutral-700 bg-transparent px-4 py-3 text-sm font-medium text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-200"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AccountPanel
      user={user}
      sessionToken={sessionToken}
      upgraded={upgraded}
      onSignOut={() => {
        setUser(null);
        setView("loggedout");
      }}
    />
  );
}
