import { useState, type FormEvent } from "react";

export default function LicenseRecovery() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch("/api/license/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("request_failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">Check your inbox</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          If that address is connected to a purchase, we sent its current license key.
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
        Enter the email used at Stripe checkout. We will resend the current key if a
        matching purchase exists.
      </p>
      <form onSubmit={submit} className="mt-6">
        <label htmlFor="recovery-email" className="text-xs font-bold uppercase tracking-widest text-neutral-700">
          Purchase email
        </label>
        <input
          id="recovery-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 outline-none ring-brand focus:ring-2"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-4 w-full bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Email my license"}
        </button>
        {status === "error" && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            The request could not be sent. Try again shortly or contact support.
          </p>
        )}
      </form>
    </div>
  );
}
