// Claude içinde önizleme için tek dosyalık demo sayfası üretir: demo/kitaplik-demo.html
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const js = await build({
  entryPoints: ['src/main.jsx'], bundle: true, minify: true, write: false, format: 'esm',
  target: ['es2020', 'safari15'], jsx: 'automatic', loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"', __DEMO__: 'true' },
});
const css = await build({ entryPoints: ['src/styles.css'], bundle: true, minify: true, write: false });
const jsText = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const cssText = css.outputFiles[0].text.replace(/<\/style/gi, '<\\/style');

const html = `<title>Kitaplık</title>
<meta name="theme-color" content="#fbf7f0">
<style>${cssText}</style>
<div id="root"></div>
<script type="module">${jsText}</script>
`;
mkdirSync('demo', { recursive: true });
writeFileSync('demo/kitaplik-demo.html', html);
console.log('demo/kitaplik-demo.html', (html.length / 1024).toFixed(0) + ' KB');
