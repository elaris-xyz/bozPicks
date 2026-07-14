import { isoFor } from '@/lib/flags';

/**
 * SVG team flag (flag-icons). Emoji flags don't render on Windows,
 * so this is the reliable cross-platform way to show country flags.
 *
 * Sizes: sm = list rows / ticker, md = cards, lg = match header.
 */
// px sizes (4:3, matching the flag-icons artwork) applied as INLINE styles —
// flag-icons' own `.fi { width: 1.333em }` rule loads after Tailwind and was
// overriding utility widths, squishing flags into tall slivers.
const SIZES = {
  xs: [16, 12],
  sm: [20, 15],
  md: [28, 21],
  lg: [48, 36],
} as const;

/**
 * Full-bleed flag layer that fades from one edge toward the center.
 * Shared by the poster match cards and the match-detail score header.
 */
export function FlagBleed({
  team, side, opacity = 0.42,
}: {
  team: string; side: 'home' | 'away'; opacity?: number;
}) {
  const code = isoFor(team);
  const isHome = side === 'home';
  const mask = isHome
    ? 'linear-gradient(100deg, rgba(0,0,0,0.95) 10%, rgba(0,0,0,0.5) 48%, transparent 85%)'
    : 'linear-gradient(260deg, rgba(0,0,0,0.95) 10%, rgba(0,0,0,0.5) 48%, transparent 85%)';

  if (!code) {
    // unknown team — soft tinted panel so the layout still reads two-sided
    return (
      <div
        className={`poster-flag absolute top-0 bottom-0 w-[60%] ${isHome ? 'left-0' : 'right-0'}`}
        style={{
          background: isHome
            ? 'radial-gradient(ellipse at 0% 50%, rgba(59,130,246,0.25), transparent 70%)'
            : 'radial-gradient(ellipse at 100% 50%, rgba(167,139,250,0.22), transparent 70%)',
          WebkitMaskImage: mask, maskImage: mask,
        }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={`fi fi-${code} poster-flag`}
      // geometry is inline so flag-icons' own .fi sizing (width:1.33em,
      // display:inline-block, position:relative) can never override it
      style={{
        position: 'absolute',
        top: 0, bottom: 0,
        width: '60%',
        height: '100%',
        ...(isHome ? { left: 0 } : { right: 0 }),
        display: 'block',
        lineHeight: 'normal',
        backgroundSize: 'cover',
        backgroundPosition: isHome ? 'left center' : 'right center',
        opacity,
        filter: 'saturate(1.15)',
        WebkitMaskImage: mask, maskImage: mask,
        transformOrigin: isHome ? 'left center' : 'right center',
      }}
      aria-hidden
    />
  );
}

export function Flag({
  team, size = 'sm', rounded = true, className = '',
}: {
  team: string | undefined | null;
  size?: keyof typeof SIZES;
  rounded?: boolean;
  className?: string;
}) {
  const code = isoFor(team);
  const [w, h] = SIZES[size];
  if (!code) {
    // Unknown team — neutral placeholder keeps layout stable
    return (
      <span
        className={`inline-block flex-shrink-0 ${rounded ? 'rounded-[3px]' : ''} align-middle ${className}`}
        style={{ width: w, height: h, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`fi fi-${code} !inline-block flex-shrink-0 ${rounded ? 'rounded-[3px]' : ''} align-middle ${className}`}
      // 100%/100% (not cover) — the box is already 4:3, so the whole flag
      // shows edge to edge with zero cropping or distortion
      style={{ width: w, height: h, backgroundSize: '100% 100%', boxShadow: '0 0 0 1px rgba(255,255,255,0.09)' }}
      role="img"
      aria-label={`${team} flag`}
    />
  );
}

/**
 * Crisp FULL flag pinned to a banner corner: full banner height, correct 4:3
 * aspect (every stripe visible — no cover-crop), softly fading toward the
 * centre. Pairs with <FlagWash> for the match-header hero.
 */
export function FlagCorner({ team, side }: { team: string; side: 'home' | 'away' }) {
  const code = isoFor(team);
  const isHome = side === 'home';
  if (!code) return null;
  const mask = isHome
    ? 'linear-gradient(90deg, rgba(0,0,0,0.95) 30%, rgba(0,0,0,0.45) 72%, transparent)'
    : 'linear-gradient(270deg, rgba(0,0,0,0.95) 30%, rgba(0,0,0,0.45) 72%, transparent)';
  return (
    <div
      className={`fi fi-${code}`}
      style={{
        position: 'absolute', top: 0, bottom: 0,
        ...(isHome ? { left: 0 } : { right: 0 }),
        height: '100%', width: 'auto', aspectRatio: '4 / 3',
        display: 'block', lineHeight: 'normal',
        backgroundSize: '100% 100%',
        filter: 'saturate(1.12)',
        WebkitMaskImage: mask, maskImage: mask,
      }}
      aria-hidden
    />
  );
}

/**
 * The "mix the colours" layer: both flags stretched across the banner,
 * heavily blurred and saturated, overlapping in the middle — team colours
 * wash into each other without any recognisable (croppable) flag geometry.
 */
export function FlagWash({ home, away, opacity = 0.42 }: { home: string; away: string; opacity?: number }) {
  const h = isoFor(home), a = isoFor(away);
  const base: React.CSSProperties = {
    position: 'absolute', top: '-12%', bottom: '-12%', width: '64%',
    display: 'block', lineHeight: 'normal', backgroundSize: '100% 100%',
  };
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden
         style={{ filter: 'blur(44px) saturate(1.6)', opacity, transform: 'scale(1.25)' }}>
      {h && <div className={`fi fi-${h}`} style={{ ...base, left: '-4%',
        WebkitMaskImage: 'linear-gradient(90deg, black 35%, transparent)', maskImage: 'linear-gradient(90deg, black 35%, transparent)' }} />}
      {a && <div className={`fi fi-${a}`} style={{ ...base, right: '-4%',
        WebkitMaskImage: 'linear-gradient(270deg, black 35%, transparent)', maskImage: 'linear-gradient(270deg, black 35%, transparent)' }} />}
    </div>
  );
}
