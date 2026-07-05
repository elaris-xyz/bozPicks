import { ogImage, OG_SIZE } from '@/lib/og';

export const alt = 'bozPicks — one data core, three World Cup products';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogImage({
    title: 'One data core. Three products.',
    subtitle: 'Fan games, trustless prediction markets, and autonomous agents on TxLINE.',
    accent: '#a78bfa',
    badge: 'bozPicks',
  });
}
