import { useEffect, useState, type FormEvent } from "react";

// Public license-issuer Worker — the same endpoint the CLI uses. Not a secret.
const ISSUER_URL = "https://atelier-license-issuer.pankaj4u4m.workers.dev";

type Device = {
  device_id: string;
  name: string;
  created_at: number;
  last_seen_at: number;
};

type View = "loading" | "email" | "sent" | "manage" | "link_invalid";

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

export default function DeviceManager() {
  const [view, setView] = useState<View>("loading");
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setView("email");
      return;
    }
    // Strip the one-time token from the address bar so it is not bookmarked,
    // shared, or leaked through the referrer header.
    window.history.replaceState({}, "", window.location.pathname);
    void (async () => {
      try {
        const response = await fetch(`${ISSUER_URL}/devices/session/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!response.ok) throw new Error("invalid");
        const data = (await response.json()) as {
          session: string;
          email: string;
          devices: Device[];
        };
        setSession(data.session);
        setAccountEmail(data.email);
        setDevices(data.devices);
        setView("manage");
      } catch {
        setView("link_invalid");
      }
    })();
  }, []);

  const requestLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy("link");
    try {
      const response = await fetch(`${ISSUER_URL}/devices/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("failed");
      setView("sent");
    } catch {
      setError("Could not send the link. Try again shortly.");
    } finally {
      setBusy(null);
    }
  };

  const removeDevice = async (device: Device) => {
    if (!session) return;
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
      const response = await fetch(`${ISSUER_URL}/devices/session/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, device_id: device.device_id }),
      });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { devices: Device[] };
      setDevices(data.devices);
    } catch {
      setError(
        "Could not remove that device. Your session may have expired — request a new link.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (view === "loading") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  if (view === "sent") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">
          Check your inbox
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          If that address has an Atelier Pro license, we sent a secure link to
          manage your devices. It expires in 15 minutes.
        </p>
      </div>
    );
  }

  if (view === "manage") {
    return (
      <div className="border border-neutral-200 bg-white p-8">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-700">
          Pro access
        </div>
        <h1 className="mt-3 text-2xl font-bold text-neutral-950">
          Your devices
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Signed in as {accountEmail}. Atelier Pro allows up to three active
          devices — remove one to free a slot.
        </p>
        {devices.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-600">No active devices.</p>
        ) : (
          <ul className="mt-6 divide-y divide-neutral-200 border border-neutral-200">
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
                  className="border border-neutral-300 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
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

  if (view === "link_invalid") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">Link expired</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          That device-management link is invalid or has already been used.
          Request a fresh one below.
        </p>
        <button
          type="button"
          onClick={() => setView("email")}
          className="mt-6 bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-brand-700"
        >
          Request a new link
        </button>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 bg-white p-8">
      <div className="text-xs font-bold uppercase tracking-widest text-brand-700">
        Pro access
      </div>
      <h1 className="mt-3 text-2xl font-bold text-neutral-950">
        Manage your devices
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        Enter the email used at Stripe checkout. We will send a secure link to
        view and remove the devices on your license.
      </p>
      <form onSubmit={requestLink} className="mt-6">
        <label
          htmlFor="device-email"
          className="text-xs font-bold uppercase tracking-widest text-neutral-700"
        >
          Purchase email
        </label>
        <input
          id="device-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 outline-none ring-brand focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy === "link"}
          className="mt-4 w-full bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {busy === "link" ? "Sending…" : "Email me a link"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
