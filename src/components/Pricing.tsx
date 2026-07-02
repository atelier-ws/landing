import { useState } from "react";
import { Check } from "lucide-react";

const PRO_LINKS = {
  monthly: "/pro?billing=monthly",
  yearly: "/pro?billing=yearly",
};

type SideTier = {
  name: string;
  price: string;
  cadence?: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
};

export const FREE_TIER: SideTier = {
  name: "Free",
  price: "$0",
  blurb: "A grounded coding-agent runtime that runs fully local.",
  features: [
    "The full grounded loop — code search, read, bash, verified edits",
    "Repo map + context engine for normal-size repos",
    "Single-repo memory, host packaging, benchmarks",
    "See how much you'd save",
  ],
  cta: { label: "Install free", href: "#install" },
};

const ENTERPRISE_TIER: SideTier = {
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
};

const PRO_FEATURES = [
  "Zoekt fast search + large-repo indexing",
  "Recall across all past sessions + cross-vendor memory",
  "Reusable procedures, lessons & knowledge base",
  "Savings engine — apply policies + full breakdown",
  "Model routing — daemon, cross-vendor, quality",
  "Multi-repo + multi-worktree swarm",
];

function SideTierCard({ tier }: { tier: SideTier }) {
  return (
    <div className="flex flex-col border border-neutral-200 bg-white p-6">
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
            <Check size={15} className="mt-0.5 shrink-0 text-brand" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={tier.cta.href}
        className="mt-6 inline-flex items-center justify-center border border-neutral-950 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-neutral-950 no-underline transition hover:bg-neutral-950 hover:text-white"
      >
        {tier.cta.label}
      </a>
    </div>
  );
}

function ProCard() {
  const [cadence, setCadence] = useState<"monthly" | "yearly">("yearly");
  const isYearly = cadence === "yearly";

  return (
    <div className="flex flex-col border border-brand bg-white p-6 shadow-lg ring-1 ring-brand">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          Most popular
        </span>
        <span className="inline-flex bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          3 months free
        </span>
      </div>

      <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">
        Pro
      </div>

      {/* Billing toggle */}
      <div className="mt-3 flex items-center gap-2">
        <button
          id="billing-monthly"
          onClick={() => setCadence("monthly")}
          className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest transition ${
            !isYearly
              ? "bg-neutral-950 text-white"
              : "text-neutral-400 hover:text-neutral-700"
          }`}
        >
          Monthly
        </button>
        <span className="text-neutral-300">|</span>
        <button
          id="billing-yearly"
          onClick={() => setCadence("yearly")}
          className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest transition ${
            isYearly
              ? "bg-neutral-950 text-white"
              : "text-neutral-400 hover:text-neutral-700"
          }`}
        >
          Yearly
          <span
            className={`rounded px-1 py-px text-[9px] font-bold uppercase ${
              isYearly
                ? "bg-brand-600 text-white"
                : "bg-brand-100 text-brand-700"
            }`}
          >
            Save 17%
          </span>
        </button>
      </div>

      {/* Price */}
      <div className="mt-3 flex items-baseline gap-1.5">
        {isYearly && (
          <span className="text-lg text-neutral-400 line-through">$19</span>
        )}
        <span className="text-3xl font-bold text-neutral-950">
          {isYearly ? "$15.83" : "$19"}
        </span>
        <span className="text-xs text-neutral-500">
          {isYearly ? "/mo · billed $190/yr" : "/mo"}
        </span>
      </div>
      <p className="mt-1 text-xs font-bold text-emerald-700">
        Free for 3 months, then {isYearly ? "$190/yr" : "$19/mo"}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        The leverage — for one developer on real, large codebases.
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {PRO_FEATURES.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm text-neutral-700"
          >
            <Check size={15} className="mt-0.5 shrink-0 text-brand" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        id="pro-cta"
        href={PRO_LINKS[cadence]}
        className="mt-6 inline-flex items-center justify-center bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white no-underline transition hover:bg-brand-700"
      >
        Start Free Trial · {isYearly ? "Yearly" : "Monthly"}
      </a>
    </div>
  );
}

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="border-t border-neutral-200 bg-[#f7f8fb] px-6 py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-600">
            Pricing
          </div>
          <h1 className="mt-3 text-2xl font-bold text-neutral-950 md:text-3xl">
            Open-core. Free is genuinely useful.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
            The core runtime is source-available under the FSL and runs on your
            machine alongside Claude Code, Codex, Cursor, and any MCP host. Pro
            unlocks search &amp; indexing at scale, cross-session memory, the
            savings engine, and model routing. Try Pro free for 3 months — no
            charge until your trial ends.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <SideTierCard tier={FREE_TIER} />
          <ProCard />
          <SideTierCard tier={ENTERPRISE_TIER} />
        </div>

        <p className="mt-8 text-center text-xs text-neutral-600">
          Use Pro on up to 3 devices. Cancel any subscription anytime. Already
          purchased?{" "}
          <a href="/account" className="text-brand-700 underline">
            Manage your account
          </a>
          .
        </p>
      </div>
    </section>
  );
}
