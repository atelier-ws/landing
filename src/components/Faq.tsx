import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Isn’t this just prompt caching?",
    a: "Your host already caches the conversation prefix automatically. Atelier works earlier in the loop and reduces how much enters the context in the first place. Caching makes repeated context cheaper; projection and dedup leave less of it to cache. Both help, and we count only our part.",
  },
  {
    q: "I already have LSP or a code-index tool. Why Atelier?",
    a: "LSP and code indexers tell you where a symbol lives, and the best of them are excellent at it — our benchmark shows Serena and CodeGraph leading on exact-match. Atelier works one layer up. It shapes those lookups for a token budget and folds them into the rest of the loop: projected reads, deduped context, batched edits, measured on every call. Code intelligence is one piece. Reach for Atelier when you want the whole agent loop to run leaner.",
  },
  {
    q: "Are the benchmark numbers cherry-picked?",
    a: "The full code-search table is on this page, including the rows where Serena and CodeGraph come out ahead. The Claude Code A/B runs both arms on the same model and harness.",
  },
  {
    q: "What happens when Atelier is slower or costs more?",
    a: "The per-task breakdown shows it. Some tasks favor the baseline, and those rows stay in the table.",
  },
  {
    q: "Does my code leave my machine?",
    a: "No. The CLI, MCP server, and store all run locally. Atelier indexes and measures in place.",
  },
  {
    q: "Is it free?",
    a: "The runtime is open source under Apache-2.0 and self-hosted. A hosted tier for teams is on the way; it will add convenience, and the open core stays in the open core.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-neutral-900 px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500">
            Straight answers
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-100 md:text-3xl">
            Questions a skeptic would ask
          </h2>
        </div>
        <div className="mt-10 divide-y divide-neutral-900 border border-neutral-800 bg-neutral-950/40">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-neutral-900/30"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-bold text-neutral-100">{item.q}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-80" : "max-h-0"}`}
                >
                  <p className="px-5 pb-5 text-xs leading-relaxed text-neutral-400">
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
