import { useEffect, useState } from "react";
import { Star } from "lucide-react";

const REPO = "atelier-ws/atelier";

// Honest social proof: fetches the REAL star count client-side. Renders nothing
// until a real number loads — and nothing at all if the repo is private or
// unreachable. No hardcoded counts, ever.
export default function GitHubStars({ className = "" }: { className?: string }) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`https://api.github.com/repos/${REPO}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.stargazers_count === "number") {
          setStars(d.stargazers_count);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (stars === null) return null;

  const label = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : `${stars}`;

  return (
    <a
      href={`https://github.com/${REPO}`}
      className={`inline-flex items-center gap-1.5 border border-neutral-300 px-2.5 py-1 text-xs font-bold text-neutral-700 no-underline transition hover:border-neutral-950 hover:text-neutral-950 ${className}`}
      aria-label={`${stars} GitHub stars`}
    >
      <Star size={12} className="text-amber-400" />
      {label}
    </a>
  );
}
