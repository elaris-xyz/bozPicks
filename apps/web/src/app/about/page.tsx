import Link from 'next/link';
import { HeroAura } from '@/components/ui/HeroAura';
import { OnChainProof } from '@/components/ui/OnChainProof';

export const metadata = {
  title: 'About',
  description: 'Three World Cup products on one live TxLINE data core — consumer games, prediction markets, and autonomous trading agents.',
};

const TRACKS = [
  {
    href: '/markets', badge: 'Track 1 · Settlement', color: '#10b981', name: 'bozSettle',
    title: 'Prediction Markets & Settlement',
    desc: 'USDC parimutuel prop markets — goals, corners, cards, BTTS — that settle themselves the instant TxLINE confirms the result.',
    points: ['Parametric prop markets', 'Trustless Merkle settlement', 'Verifiable resolution receipt'],
  },
  {
    href: '/play', badge: 'Track 2 · Fan', color: '#3b82f6', name: 'bozPicks',
    title: 'Consumer & Fan Experiences',
    desc: 'Hi-Lo stat games, a live win-probability gauge and an AI pundit — a phone-first way to read the match as it happens.',
    points: ['Replayable Hi-Lo game', 'Live possession & danger', 'AI pundit with neural voice'],
  },
  {
    href: '/agent', badge: 'Track 3 · Agents', color: '#a78bfa', name: 'bozAgent',
    title: 'Trading Tools & Agents',
    desc: 'Two autonomous agents trade the same odds stream with opposite theses in a head-to-head Arena, scored on closing-line value.',
    points: ['Agent-vs-Agent Arena', 'CLV + accuracy tracking', 'Headless — no human input'],
  },
];

/** One shared data core → three products (the architecture story in one strip). */
const FLOW = [
  { label: 'TxLINE', sub: 'scores · odds · proofs', color: '#f59e0b',
    icon: <><circle cx="12" cy="12" r="2" /><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" strokeLinecap="round" /></> },
  { label: 'Ingest', sub: 'normalize → BozEvent', color: '#3b82f6',
    icon: <path d="M12 3v12M8 11l4 4 4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" /> },
  { label: 'Realtime', sub: 'Redis pub/sub → SSE', color: '#06b6d4',
    icon: <path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" strokeLinejoin="round" /> },
  { label: '3 products', sub: 'one live feed', color: '#10b981',
    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="7" rx="1.5" /></> },
  { label: 'Solana', sub: 'escrow + validate_stat', color: '#a78bfa',
    icon: <path d="M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4zM9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /> },
];

/** Exactly which TxLINE endpoints power the app (a submission requirement). */
const ENDPOINTS = [
  { path: '/auth/guest/start + /api/token/activate', use: 'Free-tier access — guest JWT, then on-chain subscribe + token activation' },
  { path: '/api/fixtures/snapshot', use: 'All 104 World Cup fixtures — schedule, ticker, and the Command Bridge picker' },
  { path: '/api/odds/snapshot · /api/odds/stream (SSE)', use: 'Consensus 1X2 odds — win probability, agent signals, arena strategies' },
  { path: '/api/scores/snapshot · /api/scores/stream (SSE)', use: 'Live goals, cards, corners, possession, VAR — feed, Hi-Lo, pundit' },
  { path: '/api/scores/historical/{fixtureId}', use: 'Full event sequence for replays of finished fixtures' },
  { path: '/api/scores/stat-validation', use: 'Merkle proof payload for validate_stat — the trustless settlement path' },
];

const STACK = [
  { k: 'Data', v: 'TxLINE — real-time scores, events & consensus odds, anchored on Solana' },
  { k: 'Chain', v: 'Solana devnet — USDC escrow + validate_stat Merkle proofs (Anchor)' },
  { k: 'Realtime', v: 'Server-Sent Events + Redis pub/sub (one stream drives every page)' },
  { k: 'AI', v: 'Claude Haiku pundit lines + neural TTS voice' },
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      {/* hero */}
      <header className="glass fx-rise relative overflow-hidden p-8 md:p-10 text-center">
        <HeroAura color="var(--blue)" />
        <div className="relative">
          <span className="chip-glass uppercase">World Cup 2026 · TxLINE Hackathon</span>
          <h1 className="font-display text-3xl md:text-4xl font-black mt-4 leading-tight">
            One live data core.<br />
            <span style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Three World Cup products.
            </span>
          </h1>
          <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl mx-auto">
            bozPicks turns TxLINE&rsquo;s real-time feed for all 104 matches into a fan game,
            a trustless prediction market, and an autonomous trading arena — submitted to all three tracks.
          </p>
        </div>
      </header>

      {/* architecture flow — the same pipeline language as Markets/Agent */}
      <section className="glass relative overflow-hidden p-5 md:p-6">
        <div className="relative flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--blue)', boxShadow: '0 0 10px rgba(59,130,246,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight text-gray-100">How it fits together</h2>
          <span className="text-[10px] uppercase tracking-widest text-gray-600">one feed · every page</span>
        </div>
        <p className="relative text-[12px] text-gray-500 mb-5">
          Every page you see runs off this single pipeline — nothing is mocked into the UI.
        </p>
        <div className="relative">
          <div className="absolute left-[10%] right-[10%] h-[2px] rounded-full"
               style={{ top: 26, background: 'linear-gradient(90deg,#f59e0b,#3b82f6,#06b6d4,#10b981,#a78bfa)', opacity: 0.35 }}>
            <span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                  style={{ background: '#fff', boxShadow: '0 0 12px #fff, 0 0 4px #3b82f6', animation: 'boz-flow 3.5s linear infinite' }} />
          </div>
          <div className="relative flex items-start justify-between gap-1">
            {FLOW.map((n, i) => (
              <div key={n.label} className="flex flex-col items-center text-center flex-1 min-w-0 anim-in" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-2"
                      style={{ background: `${n.color}18`, border: `1px solid ${n.color}55`, color: n.color, boxShadow: `0 0 20px ${n.color}22` }}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={n.label === 'Realtime' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>{n.icon}</svg>
                </span>
                <p className="text-[11px] md:text-xs font-bold leading-tight" style={{ color: n.color }}>{n.label}</p>
                <p className="text-[9px] md:text-[10px] text-gray-500 leading-tight mt-0.5">{n.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* three tracks */}
      <div className="grid gap-4 lg:grid-cols-3">
        {TRACKS.map(t => (
          <Link key={t.href} href={t.href}
            className="glass sheen group relative overflow-hidden p-5 flex flex-col transition-transform hover:-translate-y-1"
            style={{ borderColor: `${t.color}44` }}>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full self-start"
                  style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}55` }}>{t.badge}</span>
            <h2 className="font-display text-xl font-black mt-3" style={{ color: t.color }}>{t.name}</h2>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 mt-0.5">{t.title}</p>
            <p className="text-sm text-gray-400 mt-3 flex-1">{t.desc}</p>
            <ul className="mt-4 space-y-1.5">
              {t.points.map(p => (
                <li key={p} className="flex items-center gap-2 text-[13px] text-gray-300">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke={t.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  {p}
                </li>
              ))}
            </ul>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: t.color }}>
              Open {t.name}
              <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </Link>
        ))}
      </div>

      {/* judge quickstart — the 60-second tour */}
      <section className="glass relative overflow-hidden p-5 md:p-6" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--blue)', boxShadow: '0 0 10px rgba(59,130,246,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight text-gray-100">Judge it in 60 seconds</h2>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {[
            { n: '1', title: 'Open the Command Bridge', desc: 'The ⚡ icon, bottom-left on every page — pick a REAL TxLINE fixture and the exact outcome you want.', color: '#3b82f6' },
            { n: '2', title: 'Run the match', desc: 'Every page reacts live: feed, Hi-Lo, pundit voice, markets, agents — all off one SSE stream.', color: '#10b981' },
            { n: '3', title: 'Verify the settlement', desc: 'All six markets resolve to your chosen outcome with proof receipts. Or run `pnpm --filter=web test` — 28 deterministic tests.', color: '#a78bfa' },
          ].map(s => (
            <div key={s.n} className="rounded-xl p-3.5" style={{ background: `${s.color}0d`, border: `1px solid ${s.color}33` }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mb-2"
                    style={{ background: `${s.color}22`, color: s.color }}>{s.n}</span>
              <p className="text-[13px] font-bold text-gray-100">{s.title}</p>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TxLINE endpoints used — explicit, per the submission requirements */}
      <section className="glass p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--amber)', boxShadow: '0 0 10px rgba(245,158,11,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight text-gray-100">TxLINE endpoints in production here</h2>
        </div>
        <div className="space-y-2">
          {ENDPOINTS.map(e => (
            <div key={e.path} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 rounded-xl px-3 py-2"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
              <code className="text-[11px] font-mono flex-shrink-0 sm:w-[46%]" style={{ color: 'var(--amber)' }}>{e.path}</code>
              <span className="text-[12px] text-gray-400">{e.use}</span>
            </div>
          ))}
        </div>
      </section>

      {/* live on-chain proof + honesty note */}
      <OnChainProof />

      {/* tech stack */}
      <section className="glass p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight text-gray-100">Built on</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {STACK.map(s => (
            <div key={s.k} className="flex gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 w-16 flex-shrink-0 pt-0.5">{s.k}</span>
              <span className="text-[13px] text-gray-300">{s.v}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
