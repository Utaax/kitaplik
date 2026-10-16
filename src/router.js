// Çok küçük hash tabanlı yönlendirici (statik barındırmada ek ayar gerektirmez)
import { useSyncExternalStore, useMemo } from 'react';

const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash || '#/';

export function parseHash(hash) {
  const [path, qs] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => parseHash(hash), [hash]);
}

export function go(path, { replace = false } = {}) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else go(fallback, { replace: true });
}

// Ekranlar arası geçici veri aktarımı (ör. taramadan forma). Bellekte tutulur.
let draft = null;
export const setDraft = (d) => {
  draft = d;
};
export const takeDraft = () => {
  const d = draft;
  draft = null;
  return d;
};
export const peekDraft = () => draft;
