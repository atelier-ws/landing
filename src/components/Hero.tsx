import { ArrowRight } from "lucide-react";
import GitHubIcon from "./GitHubIcon";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200 bg-[#f7f8fb] px-6 pt-24 pb-16 text-neutral-950 sm:pt-28 md:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-80" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex border border-neutral-300 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-700">
            Open-source agent runtime
          </div>

          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-5xl md:text-6xl md:leading-[1.06]">
            Own the runtime for coding agents.
          </h1>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-neutral-600 md:text-base">
            Atelier hosts and orchestrates the whole run: context reads, batch
            edits, model routing, tool calls, and a trace of what happened.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href="#install"
              className="inline-flex w-full items-center justify-center gap-2 border border-neutral-950 bg-neutral-950 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white no-underline transition hover:bg-neutral-800 sm:w-auto"
            >
              Install
              <ArrowRight size={16} />
            </a>
            <a
              href="https://docs.atelier.ws/installation"
              className="inline-flex w-full items-center justify-center gap-2 border border-neutral-300 bg-white/60 px-6 py-3 text-sm font-bold uppercase tracking-widest text-neutral-800 no-underline transition hover:border-neutral-950 hover:text-neutral-950 sm:w-auto"
            >
              Read docs
            </a>
            <a
              href="https://github.com/atelier-runtime/atelier"
              className="inline-flex w-full items-center justify-center gap-2 border border-neutral-300 px-6 py-3 text-sm uppercase tracking-widest text-neutral-600 no-underline transition hover:border-neutral-950 hover:text-neutral-950 sm:w-auto"
            >
              <GitHubIcon size={16} />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
