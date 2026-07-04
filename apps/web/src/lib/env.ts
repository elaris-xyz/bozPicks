const required = {
  DATABASE_URL:    process.env.DATABASE_URL,
  REDIS_URL:       process.env.REDIS_URL,
} as const;

const optional = {
  ANTHROPIC_API_KEY:          process.env.ANTHROPIC_API_KEY,
  TXLINE_API_KEY:             process.env.TXLINE_API_KEY,
  SHARP_THRESHOLD:            process.env.SHARP_THRESHOLD    ?? '0.10',
  SHARP_WINDOW_MS:            process.env.SHARP_WINDOW_MS    ?? '120000',
  LOG_EVENTS:                 process.env.LOG_EVENTS         ?? 'false',
  NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet',
  BOZPICKS_PROGRAM_ID:        process.env.BOZPICKS_PROGRAM_ID,
  SETTLEMENT_KEEPER_KEYPAIR:  process.env.SETTLEMENT_KEEPER_KEYPAIR ?? '[]',
} as const;

function validateEnv() {
  if (typeof window !== 'undefined') return; // client-side: skip

  // `next build` imports every route to collect page data. It must not need
  // live DB/Redis credentials — validate at request time, not build time.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const missing = (Object.entries(required) as [string, string | undefined][])
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(
      `[bozPicks] Missing required environment variables:\n  ${missing.join('\n  ')}\n\nCopy .env.example to .env and fill in the values.`
    );
  }
}

validateEnv();

export const env = { ...required, ...optional } as {
  DATABASE_URL: string;
  REDIS_URL: string;
  ANTHROPIC_API_KEY?: string;
  TXLINE_API_KEY?: string;
  SHARP_THRESHOLD: string;
  SHARP_WINDOW_MS: string;
  LOG_EVENTS: string;
  NEXT_PUBLIC_SOLANA_NETWORK: string;
  BOZPICKS_PROGRAM_ID?: string;
  SETTLEMENT_KEEPER_KEYPAIR: string;
};
