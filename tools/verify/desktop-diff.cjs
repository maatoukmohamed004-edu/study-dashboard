// Deterministic desktop screenshots for before/after comparisons.
//   node tools/verify/desktop-diff.cjs shoot <dir>            → <dir>/<preset>-<page>-<width>-<scroll>.png
//   node tools/verify/desktop-diff.cjs compare <dirA> <dirB>  → pixel differences per image
// 3D canvases are hidden and animations frozen so any difference is a real layout or colour change.
// Needs a running server (npm run preview -- --port 5173) and playwright + pngjs (see matrix.cjs).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const sim = { 'sim.enabled': true, 'sim.date': '2026-11-18', 'sim.time': '14:40' };
const clear = { 'appearance.accent': null, 'appearance.background': null, 'background.color1': null, 'background.color2': null, 'background.color3': null };
const presets = {
  'mono-noir': { ...clear, 'appearance.preset': 'mono-noir', 'appearance.colorMode': 'dark', 'appearance.radius': 0, 'background.type': 'dither', 'glass.mode': 'refraction', 'glass.tint': 70, 'hud.grid': true, 'hud.orbStyle': 'dotted' },
  light: { ...clear, 'appearance.preset': 'light', 'appearance.colorMode': 'light', 'appearance.radius': 0, 'background.type': 'dots', 'glass.mode': 'blur', 'glass.tint': 75, 'hud.grid': true, 'hud.orbStyle': 'dotted' },
};
// Optional filters: PAGES=week,plan PRESETS=mono-noir WIDTHS=1440
const pages = (process.env.PAGES || 'today,week,plan,resources,absences,check,settings').split(',');
const widths = (process.env.WIDTHS || '1440,1024').split(',').map(Number);
const only = process.env.PRESETS ? process.env.PRESETS.split(',') : null;
const seed = fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8');

async function shoot(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [name, s] of Object.entries(presets).filter(([n]) => !only || only.includes(n)))
    for (const W of widths) {
      const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      await ctx.addInitScript(([v, p]) => {
        localStorage.setItem('study-dashboard:settings:v1', v);
        localStorage.setItem('study-dashboard:v1', p);
      }, [JSON.stringify({ version: 1, values: { ...s, ...sim } }), seed]);
      const page = await ctx.newPage();
      for (const pg of pages) {
        await page.goto(`${BASE}/#/${pg}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1500);
        await page.addStyleTag({ content: 'canvas{visibility:hidden!important} *,*::before,*::after{caret-color:transparent!important}' });
        const heights = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        for (const [label, frac] of [['top', 0], ['mid', 0.5], ['end', 1]]) {
          await page.evaluate((y) => window.scrollTo(0, y), Math.round(heights * frac));
          await page.waitForTimeout(250);
          await page.evaluate(() => document.getAnimations().forEach((a) => a.finish?.()));
          await page.screenshot({ path: path.join(dir, `${name}-${pg}-${W}-${label}.png`) });
        }
        process.stdout.write('.');
      }
      await ctx.close();
    }
  await browser.close();
  console.log(`\nshot ${fs.readdirSync(dir).length} images → ${dir}`);
}

function compare(a, b) {
  let total = 0, changed = 0;
  for (const f of fs.readdirSync(a).filter((f) => f.endsWith('.png')).sort()) {
    if (!fs.existsSync(path.join(b, f))) continue;
    const A = PNG.sync.read(fs.readFileSync(path.join(a, f)));
    const B = PNG.sync.read(fs.readFileSync(path.join(b, f)));
    total++;
    if (A.width !== B.width || A.height !== B.height) { console.log(`SIZE  ${f}`); changed++; continue; }
    let n = 0, max = 0;
    for (let i = 0; i < A.data.length; i += 4) {
      const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
      if (d > 6) n++;
      if (d > max) max = d;
    }
    if (n) { changed++; console.log(`DIFF  ${f}  ${n} px, max Δ ${max} (sum of RGB, 0–765)`); }
  }
  console.log(`${total} image pairs compared, ${changed} differ`);
}

const [mode, x, y] = process.argv.slice(2);
if (mode === 'shoot') shoot(path.resolve(x));
else if (mode === 'compare') compare(path.resolve(x), path.resolve(y));
else console.log('usage: desktop-diff.cjs shoot <dir> | compare <dirA> <dirB>');
