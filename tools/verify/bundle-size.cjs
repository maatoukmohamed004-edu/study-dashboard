// First-load size: the entry chunk plus every <link rel="modulepreload"> and stylesheet in dist/index.html.
//   npm run build && node tools/verify/bundle-size.cjs [chunk-name-prefix ...]
// Extra arguments print the gzipped size of matching lazy chunks too (e.g. "liquid-metal").
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dist = path.join(__dirname, '..', '..', 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(dist, f)), { level: 9 }).length / 1000;
const refs = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/^\.\//, ''));

const js = [...refs(/<script[^>]+src="([^"]+\.js)"/g), ...refs(/rel="modulepreload"[^>]*href="([^"]+\.js)"/g)];
const css = refs(/rel="stylesheet"[^>]*href="([^"]+\.css)"/g);
let total = 0;
for (const f of js) {
  const k = gz(f);
  total += k;
  console.log(`${k.toFixed(2).padStart(8)} kB  ${f}`);
}
console.log(`${total.toFixed(2).padStart(8)} kB  first-load JS (gzip -9)`);
for (const f of css) console.log(`${gz(f).toFixed(2).padStart(8)} kB  ${f}`);

for (const prefix of process.argv.slice(2)) {
  for (const f of fs.readdirSync(path.join(dist, 'assets')).filter((n) => n.startsWith(prefix)))
    console.log(`${gz('assets/' + f).toFixed(2).padStart(8)} kB  lazy  assets/${f}`);
}
