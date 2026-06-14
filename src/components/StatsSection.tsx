import { FileCode, Server, BarChart3, FileDown, Crosshair, Shield } from "lucide-react";

const STATS = [
  { icon: FileDown, value: "50–90%", label: "Read compression", detail: "outline / range on large source files" },
  { icon: Crosshair, value: "2.2×", label: "Fewer search tokens", detail: "code-index-mcp, exact lookups; full table below" },
  { icon: Server, value: "10+", label: "Agent hosts", detail: "MCP & SDK integrations" },
  { icon: FileCode, value: "18+", label: "Languages", detail: "SCIP code intelligence & outlining" },
  { icon: BarChart3, value: "$0", label: "Unpriced models", detail: "shown as $0 until a rate is known" },
  { icon: Shield, value: "Apache-2.0", label: "License", detail: "open source, self-hosted" },
];

export default function StatsSection() {
  return (
    <section className="border-t border-neutral-900 bg-neutral-950/30 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-100 md:text-3xl">
            Measured savings
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            Every number here comes from the run ledger, with the method a click away.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden border border-neutral-800 bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-[#0a0a0a] p-6 transition hover:bg-neutral-950/80"
              >
                <Icon size={20} className="text-neutral-700" />
                <div className="mt-3 text-3xl font-bold text-brand-300">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm font-bold text-neutral-100">
                  {stat.label}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {stat.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
