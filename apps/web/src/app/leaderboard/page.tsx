'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconTrophy } from '@/components/ui/Icons';

type Entry = {
  rank: number; wallet: string; total: number; wins: number;
  losses: number; winRate: number; totalStaked: number; totalPayout: number;
  netUsdc: number; since: string;
};

function shortWallet(w: string) {
  return w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
}

// podium tints for the top 3 rank badges
const PODIUM = [
  { ring: 'rgba(250,204,21,0.55)', bg: 'rgba(250,204,21,0.14)', text: '#facc15' }, // gold
  { ring: 'rgba(203,213,225,0.5)', bg: 'rgba(203,213,225,0.12)', text: '#cbd5e1' }, // silver
  { ring: 'rgba(217,119,66,0.5)',  bg: 'rgba(217,119,66,0.14)',  text: '#e0975a' }, // bronze
];

export default function LeaderboardPage() {
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'wins' | 'winRate' | 'netUsdc'>('wins');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...data].sort((a, b) => b[sort] - a[sort]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">Leaderboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Top predictors by performance</p>
        </div>
        <Link href="/stats"
          className="text-xs font-semibold px-3 py-1.5 rounded-xl"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: '#6b7280' }}>
          ← Stats
        </Link>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1.5">
        {([
          { key: 'wins',    label: 'Most Wins' },
          { key: 'winRate', label: 'Win Rate' },
          { key: 'netUsdc', label: 'Net P&L' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setSort(key)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={sort === key
              ? { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }
              : { background: 'var(--glass-bg)', color: '#6b7280', border: '1px solid var(--glass-border)' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 animate-spin"
               style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: 'var(--blue)' }} />
        </div>
      ) : data.length === 0 ? (
        <div className="glass text-center py-20">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
               style={{ color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <IconTrophy size={26} />
          </div>
          <p className="font-semibold text-gray-300 mb-1">No predictors yet</p>
          <p className="text-xs text-gray-600">Be the first to connect your wallet and make a prediction</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((e, i) => {
            const podium = i < 3 ? PODIUM[i] : null;
            return (
              <div key={e.wallet} className="glass glass-hover p-4 flex items-center gap-4"
                   style={podium ? { borderColor: podium.ring, boxShadow: `0 0 20px ${podium.bg}` } : {}}>
                {/* Rank badge */}
                <div className="flex-shrink-0">
                  {podium ? (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-sm"
                         style={{ color: podium.text, background: podium.bg, border: `1px solid ${podium.ring}` }}>
                      {i + 1}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-sm text-gray-500"
                         style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                      {e.rank}
                    </div>
                  )}
                </div>

                {/* Wallet + stats */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold font-mono text-gray-200">{shortWallet(e.wallet)}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-500">{e.wins}W · {e.losses}L</span>
                    <span className="text-[10px] text-gray-500">{e.winRate}% win rate</span>
                    {e.since && (
                      <span className="text-[10px] text-gray-700">
                        since {new Date(e.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Key metric */}
                <div className="text-right flex-shrink-0">
                  {sort === 'wins' && (
                    <>
                      <p className="stat-display text-lg" style={{ color: 'var(--green)' }}>{e.wins}</p>
                      <p className="text-[10px] text-gray-600">wins</p>
                    </>
                  )}
                  {sort === 'winRate' && (
                    <>
                      <p className="stat-display text-lg"
                         style={{ color: e.winRate >= 60 ? 'var(--green)' : e.winRate >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                        {e.winRate}%
                      </p>
                      <p className="text-[10px] text-gray-600">win rate</p>
                    </>
                  )}
                  {sort === 'netUsdc' && (
                    <>
                      <p className="stat-display text-lg"
                         style={{ color: e.netUsdc >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {e.netUsdc >= 0 ? '+' : ''}{e.netUsdc.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-gray-600">USDC</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-center text-gray-700">
        Rankings update in real-time · Minimum 1 settled prediction to appear
      </p>
    </div>
  );
}
