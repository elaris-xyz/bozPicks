import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Shared cinematic Open Graph card renderer. Satori (next/og) needs explicit
 * flex on any element with multiple children — keep layouts flat + flexed.
 */
export function ogImage(opts: {
  title: string;
  subtitle: string;
  accent: string;      // hex
  badge: string;
}) {
  const { title, subtitle, accent, badge } = opts;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: 72,
          background: `linear-gradient(135deg, ${rgba(accent, 0.28)} 0%, #0B1020 42%, #0B1020 60%, ${rgba(accent, 0.16)} 100%)`,
          color: '#e2e8f0', fontFamily: 'sans-serif',
        }}
      >
        {/* top row: logo + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 18,
              background: `linear-gradient(135deg, #3b82f6, #a78bfa)`,
              boxShadow: `0 0 40px ${rgba(accent, 0.53)}`, fontSize: 40,
            }}>⚡</div>
            <div style={{ display: 'flex', marginLeft: 20, fontSize: 40, fontWeight: 800 }}>
              <span style={{ color: '#3b82f6' }}>boz</span>
              <span style={{ color: '#fff' }}>Picks</span>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', padding: '10px 22px', borderRadius: 999,
            border: `2px solid ${accent}`, color: accent, fontSize: 24, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 2,
          }}>{badge}</div>
        </div>

        {/* title block */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, color: '#fff' }}>
            {title}
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 34, color: '#94a3b8', maxWidth: 900 }}>
            {subtitle}
          </div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, color: '#64748b' }}>
          <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 999, background: accent, marginRight: 12 }} />
          Live World Cup data · TxLINE · Solana
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
