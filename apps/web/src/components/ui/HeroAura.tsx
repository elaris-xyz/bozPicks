/**
 * Decorative themed hero backdrop: a top neon hairline + three softly floating
 * colour orbs. Purely visual (pointer-events none), sits behind hero content.
 * Pass an accent color to match the track theme.
 */
export function HeroAura({ color = 'var(--blue)' }: { color?: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 'inherit' }} aria-hidden>
      <div className="absolute top-0 inset-x-0 h-px"
           style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="absolute rounded-full blur-2xl"
           style={{ width: 180, height: 180, top: -40, left: '12%', background: color, opacity: 0.14, animation: 'fx-float-a 11s ease-in-out infinite' }} />
      <div className="absolute rounded-full blur-2xl"
           style={{ width: 140, height: 140, bottom: -50, right: '18%', background: color, opacity: 0.12, animation: 'fx-float-b 13s ease-in-out infinite' }} />
      <div className="absolute rounded-full blur-3xl"
           style={{ width: 220, height: 220, top: '30%', right: '-6%', background: color, opacity: 0.08, animation: 'fx-float-c 15s ease-in-out infinite' }} />
    </div>
  );
}
