import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Neural text-to-speech for the AI Pundit. Provider-flexible: it uses whichever
 * API key is configured (checked in this order), and returns the audio bytes so
 * the client can play a genuinely human voice. With NO key set it returns 204,
 * and the client silently falls back to the browser's Web Speech voice.
 *
 * Recommended FREE providers (set ONE in the env):
 *   GROQ_API_KEY      — Groq PlayAI TTS      (console.groq.com — generous free tier)  ← easiest
 *   DEEPGRAM_API_KEY  — Deepgram Aura-2      (deepgram.com — $200 free credit, very natural)
 *   OPENAI_API_KEY    — OpenAI gpt-4o-mini-tts (paid, but cheap + excellent)
 *   ELEVENLABS_API_KEY— ElevenLabs           (elevenlabs.io — 10k chars/mo free, top quality)
 *
 * Optional: TTS_VOICE overrides the default voice for the active provider.
 */
export async function POST(req: NextRequest) {
  let text = '';
  try { ({ text } = await req.json()); } catch { /* ignore */ }
  text = (text ?? '').toString().slice(0, 400).trim();
  if (!text) return new Response('missing text', { status: 400 });

  const V = process.env.TTS_VOICE;
  try {
    if (process.env.GROQ_API_KEY)       return await groq(text, V);
    if (process.env.DEEPGRAM_API_KEY)   return await deepgram(text, V);
    if (process.env.OPENAI_API_KEY)     return await openai(text, V);
    if (process.env.ELEVENLABS_API_KEY) return await elevenlabs(text, V);
  } catch (e) {
    console.error('[tts] provider error:', (e as Error).message);
    return new Response('tts upstream error', { status: 502 });
  }
  return new Response(null, { status: 204 }); // no provider configured → client uses Web Speech
}

const audio = (buf: ArrayBuffer, type: string) =>
  new Response(buf, { headers: { 'content-type': type, 'cache-control': 'no-store' } });

// ── Groq TTS (OpenAI-compatible; returns WAV) ────────────────────────────────
// Defaults to Canopy Labs' Orpheus — a far more natural/expressive voice than
// PlayAI. Model + voice are env-overridable. Falls back to PlayAI once if
// Orpheus isn't available on the account, so a config mismatch never goes mute.
async function groq(text: string, voice?: string) {
  const model = process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
  const call = (m: string, v: string) => fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: m, voice: v, input: text, response_format: 'wav' }),
  });

  let res = await call(model, voice || 'autumn');
  if (!res.ok && model.includes('orpheus')) {
    console.warn('[tts] orpheus unavailable, falling back to playai-tts');
    res = await call('playai-tts', 'Fritz-PlayAI');
  }
  if (!res.ok) throw new Error(`groq ${res.status}: ${await res.text().catch(() => '')}`);
  return audio(await res.arrayBuffer(), 'audio/wav');
}

// ── Deepgram Aura-2 (returns MP3) ────────────────────────────────────────────
async function deepgram(text: string, voice?: string) {
  const model = voice || 'aura-2-orion-en';
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`, {
    method: 'POST',
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`deepgram ${res.status}: ${await res.text().catch(() => '')}`);
  return audio(await res.arrayBuffer(), 'audio/mpeg');
}

// ── OpenAI TTS (returns MP3) ─────────────────────────────────────────────────
async function openai(text: string, voice?: string) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: voice || 'onyx', input: text, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text().catch(() => '')}`);
  return audio(await res.arrayBuffer(), 'audio/mpeg');
}

// ── ElevenLabs (returns MP3) ─────────────────────────────────────────────────
async function elevenlabs(text: string, voice?: string) {
  const id = voice || 'JBFqnCBsd6RMkjVDRZzb'; // "George" — warm male narrator
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY as string, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5' }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${await res.text().catch(() => '')}`);
  return audio(await res.arrayBuffer(), 'audio/mpeg');
}
