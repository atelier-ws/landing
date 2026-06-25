import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import GitHubIcon from "./GitHubIcon";
import GitHubStars from "./GitHubStars";

function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(
      `(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}=([^;]*)`,
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

const NAV_LINKS = [
  { label: "Blog", href: "/blog" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "https://docs.atelier.ws/installation" },
];

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileMenuRef.current) mobileMenuRef.current.inert = !mobileOpen;
  }, [mobileOpen]);

  useEffect(() => {
    setLoggedIn(!!getCookie("atelier_auth_token"));
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-200 bg-[#f7f8fb]/90 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-lg font-bold text-white">
            ❯
          </span>
          <span className="text-base font-bold tracking-wide text-neutral-950">
            ATELIER
          </span>
        </a>

        {/* Desktop nav links — middle */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs uppercase tracking-widest text-neutral-600 no-underline transition hover:text-neutral-950"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop actions — right */}
        <div className="hidden items-center gap-3 md:flex">
          <GitHubStars />
          <a
            href="https://github.com/atelier-ws/atelier"
            className="text-neutral-600 transition hover:text-neutral-950"
            aria-label="GitHub"
          >
            <GitHubIcon size={18} />
          </a>
          <a
            href="/account"
            className="inline-flex items-center gap-1.5 border border-neutral-950 bg-neutral-950 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white no-underline transition hover:bg-neutral-800"
          >
            {loggedIn ? "Account" : "Sign in"}
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="-mr-2 p-2 text-neutral-700 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        ref={mobileMenuRef}
        aria-hidden={!mobileOpen}
        className={`overflow-hidden transition-all duration-300 md:hidden ${
          mobileOpen
            ? "max-h-64 border-t border-neutral-200 bg-[#f7f8fb]/95"
            : "max-h-0"
        }`}
      >
        <div className="px-6 py-4">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="py-2 text-xs uppercase tracking-widest text-neutral-700 no-underline transition hover:text-neutral-950"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex items-center gap-3 border-t border-neutral-200 pt-3">
              <GitHubStars />
              <a
                href="https://github.com/atelier-ws/atelier"
                className="text-neutral-600 transition hover:text-neutral-950"
                aria-label="GitHub"
              >
                <GitHubIcon size={18} />
              </a>
              <a
                href="/account"
                className="inline-flex items-center gap-1.5 border border-neutral-950 bg-neutral-950 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white no-underline transition hover:bg-neutral-800"
                onClick={() => setMobileOpen(false)}
              >
                {loggedIn ? "Account" : "Sign in"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
