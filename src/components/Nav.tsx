import { useState } from "react";
import { Menu, X } from "lucide-react";
import GitHubIcon from "./GitHubIcon";
import GitHubStars from "./GitHubStars";

const NAV_LINKS = [
  { label: "How it works", href: "#savings" },
  { label: "Benchmark", href: "#benchmark" },
  { label: "Hosts", href: "#hosts" },
  { label: "Docs", href: "https://docs.atelier.ws/installation" },
];

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-lg font-bold text-white">
            ❯
          </span>
          <span className="text-base font-bold tracking-wide text-neutral-100">
            ATELIER
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs uppercase tracking-widest text-neutral-400 no-underline transition hover:text-brand-300"
            >
              {link.label}
            </a>
          ))}
          <div className="flex items-center gap-3">
            <GitHubStars />
            <a
              href="https://github.com/atelier-runtime/atelier"
              className="text-neutral-400 transition hover:text-neutral-200"
              aria-label="GitHub"
            >
              <GitHubIcon size={18} />
            </a>
            <a
              href="#install"
              className="inline-flex items-center gap-1.5 border border-brand/60 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-300 no-underline transition hover:bg-brand/10"
            >
              Install
            </a>
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-neutral-400 md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden transition-all duration-300 md:hidden ${
          mobileOpen
            ? "max-h-64 border-t border-neutral-800 bg-neutral-950/95"
            : "max-h-0"
        }`}
      >
        <div className="px-6 py-4">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs uppercase tracking-widest text-neutral-300 no-underline transition hover:text-brand-300"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex items-center gap-3 pt-3 border-t border-neutral-800">
              <a
                href="https://github.com/atelier-runtime/atelier"
                className="text-neutral-400 transition hover:text-neutral-200"
                aria-label="GitHub"
              >
                <GitHubIcon size={18} />
              </a>
              <a
                href="#install"
                className="inline-flex items-center gap-1.5 border border-brand/60 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-300 no-underline transition hover:bg-brand/10"
                onClick={() => setMobileOpen(false)}
              >
                Install
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
