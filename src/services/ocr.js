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

// onProgress(0..1, durumMetni)
export async function recognize(blob, onProgress) {
  if (DEMO) throw new Error(DEMO_OFF_MSG);
  const canvas = await blobToCanvas(blob, 2000);
  progressHandler = (m) => {
    if (onProgress) onProgress(typeof m.progress === 'number' ? m.progress : 0, m.status || '');
  };
  if (onProgress) onProgress(0, 'OCR hazırlanıyor (ilk seferde birkaç saniye sürebilir)');
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas);
  progressHandler = null;
  const lines = (data.lines || []).map((l) => ({
    text: (l.text || '').trim(),
    confidence: l.confidence,
    bbox: l.bbox,
  }));
  return { text: (data.text || '').trim(), lines, width: canvas.width, height: canvas.height };
}

export async function readPage(blob, onProgress) {
  const r = await recognize(blob, onProgress);
  const page = parsePageNumber(r.lines, r.height);
  return { page: page ? page.page : null, text: r.text };
}

export async function readCover(blob, onProgress) {
  const r = await recognize(blob, onProgress);
  const guess = guessCover(r.lines);
  return { ...guess, text: r.text };
}
