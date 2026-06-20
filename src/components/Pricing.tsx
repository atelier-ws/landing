import { Check } from "lucide-react";

type Tier = {
  name: string;
  price: string;
  cadence?: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    blurb: "A grounded coding-agent runtime that runs fully local.",
    features: [
      "Code-nav MCP tools — read, grep, search, edit",
      "Repo map + context engine for normal-size repos",
      "Single-repo memory, host packaging, benchmarks",
      "See how much you'd save",
    ],
    cta: { label: "Install free", href: "#install" },
  },
  {
    name: "Pro",
    price: "$19",
    cadence: "/mo · $190/yr",
    blurb: "The leverage — for one developer on real, large codebases.",
    features: [
      "Zoekt fast search + large-repo indexing",
      "Recall across all past sessions + cross-vendor memory",
      "Reusable procedures, lessons & knowledge base",
      "Savings engine — apply policies + full breakdown",
      "Model routing — daemon, cross-vendor, quality",
      "Multi-repo + multi-worktree swarm",
    ],
    cta: { label: "Get Pro", href: "https://atelier.ws/pro" },
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    blurb: "Scale, shared context, and governance for teams.",
    features: [
      "Very large repos with no index caps",
      "Shared team context across repositories",
      "Governance, audit export & retention",
      "SSO + priority support",
      "Self-host the license issuer",
    ],
    cta: { label: "Contact us", href: "https://atelier.ws/enterprise" },
  },
];

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="border-t border-neutral-200 bg-[#f7f8fb] px-6 py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500">
            Pricing
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-950 md:text-3xl">
            Open-core. Free is genuinely useful.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
            The whole runtime is Apache-2.0 and runs on your machine. Pro unlocks
            search &amp; indexing at scale, cross-session memory, the savings
            engine, and model routing.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col border bg-white p-6 ${
                tier.featured
                  ? "border-[#9b75d9] shadow-lg ring-1 ring-[#9b75d9]"
                  : "border-neutral-200"
              }`}
            >
              {tier.featured && (
                <div className="mb-3 inline-flex self-start bg-[#9b75d9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                  Most popular
                </div>
              )}
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                {tier.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-neutral-950">
                  {tier.price}
                </span>
                {tier.cadence && (
                  <span className="text-xs text-neutral-500">{tier.cadence}</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {tier.blurb}
              </p>

              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-neutral-700"
                  >
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0 text-[#9b75d9]"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={tier.cta.href}
                className={`mt-6 inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold uppercase tracking-widest no-underline transition ${
                  tier.featured
                    ? "bg-[#9b75d9] text-white hover:bg-[#8a64c8]"
                    : "border border-neutral-950 text-neutral-950 hover:bg-neutral-950 hover:text-white"
                }`}
              >
                {tier.cta.label}
              </a>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-neutral-500">
          Activation is offline — no license server, no phone-home. Cancel any
          subscription anytime.
        </p>
      </div>
    </section>
  );
}
