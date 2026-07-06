'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkline } from '@/components/ui/Sparkline';
import { CountUp } from '@/components/ui/CountUp';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconChart, IconTrophy, IconTarget } from '@/components/ui/Icons';

type Stats = {
  matches: { total: number; live: number; upcoming: number; finished: number };
  signals: {
    total: number; verified: number; accurate: number; active: number;
    accuracy: number | null;
    byConfidence: { HIGH: number; MEDIUM: number; LOW: number };
  };
  pool: { totalUsdc: number };
  recentSignals: {
    id: string; matchId: string; outcome: string; confidence: string;
    delta: number; verified: boolean; accurate: boolean | null; detectedAt: string;
  }[];
  topMatches: { matchId: string; count: number }[];
};

function StatCard({ label, value, sub, color = '#e2e8f0' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  const isPct = typeof value === 'string' && value.endsWith('%');
  return (
    <div className="poster-card glass-hover p-4 text-center">
      <p className="stat-display text-2xl" style={{ color }}>
        {typeof value === 'number'
          ? <CountUp value={value} />
          : isPct ? <CountUp value={parseFloat(value)} suffix="%" /> : value}
      </p>
      <p className="text-xs text-gray-500 mt-1.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 animate-spin"
           style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: 'var(--blue)' }} />
    </div>
  );

  if (!stats) return (
    <div className="glass text-center py-20">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-gray-500"
           style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
        <IconChart size={26} />
      </div>
      <p className="text-gray-400">Could not load stats</p>
    </div>
  );

  const { matches, signals, pool, recentSignals, topMatches } = stats;

  // Accuracy sparkline from recent signals (verified only)
  const accData = recentSignals
    .filter(s => s.verified)
    .map(s => s.accurate ? 1 : 0)
    .reverse();

  const confTotal = signals.byConfidence.HIGH + signals.byConfidence.MEDIUM + signals.byConfidence.LOW || 1;

  return (
    <div className="space-y-5">
      <PageHeader title="Stats" subtitle="Platform-wide analytics" />

      {/* Match metrics */}
      <div>
        <p className="section-label mb-3">Matches</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Matches" value={matches.total} />
          <StatCard label="Live Now"     value={matches.live}     color="var(--green)" sub={matches.live > 0 ? 'In play' : 'None active'} />
          <StatCard label="Upcoming"     value={matches.upcoming} color="var(--blue)" />
          <StatCard label="Finished"     value={matches.finished} color="#6b7280" />
        </div>
      </div>

      {/* Signal metrics */}
      <div>
        <p className="section-label mb-3">Sharp Agent</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Signals" value={signals.total} />
          <StatCard label="Active"         value={signals.active} color="var(--amber)" />
          <StatCard label="Verified"       value={signals.verified} color="var(--blue)" />
          <StatCard label="Accuracy"
            value={signals.accuracy !== null ? `${signals.accuracy}%` : '—'}
            color={signals.accuracy !== null
              ? signals.accuracy >= 60 ? 'var(--green)' : signals.accuracy >= 40 ? 'var(--amber)' : 'var(--red)'
              : '#6b7280'}
            sub={signals.verified > 0 ? `${signals.accurate}/${signals.verified} correct` : 'No data yet'} />
        </div>
      </div>

      {/* Confidence distribution */}
      <div className="glass p-4">
        <p className="section-label mb-4">Signal Confidence Distribution</p>
        <div className="space-y-3">
          {([
            { label: 'HIGH',   count: signals.byConfidence.HIGH,   color: 'var(--red)' },
            { label: 'MEDIUM', count: signals.byConfidence.MEDIUM, color: 'var(--orange)' },
            { label: 'LOW',    count: signals.byConfidence.LOW,    color: '#6b7280' },
          ] as const).map(({ label, count, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold" style={{ color }}>{label}</span>
                <span className="text-gray-500">{count} ({((count / confTotal) * 100).toFixed(0)}%)</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                     style={{ width: `${(count / confTotal) * 100}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pool + Accuracy trend row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-4">
          <p className="section-label mb-3">Prediction Pool</p>
          <p className="stat-value" style={{ color: 'var(--blue)' }}>{pool.totalUsdc.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">Total USDC locked</p>
        </div>

        {accData.length >= 2 && (
          <div className="glass p-4">
            <p className="section-label mb-3">Accuracy Trend</p>
            <Sparkline
              data={accData}
              color={signals.accuracy !== null && signals.accuracy >= 50 ? 'var(--green)' : 'var(--red)'}
              width={240}
              height={48}
            />
            <p className="text-[10px] text-gray-600 mt-2">Last {accData.length} verified signals</p>
          </div>
        )}
      </div>

      {/* Top matches by signal count */}
      {topMatches.length > 0 && (
        <div className="glass p-4">
          <p className="section-label mb-3">
            Most Active Matches
          </p>
          <div className="space-y-2">
            {topMatches.map((m, i) => (
              <div key={m.matchId} className="flex items-center justify-between py-1.5"
                   style={{ borderBottom: i < topMatches.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-600 w-4">{i + 1}</span>
                  <span className="text-xs text-gray-400 font-mono">{m.matchId}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--blue)' }}>
                  {m.count} signals
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent signals */}
      {recentSignals.length > 0 && (
        <div className="glass p-4">
          <p className="section-label mb-3">
            Recent Signals
          </p>
          <div className="space-y-1.5">
            {recentSignals.map(s => {
              const dir = s.delta > 0 ? '↑' : '↓';
              const cs = {
                HIGH:   { color: 'var(--red)',    bg: 'var(--red-dim)',    border: 'rgba(239,68,68,0.25)' },
                MEDIUM: { color: 'var(--orange)', bg: 'var(--orange-dim)', border: 'rgba(249,115,22,0.25)' },
                LOW:    { color: '#9ca3af',       bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
              }[s.confidence as 'HIGH' | 'MEDIUM' | 'LOW'];
              return (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl border"
                     style={{ background: cs.bg, borderColor: cs.border }}>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold" style={{ color: cs.color }}>
                      {s.outcome} {dir}{Math.abs(s.delta).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-gray-600 ml-2 font-mono">{s.matchId}</span>
                  </div>
                  {s.verified ? (
                    <span className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ color: s.accurate ? 'var(--green)' : 'var(--red)',
                                   background: s.accurate ? 'var(--green-dim)' : 'var(--red-dim)' }}>
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3}
                           strokeLinecap="round" strokeLinejoin="round">
                        {s.accurate ? <path d="M4 12l5 5L20 6" /> : <path d="M6 6l12 12M18 6L6 18" />}
                      </svg>
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-600">Pending</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/leaderboard"
          className="glass glass-hover p-4 flex items-center gap-3 block">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <IconTrophy size={20} />
          </span>
          <div>
            <p className="text-sm font-bold">Leaderboard</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Top predictors</p>
          </div>
        </Link>
        <Link href="/predictions"
          className="glass glass-hover p-4 flex items-center gap-3 block">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid rgba(59,130,246,0.25)' }}>
            <IconTarget size={20} />
          </span>
          <div>
            <p className="text-sm font-bold">My Predictions</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Connect wallet</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
