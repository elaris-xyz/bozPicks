import { isoFor } from '@/lib/flags';

/**
 * SVG team flag (flag-icons). Emoji flags don't render on Windows,
 * so this is the reliable cross-platform way to show country flags.
 *
 * Sizes: sm = list rows / ticker, md = cards, lg = match header.
 */
const SIZES = {
  xs: 'w-4 h-3',
  sm: 'w-5 h-[15px]',
  md: 'w-7 h-[21px]',
  lg: 'w-12 h-9',
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
  if (!code) {
    // Unknown team — neutral placeholder keeps layout stable
    return (
      <span
        className={`inline-block ${SIZES[size]} ${rounded ? 'rounded-[3px]' : ''} align-middle ${className}`}
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`fi fi-${code} !inline-block ${SIZES[size]} ${rounded ? 'rounded-[3px]' : ''} align-middle ${className}`}
      style={{ backgroundSize: 'cover', boxShadow: '0 0 0 1px rgba(255,255,255,0.09)' }}
      role="img"
      aria-label={`${team} flag`}
    />
  );
}
