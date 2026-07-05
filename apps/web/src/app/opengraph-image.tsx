import { ogImage, OG_SIZE } from '@/lib/og';

export const alt = 'bozPicks — Live World Cup intelligence, on-chain';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogImage({
    title: 'Pick smart. Watch live. Get paid on-chain.',
    subtitle: 'Live scores, odds and match events for all 104 World Cup games.',
    accent: '#3b82f6',
    badge: 'bozPicks',
  });
}
