import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Subdomain → track landing routing.
 *
 * One Vercel deployment serves all three hackathon tracks. When you attach the
 * subdomains below, the root path of each is rewritten to its track experience
 * (the URL stays on the subdomain; the content is the track page):
 *
 *   picks.<domain>   → /          (Track 2 · Consumer & Fan Experiences)
 *   settle.<domain>  → /markets   (Track 1 · Prediction Markets & Settlement)
 *   agent.<domain>   → /agent     (Track 3 · Trading Tools & Agents)
 *
 * Matched on the leftmost host label, so it works with any root domain you add.
 * Only the "/" path is rewritten — deep links (e.g. settle.<domain>/agent)
 * pass through untouched. The bare deployment domain is unaffected.
 */
const SUBDOMAIN_ROUTES: Record<string, string> = {
  settle: '/markets',
  agent: '/agent',
  // "picks" maps to "/" — the default homepage, so no rewrite is needed.
};

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const sub = host.split('.')[0];
  const target = SUBDOMAIN_ROUTES[sub];

  if (target && req.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL(target, req.url));
  }
  return NextResponse.next();
}

// Run only for the landing path — cheap and avoids touching assets/APIs.
export const config = {
  matcher: ['/'],
};
