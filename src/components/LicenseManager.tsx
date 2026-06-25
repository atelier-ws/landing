import { useEffect, useRef, useState } from "react";

type License = {
  token: string;
  plan: string;
  expires_at: number | null;
};

type Device = {
  device_id: string;
  name: string;
  created_at: number;
  last_seen_at: number;
};

type View = "loading" | "manage" | "link_invalid";

const RENEW_INTERVAL_MS = 60_000; // attempt renewal every 60s
const WARN_BEFORE_MS = 120_000; // warn when less than 2 min remain

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatExpiry(unixSeconds: number | null): string {
  if (unixSeconds === null) return "Lifetime";
  return formatDate(unixSeconds);
}

function formatPlan(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export default function LicenseManager() {
  const [view, setView] = useState<View>("loading");
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionExpiring, setSessionExpiring] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [sendLinkState, setSendLinkState] = useState<
    "idle" | "sending" | "sent"
  >("idle");
  const activeRef = useRef(false);
  const renewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Activity tracking ─────────────────────────────────────────────────────
  useEffect(() => {
    const markActive = () => {
      activeRef.current = true;
    };
    window.addEventListener("mousemove", markActive, { passive: true });
    window.addEventListener("click", markActive, { passive: true });
    window.addEventListener("keydown", markActive, { passive: true });
    window.addEventListener("touchstart", markActive, { passive: true });
    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("click", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
    };
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setView("link_invalid");
      return;
    }
    // Strip the token from the address bar so it isn't bookmarked or shared.
    window.history.replaceState({}, "", window.location.pathname);

    void (async () => {
      try {
        const [licRes, devRes] = await Promise.all([
          fetch(`/api/license/manage?token=${encodeURIComponent(token)}`, {
            headers: { Accept: "application/json" },
          }),
          fetch(
            `/api/license/manage/devices?token=${encodeURIComponent(token)}`,
            {
              headers: { Accept: "application/json" },
            },
          ),
        ]);
        if (!licRes.ok) throw new Error("invalid");
        const licData = (await licRes.json()) as {
          licenses: License[];
          email?: string;
          token: string;
          expires_at: number;
          max_expires_at: number;
        };
        setManageToken(token);
        setLicenses(licData.licenses);
        setSessionExpiresAt(licData.expires_at);

        if (devRes.ok) {
          const devData = (await devRes.json()) as { devices: Device[] };
          setDevices(devData.devices);
        }

        setRecoveryEmail(licData.email ?? null);
        setView("manage");
      } catch {
        setView("link_invalid");
      }
    })();
  }, []);

  // ── Periodic renewal ──────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "manage" || !manageToken) return;

    const renew = async () => {
      if (!activeRef.current) return; // no activity since last check → skip
      activeRef.current = false;

      try {
        const response = await fetch("/api/license/manage/renew", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ manage_token: manageToken }),
        });
        if (!response.ok) throw new Error("renew_failed");
        const data = (await response.json()) as {
          expires_at: number;
          max_expires_at: number;
        };
        setSessionExpiresAt(data.expires_at);
        // If we've hit the hard cap, stop the renewal timer.
        if (data.expires_at >= data.max_expires_at && renewTimerRef.current) {
          clearInterval(renewTimerRef.current);
          renewTimerRef.current = null;
        }
        setSessionExpiring(false);
      } catch {
        // If renewal fails, the existing expiry remains — next tick may work.
      }
    };

    renewTimerRef.current = setInterval(renew, RENEW_INTERVAL_MS);
    return () => {
      if (renewTimerRef.current) clearInterval(renewTimerRef.current);
    };
  }, [view, manageToken]);

  // ── Expiry warning ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const check = () => {
      const remaining = sessionExpiresAt * 1000 - Date.now();
      setSessionExpiring(remaining < WARN_BEFORE_MS);
    };
    check();
    const tick = setInterval(check, 10_000);
    return () => clearInterval(tick);
  }, [sessionExpiresAt]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const sendNewLink = async () => {
    if (!recoveryEmail || sendLinkState !== "idle") return;
    setSendLinkState("sending");
    try {
      await fetch("/api/license/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      setSendLinkState("sent");
    } catch {
      setSendLinkState("idle");
    }
  };

  const revokeKey = async (licenseToken: string) => {
    if (!manageToken) return;
    if (
      !window.confirm(
        "Revoke this license key? It will stop working on all devices.\n\n" +
          "A new key can be obtained by requesting license recovery.",
      )
    ) {
      return;
    }

    setError(null);
    setBusy(licenseToken);
    try {
      const response = await fetch("/api/license/manage/revoke-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          manage_token: manageToken,
          license_token: licenseToken,
        }),
      });
      if (!response.ok) throw new Error("failed");
      setLicenses((prev) => prev.filter((l) => l.token !== licenseToken));
    } catch {
      setError(
        "Could not revoke that key. Your session may have expired — request a new recovery email.",
      );
    } finally {
      setBusy(null);
    }
  };

  const removeDevice = async (device: Device) => {
    if (!manageToken) return;
    if (
      !window.confirm(
        `Remove "${device.name}"? That machine will need to re-activate to use Pro again.`,
      )
    ) {
      return;
    }

    setError(null);
    setBusy(device.device_id);
    try {
      const response = await fetch("/api/license/manage/devices/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          manage_token: manageToken,
          device_id: device.device_id,
        }),
      });
      if (!response.ok) throw new Error("failed");
      setDevices((prev) =>
        prev.filter((d) => d.device_id !== device.device_id),
      );
    } catch {
      setError(
        "Could not remove that device. Your session may have expired — request a new recovery email.",
      );
    } finally {
      setBusy(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (view === "loading") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  if (view === "link_invalid") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">Link expired</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          That management link is invalid or has expired. Request a fresh one
          via license recovery.
        </p>
        <a
          href="/license/recover"
          className="mt-6 inline-flex bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white no-underline transition hover:bg-brand-700"
        >
          Recover licenses
        </a>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 bg-white p-8">
      <div className="text-xs font-bold uppercase tracking-widest text-brand-700">
        Pro access
      </div>
      <h1 className="mt-3 text-2xl font-bold text-neutral-950">
        Manage your licenses
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        View your license keys and the devices enrolled on your account.
      </p>

      {sessionExpiring && (
        <div
          role="status"
          className="mt-4 flex items-center justify-between gap-4 border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800"
        >
          <span>
            Session expiring soon — interact with the page to keep it alive.
          </span>
          {sendLinkState === "sent" ? (
            <span className="shrink-0 font-bold">Check your email</span>
          ) : (
            <button
              type="button"
              onClick={() => void sendNewLink()}
              disabled={sendLinkState === "sending"}
              className="shrink-0 font-bold underline hover:no-underline disabled:cursor-wait disabled:opacity-60"
            >
              {sendLinkState === "sending" ? "Sending…" : "Send me a new link"}
            </button>
          )}
        </div>
      )}

      {/* ── License keys ─────────────────────────────────────────────────── */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-widest text-neutral-700">
        License Keys
      </h2>

      {licenses.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No active license keys found.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-200 border border-neutral-200">
          {licenses.map((license) => (
            <li
              key={license.token}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-800">
                    {formatPlan(license.plan)}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {formatExpiry(license.expires_at)}
                  </span>
                </div>
                <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-800">
                  {license.token}
                </pre>
              </div>
              <button
                type="button"
                onClick={() => void revokeKey(license.token)}
                disabled={busy !== null}
                className="shrink-0 border border-neutral-300 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {busy === license.token ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Devices ──────────────────────────────────────────────────────── */}
      <h2 className="mt-10 text-sm font-bold uppercase tracking-widest text-neutral-700">
        Active Devices
      </h2>
      <p className="mt-1 text-xs text-neutral-400">
        Pro allows up to three active devices. Remove one to free a slot.
      </p>

      {devices.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No active devices. Activate a license on any machine to enroll it.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-200 border border-neutral-200">
          {devices.map((device) => (
            <li
              key={device.device_id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <div className="text-sm font-bold text-neutral-950">
                  {device.name}
                </div>
                <div className="text-xs text-neutral-500">
                  Last used {formatDate(device.last_seen_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void removeDevice(device)}
                disabled={busy !== null}
                className="shrink-0 border border-neutral-300 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {busy === device.device_id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-4 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
