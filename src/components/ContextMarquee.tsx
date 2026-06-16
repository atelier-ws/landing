const ITEMS = [
  "SCIP",
  "tree-sitter",
  "Zoekt",
  "BM25",
  "source projection",
  "outline reads",
  "range reads",
  "compact reads",
  "projection maps",
  "cached reads",
  "memoized search",
  "token budgets",
  "prefix-cache diagnostics",
  "run ledger",
  "context compression",
];

function MarqueeItems() {
  return (
    <>
      {ITEMS.map((item) => (
        <span
          key={item}
          className="shrink-0 border border-neutral-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-600"
        >
          {item}
        </span>
      ))}
    </>
  );
}

export default function ContextMarquee() {
  return (
    <section
      aria-label="Context engine technologies"
      className="border-b border-neutral-200 bg-[#f7f8fb] py-4"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-hidden px-6">
        <div className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 sm:block">
          Context engine
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="context-marquee flex w-max gap-2">
            <MarqueeItems />
            <div aria-hidden="true" className="flex gap-2">
              <MarqueeItems />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
