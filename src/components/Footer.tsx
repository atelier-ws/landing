import GitHubIcon from "./GitHubIcon";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-[#f7f8fb] px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 text-xs text-neutral-600 md:flex-row md:items-center md:justify-between">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-lg font-bold text-white">
            ❯
          </span>
          <span className="text-base font-bold tracking-wide text-neutral-950">
            ATELIER
          </span>
        </a>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href="/blog"
            className="text-neutral-600 no-underline transition hover:text-neutral-950"
          >
            Blog
          </a>
          <a
            href="https://docs.atelier.ws/installation"
            className="text-neutral-600 no-underline transition hover:text-neutral-950"
          >
            Docs
          </a>
          <a
            href="https://github.com/atelier-ws/atelier"
            className="inline-flex items-center gap-1.5 text-neutral-600 no-underline transition hover:text-neutral-950"
          >
            <GitHubIcon size={14} />
            GitHub
          </a>
          <a
            href="mailto:contact@atelier.ws"
            className="text-neutral-600 no-underline transition hover:text-neutral-950"
          >
            Contact
          </a>
          <a
            href="/license/recover"
            className="text-neutral-600 no-underline transition hover:text-neutral-950"
          >
            Recover license
          </a>
          <a
            href="/privacy"
            className="text-neutral-600 no-underline transition hover:text-neutral-950"
          >
            Privacy
          </a>
          <a
            href="/terms"
            className="text-neutral-600 no-underline transition hover:text-neutral-950"
          >
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
