// Kullanıcı ayarları ve tema. Tasarım tek renkli (siyah/beyaz) ve sadedir;
// kullanıcı yalnızca açık/koyu görünümü, yazı boyutunu ve kitaplık görünümünü seçer.
import { useSyncExternalStore } from 'react';

const KEY = 'kitaplik.settings.v1';

const defaults = {
  mode: 'auto', // auto | light | dark
  fontScale: 1,
  view: 'grid', // grid | list
  sort: 'added', // added | title | author | rating
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) if (k in saved) out[k] = saved[k];
    return out;
  } catch {
    return { ...defaults };
  }
}

let state = load();
const subs = new Set();

export function applyTheme(s = state) {
  const root = document.documentElement;
  root.dataset.theme = s.mode;
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-ink');
  root.style.removeProperty('--radius');
  root.style.setProperty('--font-scale', String(s.fontScale));
  const dark = s.mode === 'dark' || (s.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0b0b0c' : '#fafafa');
}

export function getSettings() {
  return state;
}

export function updateSettings(patch) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* depolama dolu ya da kapalı */
  }
  applyTheme(state);
  subs.forEach((fn) => fn());
}

export function resetSettings() {
  updateSettings({ ...defaults });
}

export function useSettings() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state
  );
}
