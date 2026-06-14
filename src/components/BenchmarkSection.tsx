// Task-level cost benchmark: Atelier vs Claude Code (baseline), controlled A/B.
// Run command (both arms, same model/provider/dataset):
//   uv run atelier benchmark codebench --arm baseline --arm atelier \
//     --provider bedrock --model us.anthropic.claude-sonnet-4-6 \
//     --rate-limit-rpm 10 --timeout 2400
// RESULTS_PENDING: numbers are published only when the controlled run completes.
// To publish: set RESULTS_PENDING = false and fill `cc` / `atelier` (USD) per task.

const RESULTS_PENDING = true;

const TASKS: { id: number; lang: string; label: string; cc?: number; atelier?: number }[] = [
  { id: 1, lang: "swift", label: "Write a full LRU file-cache spec" },
  { id: 2, lang: "swift", label: "Add logging to an existing cache" },
  { id: 3, lang: "rust", label: "Fix non-string enum key parsing in serde_json" },
  { id: 4, lang: "python", label: "Write a pytest suite to 80%+ coverage" },
  { id: 5, lang: "python", label: "Refactor a module guided by existing tests" },
  { id: 6, lang: "ts", label: "Add a localization following existing i18n patterns" },
  { id: 7, lang: "rust", label: "Fix a Rust compilation error from CI logs" },
];

const LANG_COLORS: Record<string, string> = {
  swift: "text-orange-400/80 border-orange-400/20 bg-orange-400/5",
  rust: "text-red-400/80 border-red-400/20 bg-red-400/5",
  python: "text-blue-400/80 border-blue-400/20 bg-blue-400/5",
  ts: "text-cyan-400/80 border-cyan-400/20 bg-cyan-400/5",
};

const METHOD = [
  ["Dataset", "CodeBench · 7 real tasks · Swift, Rust, Python, TypeScript"],
  ["Arms", "baseline (Claude Code) vs atelier — both measured by us, same harness"],
  ["Model", "us.anthropic.claude-sonnet-4-6 (AWS Bedrock)"],
  ["Controls", "same tasks · same model · rate-limited 10 rpm · 2400s timeout"],
];

export default function BenchmarkSection() {
  return (
    <section
      id="benchmark"
      className="relative border-t border-neutral-900 px-6 py-24"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/70">
            Head-to-head
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-100 md:text-3xl">
            Atelier vs Claude Code
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            A controlled A/B on real coding tasks. <span className="text-neutral-200">Both arms run by
            us</span>, on the same model and harness.
          </p>
        </div>

        {/* Pending status banner */}
        {RESULTS_PENDING && (
          <div className="mt-10 flex items-center justify-center gap-3 border border-amber-400/30 bg-amber-400/[0.04] px-5 py-4 text-center">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-xs leading-relaxed text-amber-200/90">
              <span className="font-bold uppercase tracking-wider">Controlled run in progress.</span>{" "}
              The full per-task breakdown lands here when it finishes, every task included.
            </p>
          </div>
        )}

        {/* Methodology card — the honest centerpiece */}
        <div className="mt-4 border border-neutral-800 bg-neutral-950/40 p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
            Methodology
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {METHOD.map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs">
                <dt className="shrink-0 font-bold uppercase tracking-wider text-neutral-600">{k}</dt>
                <dd className="text-neutral-300">{v}</dd>
              </div>
            ))}
          </dl>
          <pre className="mt-4 overflow-x-auto border border-neutral-800 bg-black p-3 text-[10px] leading-relaxed text-neutral-400">
            <span className="text-neutral-600">$</span>{" "}
            <span className="text-emerald-300">uv run atelier benchmark codebench</span> --arm baseline --arm atelier \{"\n"}
            {"    "}--provider bedrock --model us.anthropic.claude-sonnet-4-6 \{"\n"}
            {"    "}--rate-limit-rpm 10 --timeout 2400
          </pre>
        </div>

        {/* Task slate */}
        <div className="mt-4 space-y-2">
          {TASKS.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-2 border border-neutral-800 bg-neutral-950/40 p-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${LANG_COLORS[task.lang]}`}
                >
                  {task.lang}
                </span>
                <span className="truncate text-xs leading-snug text-neutral-300">
                  {task.label}
                </span>
              </div>
              {RESULTS_PENDING ? (
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-neutral-600">
                  measuring…
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[10px] text-neutral-400">
                  {task.cc != null && task.atelier != null
                    ? `$${task.cc.toFixed(2)} → $${task.atelier.toFixed(2)}`
                    : "—"}
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-[10px] text-neutral-600">
          Source: CodeBench · claude-sonnet-4-6 (Bedrock) · results published on run completion.
        </p>
      </div>
    </section>
  );
}
