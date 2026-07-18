import type { Confidence } from '@bozpicks/shared';

/**
 * ONE standard for sharp-signal confidence, used everywhere a signal is shown
 * (agent page, match page, match cards, toasts). The old scheme used red for
 * HIGH and orange for MEDIUM — two near-identical hues that read as the same
 * colour and, worse, as "danger". Sharp moves are OPPORTUNITY, so use three
 * genuinely distinct, non-alarming hues: gold (high) · blue (medium) · slate
 * (low). Direction (↑/↓) is shown separately by an arrow, not by colour.
 */
export const SIGNAL_STYLE: Record<Confidence, {
  color: string; bg: string; border: string; label: string;
}> = {
  HIGH:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.45)', label: 'HIGH' },
  MEDIUM: { color: '#60a5fa', bg: 'rgba(96,165,250,0.14)',  border: 'rgba(96,165,250,0.42)', label: 'MED' },
  LOW:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)',  label: 'LOW' },
};

export const signalStyle = (c: Confidence) => SIGNAL_STYLE[c] ?? SIGNAL_STYLE.LOW;
