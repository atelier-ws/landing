import { Scissors, Copy, Network, GitMerge } from "lucide-react";

const SATELLITES = [
  {
    icon: Copy,
    title: "Dedup and delta re-reads",
    body: "Read a file twice and the second read is a pointer. Re-read after an edit and you get the diff. The same bytes stay out of context.",
  },
  {
    icon: Network,
    title: "Code intelligence",
    body: "SCIP-indexed lookups return the exact symbol, caller, or reference, with the snippet inline.",
  },
  {
    icon: GitMerge,
    title: "Batch edits",
    body: "Edit across many files in one call. Every round-trip you skip is a full context read you keep.",
  },
];

export default function SavingsStack() {
  return (
    <section
      id="savings"
      className="relative border-t border-neutral-900 px-6 py-24"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400/70">
            How it cuts cost
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-100 md:text-3xl">
            Four levers, measured on every call
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            Atelier reduces how many tokens and round-trips reach the model, and records every one.
          </p>
        </div>

        {/* Bento: one dominant lever + three satellites */}
        <div className="mt-12 space-y-4">
          {/* Dominant card — source projection (the 90% lever) */}
          <div className="relative overflow-hidden border border-brand/30 bg-gradient-to-br from-brand/[0.08] to-transparent p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <Scissors size={26} className="text-brand-300" />
                <h3 className="mt-3 text-lg font-bold text-neutral-100">Source projection</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-300">
                  <code className="text-brand-300">read</code> returns an outline, an exact line range, or a
                  minified view. The model sees the shape of the file first, and expands only the parts it
                  needs.
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <div className="bg-gradient-to-r from-brand-200 to-brand-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
                  50–90%
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">
                  fewer tokens, large files
                </div>
              </div>
            </div>
          </div>

          {/* Satellites */}
          <div className="grid gap-4 md:grid-cols-3">
            {SATELLITES.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="group border border-neutral-800 bg-neutral-950/40 p-6 transition hover:border-neutral-600"
                >
                  <Icon size={22} className="text-brand-400" />
                  <h3 className="mt-3 text-sm font-bold text-neutral-100">{s.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs leading-relaxed text-neutral-500">
            Every saving is written to the run ledger and priced at the model&apos;s real input rate.
            Unknown prices read as $0.
            <br />
            <a
              href="https://docs.atelier.ws"
              className="text-brand-300 no-underline transition hover:text-brand-200"
            >
              How savings are measured →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
