import { useEffect, useState } from "react";

// Faithful recreation of a Claude Code + Atelier session: the statusline shape
// (atelier | model ctx % | $cost(I/C/O) ↓ $saved ♻ $carry), Claude-Code tool
// glyphs, and the ✻ Stop recap. Numbers are an illustrative session, not a
// benchmark — the real ones render live in your own statusline.

type Stat = {
  ctx: string;
  pct: string;
  cost: string;
  io: string;
  saved: string;
  savedTok: string;
  carry: string;
  carryTok: string;
};

const PROMPT = "refactor auth to use the new TokenStore";

const TOOLS = [
  { call: "read(src/auth.py)", result: "outline · 1,240→180", tok: 1060 },
  { call: 'grep("TokenStore")', result: "8 files · ranked map", tok: 4200 },
  { call: "read(src/token_store.py:40-90)", result: "range", tok: 1510 },
  { call: "read(src/auth.py)", result: "deduped re-read", tok: 1240 },
  { call: "usages(migrate_token)", result: "7 refs · token budget", tok: 1180 },
  { call: "edit(×4 hunks · 2 files)", result: "applied · lint ✓", tok: 0 },
];

const STATS: Stat[] = [
  {
    ctx: "6k",
    pct: "3",
    cost: "0.03",
    io: "I: 6k C: 0 O: 1k",
    saved: "0.00",
    savedTok: "0",
    carry: "0.00",
    carryTok: "0",
  },
  {
    ctx: "12k",
    pct: "6",
    cost: "0.12",
    io: "I: 12k C: 0.2M O: 3k",
    saved: "0.01",
    savedTok: "1.1k",
    carry: "0.02",
    carryTok: "120k",
  },
  {
    ctx: "19k",
    pct: "9",
    cost: "0.28",
    io: "I: 19k C: 0.5M O: 7k",
    saved: "0.05",
    savedTok: "5.3k",
    carry: "0.06",
    carryTok: "320k",
  },
  {
    ctx: "24k",
    pct: "12",
    cost: "0.44",
    io: "I: 24k C: 0.7M O: 11k",
    saved: "0.07",
    savedTok: "6.8k",
    carry: "0.12",
    carryTok: "560k",
  },
  {
    ctx: "26k",
    pct: "13",
    cost: "0.61",
    io: "I: 26k C: 0.9M O: 15k",
    saved: "0.10",
    savedTok: "8.0k",
    carry: "0.20",
    carryTok: "880k",
  },
  {
    ctx: "31k",
    pct: "15",
    cost: "0.83",
    io: "I: 31k C: 1.1M O: 22k",
    saved: "0.13",
    savedTok: "9.2k",
    carry: "0.28",
    carryTok: "1.2M",
  },
  {
    ctx: "38k",
    pct: "18",
    cost: "1.12",
    io: "I: 38k C: 1.4M O: 31k",
    saved: "0.16",
    savedTok: "9.2k",
    carry: "0.34",
    carryTok: "1.4M",
  },
  {
    ctx: "38k",
    pct: "18",
    cost: "1.12",
    io: "I: 38k C: 1.4M O: 31k",
    saved: "0.16",
    savedTok: "9.2k",
    carry: "0.34",
    carryTok: "1.4M",
  },
];

const STEPS = STATS.length;

export default function TerminalDemo() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(PROMPT.length);
  const [reduced, setReduced] = useState(false);

  // Honor prefers-reduced-motion: freeze on the final recap frame, no loop.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) setStep(STEPS - 1);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Advance through the session on a timer (paused under reduced motion).
  useEffect(() => {
    if (reduced) return;
    const last = step >= STEPS - 1;
    const delay = step === 0 ? 2400 : last ? 3200 : 820;
    const t = setTimeout(() => setStep(last ? 0 : step + 1), delay);
    return () => clearTimeout(t);
  }, [step, reduced]);

  // Type the prompt character by character at the start of each loop.
  useEffect(() => {
    if (reduced || step !== 0) {
      setTyped(PROMPT.length);
      return;
    }
    setTyped(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= PROMPT.length) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [step, reduced]);

  const s = STATS[step];
  const toolsShown = Math.min(step, TOOLS.length);
  const showRecap = step >= STEPS - 1;

  // The most recent tool call that saved tokens, surfaced inline as (savedTok+N).
  let lastDelta = 0;
  for (let j = 0; j < toolsShown; j++) {
    if (TOOLS[j].tok > 0) lastDelta = TOOLS[j].tok;
  }

  return (
    <section
      id="terminal"
      className="border-t border-neutral-200 bg-[#f7f8fb] px-6 py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-600">
            In the terminal
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-950 md:text-3xl">
            Watch the savings add up
          </h2>
        </div>

        <div className="terminal-surface mt-10 overflow-hidden border border-neutral-700/70 bg-[#1f1f23]">
          <div className="flex items-center gap-2 border-b border-neutral-700/70 bg-[#29292e] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-3 text-[10px] uppercase tracking-widest text-neutral-400">
              claude code
            </span>
          </div>

          <div className="flex h-[340px] flex-col justify-end gap-1 overflow-hidden p-4 font-mono text-[13px] leading-relaxed sm:text-sm">
            {step === 0 && (
              <div className="text-neutral-400">
                <span className="animate-pulse">✶</span> Working…
              </div>
            )}

            {TOOLS.slice(0, toolsShown).map((t, i) => (
              <div key={i}>
                <div>
                  <span className="text-neutral-200">⏺</span>{" "}
                  <span className="text-neutral-100">{t.call}</span>
                </div>
                <div className="pl-1 text-neutral-400">⎿ {t.result}</div>
              </div>
            ))}

            {showRecap && (
              <div className="mt-2 text-neutral-400">
                <div>
                  <span className="text-brand-300">✻</span> Stop says: Atelier:
                  session auto-recorded.
                </div>
                <div className="pl-4">8 turns · 14 tool calls</div>
                <div className="pl-4">
                  tokens: 76k input (9.8k new + 66k cW) / 1.4M cR / 31k out
                  (1.5M total)
                </div>
                <div className="pl-4">est. cost: ~$1.12</div>
                <div className="pl-4">
                  savings:{" "}
                  <span className="text-emerald-400">
                    $0.16 · 9,240 tokens saved · 3 calls avoided
                  </span>
                </div>
                <div className="pl-4">
                  context carry:{" "}
                  <span className="text-brand-300">
                    $0.34 · 1,420,800 tokens
                  </span>{" "}
                  (cache re-reads avoided on later turns)
                </div>
                <div className="pl-4 text-neutral-400">
                  top tools: mcp__atelier__read×3 · mcp__atelier__grep×1 ·
                  mcp__atelier__edit×1
                </div>
                <div className="mt-1">
                  <span className="text-brand-300">✻</span> Worked for 38s
                </div>
              </div>
            )}
          </div>

          <div className="relative mx-3 mb-2 mt-1 rounded border border-neutral-700 border-l-2 border-l-brand/70 bg-[#29292e] px-3 py-2.5 font-mono text-[13px] sm:text-sm">
            <span className="absolute -top-2.5 right-3 rounded bg-brand/20 px-2 py-0.5 text-[9px] font-bold tracking-wide text-brand-300">
              atelier:code
            </span>
            <span className="text-emerald-400">❯</span>{" "}
            <span className="text-neutral-200">{PROMPT.slice(0, typed)}</span>
            <span
              className={`ml-1 inline-block h-3.5 w-2 translate-y-0.5 border border-neutral-400 ${
                reduced ? "" : "animate-pulse"
              }`}
            />
          </div>

          <div className="border-t border-neutral-700/70 bg-[#29292e] px-4 py-2 font-mono text-[11px] sm:text-[13px]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-bold text-brand-300">atelier</span>
              <span className="text-neutral-400">|</span>
              <span className="text-neutral-300">Sonnet 4.5</span>
              <span className="text-neutral-400">
                ctx {s.ctx} {s.pct}%
              </span>
              <span className="text-neutral-400">|</span>
              <span className="text-neutral-200">
                ${s.cost}
                <span className="text-neutral-400">({s.io})</span>
              </span>
              <span className="text-emerald-400">
                ↓ ${s.saved}
                <span className="text-emerald-400">
                  {"("}
                  {s.savedTok}
                  {lastDelta > 0 ? (
                    <span className="text-emerald-300">
                      +{lastDelta.toLocaleString()}
                    </span>
                  ) : null}
                  {")"}
                </span>
              </span>
              <span className="text-brand-300">
                ♻ ${s.carry}
                <span className="text-brand-300/70">({s.carryTok})</span>
              </span>
            </div>
            <div className="mt-1 text-neutral-400">
              <span className="text-neutral-400">‣</span> bypass permissions on
              (shift+tab to cycle)
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only">
        Statusline: atelier | model · ctx used % | $cost (I input / C cache / O
        output) ↓ saved ♻ context carry. Numbers are an illustrative session,
        not a benchmark.
      </p>
    </section>
  );
}
