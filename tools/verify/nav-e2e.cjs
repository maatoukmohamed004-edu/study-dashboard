// End-to-end checks for the phone tab bar, the "More" sheet and the page-transition settings.
//   node tools/verify/nav-e2e.cjs
// Phone runs use a 390×844 touch viewport with emulated safe-area insets (top 47, bottom 34).
// Needs a running server and playwright (see matrix.cjs).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const seed = fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8');
const sim = { 'sim.enabled': true, 'sim.date': '2026-11-18', 'sim.time': '14:40' };
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
const errors = [];

async function open(browser, { phone = true, settings = {}, raw = null, reduced = false, hash = 'today' } = {}) {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: phone,
    isMobile: phone,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await ctx.addInitScript(([v, p]) => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.setItem('study-dashboard:settings:v1', v);
      localStorage.setItem('study-dashboard:v1', p);
      sessionStorage.setItem('__seeded', '1');
    }
  }, [raw ?? JSON.stringify({ version: 1, values: { ...sim, ...settings } }), seed]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  if (phone) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }).catch(() => {});
  await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  return { ctx, page, cdp };
}

const settle = (page, ms = 1400) => page.waitForTimeout(ms);
const rect = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s)?.getBoundingClientRect();
  return r && { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, bottom: r.bottom };
}, sel);

// A quick flick: three moves, so the gesture stays well under the app's 600 ms swipe limit
// even when this machine is busy.
async function swipe(cdp, from, to) {
  const steps = 3;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  // ── Phone, defaults ─────────────────────────────────────────────────────
  let { ctx, page, cdp } = await open(browser);
  const bar = await page.evaluate(() => {
    const nav = document.querySelector('nav.tabbar');
    const items = [...document.querySelectorAll('.tabbar .tab')];
    return {
      label: nav?.getAttribute('aria-label'),
      names: items.map((a) => a.textContent.trim()),
      sizes: items.map((a) => [Math.round(a.getBoundingClientRect().width), Math.round(a.getBoundingClientRect().height)]),
      topNav: !!document.querySelector('.tb-nav'),
      padBottom: getComputedStyle(nav).paddingBottom,
      height: nav.getBoundingClientRect().height,
    };
  });
  ok('Tab bar is a labelled <nav>', bar.label === 'Pages', bar.label);
  ok('Default tabs: Today, Week, Plan, Absences + More', JSON.stringify(bar.names) === JSON.stringify(['Today', 'Week', 'Plan', 'Absences', 'More']), bar.names.join(', '));
  ok('Absences is one tap away by default', bar.names.includes('Absences'));
  ok('Every slot is at least 48×48 px', bar.sizes.every(([w, h]) => w >= 48 && h >= 48), bar.sizes.map((s) => s.join('×')).join(' '));
  ok('Top bar has no navigation on phones', !bar.topNav);
  ok('Bar is padded by the bottom safe-area inset', bar.padBottom === '34px' && Math.round(bar.height) === 64 + 34, `padding ${bar.padBottom}, height ${bar.height}`);
  const gear = await rect(page, '.tb-gear');
  ok('Top gear is a 48 px target and opens Quick settings', gear.w >= 48 && gear.h >= 48 && (await page.getAttribute('.tb-gear', 'aria-label')) === 'Quick settings', `${gear.w}×${gear.h}`);
  const active = await page.evaluate(() => {
    const a = document.querySelector('.tab[aria-current="page"]');
    return a && { name: a.textContent.trim(), mark: getComputedStyle(a.querySelector('.tab-mark')).opacity, weight: getComputedStyle(a.querySelector('.tab-label')).fontWeight };
  });
  ok('Active tab: aria-current + indicator bar + bold label', active?.name === 'Today' && active.mark === '1' && Number(active.weight) >= 700, JSON.stringify(active));

  // Nothing hides behind the bar
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await settle(page, 400);
  const layout = await page.evaluate(() => {
    const barTop = document.querySelector('.tabbar').getBoundingClientRect().top;
    const main = document.getElementById('main');
    const last = [...main.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().height > 0).reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
    const cap = document.querySelector('.hud-caption').getBoundingClientRect();
    const fab = document.querySelector('.fab-stack').getBoundingClientRect();
    return { barTop, last, capBottom: cap.bottom, fabBottom: fab.bottom, fabCount: document.querySelectorAll('.fab-stack .square-btn').length };
  });
  ok('Page content ends above the bar', layout.last <= layout.barTop, `last ${Math.round(layout.last)} ≤ bar ${Math.round(layout.barTop)}`);
  ok('Caption sits above the bar', layout.capBottom <= layout.barTop + 0.5, `${Math.round(layout.capBottom)} ≤ ${Math.round(layout.barTop)}`);
  ok('Floating button sits above the bar (Quick settings button moved to the top gear)', layout.fabBottom <= layout.barTop && layout.fabCount === 1, `${Math.round(layout.fabBottom)} ≤ ${Math.round(layout.barTop)}, buttons ${layout.fabCount}`);

  // Tab tap → navigation, focus and announcement
  await page.evaluate(() => window.scrollTo(0, 500));
  await settle(page, 300);
  await page.tap('.tab[href="#/week"]');
  await settle(page);
  const nav1 = await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement?.tagName, text: document.activeElement?.textContent, live: document.getElementById('route-announcer').textContent, y: scrollY }));
  ok('Tapping a tab changes page', nav1.hash === '#/week', nav1.hash);
  ok('Focus moves to the page heading', nav1.focus === 'H1', `${nav1.focus} "${nav1.text}"`);
  ok('Page change is announced in a live region', nav1.live === 'Week page', nav1.live);
  ok('New page starts at the top', nav1.y === 0, `scrollY ${nav1.y}`);

  // Re-tap scrolls to top
  await page.evaluate(() => window.scrollTo(0, 700));
  await settle(page, 300);
  await page.tap('.tab[href="#/week"]');
  await settle(page, 1200);
  ok('Re-tapping the active tab scrolls to the top', (await page.evaluate(() => scrollY)) === 0 && (await page.evaluate(() => location.hash)) === '#/week');

  // Back restores scroll
  await page.evaluate(() => window.scrollTo(0, 640));
  await settle(page, 300);
  await page.tap('.tab[href="#/plan"]');
  await settle(page);
  await page.goBack();
  await settle(page);
  ok('Back restores the scroll position', (await page.evaluate(() => location.hash)) === '#/week' && (await page.evaluate(() => scrollY)) === 640, `scrollY ${await page.evaluate(() => scrollY)}`);

  // More sheet
  await page.tap('.tab-more');
  await page.waitForSelector('#more-sheet');
  await settle(page, 500);
  const sheet = await page.evaluate(() => {
    const d = document.getElementById('more-sheet');
    return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), labelled: !!document.getElementById(d.getAttribute('aria-labelledby')), links: [...d.querySelectorAll('.sheet-link')].map((a) => a.textContent.trim()), focus: document.activeElement?.textContent?.trim(), expanded: document.querySelector('.tab-more').getAttribute('aria-expanded') };
  });
  ok('More opens a labelled modal dialog', sheet.role === 'dialog' && sheet.modal === 'true' && sheet.labelled && sheet.expanded === 'true');
  ok('Sheet lists Resources, Sunday check, Settings', JSON.stringify(sheet.links) === JSON.stringify(['Resources', 'Sunday check', 'Settings']), sheet.links.join(', '));
  ok('Focus starts on the first page in the sheet', sheet.focus === 'Resources', sheet.focus);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('#more-sheet a, #more-sheet button')].map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height)));
  ok('Sheet targets are at least 48 px', sizes.every((s) => s >= 48), sizes.map(Math.round).join(' '));
  const trapped = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    trapped.push(await page.evaluate(() => !!document.activeElement?.closest('#more-sheet')));
  }
  await page.keyboard.press('Shift+Tab');
  trapped.push(await page.evaluate(() => !!document.activeElement?.closest('#more-sheet')));
  ok('Focus is trapped in the sheet (Tab and Shift+Tab)', trapped.every(Boolean));
  await page.keyboard.press('Escape');
  await settle(page, 400);
  ok('Esc closes the sheet and focus returns to More', (await page.$('#more-sheet')) === null && (await page.evaluate(() => document.activeElement?.classList.contains('tab-more'))));

  await page.tap('.tab-more');
  await page.waitForSelector('#more-sheet');
  await settle(page, 400);
  await page.touchscreen.tap(195, 200);
  await settle(page, 400);
  ok('Tapping the backdrop closes the sheet, focus returns to More', (await page.$('#more-sheet')) === null && (await page.evaluate(() => document.activeElement?.classList.contains('tab-more'))));

  await page.tap('.tab-more');
  await page.waitForSelector('#more-sheet');
  await settle(page, 500);
  const handle = await rect(page, '.sheet-handle');
  await page.mouse.move(195, handle.y + 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(195, handle.y + 2 + i * 18);
  await page.mouse.up();
  await settle(page, 700);
  ok('Swiping the sheet down closes it, focus returns to More', (await page.$('#more-sheet')) === null && (await page.evaluate(() => document.activeElement?.classList.contains('tab-more'))));

  await page.tap('.tab-more');
  await page.waitForSelector('#more-sheet');
  await settle(page, 400);
  await page.tap('#more-sheet a[href="#/resources"]');
  await settle(page);
  const viaMore = await page.evaluate(() => ({ hash: location.hash, sheet: !!document.getElementById('more-sheet'), active: document.querySelector('.tab-more').dataset.active, sr: document.querySelector('.tab-more .sr-only')?.textContent, focus: document.activeElement?.tagName }));
  ok('Choosing a page in the sheet navigates and closes it', viaMore.hash === '#/resources' && !viaMore.sheet && viaMore.focus === 'H1', JSON.stringify(viaMore));
  ok('More shows the active state for a page inside it', viaMore.active === 'true' && /Resources/.test(viaMore.sr ?? ''), viaMore.sr);

  // Keyboard: focusing a text field hides the bar
  await page.tap('.tab[href="#/absences"]');
  await settle(page);
  const field = await page.$('#main input[type="number"], #main input[type="text"], #main textarea');
  if (field) {
    await field.scrollIntoViewIfNeeded();
    await field.focus();
    await settle(page, 300);
    const kb = await page.evaluate(() => ({ kb: document.documentElement.dataset.kb, bar: getComputedStyle(document.querySelector('.tabbar')).display, cap: getComputedStyle(document.querySelector('.hud-caption')).display }));
    const fr = await field.boundingBox();
    ok('With a text field focused, the bar and caption hide', kb.kb === 'open' && kb.bar === 'none' && kb.cap === 'none', JSON.stringify(kb));
    ok('The focused field is not covered', fr.y + fr.height <= 844);
    await page.evaluate(() => document.activeElement.blur());
    await settle(page, 300);
    ok('Leaving the field brings the bar back', (await page.evaluate(() => getComputedStyle(document.querySelector('.tabbar')).display)) === 'block');
  } else ok('Absences page has a text field to test the keyboard rule', false);

  // Swipe: off by default
  await page.tap('.tab[href="#/today"]');
  await settle(page);
  await swipe(cdp, { x: 320, y: 420 }, { x: 60, y: 430 });
  await settle(page);
  ok('Swipe does nothing while the setting is off (default)', (await page.evaluate(() => location.hash)) === '#/today');
  await ctx.close();

  // ── Phone, swipe on ─────────────────────────────────────────────────────
  ({ ctx, page, cdp } = await open(browser, { settings: { 'nav.swipe': true } }));
  await swipe(cdp, { x: 320, y: 420 }, { x: 60, y: 430 });
  await settle(page);
  ok('Swipe left moves to the next tab', (await page.evaluate(() => location.hash)) === '#/week', await page.evaluate(() => location.hash));
  await swipe(cdp, { x: 60, y: 420 }, { x: 330, y: 430 });
  await settle(page);
  ok('Swipe right moves back', (await page.evaluate(() => location.hash)) === '#/today', await page.evaluate(() => location.hash));
  // A horizontally scrollable area swallows the swipe (the real one on phones is the Plan table, if any;
  // otherwise a test scroller is added).
  const scroller = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#main *')].find((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 1);
    if (el) return { real: true, ...el.getBoundingClientRect().toJSON() };
    const d = document.createElement('div');
    d.id = '__scroller';
    d.style.cssText = 'position:fixed;left:20px;top:300px;width:350px;height:120px;overflow-x:auto;z-index:39';
    d.innerHTML = '<div style="width:1200px;height:100px;background:repeating-linear-gradient(90deg,#333 0 40px,#555 40px 80px)"></div>';
    document.body.appendChild(d);
    return { real: false, ...d.getBoundingClientRect().toJSON() };
  });
  await swipe(cdp, { x: scroller.x + scroller.width - 20, y: scroller.y + 40 }, { x: scroller.x + 20, y: scroller.y + 45 });
  await settle(page);
  ok(`Swipe inside a sideways-scrolling area is ignored (${scroller.real ? 'page scroller' : 'test scroller'})`, (await page.evaluate(() => location.hash)) === '#/today');
  await ctx.close();

  // ── Phone, other settings ───────────────────────────────────────────────
  ({ ctx, page } = await open(browser, { settings: { 'nav.bottomBar': false } }));
  ok('Tab bar off: the scrolling top navigation comes back', !(await page.$('.tabbar')) && !!(await page.$('.tb-nav')) && (await page.getAttribute('.tb-gear', 'href')) === '#/settings');
  await ctx.close();

  ({ ctx, page } = await open(browser, { settings: { 'nav.labels': false } }));
  const lab = await page.evaluate(() => {
    const a = document.querySelector('.tab[href="#/week"]');
    const l = a.querySelector('.tab-label').getBoundingClientRect();
    return { w: l.width, name: a.textContent.trim(), h: a.getBoundingClientRect().height };
  });
  ok('Labels off: labels are visually hidden, accessible names stay', lab.w <= 1 && lab.name === 'Week' && lab.h >= 48, JSON.stringify(lab));
  await ctx.close();

  ({ ctx, page } = await open(browser, { settings: { 'nav.tabs': ['today', 'resources', 'check', 'settings'] } }));
  const custom = await page.evaluate(() => [...document.querySelectorAll('.tabbar .tab')].map((a) => a.textContent.trim()));
  ok('Custom tabs are used in order', JSON.stringify(custom) === JSON.stringify(['Today', 'Resources', 'Sunday', 'Settings', 'More']), custom.join(', '));
  await ctx.close();

  for (const bad of [['today', 'today', 'week', 'plan'], ['today', 'week'], ['today', 'week', 'plan', 'nope'], 'today']) {
    ({ ctx, page } = await open(browser, { settings: { 'nav.tabs': bad } }));
    const t = await page.evaluate(() => [...document.querySelectorAll('.tabbar .tab')].map((a) => a.textContent.trim()).slice(0, 4));
    ok(`Invalid stored tabs ${JSON.stringify(bad)} fall back to the default`, JSON.stringify(t) === JSON.stringify(['Today', 'Week', 'Plan', 'Absences']), t.join(', '));
    await ctx.close();
  }

  // Old settings file without the navigation keys: defaults, nothing else lost.
  ({ ctx, page } = await open(browser, { raw: JSON.stringify({ version: 1, values: { ...sim, 'appearance.preset': 'light', 'appearance.colorMode': 'light' } }) }));
  const old = await page.evaluate(() => ({ preset: document.documentElement.dataset.preset, tabbar: document.documentElement.dataset.tabbar, tabs: document.querySelectorAll('.tabbar .tab').length }));
  ok('A settings file from before this change keeps its values and gets navigation defaults', old.preset === 'light' && old.tabbar === 'on' && old.tabs === 5, JSON.stringify(old));
  await ctx.close();

  // ── Transition settings (desktop) ────────────────────────────────────────
  async function vtStyleAfterClick(settings, opts = {}) {
    const o = await open(browser, { phone: false, settings, reduced: opts.reduced });
    await o.page.evaluate(() => {
      window.__seen = null;
      new MutationObserver(() => {
        const r = document.documentElement;
        if (r.dataset.vt && !window.__seen) window.__seen = { vt: r.dataset.vt, x: r.style.getPropertyValue('--vt-x'), y: r.style.getPropertyValue('--vt-y') };
      }).observe(document.documentElement, { attributes: true });
      window.__disc = null;
      new MutationObserver(() => {
        if (document.querySelector('.vt-disc, .vt-veil') && !window.__disc) window.__disc = document.querySelector('.vt-disc') ? 'disc' : 'veil';
      }).observe(document.body, { childList: true, subtree: true });
    });
    const b = await o.page.locator('.tb-nav a[href="#/plan"]').boundingBox();
    await o.page.mouse.click(Math.round(b.x + 5), Math.round(b.y + 6));
    const durations = await o.page.evaluate(() => new Promise((res) => setTimeout(() => res(document.getAnimations().filter((a) => a.effect?.pseudoElement).map((a) => a.effect.getTiming().duration)), 400)));
    await settle(o.page, 1600);
    const r = { seen: await o.page.evaluate(() => window.__seen), disc: await o.page.evaluate(() => window.__disc), hash: await o.page.evaluate(() => location.hash), durations, click: { x: Math.round(b.x + 5), y: Math.round(b.y + 6) } };
    await o.ctx.close();
    return r;
  }
  let r = await vtStyleAfterClick({});
  ok('Default: Disc reveal from the press point', r.seen?.vt === 'reveal' && r.seen.x === `${r.click.x}px` && r.seen.y === `${r.click.y}px`, JSON.stringify(r.seen));
  ok('Default duration 650 ms', r.durations.includes(650), JSON.stringify(r.durations));
  r = await vtStyleAfterClick({ 'motion.speed': 2 });
  ok('Animation speed 2× halves the duration', r.durations.includes(325), JSON.stringify(r.durations));
  r = await vtStyleAfterClick({ 'nav.origin': 'center' });
  ok('Origin "Screen centre" starts the disc in the middle', r.seen?.x === '720px' && r.seen?.y === '450px', JSON.stringify(r.seen));
  r = await vtStyleAfterClick({ 'nav.transition': 'fade' });
  ok('Crossfade uses a View Transition crossfade', r.seen?.vt === 'fade' && r.hash === '#/plan');
  r = await vtStyleAfterClick({ 'nav.transition': 'none' });
  ok('None changes page with no transition', r.seen === null && r.disc === null && r.hash === '#/plan');
  r = await vtStyleAfterClick({ 'nav.transition': 'wash' });
  ok('Disc wash uses the overlay disc', r.seen === null && r.disc === 'disc' && r.hash === '#/plan');
  r = await vtStyleAfterClick({}, { reduced: true });
  ok('Reduced motion (OS): short crossfade, no disc', r.seen?.vt === 'fade' && r.durations.every((d) => d <= 160), JSON.stringify(r));
  r = await vtStyleAfterClick({ 'motion.mode': 'reduced' });
  ok('Reduced motion (Settings): short crossfade, no disc', r.seen?.vt === 'fade', JSON.stringify(r.seen));

  // Keyboard activation: origin is the focused link's centre
  {
    const o = await open(browser, { phone: false });
    await o.page.evaluate(() => {
      window.__seen = null;
      new MutationObserver(() => {
        const r = document.documentElement;
        if (r.dataset.vt && !window.__seen) window.__seen = { x: r.style.getPropertyValue('--vt-x'), y: r.style.getPropertyValue('--vt-y') };
      }).observe(document.documentElement, { attributes: true });
    });
    await o.page.focus('.tb-nav a[href="#/week"]');
    await o.page.waitForTimeout(800);
    const b = await o.page.locator('.tb-nav a[href="#/week"]').boundingBox();
    await o.page.keyboard.press('Enter');
    await settle(o.page);
    const seen = await o.page.evaluate(() => window.__seen);
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    ok('Keyboard activation starts the disc at the link centre', seen && Math.abs(parseFloat(seen.x) - cx) < 1 && Math.abs(parseFloat(seen.y) - cy) < 1, `${JSON.stringify(seen)} vs ${cx},${cy}`);
    ok('Skip link still focuses main after navigation', await o.page.evaluate(() => { document.querySelector('.skip-link').click(); return document.activeElement?.id === 'main'; }));
    await o.ctx.close();
  }

  // Desktop: no tab bar
  ({ ctx, page } = await open(browser, { phone: false }));
  ok('Desktop: no tab bar, top navigation unchanged', !(await page.$('.tabbar')) && (await page.$$('.tb-nav a')).length === 6);
  await ctx.close();

  ok('No console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('PASS')).length}/${results.length} passed`);
  await browser.close();
})();
