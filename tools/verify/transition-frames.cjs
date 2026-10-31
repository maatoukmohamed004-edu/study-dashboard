// Frames of the page transition at fixed times, to check where the disc starts and how it grows.
//   node tools/verify/transition-frames.cjs <out-dir>
// The animation is paused and seeked, so frames are exact even on slow software rendering.
// A crosshair marks the press point. Scenarios: View Transition reveal (desktop, phone), the
// fallback with startViewTransition removed, Disc wash, reduced motion, and reveal over the
// animated WebGL background with refraction glass (with a header-glass stability measure).
// Needs a running server and playwright + pngjs (see matrix.cjs).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = path.resolve(process.argv[2] || 'verify-out/transitions');
fs.mkdirSync(OUT, { recursive: true });
const seed = fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8');
const sim = { 'sim.enabled': true, 'sim.date': '2026-11-18', 'sim.time': '14:40' };
const TIMES = [0, 100, 250, 400, 650];

const scenarios = [
  { name: 'reveal-desktop', W: 1440, H: 900, settings: {}, from: 'today', click: '.tb-nav a[href="#/week"]' },
  { name: 'reveal-phone', W: 390, H: 844, phone: true, settings: {}, from: 'today', click: '.tab[href="#/plan"]' },
  { name: 'fallback-reveal-desktop', W: 1440, H: 900, settings: {}, from: 'today', click: '.tb-nav a[href="#/week"]', noVT: true },
  { name: 'wash-desktop', W: 1440, H: 900, settings: { 'nav.transition': 'wash' }, from: 'today', click: '.tb-nav a[href="#/week"]' },
  { name: 'wash-phone', W: 390, H: 844, phone: true, settings: { 'nav.transition': 'wash' }, from: 'today', click: '.tab[href="#/absences"]' },
  { name: 'reduced-motion-desktop', W: 1440, H: 900, settings: {}, from: 'today', click: '.tb-nav a[href="#/week"]', reduced: true, times: [0, 80, 160] },
  {
    name: 'reveal-webgl-glass',
    W: 1440,
    H: 900,
    settings: { 'appearance.preset': 'midnight', 'background.type': 'animated', 'glass.mode': 'refraction' },
    from: 'today',
    click: '.tb-nav a[href="#/plan"]',
    glassCheck: true,
  },
];

const read = (buf) => PNG.sync.read(buf);
function regionDiff(a, b, x0, y0, x1, y1) {
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 4;
      sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      n++;
    }
  return sum / n / 3;
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = [];
  for (const sc of scenarios) {
    const ctx = await browser.newContext({ viewport: { width: sc.W, height: sc.H }, deviceScaleFactor: 1, hasTouch: !!sc.phone, isMobile: !!sc.phone, reducedMotion: sc.reduced ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(([v, p, noVT]) => {
      localStorage.setItem('study-dashboard:settings:v1', v);
      localStorage.setItem('study-dashboard:v1', p);
      if (noVT) delete Document.prototype.startViewTransition;
    }, [JSON.stringify({ version: 1, values: { ...sim, ...sc.settings } }), seed, !!sc.noVT]);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    if (sc.phone) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }).catch(() => {});
    }
    await page.goto(`${BASE}/#/${sc.from}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    // Let every page chunk load first (the app preloads them when idle).
    await page.waitForFunction(() => performance.getEntriesByType('resource').filter((r) => /Page-/.test(r.name)).length >= 6, null, { timeout: 15000 }).catch(() => {});
    const box = await page.locator(sc.click).first().boundingBox();
    const press = { x: Math.round(box.x + box.width * 0.3), y: Math.round(box.y + box.height * 0.6) };
    const before = await page.screenshot();

    // Click, then catch the animation as soon as it exists and pause it.
    await page.evaluate(() => {
      window.__caught = null;
      const tick = () => {
        const anims = document.getAnimations().filter((a) => a.effect && (a.effect.pseudoElement || a.effect.target?.classList?.contains('vt-disc') || a.effect.target?.classList?.contains('vt-veil')));
        if (anims.length) {
          anims.forEach((a) => a.pause());
          window.__caught = anims.map((a) => ({ pseudo: a.effect.pseudoElement || a.effect.target.className, duration: a.effect.getTiming().duration }));
        } else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (sc.phone) await page.touchscreen.tap(press.x, press.y);
    else await page.mouse.click(press.x, press.y);
    await page.waitForFunction(() => window.__caught, null, { timeout: 10000 });
    const caught = await page.evaluate(() => window.__caught);
    const origin = await page.evaluate(() => ({ vt: document.documentElement.dataset.vt || null, x: document.documentElement.style.getPropertyValue('--vt-x'), y: document.documentElement.style.getPropertyValue('--vt-y') }));
    // Crosshair at the press point (drawn on top of everything, ignored by the page).
    await page.evaluate(({ x, y }) => {
      const m = document.createElement('div');
      m.id = '__press';
      m.style.cssText = `position:fixed;left:${x - 9}px;top:${y - 9}px;width:18px;height:18px;z-index:2147483647;pointer-events:none;border:2px solid #ff2d55;border-radius:50%;box-shadow:0 0 0 1px #000`;
      document.documentElement.appendChild(m);
    }, press);

    const times = sc.times || TIMES;
    const frames = [];
    for (const t of times) {
      await page.evaluate(async (t) => {
        // Overlay fallbacks have two phases (cover 55 %, fade 45 %); View Transitions have one.
        const all = () => document.getAnimations().filter((a) => a.effect && (a.effect.pseudoElement || a.effect.target?.classList?.contains('vt-disc') || a.effect.target?.classList?.contains('vt-veil')));
        let anims = all();
        const total = window.__total ?? (window.__total = Math.max(...anims.map((a) => a.effect.getTiming().duration)) / 0.55);
        const overlay = anims.some((a) => !a.effect.pseudoElement);
        if (overlay && t > total * 0.55) {
          const first = (a) => a.effect.getKeyframes()[0]
          const cover = anims.find((a) => first(a).transform !== undefined || parseFloat(first(a).opacity) === 0);
          if (cover && cover.playState !== 'finished') {
            cover.finish();
            await new Promise((r) => setTimeout(r, 60));
          }
          anims = all().filter((a) => parseFloat(first(a).opacity) === 1 && first(a).transform === undefined);
          anims.forEach((a) => {
            a.pause();
            a.currentTime = Math.min(a.effect.getTiming().duration, t - total * 0.55);
          });
        } else
          anims.forEach((a) => {
            a.pause();
            a.currentTime = Math.min(a.effect.getTiming().duration, t);
          });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, t);
      const buf = await page.screenshot();
      fs.writeFileSync(path.join(OUT, `${sc.name}-${String(t).padStart(4, '0')}ms.png`), buf);
      frames.push(buf);
    }
    let note = '';
    if (sc.glassCheck) {
      // Header glass: compare the header strip mid-transition with the settled page afterwards.
      await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      await page.waitForTimeout(2500);
      await page.evaluate(() => document.getElementById('__press')?.remove());
      const after = await page.screenshot();
      const A = read(before), M = read(frames[2]), Z = read(after);
      const hdr = [40, 22, sc.W - 40, 70];
      note = `  header strip mean |Δ| before→250ms ${regionDiff(A, M, ...hdr).toFixed(1)}, 250ms→after ${regionDiff(M, Z, ...hdr).toFixed(1)} (0–255)`;
    }
    const line = `${sc.name.padEnd(26)} press (${press.x},${press.y})  vt=${origin.vt ?? 'none'} origin=${origin.x || '-'},${origin.y || '-'}  animations: ${caught.map((c) => `${c.pseudo}:${Math.round(c.duration)}ms`).join(' ')}  console:${errs.length ? 'ERR ' + errs[0].slice(0, 60) : 'clean'}${note}`;
    console.log(line);
    report.push(line);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n') + '\n');
  await browser.close();
})();
