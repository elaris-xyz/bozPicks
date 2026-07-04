import { db } from '@/lib/db';
import Link from 'next/link';
import { Marquee } from '@/components/ui/Marquee';
import { Flag } from '@/components/ui/Flag';
import { IconChain, IconData, IconShield, IconRadar } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

async function getPoolStats() {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*)                                      AS total_pools,
        COUNT(*) FILTER (WHERE status = 'OPEN')       AS open_pools,
        COUNT(*) FILTER (WHERE status = 'SETTLED')    AS settled_pools,
        COALESCE(SUM(total_pool), 0)                  AS total_usdc,
        COUNT(DISTINCT p.wallet_address)              AS unique_predictors
      FROM boz_pools bp
      LEFT JOIN boz_predictions p ON p.match_id = bp.match_id
    `);
    return rows[0];
  } catch {
    return { total_pools: 0, open_pools: 0, settled_pools: 0, total_usdc: 0, unique_predictors: 0 };
  }
}

async function getOpenPools() {
  try {
    const { rows } = await db.query(`
      SELECT bp.match_id, bp.pool_home, bp.pool_draw, bp.pool_away,
             bp.total_pool, bp.fee_bps, bp.status,
             m.home_team, m.away_team, m.status AS match_status,
             m.home_score, m.away_score, m.current_minute
      FROM boz_pools bp
      JOIN boz_matches m ON m.id = bp.match_id
      WHERE bp.status = 'OPEN'
      ORDER BY m.kickoff_time ASC
      LIMIT 4
    `);
    return rows;
  } catch { return []; }
}

export default async function SettlePage() {
  const [stats, pools] = await Promise.all([getPoolStats(), getOpenPools()]);
  const totalUsdc = Number(stats.total_usdc) / 1_000_000;

  return (
    <div className="theme-settle space-y-8">

      {/* ── Hero ── */}
      <div className="glass hero-glow relative overflow-hidden p-8 md:p-12 text-center">
        <div className="absolute top-0 left-0 right-0 h-px"
             style={{ background: 'linear-gradient(90deg,transparent,rgb(var(--accent)),transparent)' }} />

        <div className="relative inline-flex mb-4">
          <span className="chip-glass uppercase">Track 1 — Prediction Markets &amp; Settlement</span>
        </div>

        <h1 className="font-display relative text-3xl md:text-5xl font-bold tracking-tight mb-3">
          Predict.<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--green), #6ee7b7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Settle on-chain.</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
          Parimutuel prediction pools on Solana devnet — trustless settlement via
          TxLINE cryptographic proofs. No middleman. Winners paid automatically.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 relative">
          <Link href="/" className="btn-accent justify-center">Browse Open Pools →</Link>
          <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener noreferrer"
             className="btn-ghost justify-center">
            Solana Explorer ↗
          </a>
        </div>

        {/* Stats strip */}
        <div className="flex items-center justify-center gap-8 mt-10 pt-6"
             style={{ borderTop: '1px solid var(--glass-border)' }}>
          {[
            { value: Number(stats.open_pools), label: 'Open Pools', color: 'var(--green)' },
            { value: `${totalUsdc.toFixed(0)} USDC`, label: 'Total Staked', color: 'var(--blue)' },
            { value: Number(stats.unique_predictors), label: 'Predictors', color: 'var(--amber)' },
          ].map(({ value, label, color }) => (
            <div key={label} className="text-center">
              <p className="stat-display text-2xl md:text-3xl" style={{ color }}>{value}</p>
              <p className="section-label mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* brand strip */}
      <Marquee items={[
        'Parimutuel Pools', 'Trustless Settlement', 'Merkle-Proof Verified',
        'No House Edge', 'Anchor on Solana', 'Winners Paid Automatically',
      ]} />

      {/* ── How it works ── */}
      <div className="glass p-6 space-y-4">
        <p className="section-label">How Settlement Works</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { n: '1', title: 'Place Prediction', desc: 'Connect Phantom, pick Home / Draw / Away, stake USDC on Solana devnet', color: 'var(--blue)' },
            { n: '2', title: 'Pool Fills', desc: 'All stakes go into parimutuel pool — no house edge, just 2% protocol fee', color: 'var(--blue)' },
            { n: '3', title: 'TxLINE Verifies', desc: 'On match end, keeper CPI calls validate_stat — outcome verified on-chain with Merkle proof', color: 'var(--amber)' },
            { n: '4', title: 'Winners Paid', desc: 'Smart contract distributes pool proportionally to winning predictors — fully trustless', color: 'var(--green)' },
          ].map(({ n, title, desc, color }) => (
            <div key={n} className="rounded-xl p-4 space-y-2"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black"
                   style={{ background: `${color}22`, color }}>
                {n}
              </div>
              <p className="text-sm font-bold text-gray-100">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Open pools ── */}
      {pools.length > 0 && (
        <div className="space-y-3">
          <p className="section-label">
            Open Pools — {pools.length} available
          </p>
          <div className="space-y-3">
            {pools.map((p) => {
              const total = Number(p.total_pool) || 1;
              const toUsdc = (n: number) => (Number(n) / 1_000_000).toFixed(1);
              return (
                <Link key={p.match_id} href={`/match/${p.match_id}`}
                  className="glass p-5 rounded-2xl block hover:border-green-500/30 transition-all"
                  style={{ borderColor: 'var(--glass-border)' }}>
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-bold text-sm truncate">
                        <Flag team={p.home_team} size="xs" /> {p.home_team}
                        <span className="text-gray-600 font-normal mx-0.5">v</span>
                        {p.away_team} <Flag team={p.away_team} size="xs" />
                      </p>
                      <p className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-1">
                        {(p.match_status === 'LIVE' || p.match_status === 'HALFTIME') && (
                          <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'var(--green)' }} />
                        )}
                        <span style={{ color: (p.match_status === 'LIVE' || p.match_status === 'HALFTIME') ? 'var(--green)' : '#6b7280' }}>
                          {p.match_status === 'LIVE' ? `LIVE ${p.current_minute}'` : p.match_status}
                        </span>
                        {(p.match_status === 'LIVE' || p.match_status === 'HALFTIME') &&
                          <span className="text-gray-600 font-mono">{p.home_score}–{p.away_score}</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="stat-display text-base" style={{ color: 'var(--green)' }}>
                        {toUsdc(p.total_pool)} <span className="text-[10px] text-gray-500">USDC</span>
                      </p>
                      <p className="text-[10px] text-gray-600">total pool</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Home', amount: p.pool_home, color: 'var(--green)' },
                      { label: 'Draw', amount: p.pool_draw, color: '#9ca3af' },
                      { label: 'Away', amount: p.pool_away, color: 'var(--blue)' },
                    ].map(({ label, amount, color }) => {
                      const pct = (Number(amount) / total) * 100;
                      return (
                        <div key={label}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span style={{ color }}>{label}</span>
                            <span className="text-gray-600">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden"
                               style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full"
                                 style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
                          </div>
                          <p className="text-[9px] text-gray-700 mt-0.5">{toUsdc(amount)} USDC</p>
                        </div>
                      );
                    })}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tech stack badge ── */}
      <div className="glass p-5 rounded-2xl">
        <p className="section-label mb-4">Built With</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <IconChain size={18} />,  color: 'var(--green)',  name: 'Solana',     desc: 'Devnet · Anchor framework' },
            { icon: <IconData size={18} />,   color: 'var(--blue)',   name: 'TxLINE',     desc: 'validate_stat CPI' },
            { icon: <IconShield size={18} />, color: 'var(--amber)',  name: 'USDC',       desc: 'SPL token escrow' },
            { icon: <IconRadar size={18} />,  color: 'var(--purple)', name: 'Keeper Bot', desc: 'Auto settlement trigger' },
          ].map(({ icon, color, name, desc }) => (
            <div key={name} className="rounded-xl p-3.5 text-center"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
              <div className="w-9 h-9 mx-auto mb-2 rounded-xl flex items-center justify-center"
                   style={{ color, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
                {icon}
              </div>
              <p className="text-xs font-bold text-gray-200">{name}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
