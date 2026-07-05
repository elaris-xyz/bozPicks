import { ogImage, OG_SIZE } from '@/lib/og';

export const alt = 'bozPicks Markets — trustless prediction markets';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogImage({
    title: 'Markets that settle themselves.',
    subtitle: 'USDC prop markets resolved by TxLINE Merkle proofs — no oracle to trust.',
    accent: '#10b981',
    badge: 'Track 1 · Settlement',
  });
}
