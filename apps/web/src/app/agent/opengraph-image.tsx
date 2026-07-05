import { ogImage, OG_SIZE } from '@/lib/og';

export const alt = 'bozAgent — autonomous trading agents';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogImage({
    title: 'Two agents. One feed. Best P&L wins.',
    subtitle: 'Autonomous strategies trading live TxLINE odds, with closing-line value.',
    accent: '#a78bfa',
    badge: 'Track 3 · Agents',
  });
}
