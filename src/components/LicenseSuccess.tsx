import { useEffect, useState } from "react";

type State =
  | { status: "loading" }
  | { status: "pending" }
  | { status: "ready"; email: string; expiresAt: string | null }
  | { status: "error"; message: string };

export default function LicenseSuccess() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get(
      "session_id",
    );
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
          email?: string;
          plan?: string;
          expires_at?: string | null;
          error?: string;
        };
        if (!response.ok || !body.email || body.expires_at === undefined) {
          throw new Error(
            body.error === "claim_expired"
              ? "This checkout link has expired. Sign in on the account page to check your plan."
              : "The purchase is not ready yet. Sign in on the account page to check your plan.",
          );
        }

        setState({
          status: "ready",
          email: body.email,
          expiresAt: body.expires_at,
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "The purchase could not be confirmed.",
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading" || state.status === "pending") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-700">
          Payment received
        </div>
        <h1 className="mt-3 text-2xl font-bold text-neutral-950">
          Activating Pro…
        </h1>
        <p className="mt-3 text-sm text-neutral-600">
          Stripe confirmation can take a few seconds. This page updates
          automatically.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">
          Purchase not confirmed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          {state.message}
        </p>
        <a
          href="/account"
          className="mt-6 inline-flex bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white no-underline"
        >
          Go to account
        </a>
      </div>
    );
  }

  return (
    <div className="border border-brand bg-white p-8 shadow-lg ring-1 ring-brand">
      <div className="text-xs font-bold uppercase tracking-widest text-brand-700">
        Payment received
      </div>
      <h1 className="mt-3 text-2xl font-bold text-neutral-950">
        Pro is active for {state.email}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        Run this command in your terminal and sign in with that same email —
        your plan attaches to your account automatically.
      </p>
      <pre className="mt-6 overflow-x-auto whitespace-pre-wrap break-all border border-neutral-200 bg-neutral-950 p-4 text-left text-xs leading-relaxed text-neutral-100">
        atelier login
      </pre>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href="/account"
          className="inline-flex bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white no-underline transition hover:bg-brand-700"
        >
          Manage devices &amp; billing
        </a>
        <span className="text-xs text-neutral-500">
          {state.expiresAt
            ? `Valid through ${new Date(state.expiresAt).toLocaleDateString()}`
            : "Active subscription"}
        </span>
      </div>
    </div>
  );
}
