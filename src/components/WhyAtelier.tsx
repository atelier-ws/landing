import { useState } from "react";
import { Network, BarChart3, Boxes, ShieldCheck } from "lucide-react";

const TABS = [
  {
    icon: Network,
    label: "Code intelligence",
    heading: "Code intelligence, sized for the model",
    blurb:
      "Ask for a symbol, its callers, its references, or its blast radius. Atelier returns the answer on a token budget, snippet inline, ready to use.",
    bullets: [
      "symbols · node · callers · callees · usages · impact · explore",
      "Indexed, exact results",
      "Token-budgeted, snippet inline",
      "One query layer across 18+ languages",
    ],
    mock: [
      "$ callers of parse_config",
      "3 callers · 2 files",
      "  loader.py:88   load()",
      "  cli.py:142     main()",
      "  ↳ inline snippets, no extra read",
    ],
  },
  {
    icon: BarChart3,
    label: "Measured savings",
    heading: "Savings you can read back",
    blurb:
      "Each call records what it saved, priced at the model’s real rate. It lands in a ledger you can open from the CLI, statusline, or dashboard.",
    bullets: [
      "Per-call savings in the run ledger",
      "Priced at the live model rate",
      "Visible in CLI, statusline, and dashboard",
    ],
    mock: [
      "tool: read  →  saved",
      "  tokens: 1,842   calls: 0",
      "  lever:  source_projection",
      "  model:  claude-sonnet-4-5",
      "  value:  $0.0055  (input rate)",
    ],
  },
  {
    icon: Boxes,
    label: "Every host & provider",
    heading: "One runtime, wired in everywhere",
    blurb:
      "Atelier connects to every major agent host over MCP, with SDK middleware for framework agents. Bring any provider: a cloud API, Bedrock, Vertex, or a local model.",
    bullets: [
      "MCP: Claude Code, Codex, Copilot, Cursor, opencode, …",
      "SDK middleware: LangChain, OpenAI, Gemini",
      "Providers: Anthropic, OpenAI, Bedrock, Vertex, Ollama, …",
    ],
    mock: [
      "host:     claude-code  (MCP)",
      "provider: bedrock/claude-sonnet",
      "tools:    14 registered",
      "status:   ✓ savings tracked per call",
    ],
  },
  {
    icon: ShieldCheck,
    label: "Safety rails",
    heading: "Edits are mechanical and reversible",
    blurb:
      "A contract gate guards your test files, lint runs after every edit, and the whole batch rolls back if any hunk fails.",
    bullets: [
      "Test-contract gate before touching test files",
      "Lint-after-edit diagnostics, inline",
      "Atomic batch edits with rollback",
    ],
    mock: [
      "edit × 5 hunks · 3 files",
      "  ✓ applied   ✓ lint clean",
      "  ✗ test contract touched",
      "    → held for review",
    ],
  },
];

export default function WhyAtelier() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  const Icon = tab.icon;
  return (
    <section id="why" className="border-t border-neutral-900 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500">
            Why Atelier
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-100 md:text-3xl">
            Inside the runtime
          </h2>
        </div>

        {/* Tab bar */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {TABS.map((t, i) => {
            const TabIcon = t.icon;
            const on = i === active;
            return (
              <button
                key={t.label}
                onClick={() => setActive(i)}
                aria-pressed={on}
                className={`inline-flex items-center gap-2 border px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition ${
                  on
                    ? "border-brand/60 bg-brand/10 text-brand-300"
                    : "border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
                }`}
              >
                <TabIcon size={14} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="mt-8 grid items-center gap-8 border border-neutral-800 bg-neutral-950/40 p-6 md:grid-cols-2 md:p-8">
          <div>
            <div className="flex items-center gap-2 text-brand-300">
              <Icon size={18} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                {tab.label}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-bold text-neutral-100">{tab.heading}</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">{tab.blurb}</p>
            <ul className="mt-5 space-y-2.5">
              {tab.bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-xs text-neutral-300">
                  <span className="mt-0.5 shrink-0 text-brand-400">▹</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-neutral-800 bg-black">
            <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-red-500/60" />
              <span className="h-2 w-2 rounded-full bg-amber-500/60" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
            </div>
            <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-neutral-300">
              {tab.mock.join("\n")}
            </pre>
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] text-neutral-600">
          Terminal output is illustrative. Real numbers come from your run ledger.
        </p>
      </div>
    </section>
  );
}
