// Görsel yardımcıları: yeniden boyutlandırma, tuval alma, dosya seçme

async function loadBitmap(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* eski tarayıcı: aşağıdaki yönteme düş */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sizeOf = (src) => ({ w: src.naturalWidth || src.width, h: src.naturalHeight || src.height });

// Fotoğrafı en uzun kenarı maxSide olacak şekilde küçültüp JPEG'e çevirir (depolama tasarrufu)
export async function resizeImage(blob, maxSide = 1600, quality = 0.82) {
  const bmp = await loadBitmap(blob);
  const { w, h } = sizeOf(bmp);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if (bmp.close) bmp.close();
  const out = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return { blob: out || blob, width: canvas.width, height: canvas.height };
}

export async function blobToCanvas(blob, maxSide = 2000) {
  const bmp = await loadBitmap(blob);
  const { w, h } = sizeOf(bmp);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if (bmp.close) bmp.close();
  return canvas;
}

// Adres (URL) ile bir görselin gerçekten yüklenip yüklenmediğini dener
export function probeImage(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    const t = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => {
      clearTimeout(t);
      resolve(img.naturalWidth > 20 && img.naturalHeight > 20);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(false);
    };
    img.src = url;
  });
}

// Uzak kapağı yerel kopya olarak indirmeyi dener (CORS izin vermezse null döner)
export async function downloadCover(url, timeoutMs = 7000) {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') || blob.size < 1500) return null;
    const { blob: small } = await resizeImage(blob, 900, 0.85);
    return small;
  } catch {
    return null;
  }
}

// Kamerayı veya galeriyi açıp tek bir görsel seçtirir. camera=true: arka kamera
export function pickImage({ camera = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    let done = false;
    const finish = (file) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(file || null);
    };
    input.addEventListener('change', () => finish(input.files && input.files[0]));
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

// Dosyayı paylaş menüsüyle (iOS: Dosyalar/iCloud'a kaydet) ya da indirme olarak verir
export async function saveFile(blob, filename) {
  // Claude içindeki önizlemede: platformun indirme onayı
  try {
    const dl = window.claude?.use ? await window.claude.use('downloads') : null;
    if (dl) {
      try {
        await dl.save({ filename, data: blob });
        return 'downloaded';
      } catch (e) {
        if (e?.code === 'declined') return 'cancelled';
        throw new Error('Dosya kaydedilemedi (' + (e?.code || 'bilinmeyen hata') + ')');
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Dosya kaydedilemedi')) throw e;
  }
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
