// Screenshots + pixel contrast for presets × pages × widths, and glass modes.
// Needs a running server (npm run build && npm run preview -- --port 5173) and, once:
//   npm i --no-save playwright pngjs && npx playwright install chromium
// "all" = 5 presets × 7 pages × 1440/390 px + 4 glass modes × 2 widths (78 shots, slow on software WebGL).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
// Usage: node tools/verify/matrix.cjs <out-dir> [all | presets | glass | only <preset:page:width[:sheet]> ...]
// Phone widths (≤ 640) use a touch viewport with emulated safe-area insets; ":sheet" opens "More" first.
const OUT = path.resolve(process.argv[2] || 'verify-out/matrix');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const sim = { 'sim.enabled': true, 'sim.date': '2026-11-18', 'sim.time': '14:40' };
const clear = { 'appearance.accent': null, 'appearance.background': null, 'background.color1': null, 'background.color2': null, 'background.color3': null };
const presets = {
  'mono-noir': { ...clear, 'appearance.preset': 'mono-noir', 'appearance.colorMode': 'dark', 'appearance.radius': 0, 'background.type': 'dither', 'glass.mode': 'refraction', 'glass.tint': 70, 'hud.grid': true, 'hud.orbStyle': 'dotted' },
  midnight: { ...clear, 'appearance.preset': 'midnight', 'appearance.colorMode': 'dark', 'appearance.radius': 14, 'background.type': 'animated', 'glass.mode': 'refraction', 'glass.tint': 60, 'hud.grid': false, 'hud.orbStyle': 'liquid' },
  light: { ...clear, 'appearance.preset': 'light', 'appearance.colorMode': 'light', 'appearance.radius': 0, 'background.type': 'dots', 'glass.mode': 'blur', 'glass.tint': 75, 'hud.grid': true, 'hud.orbStyle': 'dotted' },
  graphite: { ...clear, 'appearance.preset': 'graphite', 'appearance.colorMode': 'dark', 'appearance.radius': 6, 'background.type': 'dots', 'glass.mode': 'blur', 'glass.tint': 70, 'hud.grid': true, 'hud.orbStyle': 'dotted' },
  'high-contrast': { ...clear, 'appearance.preset': 'high-contrast', 'appearance.colorMode': 'dark', 'appearance.radius': 0, 'background.type': 'solid', 'glass.mode': 'off', 'hud.grid': false, 'hud.orbStyle': 'dotted' },
};
const pages = ['today', 'week', 'plan', 'resources', 'absences', 'check', 'settings'];
const sizes = [[1440, 900], [390, 844]];
const seed = fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8');
const mode = process.argv[3] || 'all';

const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) };

async function measure(page, W, H) {
  const fails = [];
  let checked = 0;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += Math.round(H * 0.8)) {
    await page.evaluate(y => window.scrollTo(0, y), y);
    await page.waitForTimeout(250);
    const items = await page.evaluate(() => {
      const parse = (raw) => {
        let m = raw.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
        if (raw.startsWith('color(')) m = [m[0] * 255, m[1] * 255, m[2] * 255, m[3] ?? 1];
        return m;
      };
      const out = [];
      // Only text inside the frame window: content under the "desk" mats and frame lines is hidden by design.
      // The window is read from the frame element (its insets are calc() expressions with safe areas).
      const fr = document.querySelector('.hud-frame')?.getBoundingClientRect();
      const inFrame = document.documentElement.dataset.frame === 'on' && fr && fr.width > 0;
      const win = inFrame ? { t: fr.top, l: fr.left, r: fr.right, b: fr.bottom } : null;
      const caption = document.querySelector('.hud-caption');
      const floor = Math.min(...[caption, document.querySelector('.tabbar')].filter(Boolean).map((e) => e.getBoundingClientRect().top).filter((v) => v > 0), innerHeight);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.textContent.trim();
        const el = n.parentElement;
        if (!t || !el || el.closest('.sr-only, script, style, option, .scrim')) continue;
        if (el.closest('button:disabled, [aria-hidden="true"] svg')) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        const b = r.getBoundingClientRect();
        if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue;
        // HUD chrome outside the frame window is measured too: caption, FPS, tab bar, "More" sheet.
        const isHud = (caption && caption.contains(el)) || el.closest('.fps, .tabbar, .sheet');
        if (!isHud && inFrame && (b.top < win.t + 6 || b.bottom > win.b - 6 || b.left < win.l + 6 || b.right > win.r - 6)) continue;
        if (!isHud && !inFrame && b.bottom > floor) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        // Visible only if the top, middle and bottom of the text are all this element (not under the sticky header).
        const visibleAt = (x, y) => {
          const t = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, x)), Math.min(innerHeight - 1, Math.max(0, y)));
          return !!t && (t === el || el.contains(t) || t.contains(el));
        };
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        if (!visibleAt(cx, b.top + 1) || !visibleAt(cx, cy) || !visibleAt(cx, b.bottom - 1)) continue;
        // Partly covered at either end (e.g. by a floating button): not measurable at this scroll position.
        if (!visibleAt(b.left + 1, cy) || !visibleAt(b.right - 1, cy)) continue;
        let c = parse(el.closest('svg') ? cs.fill : cs.color);
        if ((c[3] ?? 1) === 0 && cs.webkitTextStrokeWidth && parseFloat(cs.webkitTextStrokeWidth) > 0) c = parse(cs.webkitTextStrokeColor);
        out.push({ t: t.slice(0, 36), x: b.left, y: b.top, w: b.width, h: b.height, c, fs: parseFloat(cs.fontSize), fw: +cs.fontWeight });
      }
      return out;
    });
    const style = await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}text{fill:transparent!important}input::placeholder{color:transparent!important}' });
    await page.waitForTimeout(120);
    const png = PNG.sync.read(await page.screenshot({ timeout: 120000 }));
    await style.evaluate(s => s.remove());
    for (const it of items) {
      const px = [];
      // Skip the outer 2 px of the line box: glyphs never reach it, but a neighbouring sticky bar's edge can.
      for (let yy = Math.max(0, Math.ceil(it.y) + 2); yy < Math.min(H, Math.floor(it.y + it.h) - 2); yy++)
        for (let xx = Math.max(0, Math.ceil(it.x) + 1); xx < Math.min(W, Math.floor(it.x + it.w) - 1); xx++) {
          const i = (yy * W + xx) * 4; px.push([png.data[i], png.data[i + 1], png.data[i + 2]]);
        }
      if (!px.length) continue;
      checked++;
      const tl = lum(it.c.slice(0, 3));
      px.sort((a, b) => Math.abs(lum(a) - tl) - Math.abs(lum(b) - tl));
      const bg = px[Math.floor(px.length * 0.05)];
      const a = it.c[3] ?? 1;
      const fg = it.c.slice(0, 3).map((c, k) => c * a + bg[k] * (1 - a));
      const cr = ratio(fg, bg);
      const large = it.fs >= 24 || (it.fs >= 18.66 && it.fw >= 700);
      const need = large ? 3 : 4.5;
      if (cr < need) fails.push({ y, text: it.t, ratio: +cr.toFixed(2), need, fg: fg.map(Math.round), bg });
    }
  }
  return { checked, fails };
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = [];
  const run = async (tag, settings, pageId, [W, H], doContrast, sheet = false) => {
    const phone = W <= 640;
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
    await ctx.addInitScript(([s, p]) => {
      localStorage.setItem('study-dashboard:settings:v1', s);
      localStorage.setItem('study-dashboard:v1', p);
      window.__errs = [];
      window.addEventListener('error', (e) => window.__errs.push(String(e.message)));
    }, [JSON.stringify({ version: 1, values: { ...settings, ...sim } }), seed]);
    const page = await ctx.newPage();
    // Phones: emulate a notch and home indicator (env(safe-area-inset-*)).
    if (phone) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }).catch(() => {});
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto(`${BASE}/#/${pageId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    if (sheet) {
      await page.tap('.tab-more');
      await page.waitForSelector('#more-sheet');
      await page.waitForTimeout(600);
    }
    // Hold the 3D still (the app pauses its render loops when the tab is hidden); the last frame stays on screen.
    // Software WebGL can't render the animated gradient under many blurred cards fast enough to screenshot.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${tag}-${pageId}-${W}${sheet ? '-sheet' : ''}.png`, timeout: 120000 }).catch((e) => errs.push('SCREENSHOT ' + e.message.split('\n')[0]));
    let line = '';
    try {
    if (doContrast) {
      const { checked, fails } = await measure(page, W, H);
      line += `  text checked:${checked}  below AA:${fails.length}`;
      for (const f of fails.slice(0, 4)) line += `\n      ${f.ratio}<${f.need} "${f.text}" fg${JSON.stringify(f.fg)} bg${JSON.stringify(f.bg)} @y${f.y}`;
    }
    } catch (e) { line += `  MEASURE-ERROR ${String(e.message).split('\n')[0]}`; }
    errs.push(...(await page.evaluate(() => window.__errs).catch(() => [])));
    line = `${tag.padEnd(22)} ${(pageId + (sheet ? '+sheet' : '')).padEnd(16)} ${W}  console:${errs.length ? 'ERR ' + errs[0].slice(0, 70) : 'clean'}` + line;
    report.push(line);
    console.log(line);
    await ctx.close();
  };
  if (mode === 'only') {
    for (const spec of process.argv.slice(4)) {
      const [tag, pg, w, extra] = spec.split(':');
      const settings = tag.startsWith('glass-') ? { ...presets['mono-noir'], 'glass.mode': tag.slice(6) } : presets[tag] ?? { ...presets['mono-noir'], ...(tag === 'graphite' ? { ...clear, 'appearance.preset': 'graphite', 'appearance.colorMode': 'dark', 'appearance.radius': 6, 'background.type': 'dots', 'glass.mode': 'blur', 'glass.tint': 70 } : {}) };
      await run(tag, settings, pg, sizes.find(([sw]) => String(sw) === w), true, extra === 'sheet');
    }
  }
  if (mode === 'all' || mode === 'presets')
    for (const [name, s] of Object.entries(presets))
      for (const size of sizes)
        for (const p of pages) await run(name, s, p, size, true);
  if (mode === 'all' || mode === 'glass')
    for (const g of ['off', 'blur', 'refraction', 'liquid'])
      for (const size of sizes) await run(`glass-${g}`, { ...presets['mono-noir'], 'glass.mode': g }, 'today', size, true);
  fs.writeFileSync(`${OUT}/report-${mode}.txt`, report.join('\n'));
  await browser.close();
})();
