// Derleme betiği: src/ -> dist/ (statik dosyalar, herhangi bir HTTPS sunucuya yüklenebilir)
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const dist = 'dist';
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const version = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'esm',
  target: ['es2020', 'safari15'],
  outfile: `${dist}/app.js`,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', __DEMO__: process.env.DEMO === '1' ? 'true' : 'false' },
  loader: { '.js': 'jsx' },
  logLevel: 'info',
});

await build({
  entryPoints: ['src/styles.css'],
  bundle: true,
  minify: true,
  outfile: `${dist}/app.css`,
  logLevel: 'info',
});

// Statik dosyalar
cpSync('public', dist, { recursive: true });

// Simgeler (sharp varsa SVG'den PNG üretir)
if (existsSync('scripts/make-icons.mjs')) {
  try {
    execFileSync('node', ['scripts/make-icons.mjs'], { stdio: 'inherit' });
  } catch (e) {
    console.warn('Simge üretimi atlandı:', e.message);
  }
}

// Service worker'a sürüm damgası
const sw = readFileSync(`${dist}/sw.js`, 'utf8').replace('__VERSION__', version);
writeFileSync(`${dist}/sw.js`, sw);
console.log('Derleme tamam, sürüm', version);
