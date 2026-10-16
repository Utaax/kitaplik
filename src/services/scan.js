// Barkod / QR okuma. Öncelik: tarayıcının yerleşik BarcodeDetector'ı (Android Chrome).
// Yoksa (iOS Safari dahil) ZXing kütüphanesi ilk kullanımda internetten yüklenir ve
// service worker ile önbelleğe alınır.

const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

export function loadScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${url}"]`);
    if (existing) {
      if (existing.dataset.loaded) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Betik yüklenemedi')));
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.dataset.src = url;
    s.onload = () => {
      s.dataset.loaded = '1';
      resolve();
    };
    s.onerror = () => {
      s.remove();
      reject(new Error('Betik yüklenemedi: ' + url));
    };
    document.head.appendChild(s);
  });
}

const WASM_DETECTOR_URL = 'https://cdn.jsdelivr.net/npm/barcode-detector@3.2.2/dist/es/ponyfill.js/+esm';
let wasmDetectorPromise = null;
function loadWasmDetector() {
  if (!wasmDetectorPromise) {
    wasmDetectorPromise = (async () => {
      const url = WASM_DETECTOR_URL; // değişkenden içe aktarma: paketleyici dokunmaz
      const mod = await import(/* @vite-ignore */ url);
      const BD = mod.BarcodeDetector || mod.default?.BarcodeDetector;
      if (!BD) return null;
      const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'qr_code', 'code_128'] });
      // Motoru önceden ısıt (wasm dosyasını indirir)
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      await det.detect(c).catch(() => []);
      return det;
    })().catch((e) => {
      wasmDetectorPromise = null;
      throw e;
    });
  }
  return wasmDetectorPromise;
}

async function loadZXing() {
  if (window.ZXing) return window.ZXing;
  await loadScript(ZXING_URL);
  if (!window.ZXing) throw new Error('ZXing başlatılamadı');
  return window.ZXing;
}

// Bir tuval (canvas) üzerindeki kodu okur; bulamazsa null döner.
// Dönüş: { decode(canvas): Promise<string|null>, engine: 'native'|'zxing' }
export async function createDecoder() {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const wanted = ['ean_13', 'ean_8', 'upc_a', 'qr_code', 'code_128'].filter((f) => supported.includes(f));
      if (wanted.length) {
        const detector = new window.BarcodeDetector({ formats: wanted });
        return {
          engine: 'native',
          async decode(canvas) {
            try {
              const found = await detector.detect(canvas);
              return found.length ? found[0].rawValue : null;
            } catch {
              return null;
            }
          },
        };
      }
    } catch {
      /* ZXing'e düş */
    }
  }

  // iOS ve diğerleri: zxing-cpp'nin WebAssembly sürümü (eski ZXing JS'ten çok daha başarılı)
  try {
    const det = await loadWasmDetector();
    if (det) {
      return {
        engine: 'zxing-wasm',
        async decode(canvas) {
          try {
            const found = await det.detect(canvas);
            return found.length ? found[0].rawValue : null;
          } catch {
            return null;
          }
        },
      };
    }
  } catch {
    /* eski motora düş */
  }

  const Z = await loadZXing();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
    Z.BarcodeFormat.EAN_13,
    Z.BarcodeFormat.EAN_8,
    Z.BarcodeFormat.UPC_A,
    Z.BarcodeFormat.QR_CODE,
    Z.BarcodeFormat.CODE_128,
  ]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  return {
    engine: 'zxing',
    async decode(canvas) {
      try {
        const source = new Z.HTMLCanvasElementLuminanceSource(canvas);
        const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(source));
        return reader.decode(bitmap).getText();
      } catch {
        return null; // NotFoundException: bu karede kod yok
      }
    },
  };
}

// Durağan bir fotoğraftan kod okur (kamera izni verilmediğinde yedek yol)
export async function decodeFromCanvas(canvas) {
  const decoder = await createDecoder();
  return decoder.decode(canvas);
}
