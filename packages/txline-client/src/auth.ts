const TXLINE_BASE = 'https://txline.txodds.com';

// Guest JWT — short-lived, refreshed automatically
let cachedJwt: string | null = null;
let jwtExpiry = 0;

export async function getGuestJwt(): Promise<string> {
  if (cachedJwt && Date.now() < jwtExpiry) return cachedJwt;

  const res = await fetch(`${TXLINE_BASE}/auth/guest/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error(`TxLINE guest auth failed: ${res.status}`);

  const data = await res.json() as { token: string };
  cachedJwt = data.token;
  jwtExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000; // 29 days (token valid 30)
  return cachedJwt;
}

// Long-lived API token — set once from env after on-chain activation
export function getApiToken(): string {
  const token = process.env.TXLINE_API_KEY ?? '';
  if (!token) throw new Error('TXLINE_API_KEY not set — complete on-chain subscription first');
  return token;
}

// Returns both headers required for every data API call
export async function authHeaders(): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${await getGuestJwt()}`,
    'X-Api-Token': getApiToken(),
  };
}
