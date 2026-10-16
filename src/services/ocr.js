// OCR (metin tanıma): Tesseract.js ilk kullanımda internetten yüklenir, sonra önbellekten çalışır.
// Kapak taramada başlık/yazar, sayfa fotoğrafında sayfa numarası ve metin için kullanılır.

import { loadScript } from './scan.js';
import { blobToCanvas } from './images.js';
import { parsePageNumber, guessCover } from '../lib/ocrParse.js';
import { DEMO, DEMO_OFF_MSG } from '../env.js';

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

let workerPromise = null;
let progressHandler = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      await loadScript(TESSERACT_URL);
      if (!window.Tesseract) throw new Error('OCR kütüphanesi yüklenemedi');
      return window.Tesseract.createWorker('tur+eng', 1, {
        logger: (m) => {
          if (progressHandler) progressHandler(m);
        },
      });
    })().catch((e) => {
      workerPromise = null; // bir sonraki denemede yeniden dene
      throw e;
    });
  }
  return workerPromise;
}

// Kontrastı artırılmış gri tonlu kopya (isteğe bağlı ters renk: koyu zemin, açık yazı için)
function preprocess(src, invert = false) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = g;
    hist[g | 0]++;
  }
  // %2 ve %98 yüzdelikleri arasında kontrast germe
  const n = d.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0, i = 0; i < 256; i++) if ((acc += hist[i]) > n * 0.02) { lo = i; break; }
  for (let acc = 0, i = 255; i >= 0; i--) if ((acc += hist[i]) > n * 0.02) { hi = i; break; }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    let v = ((d[i] - lo) * 255) / span;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function collect(data) {
  let lines = data.lines;
  let words = data.words;
  if ((!lines || !words) && Array.isArray(data.blocks)) {
    lines = [];
    words = [];
    for (const b of data.blocks) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
      lines.push(l);
      for (const w of l.words || []) words.push(w);
    }
  }
  const box = (x) => x.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
  return {
    lines: (lines || []).map((l) => ({ text: (l.text || '').trim(), confidence: l.confidence, bbox: box(l) })),
    words: (words || []).map((w) => ({ text: (w.text || '').trim(), confidence: w.confidence, h: box(w).y1 - box(w).y0, bbox: box(w) })),
  };
}

// onProgress(0..1, durumMetni); psm: '3' otomatik sayfa, '11' dağınık metin (kapaklar)
export async function recognize(blob, onProgress, { psm = '3', canvas: given, invert = false, enhance = false } = {}) {
  if (DEMO) throw new Error(DEMO_OFF_MSG);
  const base = given || (await blobToCanvas(blob, 2000));
  const canvas = enhance || invert ? preprocess(base, invert) : base;
  progressHandler = (m) => {
    if (onProgress) onProgress(typeof m.progress === 'number' ? m.progress : 0, m.status || '');
  };
  if (onProgress) onProgress(0, 'Metin tanıma hazırlanıyor (ilk seferde birkaç saniye sürebilir)');
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  progressHandler = null;
  const { lines, words } = collect(data);
  return { text: (data.text || '').trim(), lines, words, width: canvas.width, height: canvas.height };
}

export async function readPage(blob, onProgress) {
  const r = await recognize(blob, onProgress, { psm: '3' });
  const page = parsePageNumber(r.lines, r.height);
  return { page: page ? page.page : null, text: r.text };
}

// Kapak: dağınık metin modu + kontrast; yeterli kelime çıkmazsa ters renkle ikinci deneme
export async function readCover(blob, onProgress) {
  const canvas = await blobToCanvas(blob, 1800);
  const strong = (ws) => ws.filter((w) => w.confidence >= 60 && w.text.replace(/[^\p{L}]/gu, '').length >= 3).length;
  const first = await recognize(blob, (p, t) => onProgress && onProgress(p * 0.5, t), { psm: '11', canvas, enhance: true });
  let lines = first.lines;
  let words = first.words;
  if (strong(words) < 4) {
    if (onProgress) onProgress(0.5, 'Koyu zemin için yeniden okunuyor…');
    const second = await recognize(blob, (p, t) => onProgress && onProgress(0.5 + p * 0.5, t), { psm: '11', canvas, invert: true });
    lines = lines.concat(second.lines);
    words = words.concat(second.words);
  }
  const guess = guessCover(lines);
  return { ...guess, words, text: lines.map((l) => l.text).join('\n') };
}
