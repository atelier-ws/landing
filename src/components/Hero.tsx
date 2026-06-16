import { ArrowRight } from "lucide-react";
import GitHubIcon from "./GitHubIcon";
import { useState, useEffect } from "react";

const PHRASES = ["Open-source agent runtime", "Apache 2.0"];
const TYPING_MS = 45;
const DELETING_MS = 30;
const PAUSE_MS = 2000;
const EMPTY_PAUSE_MS = 400;

type Phase = "typing" | "deleting";

function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return prefersReduced;
}

export default function Hero() {
  const reducedMotion = usePrefersReducedMotion();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayed, setDisplayed] = useState(
    reducedMotion ? PHRASES[0] : "",
  );
  const [phase, setPhase] = useState<Phase>(
    reducedMotion ? "typing" : "typing",
  );

  const target = PHRASES[phraseIndex];

  useEffect(() => {
    if (reducedMotion) return;

    let t: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (displayed.length < target.length) {
        t = setTimeout(
          () => setDisplayed(target.slice(0, displayed.length + 1)),
          TYPING_MS,
        );
      } else {
        t = setTimeout(() => setPhase("deleting"), PAUSE_MS);
      }
    } else {
      if (displayed.length > 0) {
        t = setTimeout(
          () => setDisplayed(displayed.slice(0, -1)),
          DELETING_MS,
        );
      } else {
        t = setTimeout(() => {
          setPhraseIndex((i) => (i + 1) % PHRASES.length);
          setPhase("typing");
        }, EMPTY_PAUSE_MS);
      }
    }

    return () => clearTimeout(t);
  }, [displayed, phase, target, reducedMotion]);

  return (
    <section className="relative overflow-hidden border-b border-neutral-200 bg-[#f7f8fb] px-6 pt-24 pb-16 text-neutral-950 sm:pt-28 md:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-80" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex border border-neutral-300 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-700">
            <span>{displayed}</span>
            {!reducedMotion && (
              <span className="typing-cursor ml-px">|</span>
            )}
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
              href="https://github.com/atelier-ws/atelier"
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
