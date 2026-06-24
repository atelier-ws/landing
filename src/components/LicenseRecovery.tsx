import { useState, type FormEvent } from "react";

type Result =
  | { kind: "sent" }
  | { kind: "no_match" }
  | { kind: "error"; message: string };

export default function LicenseRecovery() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/license/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      const body: Record<string, unknown> = await response.json();
      if (body.sent === true) {
        setResult({ kind: "sent" });
      } else if (body.sent === false) {
        setResult({ kind: "error", message: (body.error as string) ?? "Delivery failed. Try again shortly." });
      } else {
        // accepted: true (rate-limited or no matching license)
        setResult({ kind: "no_match" });
      }
    } catch {
      setResult({ kind: "error", message: "Could not reach the server. Check your connection and try again." });
    } finally {
      setSending(false);
    }
  };

  // ── Success / no-match: same generic view (don't reveal whether email exists) ─
  if (result?.kind === "sent" || result?.kind === "no_match") {
    return (
      <div className="animate-fade-in-up border border-emerald-200 bg-white p-8 shadow-sm ring-1 ring-emerald-200">
        <h1 className="text-2xl font-bold text-neutral-950">License emailed</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          If the email address is associated with an active license, you will
          receive it shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 bg-white p-8">
      <div className="text-xs font-bold uppercase tracking-widest text-brand-700">
        Pro access
      </div>
      <h1 className="mt-3 text-2xl font-bold text-neutral-950">Recover your license</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        Enter the email used at Stripe checkout.
      </p>
      <form onSubmit={submit} className="mt-6">
        <label htmlFor="recovery-email" className="text-xs font-bold uppercase tracking-widest text-neutral-700">
          Email
        </label>
        <input
          id="recovery-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={sending}
          className="mt-2 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 outline-none ring-brand focus:ring-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending}
          className="mt-4 w-full bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {sending ? "Sending…" : "Email my license"}
        </button>
      </form>

      {result?.kind === "error" && (
        <div role="alert" className="mt-4 animate-fade-in-up border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Delivery failed</p>
          <p className="mt-1 text-sm text-red-800">{result.message}</p>
        </div>
      )}
    </div>
  );
}
