const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
// Usage: node tools/verify/settings-e2e.cjs [work-dir for downloaded/imported files]
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
(async () => {
  const S = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'sd-e2e-')));
  fs.mkdirSync(S, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE + '/#/today', { waitUntil: 'networkidle' });
  // Seed progress so we can prove it is never touched
  const progress = fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8');
  await page.evaluate(p => localStorage.setItem('study-dashboard:v1', p), progress);
  await page.goto(BASE + '/#/settings/appearance', { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.__noReload = 'still here' });
  const ds = (k) => page.evaluate(k => document.documentElement.dataset[k], k);
  const cssVar = (v) => page.evaluate(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), v);
  const toast = () => page.locator('.toast p').innerText().catch(() => '');

  // Preset
  const bg0 = await cssVar('--bg');
  await page.locator('select').first().selectOption('midnight');
  ok('Preset → Midnight applies live', (await ds('preset')) === 'midnight' && (await cssVar('--bg')) !== bg0, `--bg ${bg0} → ${await cssVar('--bg')}`);
  ok('Preset shows an undo toast', (await toast()).includes('Applied Midnight'));
  await page.getByRole('button', { name: 'Undo' }).click();
  ok('Undo restores Mono Noir', (await ds('preset')) === 'mono-noir');

  // Color mode
  await page.getByRole('radio', { name: 'Light' }).first().click();
  ok('Color mode → Light', (await ds('mode')) === 'light');
  await page.getByRole('radio', { name: 'Dark' }).first().click();

  // Accent → bad → guard → fix
  const hex = page.locator('.hex-input').first();
  await hex.fill('#3a3a3a'); await hex.press('Enter');
  ok('Accent hex applies', (await cssVar('--accent')) === '#3a3a3a');
  const summary1 = await page.locator('.guard-summary').innerText();
  ok('Contrast guard warns below AA', /below WCAG AA/.test(summary1), summary1.trim());
  await page.getByRole('button', { name: 'Fix automatically' }).click();
  const summary2 = await page.locator('.guard-summary').innerText();
  ok('Fix automatically → all pairs pass', /meet WCAG AA/.test(summary2), `accent now ${await cssVar('--accent')}`);

  // Bad hex input is rejected inline, value unchanged
  const before = await cssVar('--accent');
  await hex.fill('blue-ish'); await hex.press('Enter');
  ok('Invalid hex shows an error, keeps value', (await page.locator('.field-error').count()) > 0 && (await cssVar('--accent')) === before);
  await hex.fill(''); await hex.press('Enter');

  // Text size, density, radius, mono case, display font
  const range = page.locator('[data-key="appearance.textSize"] input[type=range]');
  await range.focus(); await page.keyboard.press('End');
  ok('Text size → 120%', (await cssVar('--text-scale')) === '1.2');
  await range.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  ok('Text size via arrow keys → 100%', (await cssVar('--text-scale')) === '1');
  await page.locator('[data-key="appearance.density"]').getByRole('radio', { name: 'Compact' }).click();
  ok('Density → compact', (await cssVar('--density')) === '0.72');
  const radius = page.locator('[data-key="appearance.radius"] input[type=range]');
  await radius.fill('12');
  ok('Corner radius → 12px', (await cssVar('--r-lg')) === '12px');
  await page.locator('[data-key="appearance.monoUppercase"]').getByRole('radio', { name: 'Off' }).click();
  ok('Uppercase mono labels off', (await ds('monoCase')) === 'none');
  await page.locator('[data-key="appearance.displayFont"]').getByRole('radio', { name: 'Antonio' }).click();
  ok('Display font → Antonio', (await cssVar('--font-display')).includes('Antonio'));

  // Reset section with undo
  await page.getByRole('button', { name: 'Reset section' }).click();
  ok('Reset section → defaults', (await cssVar('--density')) === '1' && (await ds('monoCase')) === 'upper' && (await cssVar('--r-lg')) === '0px');
  await page.getByRole('button', { name: 'Undo' }).click();
  ok('Reset section undo', (await cssVar('--density')) === '0.72');
  await page.getByRole('button', { name: 'Reset section' }).click();

  // Background
  await page.goto(BASE + '/#/settings/background');
  for (const [v, want] of [['solid', 'solid'], ['gradient', 'gradient'], ['dots', 'dots'], ['animated', 'animated'], ['dither', 'dither']]) {
    await page.locator('[data-key="background.type"] select').selectOption(v);
    await page.waitForTimeout(150);
    ok(`Background → ${v}`, (await ds('bg')) === want);
  }
  await page.locator('[data-key="background.type"] select').selectOption('animated');
  await page.waitForTimeout(2500);
  ok('Animated gradient mounts a WebGL canvas', (await page.locator('.bg-canvas canvas').count()) === 1);
  await page.locator('[data-key="background.grain"] input').fill('50');
  ok('Grain → overlay shown', (await page.locator('.bg-grain').count()) === 1);
  await page.locator('[data-key="background.type"] select').selectOption('dither');

  // Glass
  await page.goto(BASE + '/#/settings/glass');
  for (const [v, want] of [['off', 'off'], ['blur', 'blur'], ['refraction', 'svg'], ['liquid', 'liquid']]) {
    await page.locator('[data-key="glass.mode"] select').selectOption(v);
    await page.waitForTimeout(200);
    ok(`Glass → ${v} (engine ${want})`, (await ds('glass')) === want, (await page.locator('.inline-note').innerText()).replace(/\s+/g, ' ').slice(0, 90));
  }
  await page.locator('[data-key="glass.mode"] select').selectOption('refraction');
  await page.locator('[data-key="glass.applyTo"]').getByLabel('Cards').uncheck();
  ok('Glass apply-to: cards off', (await ds('glassCards')) === 'off');
  await page.locator('[data-key="glass.applyTo"]').getByLabel('Cards').check();
  const blurBefore = await cssVar('--glass-blur');
  await page.locator('[data-key="glass.blur"] input').fill('30');
  ok('Blur strength → 30px', (await cssVar('--glass-blur')) === '30px', `was ${blurBefore}`);
  await page.locator('[data-key="glass.refraction"] input').fill('40');
  const scale = await page.evaluate(() => document.querySelector('.topbar feDisplacementMap')?.getAttribute('scale'));
  ok('Refraction strength reaches the SVG filter', scale === '40', `scale=${scale}`);

  // HUD
  await page.goto(BASE + '/#/settings/hud');
  for (const k of ['frame', 'corners', 'grid', 'caption']) {
    await page.locator(`[data-key="hud.${k}"]`).getByRole('radio', { name: 'Off' }).click();
    ok(`HUD ${k} off`, (await ds(k)) === 'off');
    await page.locator(`[data-key="hud.${k}"]`).getByRole('radio', { name: 'On' }).click();
  }
  await page.locator('[data-key="hud.orb"]').getByRole('radio', { name: 'Off' }).click();
  ok('Header orb off', (await page.locator('.orb').count()) === 0);
  await page.locator('[data-key="hud.orb"]').getByRole('radio', { name: 'On' }).click();
  await page.locator('[data-key="hud.orbStyle"]').getByRole('radio', { name: 'Liquid' }).click();
  await page.waitForTimeout(1500);
  ok('Orb style → liquid renders', (await page.locator('.orb canvas').count()) === 1);

  // Motion
  await page.goto(BASE + '/#/settings/motion');
  await page.locator('[data-key="motion.mode"]').getByRole('radio', { name: 'Reduced' }).click();
  ok('Motion → reduced', (await ds('motion')) === 'reduced' && (await cssVar('--motion-k')) === '0');
  await page.locator('[data-key="motion.mode"]').getByRole('radio', { name: 'Full' }).click();
  await page.locator('[data-key="motion.speed"] input').fill('2');
  ok('Animation speed 2× → durations halved', (await cssVar('--motion-k')) === '0.5');

  // Simulation + FPS
  await page.goto(BASE + '/#/settings/diagnostics');
  await page.locator('[data-key="sim.enabled"]').getByRole('radio', { name: 'On' }).click();
  await page.locator('[data-key="sim.date"] input').fill('2026-11-28');
  await page.locator('[data-key="sim.time"] input').fill('13:30');
  ok('Simulation banner appears', (await page.locator('.sim-banner').innerText()).includes('28/11'));
  await page.goto(BASE + '/#/today');
  ok('Today follows the simulated date', (await page.locator('.hero-title').innerText()).toUpperCase().includes('SATURDAY'));
  await page.getByRole('button', { name: 'Back to real time' }).click();
  ok('Back to real time removes the banner', (await page.locator('.sim-banner').count()) === 0);
  await page.goto(BASE + '/#/settings/diagnostics');
  await page.locator('[data-key="diag.fps"]').getByRole('radio', { name: 'On' }).click();
  await page.waitForTimeout(1300);
  ok('FPS counter shows', /FPS \d+/.test(await page.locator('.fps').innerText()));
  ok('No reload happened during all of the above', (await page.evaluate(() => window.__noReload)) === 'still here');

  // Persist across reload
  const accentBefore = await cssVar('--accent');
  await page.reload({ waitUntil: 'networkidle' });
  ok('Settings survive a reload', (await cssVar('--accent')) === accentBefore && (await ds('motion')) === 'full' && (await page.locator('.fps').count()) === 1);

  // Cross-tab sync
  const other = await ctx.newPage();
  await other.goto(BASE + '/#/today', { waitUntil: 'networkidle' });
  await page.goto(BASE + '/#/settings/appearance');
  await page.locator('select').first().selectOption('graphite');
  await other.waitForTimeout(400);
  ok('Other tab follows (storage event)', (await other.evaluate(() => document.documentElement.dataset.preset)) === 'graphite');
  await other.close();

  // Export
  await page.goto(BASE + '/#/settings/data');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export settings' }).click()]);
  const file = S + '/' + dl.suggestedFilename(); await dl.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('Export settings file name', /^study-dashboard-settings-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok('Export has kind + version + values', exported.kind === 'study-dashboard-settings' && exported.version === 1 && exported.values['appearance.preset'] === 'graphite');

  // Imports
  const importFile = async (name, body) => {
    const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import settings' }).click()]);
    await ch.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) });
    await page.waitForTimeout(300);
    return toast();
  };
  const presetBefore = await ds('preset');
  let t = await importFile('broken.json', '{ this is not json');
  ok('Corrupt import rejected, nothing changed', /not valid JSON/.test(t) && /Nothing was changed/.test(t) && (await ds('preset')) === presetBefore, t);
  t = await importFile('progress.json', progress);
  ok('Progress backup rejected as settings', /progress backup/.test(t) && (await ds('preset')) === presetBefore, t);
  const partial = { kind: 'study-dashboard-settings', version: 1, values: { 'appearance.preset': 'light', 'appearance.colorMode': 'light', 'glass.blur': 'very', 'hud.frame': 'yes', 'appearance.radius': 999, 'bogus.key': 1 } };
  t = await importFile('partial.json', JSON.stringify(partial));
  ok('Partly invalid import: good keys applied, bad keys reset per key', (await ds('preset')) === 'light' && (await cssVar('--glass-blur')) === '16px' && (await ds('frame')) === 'on' && (await cssVar('--r-lg')) === '20px', t);
  await page.getByRole('button', { name: 'Undo import' }).click();
  ok('Undo import', (await ds('preset')) === 'graphite');
  t = await importFile('legacy.json', JSON.stringify({ 'appearance.preset': 'midnight' }));
  ok('Unversioned file is migrated (v0 → v1)', (await ds('preset')) === 'midnight', t);

  // Reset all + undo
  await page.getByRole('button', { name: 'Reset all settings' }).click();
  ok('Reset all → defaults', (await ds('preset')) === 'mono-noir' && (await page.locator('.fps').count()) === 0);
  await page.getByRole('button', { name: 'Undo' }).click();
  ok('Reset all undo', (await ds('preset')) === 'midnight');

  // Quick drawer
  await page.goto(BASE + '/#/today');
  await page.getByRole('button', { name: 'Quick settings' }).click();
  await page.locator('#quick-settings .setting').first().waitFor();
  ok('Quick drawer opens with 6 controls', (await page.locator('#quick-settings .setting').count()) === 6);
  await page.locator('#quick-settings [data-key="glass.mode"] select').selectOption('off');
  ok('Drawer change applies live', (await ds('glass')) === 'off');
  await page.keyboard.press('Escape');
  // Focus returns on the next animation frame; wait for it (up to 3 s) rather than a fixed delay.
  await page.waitForFunction(() => !document.getElementById('quick-settings') && document.activeElement?.getAttribute('aria-label') === 'Quick settings', null, { timeout: 3000 }).catch(() => {});
  ok('Esc closes the drawer, focus returns', (await page.locator('#quick-settings').count()) === 0 && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Quick settings');

  // Storage blocked → in-memory with notice
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } }) });
  const bp = await blocked.newPage();
  await bp.goto(BASE + '/#/settings/appearance', { waitUntil: 'networkidle' });
  await bp.locator('select').first().selectOption('high-contrast');
  ok('Blocked storage: settings still apply in memory', (await bp.evaluate(() => document.documentElement.dataset.preset)) === 'high-contrast');
  ok('Blocked storage: visible notice', (await bp.locator('.notice').allInnerTexts()).some(x => /settings changes last only/.test(x)));
  await blocked.close();

  // Progress untouched
  const after = await page.evaluate(() => localStorage.getItem('study-dashboard:v1'));
  ok('Progress data (study-dashboard:v1) untouched', after === progress);
  ok('No console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
  await browser.close();
})();
