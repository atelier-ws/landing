// MCP code-search benchmark: Atelier vs competing MCP providers
// Data transcribed from the atelier-mcp-bench harness (benchmarks/mcp_tools);
// keep the raw run report alongside any number change here.
// Families: exact_search, substring_search

interface ProviderRow {
  tool: string;
  label: string;
  exact: { correctness: number; tokens: number; result: string };
  substring: { correctness: number; tokens: number; result: string };
}

const PROVIDERS: ProviderRow[] = [
  {
    tool: "atelier",
    label: "Atelier",
    exact:     { correctness: 0.971, tokens: 145,  result: "baseline" },
    substring: { correctness: 0.970, tokens: 636,  result: "baseline" },
  },
  {
    tool: "code-index-mcp",
    label: "code-index-mcp",
    exact:     { correctness: 0.941, tokens: 313,  result: "atelier better" },
    substring: { correctness: 0.636, tokens: 896,  result: "atelier better" },
  },
  {
    tool: "serena",
    label: "Serena",
    exact:     { correctness: 1.0,   tokens: 103,  result: "atelier worse" },
    substring: { correctness: 0.939, tokens: 582,  result: "atelier better" },
  },
  {
    tool: "atelier-serena",
    label: "Atelier + Serena",
    exact:     { correctness: 0.971, tokens: 127,  result: "equal" },
    substring: { correctness: 0.939, tokens: 494,  result: "atelier better" },
  },
  {
    tool: "codegraph",
    label: "CodeGraph",
    exact:     { correctness: 1.0,   tokens: 251,  result: "atelier worse" },
    substring: { correctness: 0.909, tokens: 4019, result: "atelier better" },
  },
  {
    tool: "jcodemunch-mcp",
    label: "jcodemunch",
    exact:     { correctness: 1.0,   tokens: 161,  result: "atelier worse" },
    substring: { correctness: 0.818, tokens: 571,  result: "atelier better" },
  },
];

const RESULT_STYLES: Record<string, string> = {
  baseline: "text-brand-400",
  "atelier better": "text-emerald-400",
  "atelier worse": "text-red-400/70",
  equal: "text-neutral-500",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function McpBenchmark() {
  return (
    <section id="mcp-benchmark" className="relative border-t border-neutral-900 px-6 py-24">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-400/70">
            Code Search Benchmark
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-100 md:text-3xl">
            Atelier vs Competing MCPs
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            Correctness and token cost across exact lookup, no-result detection, and substring search.
          </p>
        </div>

        {/* Table */}
        <div className="mt-10 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">Provider</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-600" colSpan={2}>Exact search</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-600" colSpan={2}>Substring search</th>
              </tr>
              <tr className="border-b border-neutral-800/50">
                <th className="pb-2 pr-4" />
                {["Correctness", "Tokens", "Correctness", "Tokens"].map((h, i) => (
                  <th key={i} className="px-3 pb-2 text-center text-[9px] font-normal uppercase tracking-widest text-neutral-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => {
                const isBaseline = p.tool === "atelier";
                return (
                  <tr
                    key={p.tool}
                    className={`border-b border-neutral-800/40 transition hover:bg-neutral-900/30 ${isBaseline ? "bg-brand-400/5" : ""}`}
                  >
                    <td className="py-3 pr-4">
                      <span className={`font-mono text-xs font-bold ${isBaseline ? "text-brand-300" : "text-neutral-300"}`}>
                        {p.label}
                      </span>
                      {isBaseline && (
                        <span className="ml-2 rounded border border-brand/30 bg-brand/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-400">
                          baseline
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-neutral-200">{pct(p.exact.correctness)}</td>
                    <td className={`px-3 py-3 text-center font-mono ${RESULT_STYLES[p.exact.result]}`}>{p.exact.tokens}</td>
                    <td className="px-3 py-3 text-center font-mono text-neutral-200">{pct(p.substring.correctness)}</td>
                    <td className={`px-3 py-3 text-center font-mono ${RESULT_STYLES[p.substring.result]}`}>{p.substring.tokens}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 border border-neutral-800 bg-neutral-950/40 p-4">
          <p className="text-xs leading-relaxed text-neutral-400">
            Serena and CodeGraph lead on exact-match correctness, 100% to Atelier&apos;s 97.1%, and Serena
            edges ahead on exact-lookup tokens. Atelier leads on token efficiency across substring search at
            competitive correctness. The whole table is here.
          </p>
        </div>
        <p className="mt-4 text-center text-[10px] text-neutral-600">
          Source: atelier-mcp-bench · 100 cases per family · exact, nohit, substring search
        </p>
      </div>
    </section>
  );
}
