/**
 * The C-Dot mark. Ported from the marketing site (curiousdevs/src/components/
 * landing/Logo.tsx) — identical geometry and colour, so the console and the
 * marketing site render the same mark. Do not diverge without updating both.
 *
 * Construction: viewBox 0 0 200 200, ring centreline radius R = 76, stroke
 * weight 0.48R (thinned from the Brand Book's 0.62R per direct feedback),
 * opening 80° from 10°–90°, dot orbit 1.04R at 50°, dot radius 0.32× stroke
 * (enlarged from the Brand Book's 0.20× per direct feedback). Dot colour is
 * signal blue, not the Brand Book's reserved coral — also per direct
 * feedback on the marketing site, carried over here for consistency.
 */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <path
        d="M 176 100 A 76 76 0 1 1 113.2 25.15"
        stroke="var(--ink)"
        strokeWidth="36.48"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="160.55" cy="49.19" r="11.67" fill="var(--signal)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="text-[25px] font-bold tracking-[-0.02em] text-ink">
      Curious<span className="text-signal">Devs</span>
    </span>
  );
}
