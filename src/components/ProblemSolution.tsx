import { AlertTriangle, Zap } from "lucide-react";

export default function ProblemSolution() {
  return (
    <section className="border-t border-neutral-900 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          {/* Problem */}
          <div className="relative border-l-2 border-red-400/30 pl-6">
            <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-red-400/30 bg-[#0a0a0a]">
              <AlertTriangle size={14} className="text-red-400/80" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-400/80">
              The Problem
            </div>
            <h2 className="mt-3 text-xl font-bold text-neutral-100 md:text-2xl">
              Agents burn tokens they never use
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                "An agent reads a whole file to find one symbol. Most of those tokens go unused.",
                "The same file gets read again and again, at full cost each time.",
                "Answers come over many small turns.",
                "Context grows quietly, with no signal until the session is expensive.",
              ].map((text) => (
                <li key={text} className="flex gap-3 text-sm leading-relaxed text-neutral-400">
                  <span className="mt-0.5 shrink-0 text-red-400/60">✗</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="relative border-l-2 border-emerald-400/30 pl-6">
            <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/30 bg-[#0a0a0a]">
              <Zap size={14} className="text-emerald-400/80" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/80">
              The Solution
            </div>
            <h2 className="mt-3 text-xl font-bold text-neutral-100 md:text-2xl">
              A leaner context window
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                "Code intelligence returns the exact symbol, caller, or range.",
                "Projection and dedup send an outline or a range, and turn repeat reads into a pointer.",
                "Batch calls and cross-file edits land the work in a single turn.",
                "Every saved token and round-trip is recorded in the CLI, statusline, and dashboard.",
              ].map((text) => (
                <li key={text} className="flex gap-3 text-sm leading-relaxed text-neutral-400">
                  <span className="mt-0.5 shrink-0 text-emerald-400/80">✓</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
