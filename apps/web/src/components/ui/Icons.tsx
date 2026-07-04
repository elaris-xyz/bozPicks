'use client';

/**
 * Flat stroke icon set — one visual voice for the whole product.
 * Replaces emoji (which render inconsistently across platforms and read
 * as unpolished). All icons are 24×24 stroke-based, colored via
 * `currentColor`, sized via the `size` prop.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

/** radar / signal source — agent, live feeds */
export const IconRadar = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <path d="M12 12 5.6 5.6M5.6 5.6A9 9 0 0 0 3 12M8.5 8.5A5 5 0 0 0 7 12" />
    <path d="M16.5 7.5a6.5 6.5 0 0 1 0 9M19.4 4.6a10.5 10.5 0 0 1 0 14.8" />
  </svg>
);

/** target — accuracy */
export const IconTarget = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

/** pulse — live activity */
export const IconPulse = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />
  </svg>
);

/** bolt — sharp move / signals */
export const IconBolt = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" />
  </svg>
);

/** chain link — on-chain */
export const IconChain = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10 14a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 6.22" />
    <path d="M14 10a5 5 0 0 0-7.07 0L4.8 12.12a5 5 0 0 0 7.07 7.07l1.42-1.41" />
  </svg>
);

/** sparkles — AI */
export const IconSparkles = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4l1.6 4.2L18 9.8l-4.4 1.6L12 15.6l-1.6-4.2L6 9.8l4.4-1.6L12 4z" />
    <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15z" />
    <path d="M5 15.5l.6 1.4 1.4.6-1.4.6L5 19.5l-.6-1.4-1.4-.6 1.4-.6.6-1.4z" />
  </svg>
);

/** chart line — stats, odds */
export const IconChart = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-5 3.5 3L19 7" />
  </svg>
);

/** trending up — odds shift up */
export const IconTrendUp = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M14 7h7v7" />
  </svg>
);

/** football — goal / matches */
export const IconBall = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5 8 10.4l1.5 4.6h5L16 10.4 12 7.5z" />
    <path d="M12 3v4.5M8 10.4 4 9m5.5 6-2.4 3.9m7.4-3.9 2.4 3.9M16 10.4 20 9" />
  </svg>
);

/** card (yellow/red) — bookings */
export const IconCard = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="7" y="4" width="10" height="16" rx="2" />
  </svg>
);

/** substitution arrows */
export const IconSub = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h11M11 3l4 4-4 4" />
    <path d="M20 17H9M13 13l-4 4 4 4" />
  </svg>
);

/** whistle-ish (kickoff) — play circle */
export const IconKickoff = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
  </svg>
);

/** flag — match end */
export const IconFlagEnd = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 21V4" />
    <path d="M5 4h12l-2.5 4L17 12H5" />
  </svg>
);

/** pause — halftime */
export const IconPause = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
  </svg>
);

/** trophy — leaderboard */
export const IconTrophy = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 4h8v6a4 4 0 0 1-8 0V4z" />
    <path d="M8 5H5a1 1 0 0 0-1 1c0 2.2 1.6 4 4 4M16 5h3a1 1 0 0 1 1 1c0 2.2-1.6 4-4 4" />
    <path d="M12 14v3m-4 4h8m-6.5 0v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
  </svg>
);

/** shield-check — settled / verified */
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

/** database/feed — TxLINE data */
export const IconData = (p: IconProps) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
    <path d="M5 5.5V12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5.5" />
    <path d="M5 12v6.5C5 19.9 8.1 21 12 21s7-1.1 7-2.5V12" />
  </svg>
);

/** wallet */
export const IconWallet = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="14" rx="3" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="15" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

/** clock — upcoming */
export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2.5" />
  </svg>
);
