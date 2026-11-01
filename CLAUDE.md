# CLAUDE.md: handoff for the study dashboard

Read this file in full, then `README.md`, before changing anything. The README is the user
manual: how to run it, deploy it and use Settings. This file is the engineering memory: what
the app is, how it is put together, the rules that must not break, and the traps already hit.

---

## 1. What this is

A personal, single-user study dashboard for **Med**, a 1st-year engineering student at ESSAI
(Tunis), built from his study plan "**P2 Daily Plan — Top 3**". The goal is a top-3 class rank,
about z = 1.5 in every period. The plan runs week by week from **Mon 2026-11-02** to the exams.

- It is a **static web app**: no server, no account, no database. Every bit of user data lives
  in the browser's `localStorage` on the device where it is used. JSON export and import move
  data between devices.
- It is deployed to **GitHub Pages** by a GitHub Actions workflow and works on desktop and phone.
- Pages, hash routes, and what each shows:

| Route | Page | What it shows |
| --- | --- | --- |
| `#/today` (default) | Today | "3 / 7 BLOCKS" hero, DONE / NEXT, the day's classes and study blocks as a checklist with **Start** (records lateness), tomorrow's first task, the 40-minute bad-day minimum, "Do these first" |
| `#/week` | Week | Mon–Sun timetable grid (desktop) or day list (phone) |
| `#/plan[/section]` | Plan | Week-by-week timeline, checkpoints with score inputs, rules, bad days, exam mode |
| `#/resources[/module]` | Resources | One card per module; filter is in the URL |
| `#/absences` | Absences | Counter plus editable limit per module, warning and alarm states |
| `#/check` | Sunday check | Three weekly numbers plus trend charts vs. targets; z-score |
| `#/settings[/section]` | Settings | Everything configurable (section 6) |

On phones (≤ 640 px) navigation is a floating glass tab bar (four tabs + a "More" panel) with a
sliding current-tab highlight wearing a liquid-metal rim, and changing page plays a disc
transition everywhere. See §7a and §7b. Every corner in the app comes from radius tokens (§7).

## 2. Hard rules: do not break these

1. **`three` stays at `~0.182.x`.** `@shadergradient/react` 2.4.20 crashes on three 0.187
   (`Can not resolve #include <cube_uv_reflection_fragment>`), and 0.183+ logs a Clock
   deprecation warning through fiber. `@types/three` matches. (`^0.182.0` in package.json is
   the same range as `~0.182.0` for a 0.x version.)
2. **three.js, ShaderGradient, html2canvas and the liquid-metal shader stay in lazy chunks.**
   The first-load JS must stay near **100 kB gzipped**. It is 103.2 kB (gzip -9, measured by
   `tools/verify/bundle-size.cjs`): an 80 kB entry chunk plus the preloaded `theme`, `env` and
   `jsx-runtime` chunks. Phase 4 added 0.3 kB (102.9 → 103.2); it was 99 kB before phase 3.
   CSS is about 20 kB.
   - Lazy: every page except Today (through `src/pages/registry.ts`, preloaded when idle), the
     Settings UI (including `settings-text.ts`, `contrast.ts`, `settings-files.ts`), the quick
     drawer, the tab bar, the "More" sheet and `metalEngine` (+ `@paper-design/shaders`).
   - Measure the entry chunk plus every `<link rel="modulepreload">` in `dist/index.html`,
     not just `index-*.js`: `node tools/verify/bundle-size.cjs metalEngine`.
   - Anything only the Settings UI needs (help text, guards, file I/O) goes in a module only the
     Settings UI imports. Lazy code that must react to app state listens to DOM signals
     (`data-navigating`, the `navigating` event) instead of importing startup modules.
   - Splitting the 1.4 kB transition engine into its own chunk saved nothing (chunk overhead),
     so it stays static.
3. **Never touch, rename or migrate the progress key `study-dashboard:v1`**, nor its backup file
   format (`exportJSON` / `parseBackup` in `src/lib/store.ts`). Settings are a separate key
   (`study-dashboard:settings:v1`) and must never write progress.
4. **No URL parameters.** Nothing reads `location.search`. Every option lives in Settings. Hash
   routes are only for navigation and sub-sections.
5. **Relative base path and hash routing** (`base: './'` in `vite.config.ts`), so the build works
   at any `https://<user>.github.io/<repo>/`.
6. **WCAG AA on every text element in every preset**: 4.5:1 for normal text, 3:1 for large.
   Also keyboard access, a visible focus ring, a skip link, live regions, and respect for
   reduced motion. Verify on rendered pixels with `tools/verify/matrix.cjs` (section 11).
7. **No new runtime dependency unless unavoidable, and justify it.** Phase 2 added Fontsource
   font packages; phase 4 added `@paper-design/shaders`, **pinned exactly at `0.0.81`**
   (Apache-2.0, zero dependencies; README carries its NOTICE). Import only `ShaderMount` and
   `liquidMetalFragmentShader`, and only from `metalEngine.ts`.
8. **Open-source fonts only, self-hosted through Fontsource.** No Google Fonts CDN, no
   proprietary faces.
9. **Don't copy the reference portfolio** whose look inspired the restyle: no names, logos, copy
   or assets. Identity stays neutral: wordmark `P2.Daily.Plan`, monogram `T3`.
10. **No CSS `color-mix()`, `oklch()`, `lab()`, `color()` or relative colours.** html2canvas
    1.4.1 (used by the experimental liquid-glass mode) throws "unsupported color function" on
    them, and Chromium computes `color-mix` to `color(srgb …)`, which it also can't read.
    Compute mixed colours in JS in `applyTheme()` and expose them as CSS variables (section 7).
11. **Settings are typed and declarative.** Every setting is one entry in
    `src/data/settings-schema.ts`, and the UI is generated from it. Don't hand-build setting
    controls.
12. **All navigation goes through the navigation layer in `src/lib/env.ts`.**
    - Links are plain `<a href="#/…">`; never add per-link click handlers that change the route.
    - Code that navigates calls `navigate('#/…', { origin })`.
    - Don't read or write `location.hash` anywhere else.
13. **Desktop (≥ 641 px) must stay visually identical** unless a change is asked for there.
    - Phone-only work goes inside `@media (max-width: 640px)` and/or `[data-tabbar='on']`.
    - Prove it with `tools/verify/desktop-diff.cjs` (§11).
14. **No hard-coded corners.** Every `border-radius` uses a `--radius-*` token (§7); nested
    surfaces use `max(0px, calc(<parent token> - <padding>))`. Only true circles use `50%`.
    `GlassLayer` inherits its host's radius; never pass it a radius.
15. **At most 2 live shader canvases (1 on phones)**, through `metalEngine`'s budget. Never mount
    a `ShaderMount` anywhere else, and never let a metal control render empty: the CSS rim is
    always painted under the canvas.
16. **Write `backdrop-filter` unprefixed only.** Lightning CSS (Vite's minifier) adds the
    `-webkit-` copy itself, and when both are written in the order unprefixed → prefixed it
    drops the unprefixed one, so Chromium gets no blur at all (trap 23).

## 3. Stack

- **Vite 8** (rolldown) · **React 19** · **TypeScript 7**, strict, built with `tsc -b` · **oxlint**.
- **3D:** `three ~0.182`, `@react-three/fiber 9`, `@react-three/drei 10` (only `PerformanceMonitor`),
  `@shadergradient/react 2.4.20`. `three-stdlib` and `camera-controls` are installed only as
  ShaderGradient peers; the bundler drops them.
- **html2canvas 1.4.1**, only for the vendored **liquid-glass-js** in `src/vendor/liquid-glass-js/`
  (MIT, copied unchanged; see `VENDORED.md`).
- **Fonts** (`@fontsource-variable/*`):

| Role | Font |
| --- | --- |
| Body (UI) | Atkinson Hyperlegible Next |
| Labels (mono) | Atkinson Hyperlegible Mono |
| Display: big numbers and section heads (user picks one) | Sofia Sans Extra Condensed (default), Antonio, Big Shoulders Display |
| Giant page title | Unbounded |

- Node 20.19+ or 22.12+. CI uses Node 22.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b + vite build → dist/
npm run preview    # serve dist/
npm run lint       # oxlint (ignores src/vendor and dist)
npm run typecheck  # tsc -b
```

## 4. File map

```
index.html                  theme-color meta, viewport-fit=cover (insets handled by --safe-* tokens), #root, favicon,
                            and an EMPTY <style data-paper-shader> in <body> (stops Paper Shaders injecting CSS into <head>)
vite.config.ts              base './', React plugin
.github/workflows/deploy.yml  push to main → npm ci, build → GitHub Pages (Source must be "GitHub Actions")
src/main.tsx                font imports, the 7 stylesheets, startTheme() BEFORE createRoot
src/fonts.d.ts              declare module '@fontsource-variable/*' (bare side-effect imports)
src/App.tsx                 shell: skip link, Background, HudChrome, Header, notices, PageHost,
                            .vt-layer (fallback transition overlay), route announcer, Caption,
                            FabStack, lazy TabBar + MoreSheet (phones), lazy QuickSettings, Toaster, FpsMeter

src/data/
  plan.ts                   THE study plan (single source of content); typed sections, see §5
  settings-schema.ts        THE settings schema (single source of settings); see §6
  settings-text.ts          help text per setting and section (lazy: only the Settings UI imports it)
  presets.ts                5 presets × dark/light palettes, presetBundles, moduleHues (Midnight)

src/lib/
  store.ts                  progress store, key study-dashboard:v1 (useSyncExternalStore), export/import
  settings.ts               settings store, key study-dashboard:settings:v1: coerce, migrate (v2), sync
  settings-files.ts         settings export/import (lazy, Settings page only)
  theme.ts                  resolve(settings, media) → Resolved (incl. glass targets, metal); applyTheme() → CSS vars
                            + data-*; radiusVars()/groupShape() (roundness tokens); navbarTint()/navPillColor() (bar AA)
  contrast.ts               contrastChecks(), autoFix(): the colour guard (lazy, Settings page only)
  capabilities.ts           caps {webgl, webgl2, chromium, backdrop}; live media store {phone, osReducedMotion, osDark,
                            osReducedTransparency, visible}
  env.ts                    now() (real or simulated clock), useNow/useToday/useSimulation, DPR cap, and the
                            NAVIGATION LAYER: hash routes, navigate(), link interception, press origin,
                            per-entry scroll restore, focus + announce, tap replay during transitions
  transition.ts             page transitions: View Transition disc reveal / crossfade, overlay disc
                            (wash, and the no-API fallback), reduced motion, skip-to-latest;
                            <html data-navigating> + 'navigating' event while one runs
  color.ts                  hex/rgb, luminance, WCAG contrast, mix, rgba, inkOn
  schedule.ts               plan → concrete days and blocks (weekFor, scheduleFor, weekSchedule, plannedMinutes)
  dates.ts                  ISO-date helpers (local time, no library)
  stats.ts                  week stats, median, zScore
  useWeekProgress.ts        useWeekStats / useThisWeekStats (header %, orb, caption)
  toast.ts                  toast queue (role=status), optional Undo action
  text.ts                   tiny inline markup: [label](url), *italic*, **bold**

src/components/
  Header.tsx                3-column top bar: orb + wordmark + stat | monogram | nav + gear; SimBanner
  hud/HudChrome.tsx         frame, corner brackets, grid, desk mats (aria-hidden); Caption; FabStack (top + quick settings)
  ui/Hud.tsx                page grammar: Tag, ProgressLine, MetaPair, StatusStrip, GiantTitle (auto-fit), Hero, StaticSphere
  ui/Segmented.tsx          ARIA radiogroup with roving tabindex (the FR/EN-style toggle)
  settings/SettingControl.tsx  renders ONE schema entry by control type
  settings/helpers.ts       meets(requires), isVisible(dependsOn), applyPatch (+Undo toast)
  settings/ContrastGuard.tsx   live WCAG table + "Fix automatically"
  settings/QuickSettings.tsx   modal drawer (focus trap, Esc) with the 6 `quick` settings
  glass/GlassLayer.tsx      per-target glass (header | navbar | buttons): svg refraction | blur | liquid-glass-js | off;
                            reads the host's computed size + corners (ResizeObserver + every render)
  glass/displacementMap.ts  generates the SVG displacement map (per-corner radii, clamped)
  metal/LiquidMetalSurface.tsx  <LiquidMetalSurface target when>: CSS rim + dark fill; registers with the lazy engine
  metal/useMetalOn.ts       useMetalOn(target) for the host's data-metal attribute
  metal/metalEngine.ts      LAZY chunk: ShaderMount + liquid-metal shader, the canvas budget, IO, pause, fallbacks
  glass/liquidGlass.ts      loads vendored liquid-glass-js + html2canvas on demand
  Background.tsx            solid / gradient / dots CSS layers; lazy GradientScene for "animated"; grain
  GradientScene.tsx         ShaderGradient canvas (lazy), PerformanceMonitor quality, pause loop
  DitherSphere.tsx          lazy R3F shader: 4×4 Bayer-dithered sphere + smooth cursor lens (page hero)
  DottedOrb.tsx             lazy R3F: 520 Fibonacci points; lit dots = this week's blocks-done %
  OrbScene.tsx              lazy R3F "liquid" orb (fill level = %)
  ProgressOrb.tsx           picks DottedOrb / OrbScene / CSS fallback; null when hud.orb is off
  TrendChart.tsx            SVG line chart for the Sunday check
  BackupButtons.tsx         "Export progress" / "Import progress" (format unchanged since v1)
  Rich.tsx, Toast.tsx, FpsMeter.tsx, SafeBoundary.tsx, icons.tsx

  nav/TabBar.tsx            phone tab bar (lazy): 4 tabs + More, sliding highlight (one element), metal pill,
                            re-tap to top, keyboard watch, swipe, hide-on-scroll
  nav/MoreSheet.tsx         "More" sheet / floating panel (lazy): glass layer + scrolling .sheet-body, modal,
                            focus trap, Esc/backdrop/swipe-down close
  nav/pages.ts              PAGE_META (label, short label, icon per page), morePages(), swipeOrder()

src/pages/                  TodayPage (eager), Week, Plan, Resources, Absences, Check, Settings (lazy)
  registry.ts               page loaders, preloadPage() / preloadAll(), loadedPage()
src/styles/
  base.css                  fallback tokens, type roles (.label/.display/.giant), spacing scale, focus, skip link, reduced motion
  hud.css                   background layers, HUD frame/corners/grid/mats, top bar, nav, glass layers, banner, drawer, toast, responsive top bar
  components.css            buttons, fields, checkbox, segmented, tags, badges, status strip, hero, progress line, meta, cards, tables
  pages.css                 per-page layouts, settings page (incl. the tab picker), dither stand-in
  nav.css                   phone tab bar (docked + floating), highlight pill, caption chip, hide-on-scroll, "More"
                            sheet/panel, keyboard-open rule, phone --frame-bottom / --frame-edge
  metal.css                 liquid-metal rim, fill, tints, hosts ([data-metal='on'])
  transitions.css           @property --vt-r, chrome view-transition-names, the disc mask, overlay layer

tools/verify/               headless-Chromium checks (dev only, not shipped): see §11
  matrix.cjs                screenshots + pixel contrast (phones: safe-area insets; ":sheet" opens More);
                            modes all | presets | glass | phone (390/360) | variants (bar, roundness, glass, metal,
                            worst-case white/black block behind the bar)
  settings-e2e.cjs          73 settings checks (incl. roundness and the v1 → v2 migration)
  nav-e2e.cjs               tab bar (floating + docked), More panel, focus, scroll restore, keyboard, swipe,
                            hide on scroll, map rebuild on resize, transition settings
  metal-e2e.cjs             liquid metal: budget, fallbacks, still frames, pause, persistence, a11y, contrast
  bundle-size.cjs           first-load JS (entry + modulepreloads) and named lazy chunks, gzip -9
  transition-frames.cjs     paused/seeked frames at 0–650 ms with a press marker, per transition style
  desktop-diff.cjs          deterministic desktop shots + pixel compare (before/after proofs)
  sheets.py, seed.json      contact sheets; the progress fixture used by every script
```

## 5. Content: `src/data/plan.ts`

All plan content is here, typed, in plan order: `modules`, `goal`, `doFirst`, `week` (the 7-day
template), `weeks` (week by week, `weeks[0].start` = `planStart`), `fixedDates` (DS, exams),
`checkpoints`, `rules`, `badDay`, `examMode`, `sundayCheck`, `resources`.

- Module ids: `proba`, `micro`, `introEco`, `demo`, `statDes`, `algo`, `r`, `envInfo`,
  `anglais`, `techCom`. Each module has a colour variable `--m-<id>`, plus `--m-<id>-tint` and
  `--m-<id>-line`. Use `--m-none*` when there is no module.
- Dates are `YYYY-MM-DD` and times are `HH:MM`, both in local time.
- Text fields accept `[label](url)`, `*italic*` and `**bold**`. Links starting with `#/` stay
  in the app.
- **Block `id`s are progress keys.** Renaming one orphans saved progress, so keep them stable.
- Exam dates around 07/01 are still placeholders ("confirm the dates"). Exam-mode items have
  start times only.

## 6. Settings system

**Schema** (`settings-schema.ts`). `Settings` is one flat interface keyed `section.name`. Each
`SettingDef` has:

| Field | Meaning |
| --- | --- |
| `key`, `section`, `label` | Identity and the label shown in the UI. **Help text is not here:** it lives in `settings-text.ts` (`settingHelp[key]`, `sectionHelp[section]`) so it loads with the lazy Settings UI |
| `group` | Optional sub-heading; consecutive entries with the same group share it (Appearance → Roundness, → Liquid metal) |
| `control` | `segmented`, `select`, `toggle`, `range` (min/max/step/unit), `color` (swatches + hex, `null` = use the preset's colour), `checkboxes`, `date`, `time`, or `tabs` (exactly `count` distinct options in order; each slot is a select and picking a used option swaps) |
| `default` | Default value |
| `dependsOn: {key, is}` | Hidden when the condition isn't met |
| `requires: 'webgl' \| 'webgl2' \| 'chromium'` | On the setting or on individual options; unmet options show "(needs …)". An unmet `webgl2` setting is shown but `inert` (the shader-only metal controls) |
| `quick` / `quickLabel` | Appears in the drawer |
| `apply(value, current)` | A patch written together with the value: presets (bundle), Roundness preset → radius, radius → matching preset |
| `undo` | Show the "Applied … / Undo" toast (presets only; the radius slider must not stack toasts) |

The object is checked with `satisfies { [K in SettingKey]: SettingDef<K> }`.

**All 64 keys:**
- `appearance.`: preset, colorMode, accent, background, textSize (90–120), density,
  monoUppercase, displayFont; **Roundness:** roundness (square / soft / rounded / very / pill /
  custom, default square), radius (master, 0–40, default 0; 0–20 values from v1 stay valid),
  radiusLink (default on), radiusNav (default pill), radiusCards / radiusButtons / radiusInputs /
  radiusSheets / radiusHud (master or a preset, default master; shown when unlinked)
- `metal.`: enabled (on), applyTo (tab / primary / floating, default tab), tint (silver / warm /
  cool / accent), speed (idle 0.1–2, 0.6), hoverSpeed (0.1–3, 1), static (off). Section
  appearance, group "Liquid metal"; speed, hoverSpeed and static `requires: 'webgl2'`
- `background.`: type (solid / gradient / dots / animated / dither, **default `dither`**),
  color1–3, speed, grain, quality (auto / low / high), pauseHidden (default on), allow3dPhone
  (default off)
- `glass.`: mode (off / blur / refraction / liquid, **default `refraction`**), blur, refraction,
  tint, saturation, edge, applyTo (header / navbar / cards / buttons, all on)
- `hud.`: frame, corners, grid, caption, orb, orbStyle (dotted / liquid)
- `nav.`: transition (reveal / wash / fade / none, **default `reveal`**), duration (300–1200 ms,
  default 650), softness (0–100 %, default 35), origin (press / center), bottomBar (default on),
  labels (default on), swipe (default off), tabs (exactly 4 `NavPage`s, default
  today/week/plan/absences), barStyle (floating / docked, default floating), barMargin (0–32,
  16), barGap (0–32, 12), highlight (pill / underline), hideOnScroll (default off).
  `dependsOn` chains: a setting is hidden when its parent is hidden (`isVisible` recurses).
- `motion.`: mode (auto / reduced / full), speed
- `sim.`: enabled, date, time
- `diag.`: fps

The six quick keys are preset, colorMode, accent, background.type, glass.mode and motion.mode.

**Adding a setting:**
1. Add the key to `Settings` and an entry to `schema`, and its help text to `settings-text.ts`.
   The page and drawer pick it up.
2. Consume it in one of two ways:
   - Map it in `applyTheme()` to a CSS variable or `data-*` attribute, then style it in CSS.
     Prefer this for visual settings.
   - Read it with `useSetting('key')` in a component.
3. If it needs WebGL or Chromium, add `requires`, and handle the fallback in `resolve()`.
4. Add it to `tools/verify/settings-e2e.cjs`.

**Store** (`lib/settings.ts`, `useSyncExternalStore`):
- **Format:** `{ version: 2, values: {...} }` under `study-dashboard:settings:v1` (the key name
  keeps its `v1`; the version lives inside).
- **Load:** goes through `migrations`, then `coerce()` per key. An invalid value falls back to
  its own default, never the whole file.
  - v0 → v1: a bare values map.
  - v1 → v2: new keys take their defaults; `glass.applyTo` gains `navbar` if it had `header`
    (the tab bar used to borrow the header's glass); `appearance.roundness` is derived from the
    saved radius (0/8/16 → square/soft/rounded, anything else → custom).
- **Storage failures:** every read and write is in try/catch. If storage is blocked, settings
  live in memory and `useSettingsProblem()` shows a notice.
- **Cross-tab sync:** via the `storage` event.
- **Writes:** `setSetting` (applies the `apply` bundle), `setSettings`, `replaceSettings`;
  `resetSection` and `resetAll` return the previous state for Undo.
- **Export:** `{kind: 'study-dashboard-settings', version, exportedAt, values}` saved as
  `study-dashboard-settings-YYYY-MM-DD.json`.
- **Import (`readSettingsFile`):** rejects, changing nothing: non-JSON, non-objects, a progress
  backup (it has `blocks` or `sundayChecks`), a wrong `kind`, or a file with zero recognised
  keys. Otherwise applies the good keys and reports the reset ones, with Undo.

**Presets** (`presets.ts`): Mono Noir (default), Midnight, Graphite, High contrast, Light.
- Each preset has a dark and a light `Palette`: `{bg, ink, ink2, accent, ok, warn, alarm,
  focus, gradient[3], modules: 'hue' | 'mono'}`.
- `presetBundles[id]` is applied when a preset is picked. It clears custom colours and sets
  colorMode, radius and roundness, background type, glass mode and tint, grid, and orb style.
  colorMode then picks the preset's dark or light palette.
- Only Midnight colours modules (`moduleHues`); the others use `ink2`.

**Resolution** (`lib/theme.ts`): `resolve(settings, media)` returns what is actually used:
- **mode** and **palette**, including derived `raised`, `desk`, `line`, `lineStrong` and
  `accentInk`.
- **reducedMotion:** the auto mode follows the OS.
- **glass engine:** `off | blur | svg | liquid`.
  - `svg` (refraction) needs Chromium; otherwise it falls back to `blur`.
  - `liquid` needs WebGL; otherwise it falls back to `svg` or `blur`.
  - A `glassNote` explains any downgrade, and `glassOn` holds the per-target flags.
  - `glassOn.navbar` is also off (solid bar) without `backdrop-filter`, at Background quality
    Low, or with `prefers-reduced-transparency`.
- **metal:** `on` per target, `live` (WebGL 2 and quality not Low) and `still` (Static or
  reduced motion). The Settings note for it is computed in `SettingsPage.tsx`.
- **background type in use:**
  - `animated` falls back to the static `gradient` on phones (unless allow3dPhone is on),
    without WebGL, or with reduced motion.
  - `dither` becomes a static stand-in without WebGL and holds still under reduced motion.
  - Also resolves `bgPaused` (tab hidden and pauseHidden on) and quality.
- **contrast** (`contrast.ts`, lazy): `contrastChecks()` lists ink, ink2 (on bg and raised),
  accent on bg, text on accent, plus ink2 over the gradient's worst spot and on glass when a
  gradient is in use. `autoFix()` binary-searches the fewest colour changes to reach AA.

## 7. Theming and visual language

**Application.** `applyTheme()` writes CSS custom properties and `data-*` attributes on `<html>`.
It runs before the first render (`startTheme()` in `main.tsx`) and on every settings or media
change. Components rarely read settings directly; CSS keys off these.

- **Data attributes:** `data-mode` (dark/light), `data-preset`, `data-glass` (the *engine in
  use*: off/blur/svg/liquid, not the setting value), `data-glass-header|navbar|cards|buttons`,
  `data-motion` (reduced/full), `data-density`, `data-mono-case`, `data-frame`,
  `data-corners`, `data-grid`, `data-caption`, `data-bg` (the type in use), `data-tabbar`,
  `data-tab-labels`, `data-bar` (floating/docked), `data-tab-highlight` (pill/underline).
  Set elsewhere: `data-kb` (TabBar), `data-bar-hidden` (hide on scroll), `data-navigating`
  (transition.ts), `data-vt` (View Transitions).
- **Colour variables:** `--bg --raised --desk --ink --ink-2 --line --line-strong --accent
  --accent-ink --warn-ink --ok --warn --alarm --focus --g1..3 --dot --gridline`.
- **Precomputed mixes** (use these instead of `color-mix`, see hard rule 10): `--g1-a85 --g1-a50
  --g2-a85 --glass-tint-liquid --scrim --ink-wash --accent-wash --accent-tint --m-<id>-tint
  --m-<id>-line`. Need a new mix? Add it in `applyTheme()`.
- **Sizing and fonts:** `--text-scale` (html font-size), `--density` (0.72 or 1, scales
  `--s1..--s7` and `--control-h`), `--font-display`, `--display-weight`, `--display-tracking`.
- **Radius tokens** (`radiusVars()` in theme.ts; all 0 at the default master radius, so the
  default look is square). The old `--r-lg/md/sm` are gone.
  - Scale from the master R: `--radius-xs/s/m/l/xl` = 0.25/0.45/0.7/1/1.4 × R, `--radius-full`
    9999px. `--radius-mark` (0.25 R) for dots, swatches and progress bars.
  - Groups (each from `groupShape()`: the master when linked or "Same as master", else its own
    preset; Pill = 28 plus fully round controls): `--radius-card/-card-m/-card-s` (cards,
    formula, notes, week blocks), `--radius-btn` (buttons, square buttons, chips, badges, nav
    links), `--radius-input` / `--radius-area` (fields; multi-line fields cap at 16 in Pill) /
    `--radius-check`, `--radius-sheet` / `--radius-toast` / `--radius-tip`, `--radius-hud`,
    `--radius-nav` (the floating bar; linked = pill). `--radius-nav-px` clamps it to half the
    bar height; `--radius-bracket` makes the corner brackets concentric with the frame.
  - Nested: `max(0px, calc(outer - padding))` (segmented items, the frame's inner line, the tab
    highlight, the metal fill, rows in the More panel).
  - A rounded frame: `.hud-fill.tl/tr/bl/br` (desk-coloured, radial-masked) cover the mats'
    square inside corners; the top bar's top corners follow the frame.
- **Glass and motion:** `--glass-tint`, `--glass-tint-strong`, `--glass-blur`, `--glass-sat`,
  `--glass-edge`, `--glass-edge-soft`, `--grain`, `--motion-k` (0 when reduced, otherwise
  1/speed; multiplies `--dur`).
- **Tab bar and metal:** `--bar-margin`, `--bar-gap`, `--bar-shadow`, `--navbar-tint` (auto-AA
  tint), `--navbar-blur` (1.5× blur), `--navbar-sat` (+40 %), `--nav-pill`, `--nav-pill-line`,
  `--metal-fill` (#111214), `--metal-ink` (#f3f3f0), `--metal-tint` (accent).
- **`--tick`:** the checkbox tick, as an SVG data URI. It's a background image because
  html2canvas chokes on the `::after` with `content: ''`.

**Look.** Near-black monochrome with one accent (default off-white). HUD frame: a double
hairline inset `--frame` (18 px, or 8 px on phones) from the viewport, L-shaped corner
brackets, a faint grid, and "desk mats" filling the gutter. A fixed bottom-left mono caption
reads "Today — Week 3 · P2 daily plan · 25%". Square floating buttons sit bottom-right (back to
top, quick settings).

**Type roles:**

| Class | Font | Used for |
| --- | --- | --- |
| `.label` | Mono, 0.6875rem, tracking 0.14em, uppercase unless `data-mono-case='none'` | Labels, tags, coordinates, captions |
| `.display` | Condensed light | Big numbers, section heads |
| `.giant` | Unbounded 900, uppercase | One per page |
| (body) | Atkinson Hyperlegible Next | Running text |

**Page grammar** (every page): `StatusStrip` (4 mono key/value cells) → `Hero`:
- a `Tag` (`● [ 01 ] · TODAY · WED 18/11`),
- a big condensed number with an outlined unit ("1 / 3 BLOCKS"),
- a `ProgressLine` (partly filled hairline, role=progressbar),
- a `MetaPair` (DONE / NEXT or FROM / TO),
- a lede and actions,
- optional hero art (the dither sphere when the background is `dither`),
- the `GiantTitle` (weekday, "Week 03", "Top 3", "Resources", "Absences", "Sunday",
  "Settings"), auto-fitted to the column width and capped at min(190 px, 22% of the
  viewport height).

Then sections with numbered mono heads and hairline dividers.

**Top bar:** a three-column grid. At ≤1180 px `.tb-right` becomes `display: contents`: the gear
moves to column 3 and the nav takes row 2. At ≤640 px the stat line, monogram and corners hide.
The phone nav scrolls sideways (hidden scrollbar): `Header.tsx` keeps the current page's link
in view and sets `data-more` on the nav so CSS fades the edge(s) hiding more links. Labels use
`PAGES[].short` on phones ("Sunday").

**Glass:**
- Cards use `backdrop-filter`.
- The header and main buttons can refract: an SVG `feDisplacementMap` filter used through
  `backdrop-filter: url(#id)`. That only works in Chromium; elsewhere it falls back to blur.
- Experimental `liquid` uses liquid-glass-js. It takes **one html2canvas snapshot** and redraws
  only on scroll, so it goes stale over moving backgrounds. The header carries the
  `glass-container` class in that mode so the snapshot skips it.

**3D** (all lazy, with a CSS stand-in while loading or if WebGL fails):
- devicePixelRatio is capped at 1.5. The background gradient renders at 1× ("high" allows 1.5×).
- Loops pause when the tab is hidden and hold still (demand frameloop) with reduced motion.

## 7a. Navigation, phone tab bar and page transitions (phase 3)

**Navigation layer** (`env.ts`). One document-level click listener intercepts `<a href="#/…">`
(no modifier keys, no target/download), calls `preventDefault()` and `navigate(href, { origin })`.
- **Origin:** the press point (`clientX/Y`); for keyboard activation (`detail === 0`), the link's
  centre; a synthetic click within 700 ms of a press reuses that press. Back/forward reuses the
  last origin, or crossfades if there is none.
- **History:** `pushState({ navKey })`. Each entry's scroll position is kept in a map (updated on
  scroll) and restored on popstate. `history.scrollRestoration = 'manual'`.
- **Commit:** `commit()` bumps a token (the newest navigation wins) and waits for the page
  chunk (`preloadPage`, at most 1.5 s). It then runs `runTransition(apply)`, where `apply` does
  `flushSync` of the route store, scrolls, focuses `#main h1` (tabindex −1, no ring) and
  writes "<Page> page" into `#route-announcer`.
- **Echo guard:** popstate and hashchange both fire on back/forward. The guard compares with
  `target` (the pending destination), not just the committed `route`.
- **Taps during a View Transition:** they hit `<html>` (the overlay), and
  `pointer-events: none` on `::view-transition` does not help in Chromium 153. So `onPress`
  skips the transition, and `onOverlayClick` waits until its overlay is gone, then
  `elementFromPoint(...).click()`.

**Transitions** (`transition.ts`, `transitions.css`). Style comes from `nav.transition`.
Reduced motion always becomes a 160 ms crossfade. Duration = `nav.duration / motion.speed`.
- **Reveal + View Transitions API:** `<html data-vt="reveal">`, `--vt-x/-y/-k/-f0/-end`, then
  `startViewTransition(apply)`. On `ready`, WAAPI animates the registered `--vt-r` (0 →
  `--vt-end`) on `::view-transition-new(root)` with `cubic-bezier(.54,0,.34,.99)`.
  - The mask is `radial-gradient(circle at x y, #000 r(1-k)-f0, transparent r)`, with
    `k = 0.17·softness` and `f0 = 0.11·softness·R`; R is the distance to the farthest corner.
  - The old root stays fully visible (no dim, as in the video).
  - Animations use `fill: both` and are cancelled when the transition ends: with no fill, a
    one-frame flash of the old page appears at the end.
  - A per-transition id (`vtSeq`) stops a skipped transition from clearing the flag of its
    replacement.
- **Crossfade + API:** WAAPI opacity on the old and new root images.
- **Wash (all browsers), and reveal/crossfade without the API:**
  - A `.vt-disc` (radial-gradient, feathered by `0.3·softness` of its radius) or a `.vt-veil`
    is added to `.vt-layer`. That layer sits inside `.shell` at z 39: above the content, below
    the header, tab bar and HUD.
  - The cover phase (55 %) uses `transform: scale` or `opacity`. The page swaps while
    covered, then the cover fades (45 %).
  - Wash uses `--vt-wash` = bg mixed 24 % toward the accent: no white flash in Mono Noir.
- **Chrome during a View Transition:** `[data-vt]` gives the header, tab bar, HUD frame, mats,
  corners, caption and floating buttons `view-transition-name`s. Their groups and old images
  don't animate (old opacity 0), so chrome shows its new state from frame 1.
  - **Not named, on purpose:** `.bg` (canvas) and `.hud-grid`. Named groups always paint above
    the root, so a named full-screen background would cover the page.
  - Named glass (backdrop-filter) keeps its blur in Chromium 153 (tested).

**Phone tab bar** (`nav/TabBar.tsx`, `nav.css`; shown when `media.phone && nav.bottomBar`;
`<html data-tabbar>`, style in `<html data-bar>`).
- **Docked** (the phase-3 bar, pixel-identical): fixed full width, `--tabbar-h` 64 px (56 px
  with labels off) plus `--safe-b`, `.tab-mark` indicator at the top of the tab.
- **Floating** (default):
  - inset `--bar-margin` from the sides and `--bar-gap` + `--safe-b` from the bottom, height
    `--tabbar-h`, corners `--radius-nav-px`, `--bar-shadow`, 1 px edge, z 46;
  - glass = its own `navbar` target with `strong` frost; tint `--navbar-tint`, which
    `navbarTint()` raises to the lowest alpha where `--ink` stays ≥ 4.8:1 over pure white
    (dark) / black (light) before blur. Labels and icons use `--ink`;
  - `--frame-edge` (frame line and bottom mat) stays at `--frame` + `--safe-b`, so the page runs
    behind the bar; `--frame-bottom` = bar space + caption chip, so content, toasts and the
    drawer clear it;
  - the caption is a chip above the bar; the floating buttons sit above it;
  - the highlight: ONE `.tab-pill` (absolute, width = one column) moved by
    `translateX(var(--tab-i) * 100%)`, transition `transform` only (instant with reduced
    motion); its `.tab-pill-shape` is the accent pill (`--nav-pill`) or a 3 px underline, or
    hosts the liquid-metal surface (§7b).
- **Hide on scroll** (`nav.hideOnScroll`): `data-bar-hidden` after 24 px down, cleared after
  8 px up, near the top/bottom, on page change, and while focus is in the bar. The caption and
  floating buttons move down with it.
- **Header:** `compact` drops the top nav, and the gear becomes the Quick settings button. The
  floating Quick settings button is hidden (`showQuick={false}`).
- **Tabs:** `aria-current`, a `.tab-mark` indicator and a bold label. Re-tapping the active tab
  `preventDefault`s and scrolls to the top. "More" has `aria-haspopup="dialog"`, and
  `data-active` when the current page lives in More.
- **Keyboard:** while a text input has focus, `<html data-kb="open">` hides the bar, caption and
  floating button and shrinks `--frame-bottom`.
- **Swipe** (`nav.swipe`): a flick of ≥ 70 px, mostly horizontal, < 600 ms (event timestamps).
  It is ignored when it starts in an input, a dialog, the bar, or any element that scrolls
  sideways. Order = tabs, then the More pages except Settings.

**More sheet** (`nav/MoreSheet.tsx`). With the floating bar it is a floating glass panel just
above the bar (same margins and corners, `navbar` glass, rows spaced instead of ruled, the
current page on the pill colour); docked keeps the bottom sheet. The list scrolls inside
`.sheet-body` so the glass layer stays put. A modal dialog:
- focus starts on the first link and is trapped;
- Esc, the backdrop, the close button or a drag down (> 90 px or > 0.6 px/ms) close it with
  `'dismiss'`, and App returns focus to the More button;
- choosing a page closes it with `'navigate'`, and the router focuses the heading;
- a drag that ends on a link does not click it.

**Safe areas.** `--safe-t/r/b/l` = `env(safe-area-inset-*, 0px)`. `--frame-t/-l/-r` and
`--frame-bottom` include them. All four are 0 on desktops, so desktop geometry is unchanged.

## 7b. Liquid metal (phase 4)

`<LiquidMetalSurface target="tab|primary|floating" when>` (`components/metal/`, main bundle,
tiny) renders `<span class="lm" data-state data-tint aria-hidden><span class="lm-rim"/><span
class="lm-fill"/></span>` behind its host's content. Hosts: the tab highlight
(`.tab-pill-shape`), `.btn-start`, Export/Import progress and settings (`primary`), the
floating back-to-top / quick-settings buttons and the phone's Quick settings gear
(`floating`). Hosts get `data-metal="on"`, `isolation: isolate`, `--lm-r` (their radius);
`.lm` sits at z −1.
- **The CSS rim is always painted** (`conic-gradient`, per tint). `data-state`: `css` (still
  rim only), `live` (shader), `still` (one shader frame).
- **Engine** (`metalEngine.ts`, lazy chunk, ~10 kB gz): `attach(el, rim, kind, params)`.
  - Budget: `maxLive()` = 1 at ≤ 640 px, else 2. Priority tab 3 > floating 2 > primary 1;
    visibility from an IntersectionObserver (120 px margin); `allocate()` runs once per frame.
  - `new ShaderMount(rim, liquidMetalFragmentShader, uniforms, {low-power, no AA}, speed 0,
    frame, minPixelRatio 1, maxPixelCount = w·h·1.5²)` (≤ 360 k px). The library's own loop
    never runs: ONE shared ticker calls `setFrame()` at most 30 times a second per canvas and
    stops when nothing animates (off-screen, hidden tab, `data-navigating`, Static, reduced
    motion). The speed in force is mirrored to `.lm[data-speed]`.
  - A throw (no WebGL 2, compile error) or `webglcontextlost` marks the surface failed: CSS rim
    for good.
  - Speeds: idle `metal.speed`, hover/focus `metal.hoverSpeed`, press (pointerdown,
    Enter/Space, or the pill's `transitionrun`) max(2.4, 2.4 × hover) for 320 ms. The reset
    reads the live state when it fires (the reference's stale closure is fixed).
- **Never** set `outline: none` on hosts; never use `preserve-3d`/`translateZ`; never inject
  styles: the library would, unless `style[data-paper-shader]` exists (the empty one in
  index.html).
- Label contrast: `--metal-ink` on `--metal-fill` (≈ 17:1, measured on rendered pixels over 6
  frames by `metal-e2e.cjs`).

## 8. Progress data (`lib/store.ts`), unchanged since phase 1

`SavedState { version: 1, blocks[date][blockId] → {done, startedAt, delayMin}, classes[date],
firstTask[date], doFirst[id], badDay[date], badDaySteps["date:i"], absences[module] → {count,
limit}, sundayChecks[], checkpointScores["cp:i"] }`.

- Loading tolerates a corrupt store: the app starts empty and keeps the old copy under a
  `…:unreadable-…` key.
- Backup files from Export progress are parsed by `parseBackup`. Keep that format.

## 9. Simulated time

`sim.enabled` / `sim.date` / `sim.time` (Settings → Simulation & diagnostics) replace the old
`?date=`/`?time=` URL params. `now()` in `env.ts` returns the simulated moment, and every page
uses it through `useNow()` / `useToday()`. An empty time means the real time of day on the
simulated date. While it's on, a sticky amber banner shows with **Back to real time**.

## 10. Accessibility contract

- Skip link to `#main`, which has `tabIndex=-1`.
- Visible `:focus-visible` ring in `--focus`.
- Segmented controls are radiogroups: Arrow keys, Home and End.
- Colour swatches are `aria-pressed` buttons, not radios.
- The quick drawer and the "More" sheet are `role=dialog aria-modal`: focus trap, Esc closes,
  focus returns to the opener (passed in explicitly; tapped buttons don't always take focus on
  touch devices).
- After a page change, focus moves to the page's `<h1>` and `#route-announcer` (polite live
  region) says "<Page> page".
- Tab bar: labelled `<nav>`, targets ≥ 48 px, active tab = highlight shape (pill, underline,
  or the docked indicator bar) + bold label + `aria-current` (never colour alone); labels off
  keeps accessible names. Bar labels meet AA over the worst case behind the glass.
- Liquid-metal controls are real `<button>`s with the normal focus ring, driven by pointer,
  focus and keyboard (no mouse-only handlers); the metal layer is `aria-hidden`.
- Toasts use `role=status`; the contrast summary is `aria-live`.
- The Week grid has a screen-reader list version.
- Status is never colour-only: icons and words too.
- Reduced motion is respected via `data-motion='reduced'` (`--motion-k: 0`, 3D held still).

## 11. Verifying a change: do this before calling it done

1. `npm run lint`, then `npm run build`: no errors. Check the first-load JS (hard rule 2) with
   `node tools/verify/bundle-size.cjs metalEngine`.
2. Serve the **production build**: `npm run preview -- --port 5173 --strictPort`. Prefer it to
   the dev server for screenshots (see trap 8 in §12).
3. One-time setup for the checks: `npm i --no-save playwright pngjs && npx playwright install
   chromium`.
4. `node tools/verify/settings-e2e.cjs` (73 checks): every control applies live without a
   reload, roundness presets/Pill/overrides, persistence, cross-tab sync, export/import, corrupt
   and partial imports, both migrations, reset with undo, the drawer, blocked storage, the
   progress key untouched, no console errors. `nav-e2e.cjs` (67) covers the bar, the panel and
   the transitions; `metal-e2e.cjs` (21) the liquid metal.
5. `node tools/verify/matrix.cjs verify-out/matrix all` takes 78 screenshots (5 presets × 7
   pages × 1440/390 px, plus 4 glass modes × 2 widths). It measures every visible text run
   against the **rendered** background pixels and flags anything below AA, plus any console
   errors. Use `only mono-noir:today:390 glass-liquid:today:1440 noir-pill:plan:390:sheet …`
   for a subset. `phone` = Mono Noir and Light × 7 pages × 390/360 px; `variants` = docked,
   roundness, highlight, glass modes, metal (live / CSS / reduced / all targets) and worst-case
   white/black blocks injected right behind the bar in every preset (also at tint 20 %).
   `python3 tools/verify/sheets.py verify-out/matrix verify-out/sheets` makes contact sheets.
6. Look at the screenshots. The numbers don't catch layout breakage.

**Notes on the checks:**
- They run headless Chromium with SwiftShader, which is fine for correctness but says nothing
  about frame rate.
- Before each screenshot, the matrix fakes a hidden tab so the 3D loops pause; software
  rendering of the animated gradient under many blurred cards is otherwise too slow to capture.
- The measurement only counts text inside the HUD frame window, skips text covered by the
  sticky header, the bar (via `elementFromPoint`) or the caption chip (by rectangle: it ignores
  pointer events), and ignores the outer 2 px of each line box.
- All tests run with simulated time Wed 2026-11-18 14:40 and the progress seed in
  `tools/verify/seed.json`.

**Last full verification (phase 4, 2026-11-01, branch `feat/mobile-nav-transition`):**
- lint and typecheck clean; first-load JS 103.2 kB gz (102.9 before phase 4), metalEngine
  9.9 kB gz lazy, CSS 19.7 kB gz;
- 73/73 settings, 67/67 navigation and 21/21 liquid-metal checks;
- contrast on rendered pixels: 55 phone shots (Mono Noir and Light × 7 pages × 390/360 px,
  plus 27 variants: docked, Square/Rounded/Pill, underline, each glass mode, metal live / CSS /
  reduced / all targets, the More panel ×3, and a solid white or black block right behind the
  bar in every preset and at tint 20 %): 9,977 text runs, 0 below AA, 0 console errors. The
  metal label measured ≥ 17:1 at its brightest pixels over 6 frames;
- desktop 1440 vs 6b7ecb6 (transitions off, 42 shots): identical except Settings mid/end
  (the new Roundness, Liquid metal and Navigation rows);
- docked bar at 390 vs 6b7ecb6 (36 shots, every page but Settings): identical;
- transition frames: the bar, its glass and the metal pill stay on screen in every frame.

Phase 3 (same date):
- lint and typecheck clean;
- 61/61 settings checks and 57/57 navigation checks;
- contrast: 42 shots (Mono Noir and Light, every page at 1440 px, at 390 px, and at 390 px
  with "More" open) with 0 console errors. The only flags were the phone chart label, fixed
  with a halo, then re-measured at 0.
- transition frames: the disc starts exactly at the press point (desktop and phone), the
  fallback/wash overlays fully cover the page mid-way, and reduced motion is a 160 ms crossfade.
- desktop vs `main`, 84 deterministic shots: identical except Settings (the new Navigation
  section) and ≤ 6/255 glass shimmer in a few header strips. With transitions off, 24/24 were
  identical to `main`, so that shimmer is post-View-Transition rendering residue (see trap 20).

Earlier, at the end of phase 2: 78/78 matrix shots, 17,890 text runs, 0 below AA.

## 12. Traps already hit (don't rediscover them)

1. **ShaderGradient vs. three ≥ 0.183/0.187.** See hard rule 1.
2. **html2canvas parsing:**
   - no `color-mix()` or other modern colour functions;
   - no checkbox tick drawn with `::after { content: '' }` (use the `--tick` background image).
   - Test the liquid mode after any CSS change: `matrix.cjs … only glass-liquid:today:1440`.
3. **Fontsource exports map.** `import '@fontsource-variable/big-shoulders-display/index.css'`
   resolves to `index.css.css` and 500s in Vite. Import the bare package name (typed by
   `src/fonts.d.ts`). Atkinson Next still imports `index.css` and `wght-italic.css` explicitly.
4. **ResizeObserver loops.** Observers that change layout (GiantTitle, TrendChart, the nav) only
   react to width changes, and do their work in `requestAnimationFrame`. Otherwise Chromium logs
   "ResizeObserver loop completed with undelivered notifications".
5. **GiantTitle fitting.** `.fit` must be `inline-block`; a block element's `scrollWidth` is never
   smaller than its box. Refit on `document.fonts.ready` and `loadingdone`.
6. **Sticky header and `display: contents`.** When `.tb-right` becomes `display: contents`, its
   children lose its z-index, so `.tb-nav` and `.tb-gear` need `position: relative; z-index: 1`.
   Otherwise the header glass layer covers the nav.
7. **Web fonts move things without events.** Late-loading fonts widen the nav without resizing
   it or firing scroll. That's why `Header.tsx` observes each `.nav-link` and listens to
   `document.fonts` `loadingdone`.
8. **Vite dev server serving an empty stylesheet.** Once, HMR caught a CSS file mid-write and
   cached it empty: the whole HUD went unstyled while the file on disk was fine. If styles
   vanish in dev, restart `npm run dev`. Final checks run on `vite preview`.
9. **Undefined CSS variables fail silently.** A leftover `var(--haze)` made module-less blocks
   transparent. Grep for `var(--` names that nothing defines after refactors.
10. **Text over the hatched "classes" pattern** needs a solid backing (`background: var(--bg)`,
    or `--raised`) to stay AA.
11. **Lazy-page timing in tests.** Wait for conditions (`waitForFunction`), not fixed timeouts.
    Focus returns on the next animation frame.
12. **Shell tip for sandboxed sessions:** `pkill -f <pattern>` can match and kill the calling
    shell itself. Kill by PID instead.
13. **View Transitions swallow taps.** In Chromium 153 every tap during a transition targets
    `<html>`, even with `::view-transition { pointer-events: none }`. Skip the transition on
    `pointerdown` and replay the click after `vt.finished`; one rAF is not enough.
14. **A named full-screen layer paints over the page during a transition.** All named groups
    sit above the root group, so the background and grid must not get a
    `view-transition-name`.
15. **Back/forward fires popstate *and* hashchange.** Handling both started two transitions,
    and the skipped one deleted the live one's flag. Hence the `target` echo guard and the
    `vtSeq` id.
16. **`--frame-bottom` is a `calc()` now.** `getComputedStyle().getPropertyValue('--frame-bottom')`
    returns the expression, not pixels. Measure the `.hud-frame` element instead, as
    `matrix.cjs` does.
17. **Programmatic focus on `<h1>` shows a focus ring** in headless Chromium (no prior pointer
    input). `.main h1[tabindex='-1']:focus { outline: none }`.
18. **Tests that read the DOM right after a hash change** now race the transition (the swap
    happens a frame or more later). Wait for the condition.
19. **Swipe timing:** measure with event `timeStamp`, not `performance.now()` in the handler.
    A busy main thread otherwise turns flicks into pans (it also broke CDP-driven tests).
20. **Glass shimmer after a View Transition:** on pages reached by an in-app navigation, the
    refracting header glass can differ from `main` by up to 18 of 765 summed RGB (≤ 6/255 per
    channel). It varies run to run, and it disappears with `nav.transition: none` (24/24
    identical to `main`), so it's leftover rendering state after the transition, not a style
    change. `main` against itself is 24/24 identical. `desktop-diff.cjs` prints the max Δ, and
    `EXTRA='{"nav.transition":"none"}'` isolates this.
21. **On phones, anything wider than the screen widens the whole page.** Mobile browsers then
    widen the layout viewport, which stretches the fixed tab bar past the edge (this hid "More"
    on the Sunday check).
    - Use `minmax(0, 1fr)` grid tracks, not `1fr`.
    - Cap SVGs that have a width attribute (`max-width: 100%`).
    - Let wide tables scroll inside their card.
    - `<html>` clips `overflow-x` while the tab bar is on, as a safety net. `nav-e2e.cjs` checks
      every page fits 390 px.
22. **Playwright `isMobile` matters.** Without it, overflow only adds a scrollbar and the trap
    above stays hidden. Phone checks use `isMobile` + `hasTouch` + the CDP safe-area override.
23. **Lightning CSS drops `backdrop-filter`.** Vite's minifier keeps only the `-webkit-` copy
    when a rule says `backdrop-filter: X; -webkit-backdrop-filter: X` (in that order) and X
    uses `var()`. Chromium ignores the prefixed one, so the blur silently vanished in
    production while `npm run dev` looked fine. Write the unprefixed property only; the build
    adds the prefix (hard rule 16). Check with `grep -o '[^}]*backdrop-filter[^}]*}'
    dist/assets/*.css`.
24. **`.btn > :not(.lg-layer, .lm)` makes children `position: relative`.** A new absolutely
    positioned layer inside `.btn` must be excluded there, or it collapses to 0×0 (the metal
    rim did, which would have been an empty button).
25. **Paper Shaders injects a `<style>` into `<head>`** unless `style[data-paper-shader]` exists
    somewhere. The empty one in index.html must stay; its rules are in metal.css. The library
    also puts `data-paper-shader` and a `paperShaderMount` property on the rim element (tests use
    `rim.paperShaderMount.getCurrentFrame()`; the speed is `.lm[data-speed]`, because the
    library's own speed stays 0).
28. **Software WebGL makes a running shader expensive in tests.** With the shader at 60 fps,
    CDP touch events slowed enough (~850 ms for a 3-step flick) that the swipe test read as a
    pan. The 30 fps shared ticker helped, and the test now flicks in two moves; keep animated
    canvases capped.
26. **Shader budget in tests:** floating buttons outrank primary buttons, so on a desktop page
    with all targets on, scrolling (which shows back-to-top) moves both canvases to the floating
    buttons. And a real click on Start starts the block (the button disappears); hover/press
    tests dispatch pointer events instead.
27. **Long tab labels overflow their column** ("Resources", or "Absences" at 320–360 px). The
    highlight reads `--tab-label-w` and grows past the column; otherwise the metal pill's light
    label lands on the bright rim (it measured 2.1:1 before the fix).

## 13. Decisions taken (and why)

**Phase 2 (look and settings):**

- Display fonts: Sofia Sans Extra Condensed (default), Antonio, Big Shoulders Display. Title:
  Unbounded. Labels: Atkinson Hyperlegible Mono. Bricolage Grotesque (phase 1) removed.
- Neutral identity: wordmark `P2.Daily.Plan`, monogram `T3` (hidden on phones).
- A preset is a bundle (colours plus mode, radius, background, glass, grid, orb style), applied
  with Undo. Custom colours reset to the preset's own (`null`) when a preset is picked.
- The default background is the dithered sphere. When the background is `dither`, the sphere is
  also the hero art.
- Progress Export/Import moved to Settings → Data and the drawer. Behaviour and format are
  unchanged.
- Non-Today pages are lazy, to keep the first load near 100 kB.
- The animated gradient renders at 1× DPR by default.
- The phone nav uses short labels and scrolls sideways, with edge fades.

**Phase 3 (navigation):**
- The default transition is Disc reveal, matched to the reference video (a wallpaper "grow"
  transition): strong ease-in-out, soft edge, no dimming. 650 ms by default; 1000 ms matches
  the video.
- Wash uses an accent tint (24 % accent over bg), not the raw accent: a near-white disc in
  Mono Noir would flash.
- Default tabs: Today, Week, Plan, Absences. Absences is always a tab by default. The picker
  allows moving it to More, and shows a note when it's there.
- On phones the top gear opens Quick settings, and Settings lives in More.
- The keyboard rule is focus-based: the bar hides while any text field has focus.
- Swipe order is the tabs, then the More pages except Settings.
- The page heading takes focus after navigation with no visible ring; the announcer also
  speaks.

**Phase 4 (floating bar, roundness, liquid metal):**
- The floating bar is phones-only (≤ 640 px), like the tab bar; the top bar is unchanged.
  "Phones and desktop" for the metal pill was read as: wherever that pill exists, which
  includes desktop windows narrower than 641 px. At 1440 px nothing changes at defaults.
- Docked = the phase-3 bar exactly (verified pixel-identical), so its highlight setting
  doesn't apply; the pill/underline choice is for the floating bar.
- With "Link all to master" on, the floating bar stays a pill (the spec's default), and every
  other group follows the master. The master radius default stays 0, so the app looks the same.
- Pill = 28 px master plus fully round buttons, chips and fields; multi-line fields cap at 16 px;
  checkboxes cap at 6 px (a round checkbox reads as a radio).
- Bar contrast: labels use `--ink` (not `--ink-2`), which lets the tint stay near 55–67 % while
  keeping AA over pure white/black. A higher setting is kept.
- The metal fill is opaque dark in both colour modes (a light label on it is AA by
  construction); in Light it reads as a dark selected chip.
- `@paper-design/shaders` 0.0.81 rather than 0.0.82: the newest release then was ten days old.
- The shader-only metal settings are shown but switched off (`inert`) without WebGL 2, with a
  note; enable, apply-to and tint stay usable because the CSS rim honours them.
- The Lightning CSS blur bug (trap 23) is fixed for the new bar in its own commits; the older
  rules (frosted-blur header/buttons and glass cards) are fixed in a separate, last commit
  ("Fix frosted blur dropped by the CSS minifier") so it can be dropped if the unblurred look is
  preferred. With it, glass cards really blur in production: 34 of 42 desktop shots change
  slightly (the grid no longer shows through cards), all still AA.

## 14. History

- **Phase 1:** built the app from the plan with the original stack (ShaderGradient background,
  glass cards, an r3f orb, localStorage plus JSON backup, six pages, README, GitHub Pages
  workflow). Debug options were URL params (`?glass ?bg ?fps ?date ?time`).
- **Phase 2:**
  - Restyled everything into the monochrome HUD language, with the dotted orb and the dither
    sphere.
  - Replaced every URL param with the schema-driven Settings page and quick drawer.
  - Added the contrast guard, settings export/import/migration and cross-tab sync.
  - Built the verification tools.
  - Final fixes: removed `color-mix` for html2canvas; made the phone nav keep the current page
    in view.
- **Phase 3 (branch `feat/mobile-nav-transition`):**
  - phone tab bar plus "More" sheet;
  - one navigation layer with scroll restore, focus and announcements;
  - disc page transitions (View Transitions with an overlay fallback);
  - the Navigation settings section (45 keys in all);
  - safe-area tokens;
  - verification scripts for navigation, transitions and desktop before/after.
- **Phase 4 (same branch, on top of 6b7ecb6):**
  - roundness tokens for every corner, Appearance → Roundness (presets, link, six group
    overrides), settings v2 migration;
  - the floating glass tab bar with a sliding highlight, auto-AA tint, solid fallbacks, the
    floating "More" panel, hide on scroll, five Navigation settings;
  - `<LiquidMetalSurface>` with `@paper-design/shaders` (lazy), its budget and fallbacks, and
    Appearance → Liquid metal (64 keys in all);
  - help text, the contrast guard and settings file I/O moved to lazy chunks;
  - `metal-e2e.cjs`, `bundle-size.cjs`, matrix `phone`/`variants` modes.

## 15. Known limits

See README "Limits":
- frame rate on real GPUs is unverified;
- refraction is Chromium-only;
- liquid-glass-js goes stale;
- the contrast guard checks colour pairs, not every pixel of an animated gradient;
- the header orb loads three.js on phones;
- exam items have start times only;
- absence limits start empty.

- page transitions and safe areas are verified only in headless Chromium (Safari and Firefox
  untested); the disc mask repaints each frame (GPU, not pure compositing);
- a tap during a transition lands a frame late (skip + replay);
- the floating bar's blur and the metal shader are unverified on real phones (GPU cost,
  battery, smoothness) and in Safari/Firefox; only 1 shader canvas runs on phones.

Not yet built: installable PWA (manifest, icons, offline service worker) and any
sync between devices (data is per browser, moved by export/import).

## 16. How previous requests were run

These worked well for this project; reuse them unless told otherwise:
- Read the repo and this file first, and post a short plan.
- Don't ask questions unless blocked; make reasonable calls and list them at the end.
- Implement in stages.
- Verify with evidence (section 11), on the production build, at 1440 and 390 px.
- Keep the README honest: user-facing, with a real Limits section.
- Finish with a short summary: what changed, what was verified, what couldn't be verified.

## 17. Claude artifact version and cloud sync (phase 5, 2026-11-01)

The same build also runs as a published Claude artifact (claude.ai/artifact/Ayog4epS7EHmMjXBXoF9qD),
where it syncs across devices and Claude can read and write it.

- `src/lib/cloud.ts`: `startCloud()` (called in `main.tsx`) asks `window.claude.use('db')`. Outside
  the artifact it resolves null and the app is local-only, exactly as before. Inside, progress is
  mirrored to documents: `days/<date>` {blocks, classes?, firstTask?, badDay?, badDaySteps},
  `meta/core` {doFirst, absences, checkpointScores}, `checks/<weekOf>`. The `study-dashboard:v1`
  key is still written as the offline cache (hard rule 3 holds). Local edits are debounced (600 ms)
  and written one document at a time; unsaved edits are kept on top of incoming snapshots. On the
  first run with an empty store, this browser's progress is uploaded.
- `src/lib/extras.ts`: tasks, user resources and "From Claude" notes, one document each
  (`tasks/<id>`, `resources/<id>`, `nudges/<id>`), coerced on read because Claude writes them too.
  Outside the artifact they live under `study-dashboard:extras:v1`.
- `src/components/Extras.tsx`: Tasks and From Claude cards (Today), Your resources (Resources),
  the sync line (Settings → Data) and the sync notice.
- `src/lib/saveFile.ts`: exports go through the `downloads` capability in the artifact (pages
  can't start downloads there), a link click elsewhere.
- Publishing: `npm run build`, then publish `dist/assets/*` as supporting files and a body-only
  index (title, the script/modulepreload/stylesheet tags, the empty `style[data-paper-shader]`,
  `#root`). Escape any U+FFFD in JS chunks (GradientScene has two) or the publish is refused.
  Capabilities: `db` with rule `{path: "", read: "admin", write: "admin"}` (owner only) and
  `downloads`.
- First-load JS is now 106.6 kB gz (+3.4 kB for sync, tasks and resources).
