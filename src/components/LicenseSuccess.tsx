import { useEffect, useState } from "react";

type State =
  | { status: "loading" }
  | { status: "pending" }
  | { status: "ready"; licenseKey: string; expiresAt: string | null }
  | { status: "error"; message: string };

export default function LicenseSuccess() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) {
      setState({
        status: "error",
        message: "This page is missing the Stripe checkout session ID.",
      });
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const load = async () => {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/license/checkout?session_id=${encodeURIComponent(sessionId)}`,
          { headers: { Accept: "application/json" } },
        );
        if (cancelled) return;

        if (response.status === 202 && attempts < 12) {
          setState({ status: "pending" });
          window.setTimeout(load, 1500);
          return;
        }

        const body = (await response.json()) as {
          license_key?: string;
          expires_at?: string | null;
          error?: string;
        };
        if (!response.ok || !body.license_key || body.expires_at === undefined) {
          throw new Error(
            body.error === "claim_expired"
              ? "This checkout link has expired. Use license recovery to receive the key again."
              : "The license is not ready. Check your email or use license recovery.",
          );
        }

        setState({
          status: "ready",
          licenseKey: body.license_key,
          expiresAt: body.expires_at,
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "The license could not be loaded.",
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyCommand = async () => {
    if (state.status !== "ready") return;
    await navigator.clipboard.writeText(
      `atelier license activate ${state.licenseKey}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (state.status === "loading" || state.status === "pending") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-700">
          Payment received
        </div>
        <h1 className="mt-3 text-2xl font-bold text-neutral-950">
          Preparing your license…
        </h1>
        <p className="mt-3 text-sm text-neutral-600">
          Stripe confirmation can take a few seconds. This page updates automatically.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">License unavailable</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">{state.message}</p>
        <a
          href="/license/recover"
          className="mt-6 inline-flex bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white no-underline"
        >
          Recover license
        </a>
      </div>
    );
  }

  return (
    <div className="border border-brand bg-white p-8 shadow-lg ring-1 ring-brand">
      <div className="text-xs font-bold uppercase tracking-widest text-brand-700">
        Payment received
      </div>
      <h1 className="mt-3 text-2xl font-bold text-neutral-950">Your Pro license</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        A copy has also been emailed to you. Run this command to activate Pro.
      </p>
      <pre className="mt-6 overflow-x-auto whitespace-pre-wrap break-all border border-neutral-200 bg-neutral-950 p-4 text-left text-xs leading-relaxed text-neutral-100">
        atelier license activate {state.licenseKey}
      </pre>
      <p className="mt-3 text-xs text-neutral-500">
        After activation, the key is stored at ~/.atelier/license.key.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={copyCommand}
          className="bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-brand-700"
        >
          {copied ? "Copied" : "Copy activation command"}
        </button>
        <span className="text-xs text-neutral-500">
          {state.expiresAt
            ? `Valid through ${new Date(state.expiresAt).toLocaleDateString()}`
            : "Lifetime license"}
        </span>
      </div>
    </div>
  );
}
