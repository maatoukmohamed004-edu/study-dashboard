// End-to-end checks for <LiquidMetalSurface>: budget, fallbacks, pausing, persistence, a11y.
//   node tools/verify/metal-e2e.cjs
// Needs a running server (npm run build && npm run preview -- --port 5173) and playwright + pngjs (see matrix.cjs).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const seed = fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8');
const sim = { 'sim.enabled': true, 'sim.date': '2026-11-18', 'sim.time': '14:40' };
const ALL = { 'metal.applyTo': ['tab', 'primary', 'floating'] };
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
const errors = [];

const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) };

async function open(browser, { phone = true, settings = {}, reduced = false, dpr = 1, noWebgl2 = false, hash = 'today' } = {}) {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: dpr,
    hasTouch: phone,
    isMobile: phone,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await ctx.addInitScript(([v, p, block]) => {
    localStorage.setItem('study-dashboard:settings:v1', v);
    localStorage.setItem('study-dashboard:v1', p);
    if (block) {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        // No WebGL at all (three.js needs WebGL 2 too, so a WebGL-2-less browser runs the app's no-3D paths).
        return /webgl/.test(type) ? null : get.call(this, type, ...rest);
      };
    }
  }, [JSON.stringify({ version: 2, values: { ...sim, ...settings } }), seed, noWebgl2]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

const surfaces = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.lm')].map((l) => {
      const c = l.querySelector('canvas');
      const rim = l.querySelector('.lm-rim');
      const r = rim.getBoundingClientRect();
      return {
        host: l.parentElement.className.split(' ')[0],
        state: l.dataset.state,
        canvas: c ? { w: c.width, h: c.height } : null,
        css: { w: r.width, h: r.height },
        rimBg: getComputedStyle(rim).backgroundImage.slice(0, 15),
      };
    }),
  );
const frameOf = (page, sel) => page.evaluate((s) => document.querySelector(s)?.querySelector('.lm-rim')?.paperShaderMount?.getCurrentFrame() ?? null, sel);
const speedOf = (page, sel) => page.evaluate((s) => { const v = document.querySelector(s)?.querySelector('.lm')?.dataset.speed; return v === undefined ? null : Number(v) }, sel);

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  // ── Phone defaults: one live canvas on the tab pill ──────────────────────
  let { ctx, page } = await open(browser, { dpr: 3 });
  let s = await surfaces(page);
  ok('Default: metal on the selected-tab pill only', s.length === 1 && s[0].host === 'tab-pill-shape', JSON.stringify(s.map((x) => x.host)));
  ok('The tab pill runs the shader', s[0]?.state === 'live' && !!s[0].canvas, s[0]?.state);
  ok('Canvas resolution capped at 1.5× on a 3× phone', s[0]?.canvas && s[0].canvas.w <= Math.ceil(s[0].css.w * 1.5) + 1, `${s[0]?.canvas?.w}px for ${s[0]?.css.w} CSS px`);
  const head = await page.evaluate(() => ({ inHead: document.head.querySelectorAll('style').length, marker: document.querySelectorAll('style[data-paper-shader]').length, markerEmpty: document.querySelector('style[data-paper-shader]')?.textContent.trim() === '', markerInBody: document.querySelector('style[data-paper-shader]')?.parentElement === document.body }));
  ok('No style injected into <head> (only the empty marker in <body>)', head.inHead === 0 && head.marker === 1 && head.markerEmpty && head.markerInBody, JSON.stringify(head));
  const chunk = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /metalEngine/.test(n)).length);
  ok('The shader loads as its own lazy chunk', chunk === 1);
  // One instance, never re-mounted: the same canvas node after page changes.
  await page.evaluate(() => (window.__pillCanvas = document.querySelector('.tab-pill canvas')));
  const f0 = await frameOf(page, '.tab-pill');
  await page.tap('.tab[href="#/week"]');
  await page.waitForTimeout(90);
  const fa = await frameOf(page, '.tab-pill');
  await page.waitForTimeout(250);
  const fb = await frameOf(page, '.tab-pill');
  ok('Paused during the page transition', fa !== null && fa === fb, `${fa} → ${fb}`);
  await page.waitForTimeout(1200);
  const fc = await frameOf(page, '.tab-pill');
  ok('Runs again after the transition', fc > fb, `${fb} → ${fc} (start ${f0})`);
  await page.tap('.tab[href="#/plan"]');
  await page.waitForTimeout(1400);
  ok('The pill keeps the same canvas across page changes (never re-mounted)', await page.evaluate(() => document.querySelector('.tab-pill canvas') === window.__pillCanvas && !!window.__pillCanvas));
  // Label contrast on rendered pixels, over several frames (the brightest rim frame included).
  let worst = Infinity;
  const box = await page.evaluate(() => {
    const l = document.querySelector('.tab[aria-current="page"] .tab-label').getBoundingClientRect();
    return { x: Math.floor(l.x), y: Math.floor(l.y), w: Math.ceil(l.width), h: Math.ceil(l.height), color: getComputedStyle(document.querySelector('.tab[aria-current="page"]')).color };
  });
  const fg = box.color.match(/[\d.]+/g).slice(0, 3).map(Number);
  for (let i = 0; i < 6; i++) {
    const style = await page.addStyleTag({ content: '.tab-label{color:transparent!important}' });
    const png = PNG.sync.read(await page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } }));
    await style.evaluate((n) => n.remove());
    const px = [];
    for (let k = 0; k < png.data.length; k += 4) px.push([png.data[k], png.data[k + 1], png.data[k + 2]]);
    px.sort((a, b) => lum(b) - lum(a));
    worst = Math.min(worst, ratio(fg, px[Math.floor(px.length * 0.02)]));
    await page.waitForTimeout(400);
  }
  ok('Current-tab label on the metal pill ≥ 4.5:1 at its brightest pixels, 6 frames', worst >= 4.5, worst.toFixed(2));
  await ctx.close();

  // ── Budget: every target on ─────────────────────────────────────────────
  ({ ctx, page } = await open(browser, { settings: ALL }));
  s = await surfaces(page);
  ok('Phone budget: 1 live canvas, the rest show the CSS rim', s.filter((x) => x.canvas).length === 1 && s.find((x) => x.canvas)?.host === 'tab-pill-shape' && s.filter((x) => !x.canvas).every((x) => x.state === 'css'), JSON.stringify(s.map((x) => `${x.host}:${x.state}`)));
  ok('Never an empty control: every rim paints a metallic gradient', s.every((x) => x.rimBg.startsWith('conic-gradient') && x.css.w > 0 && x.css.h > 0));
  await ctx.close();
  ({ ctx, page } = await open(browser, { phone: false, settings: ALL }));
  s = await surfaces(page);
  ok('Desktop budget: at most 2 live canvases', s.filter((x) => x.canvas).length === 2, JSON.stringify(s.map((x) => `${x.host}:${x.state}`)));
  // Hover, press and the stale-closure fix: after a press the speed returns to the *current* state.
  await ctx.close();
  // Primary buttons only, so a Start button keeps a canvas (floating buttons outrank it).
  ({ ctx, page } = await open(browser, { phone: false, settings: { 'metal.applyTo': ['primary'] } }));
  // Pointer events on the live button itself (a real click on Start would start the block).
  const btn = '.btn-start:has(.lm[data-state="live"])';
  await page.waitForSelector(btn);
  await page.locator(btn).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const fire = (type) => page.evaluate(([s, t]) => document.querySelector(s).dispatchEvent(new PointerEvent(t, { bubbles: t !== 'pointerenter' && t !== 'pointerleave', pointerType: 'touch' })), [btn, type]);
  const idle = await speedOf(page, btn);
  await fire('pointerenter');
  const hover = await speedOf(page, btn);
  await fire('pointerdown');
  const pressed = await speedOf(page, btn);
  await fire('pointerleave'); // leave during the boost
  await page.waitForTimeout(500);
  const after = await speedOf(page, btn);
  ok('Hover speeds up, a press boosts, and leaving mid-boost settles back to idle', idle === 0.6 && hover === 1 && pressed >= 2.4 && after === 0.6, JSON.stringify({ idle, hover, pressed, after }));
  // Keyboard: a real <button>, visible focus ring, Enter works.
  const focus = await page.evaluate(() => {
    const b = document.querySelector('.btn-start');
    b.focus();
    const cs = getComputedStyle(b);
    return { tag: b.tagName, outline: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { cls: document.activeElement.className, outline: cs.outlineStyle, width: parseFloat(cs.outlineWidth) } });
  ok('Metal buttons are real <button>s with a visible keyboard focus ring', focus.tag === 'BUTTON' && ring.outline === 'solid' && ring.width >= 2, JSON.stringify(ring));
  await ctx.close();

  // ── Fallbacks ───────────────────────────────────────────────────────────
  ({ ctx, page } = await open(browser, { reduced: true }));
  s = await surfaces(page);
  const r1 = await frameOf(page, '.tab-pill');
  await page.waitForTimeout(600);
  const r2 = await frameOf(page, '.tab-pill');
  ok('Reduced motion: one still shader frame', s[0]?.state === 'still' && r1 === r2 && r1 !== null, `${s[0]?.state} ${r1}=${r2}`);
  await ctx.close();
  ({ ctx, page } = await open(browser, { settings: { 'metal.static': true } }));
  s = await surfaces(page);
  ok('Static setting: still frame', s[0]?.state === 'still');
  await ctx.close();
  ({ ctx, page } = await open(browser, { settings: { 'background.quality': 'low' } }));
  s = await surfaces(page);
  ok('Background quality Low: CSS rim, no canvas', s[0]?.state === 'css' && !s[0].canvas);
  await ctx.close();
  ({ ctx, page } = await open(browser, { noWebgl2: true, hash: 'settings/appearance' }));
  s = await surfaces(page);
  const ui = await page.evaluate(() => ({
    note: [...document.querySelectorAll('.inline-note')].map((n) => n.textContent).find((t) => /metallic rim/.test(t)) ?? '',
    inert: ['metal.speed', 'metal.hoverSpeed', 'metal.static'].map((k) => document.querySelector(`[data-key="${k}"] .setting-control`)?.inert),
    tintOn: document.querySelector('[data-key="metal.tint"] .setting-control')?.inert === false,
  }));
  ok('Without WebGL 2: CSS rim, an inline note, shader settings switched off', s[0]?.state === 'css' && /WebGL 2/.test(ui.note) && ui.inert.every((x) => x === true || x === undefined) && ui.inert.some((x) => x === true) && ui.tintOn, JSON.stringify({ state: s[0]?.state, ...ui }));
  await ctx.close();
  ({ ctx, page } = await open(browser, { settings: { 'metal.enabled': false } }));
  ok('Liquid metal off: no surfaces, the plain highlight pill', (await surfaces(page)).length === 0 && (await page.evaluate(() => getComputedStyle(document.querySelector('.tab-pill-shape')).backgroundColor !== 'rgba(0, 0, 0, 0)')));
  await ctx.close();
  ({ ctx, page } = await open(browser, { settings: { 'nav.highlight': 'underline' } }));
  ok('Underline highlight: no metal on the tab bar', (await surfaces(page)).length === 0);
  await ctx.close();

  ok('No console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
