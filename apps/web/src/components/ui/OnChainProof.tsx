'use client';

import { useEffect, useState } from 'react';

/**
 * Live on-chain proof strip (Track 1). Fetches /api/onchain, which queries
 * Solana devnet, and shows both deployed programs with clickable explorer
 * links — so a judge can verify in one click that the parimutuel/USDC-escrow
 * program and the TxLINE validate_stat verifier are real, live, and executable.
 */

interface Program { key: string; label: string; id: string; deployed: boolean; explorer: string }
interface OnChain { ok: boolean; cluster: string; latencyMs: number; programs: Program[] }

export function OnChainProof() {
  const [data, setData] = useState<OnChain | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/onchain', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, []);

  if (err) return null;

  return (
    <div className="glass p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${data?.ok ? 'badge-live' : ''}`}
              style={{ background: data?.ok ? 'var(--green)' : '#64748b' }} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          On-chain · Solana devnet
        </span>
        {data && (
          <span className="text-[10px] text-gray-600">{data.latencyMs}ms</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(data?.programs ?? [
          { key: 'settlement', label: 'parimutuel + USDC escrow', id: '', deployed: false, explorer: '#' },
          { key: 'txline', label: 'validate_stat verifier', id: '', deployed: false, explorer: '#' },
        ]).map(p => (
          <a key={p.key} href={p.explorer} target="_blank" rel="noopener noreferrer"
             className="group flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 text-[11px] transition-all hover:brightness-125"
             style={{
               background: p.deployed ? 'rgba(16,185,129,0.08)' : 'var(--glass-bg)',
               border: `1px solid ${p.deployed ? 'rgba(16,185,129,0.35)' : 'var(--glass-border)'}`,
             }}>
            <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke={p.deployed ? 'var(--green)' : '#64748b'} strokeWidth={2.4}>
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold text-gray-200">{p.label}</span>
            {p.id && <span className="font-mono text-gray-500">{p.id.slice(0, 4)}…{p.id.slice(-4)}</span>}
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-gray-600 group-hover:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ))}
      </div>
      <p className="text-[10px] text-gray-600 basis-full leading-snug">
        Real programs, live now. Demo prop markets settle in-DB with{' '}
        <span style={{ color: 'var(--amber)' }}>Simulated</span> receipts; for a real fixture the keeper runs the
        on-chain <span className="font-mono">validate_stat</span> + payout the moment TxLINE publishes a final
        stat — verify one live under <span className="text-gray-400">Verify a real result</span> below.
      </p>
    </div>
  );
}
