import { ogImage, OG_SIZE } from '@/lib/og';

export const alt = 'bozPicks Play — live World Cup fan games';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogImage({
    title: 'Read the game as it happens.',
    subtitle: 'Hi-Lo, live win-probability and an AI pundit — powered by TxLINE.',
    accent: '#3b82f6',
    badge: 'Track 2 · Fan',
  });
}
