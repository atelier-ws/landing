// Slim trust strip placed directly under the hero (Warp / PostHog pattern):
// an immediate "works where you already work" anchor before the pitch.
const HOSTS = [
  { name: "Claude Code", logo: "/logos/hosts/claude.svg" },
  { name: "Codex", logo: "/logos/hosts/codex.svg" },
  { name: "Copilot", logo: "/logos/hosts/copilot.svg" },
  { name: "Cursor", logo: "/logos/hosts/cursor.svg" },
  { name: "opencode", logo: "/logos/hosts/opencode.svg" },
  { name: "Gemini", logo: "/logos/hosts/gemini.svg" },
];

export default function TrustStrip() {
  return (
    <section className="border-t border-neutral-900/60 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-600">
          One runtime · any agent host · any provider
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 opacity-70">
          {HOSTS.map((host) => (
            <div key={host.name} className="flex items-center gap-2.5" title={host.name}>
              <img
                src={host.logo}
                alt={`${host.name} logo`}
                className="h-5 w-5 object-contain grayscale"
                loading="lazy"
              />
              <span className="text-xs font-medium tracking-wide text-neutral-500">{host.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
