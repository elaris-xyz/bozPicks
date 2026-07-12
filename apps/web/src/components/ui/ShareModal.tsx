'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Graphical share dialog — shows the stat you're sharing on a branded card and
 * offers real social targets (X, Telegram, WhatsApp, Facebook) + copy, instead
 * of bouncing to the OS share sheet. Portalled to body, Esc/backdrop to close.
 */

export interface ShareData {
  headline: string;   // big line on the card, e.g. "🔥 12 streak"
  sub?: string;       // supporting line
  text: string;       // the caption used for social/copy
  url?: string;       // link to include
}

const PANEL_BG = 'linear-gradient(180deg, #101a30, #0a0f1e)';

export function ShareModal({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  if (!mounted) return null;

  const url = data.url ?? (typeof window !== 'undefined' ? window.location.origin : 'https://bozpicks.app');
  const enc = encodeURIComponent(data.text);
  const encU = encodeURIComponent(url);

  const targets = [
    { name: 'X', color: '#e7e9ea', href: `https://twitter.com/intent/tweet?text=${enc}&url=${encU}`,
      icon: <path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h6.9l4.8 6.3L18.9 2Zm-2.4 18h1.9L7.6 4H5.6l10.9 16Z" /> },
    { name: 'Telegram', color: '#2aabee', href: `https://t.me/share/url?url=${encU}&text=${enc}`,
      icon: <path d="M21.9 4.3 18.7 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 9-8.1c.4-.3-.1-.5-.6-.2L6.9 13.2l-4.8-1.5c-1-.3-1-.9.2-1.4l18.6-7.2c.9-.3 1.6.2 1 1.2Z" /> },
    { name: 'WhatsApp', color: '#25d366', href: `https://wa.me/?text=${enc}%20${encU}`,
      icon: <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.3 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2.1.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2 1.2.9 1.8.9 2 .9.2 0 .3-.1.5-.3l.6-.7c.2-.2.3-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z" /> },
    { name: 'Facebook', color: '#1877f2', href: `https://www.facebook.com/sharer/sharer.php?u=${encU}&quote=${enc}`,
      icon: <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" /> },
  ];

  const copy = () => {
    navigator.clipboard?.writeText(`${data.text} ${url}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4"
         style={{ background: 'rgba(3,6,16,0.74)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden anim-in"
           style={{ background: PANEL_BG, border: '1px solid rgba(245,200,107,0.3)', boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}
           onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#f5c86b,transparent)' }} />

        <div className="flex items-center justify-between px-5 pt-5">
          <p className="font-display font-black text-[15px]">Share your run</p>
          <button onClick={onClose} aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* the branded stat card that gets shared */}
        <div className="px-5 pt-4">
          <div className="relative rounded-2xl p-5 text-center overflow-hidden"
               style={{ background: 'radial-gradient(120% 130% at 50% 0%, rgba(245,200,107,0.16), rgba(10,15,30,0.5))', border: '1px solid rgba(245,200,107,0.25)' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="w-4 h-4 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)' }}>
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#fff"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
              </span>
              <span className="text-[11px] font-bold tracking-tight"><span style={{ color: 'var(--blue)' }}>boz</span><span className="text-white">Picks</span></span>
            </div>
            <p className="font-display font-black leading-none" style={{ fontSize: 'clamp(2rem,10vw,3rem)', color: '#fde68a', textShadow: '0 0 30px rgba(245,200,107,0.5)' }}>{data.headline}</p>
            {data.sub && <p className="text-xs text-gray-400 mt-2">{data.sub}</p>}
          </div>
        </div>

        {/* social targets */}
        <div className="px-5 pt-4 grid grid-cols-4 gap-2">
          {targets.map(t => (
            <a key={t.name} href={t.href} target="_blank" rel="noopener noreferrer" title={`Share on ${t.name}`}
               className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill={t.color}>{t.icon}</svg>
              <span className="text-[9px] font-semibold text-gray-400">{t.name}</span>
            </a>
          ))}
        </div>

        {/* copy */}
        <div className="px-5 py-4">
          <button onClick={copy}
            className="w-full h-11 rounded-xl font-bold text-sm transition-all active:scale-[0.99]"
            style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(245,200,107,0.14)', color: copied ? 'var(--green)' : '#f5c86b', border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(245,200,107,0.4)'}` }}>
            {copied ? '✓ Copied — paste it anywhere' : 'Copy caption + link'}
          </button>
          <p className="text-[10px] text-gray-600 text-center mt-2">For Instagram/TikTok, copy and paste into your post.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
