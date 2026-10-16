// Kullanıcının kendi yapay zeka API anahtarıyla kapak okuma.
// Anahtar yalnızca bu cihazda (localStorage) saklanır ve yalnızca seçilen sağlayıcıya gönderilir.
// Model adları uygulamaya sabit yazılmaz: anahtar girildiğinde sağlayıcının güncel model
// listesi çekilir ve görüntü okuyabilen, hızlı/ucuz bir model otomatik seçilir.

import { useSyncExternalStore } from 'react';
import { resizeImage } from './images.js';

const KEY = 'kitaplik.ai.v1';

export const PROVIDERS = {
  gemini: {
    label: 'Gemini (ücretsiz)',
    company: 'Google',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    note: 'Ücretsiz katmanı var; kapak okumak için yeterli (günlük kullanım sınırıyla). Kredi kartı gerekmeden Google hesabınızla Google AI Studio’dan anahtar alınır.',
  },
  anthropic: {
    label: 'Claude',
    company: 'Anthropic',
    keyUrl: 'https://platform.claude.com/',
    keyHint: 'sk-ant-…',
    note: 'Ücretli (kullandıkça öde). Claude Pro/Max aboneliği API’yi kapsamaz; anahtar Claude Console’dan alınır.',
  },
  openai: {
    label: 'ChatGPT',
    company: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    note: 'Ücretli (kullandıkça öde). ChatGPT Plus aboneliği API’yi kapsamaz; anahtar OpenAI Platform’dan alınır.',
  },
};

/* ---------- Ayar deposu ---------- */
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && v.provider && v.key ? v : null;
  } catch {
    return null;
  }
}
let state = load();
const subs = new Set();
export function getAi() {
  return state;
}
export function setAi(v) {
  state = v;
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* depolama kapalı */
  }
  subs.forEach((f) => f());
}
export function useAi() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state
  );
}

/* ---------- HTTP ---------- */
async function request(url, opts = {}, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Yapay zeka yanıt vermedi (zaman aşımı). Yeniden deneyin.');
    throw new Error('Yapay zeka sağlayıcısına bağlanılamadı. İnternet bağlantınızı kontrol edin.');
  } finally {
    clearTimeout(t);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* gövde JSON değil */
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error?.status || body?.message || '';
    const code = body?.error?.code || body?.error?.type || '';
    if (code === 'insufficient_quota' || /insufficient_quota|exceeded your current quota/i.test(msg))
      throw new Error('OpenAI hesabınızda kullanılabilir bakiye yok. OpenAI API ücretsiz değildir; kullanmak için OpenAI Platform’da Billing bölümünden bakiye yüklemeniz gerekir. Ücretsiz seçenek için Gemini’yi bağlayabilirsiniz.');
    if (/credit balance is too low/i.test(msg))
      throw new Error('Claude API hesabınızda bakiye yok. Claude Console’dan bakiye yükleyin ya da ücretsiz seçenek için Gemini’yi bağlayın.');
    if (res.status === 401 || res.status === 403 || /api key|invalid.*key|permission/i.test(msg))
      throw new Error('API anahtarı geçersiz ya da yetkisiz. Anahtarı kontrol edin.');
    if (res.status === 429) throw new Error('Kullanım sınırına ulaşıldı ya da hesapta bakiye yok. Biraz bekleyip yeniden deneyin.');
    if (res.status === 402 || /credit|billing|quota|balance/i.test(msg)) throw new Error('Hesapta yeterli bakiye/kota yok.');
    throw new Error(`Yapay zeka hatası (${res.status})${msg ? ': ' + msg.slice(0, 140) : ''}`);
  }
  return body;
}

const anthropicHeaders = (key) => ({
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
  'content-type': 'application/json',
});

/* ---------- Model listesi ve otomatik seçim ---------- */
const ver = (id) => (String(id).match(/(\d+(?:\.\d+)?)/) || [0, 0])[1] * 1;

export function pickModel(provider, ids) {
  const list = ids.filter(Boolean);
  if (provider === 'anthropic') {
    // Liste en yeniden eskiye gelir; hızlı ve ucuz olan Haiku tercih edilir
    return list.find((id) => /haiku/i.test(id)) || list.find((id) => /sonnet/i.test(id)) || list[0];
  }
  if (provider === 'openai') {
    const bad = /audio|realtime|search|tts|transcribe|image|instruct|embedding|moderation|codex|computer|\d{4}-\d{2}-\d{2}/i;
    const minis = list.filter((id) => /^gpt-[\d.]+o?-mini$/i.test(id) && !bad.test(id)).sort((a, b) => ver(b) - ver(a));
    if (minis.length) return minis[0];
    const gpts = list.filter((id) => /^gpt-[\d.]+o?$/i.test(id) && !bad.test(id)).sort((a, b) => ver(b) - ver(a));
    return gpts[0] || list.find((id) => /gpt/i.test(id)) || list[0];
  }
  if (provider === 'gemini') {
    const flash = list.filter((id) => /^gemini-[\d.]+-flash$/i.test(id)).sort((a, b) => ver(b) - ver(a));
    if (flash.length) return flash[0];
    const anyFlash = list.filter((id) => /flash/i.test(id) && !/image|tts|audio|live|embedding/i.test(id)).sort((a, b) => ver(b) - ver(a));
    return anyFlash[0] || list[0];
  }
  return list[0];
}

// Anahtarı doğrular ve uygun modelleri döndürür: { models: string[], model: string }
export async function listModels(provider, key) {
  let ids = [];
  if (provider === 'anthropic') {
    const r = await request('https://api.anthropic.com/v1/models?limit=100', { headers: anthropicHeaders(key) }, 20000);
    ids = (r.data || []).map((m) => m.id);
  } else if (provider === 'openai') {
    const r = await request('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } }, 20000);
    ids = (r.data || []).map((m) => m.id).filter((id) => /^(gpt|o\d|chatgpt)/i.test(id));
  } else if (provider === 'gemini') {
    const r = await request(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, {}, 20000);
    ids = (r.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name).replace(/^models\//, ''))
      .filter((id) => /^gemini/i.test(id));
  }
  if (!ids.length) throw new Error('Bu anahtarla kullanılabilir model bulunamadı.');
  return { models: ids, model: pickModel(provider, ids) };
}

/* ---------- Kapak okuma ---------- */
const COVER_PROMPT = `This is a photo of a book cover (often Turkish). Read the printed text and return ONLY a JSON object, no other text:
{"title":"","subtitle":"","author":"","translator":"","publisher":"","isbn":""}
Rules: copy text exactly as printed, keeping Turkish characters; use normal title capitalization instead of ALL CAPS; "author" is the writer (several writers comma-separated); do not guess anything that is not visible; use "" for unknown fields.`;

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function parseJsonLoose(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Yapay zekanın yanıtı okunamadı. Yeniden deneyin.');
  const obj = JSON.parse(s.slice(start, end + 1));
  const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
  return {
    title: clean(obj.title),
    subtitle: clean(obj.subtitle),
    author: clean(obj.author),
    translator: clean(obj.translator),
    publisher: clean(obj.publisher),
    isbn: clean(obj.isbn),
  };
}

// Kapak fotoğrafını seçili yapay zekaya gönderir; { title, subtitle, author, translator, publisher, isbn }
export async function readCoverWithAi(blob, cfg = state) {
  if (!cfg) throw new Error('Yapay zeka bağlı değil.');
  const { blob: small } = await resizeImage(blob, 1280, 0.82);
  const data = await blobToBase64(small);
  const mime = 'image/jpeg';
  let text = '';

  if (cfg.provider === 'anthropic') {
    const r = await request('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders(cfg.key),
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mime, data } },
              { type: 'text', text: COVER_PROMPT },
            ],
          },
        ],
      }),
    });
    text = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  } else if (cfg.provider === 'openai') {
    const r = await request('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: COVER_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${data}` } },
            ],
          },
        ],
      }),
    });
    text = r.choices?.[0]?.message?.content || '';
  } else if (cfg.provider === 'gemini') {
    const r = await request(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.key)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data } }, { text: COVER_PROMPT }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    text = (r.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  } else {
    throw new Error('Bilinmeyen sağlayıcı');
  }
  return parseJsonLoose(text);
}
