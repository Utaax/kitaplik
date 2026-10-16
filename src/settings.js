// Kullanıcı ayarları ve tema. Tasarım değerleri CSS değişkenleri olarak uygulanır;
// böylece renk, yazı boyutu ve köşe yuvarlaklığı koda dokunmadan değiştirilebilir.
import { useSyncExternalStore } from 'react';

const KEY = 'kitaplik.settings.v1';

export const ACCENTS = [
  { name: 'Orman', value: '#2f5d50' },
  { name: 'Lacivert', value: '#2b4c7e' },
  { name: 'Bordo', value: '#8c2f39' },
  { name: 'Turuncu', value: '#c8643b' },
  { name: 'Mor', value: '#6b4c9a' },
  { name: 'Petrol', value: '#17717d' },
  { name: 'Hardal', value: '#a67c00' },
  { name: 'Grafit', value: '#3d4451' },
];

export const RADII = { sharp: '4px', soft: '14px', round: '22px' };

const defaults = {
  mode: 'auto', // auto | light | dark
  accent: ACCENTS[0].value,
  fontScale: 1,
  radius: 'soft',
  view: 'grid', // grid | list
  sort: 'added', // added | title | author | rating
};

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

let state = load();
const subs = new Set();

function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#1b1b1b' : '#ffffff';
}

export function applyTheme(s = state) {
  const root = document.documentElement;
  root.dataset.theme = s.mode;
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--accent-ink', inkFor(s.accent));
  root.style.setProperty('--font-scale', String(s.fontScale));
  root.style.setProperty('--radius', RADII[s.radius] || RADII.soft);
  const dark = s.mode === 'dark' || (s.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#16181a' : '#fbf7f0');
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
