import { useState } from "react";
import { Check, Copy } from "lucide-react";

const INSTALL_CMD = "curl -fsSL https://install.atelier.ws | bash";

export default function InstallCmd() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <section
      id="install"
      className="border-t border-neutral-200 bg-[#f7f8fb] px-6 py-24"
    >
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-600">
          Get started
        </div>
        <h2 className="mt-3 text-2xl font-bold text-neutral-950 md:text-3xl">
          Install in one command
        </h2>

        {/* Command */}
        <div className="mt-8 flex items-center justify-between border border-neutral-300 bg-white px-4 py-3.5">
          <code className="min-w-0 overflow-x-auto whitespace-nowrap text-xs text-neutral-950 md:text-sm">
            <span className="text-neutral-400">$</span> {INSTALL_CMD}
          </code>
          <button
            onClick={handleCopy}
            className="ml-3 inline-flex shrink-0 items-center gap-1.5 border border-neutral-300 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy
              </>
            )}
          </button>
        </div>

        <div className="mt-8">
          <a
            href="https://docs.atelier.ws/installation"
            className="text-xs uppercase tracking-widest text-brand-700 no-underline transition hover:text-neutral-950"
          >
            Installation docs →
          </a>
        </div>
      </div>
    </section>
  );
}
