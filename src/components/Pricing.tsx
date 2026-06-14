import { Check, ArrowRight } from "lucide-react";

const OSS = [
  "All MCP tools + SCIP code intelligence",
  "Per-call savings ledger & dashboard",
  "Every host & provider integration",
  "Runs entirely on your machine",
  "No account, no required telemetry",
];

const HOSTED = [
  "Managed, always-on runtime",
  "Shared team savings dashboards",
  "SSO & audit (planned)",
  "Priority support",
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative border-t border-neutral-900 px-6 py-24">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500">
            Open core
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-100 md:text-3xl">
            Free runtime. A hosted tier on the way.
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            The runtime is open source and stays that way. A hosted tier for teams is on the way, with
            everything the open core does still in the open core.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {/* Open source */}
          <div className="border border-brand/30 bg-gradient-to-br from-brand/[0.06] to-transparent p-7">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-bold text-neutral-100">Open source</h3>
              <div className="text-right">
                <span className="text-3xl font-bold text-brand-300">$0</span>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">self-hosted</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-400">Everything the runtime does. Apache-2.0.</p>
            <ul className="mt-5 space-y-2.5">
              {OSS.map((f) => (
                <li key={f} className="flex gap-2 text-xs text-neutral-300">
                  <Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#install"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 border border-brand/60 bg-brand/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-300 no-underline transition hover:bg-brand/20"
            >
              Install
              <ArrowRight size={14} />
            </a>
          </div>

          {/* Hosted / Teams — honestly marked in-development, no fake price */}
          <div className="border border-neutral-800 bg-neutral-950/40 p-7">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-bold text-neutral-100">Hosted &amp; Teams</h3>
              <span className="rounded border border-amber-400/30 bg-amber-400/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
                In development
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Managed runtime + shared visibility for teams. Help us shape it.
            </p>
            <ul className="mt-5 space-y-2.5">
              {HOSTED.map((f) => (
                <li key={f} className="flex gap-2 text-xs text-neutral-400">
                  <span className="mt-0.5 shrink-0 text-neutral-600">○</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="mailto:contact@atelier.ws?subject=Atelier%20hosted%20%2F%20teams"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 border border-neutral-700 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-neutral-300 no-underline transition hover:border-neutral-500 hover:text-neutral-100"
            >
              Talk to us
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-neutral-600">
          When the hosted tier is ready, its pricing will be public, right here.
        </p>
      </div>
    </section>
  );
}
