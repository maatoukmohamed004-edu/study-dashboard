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

On phones (≤ 640 px) navigation is a bottom tab bar (four tabs + "More" sheet), and changing
page plays a disc transition everywhere. See §7a.

## 2. Hard rules: do not break these

1. **`three` stays at `~0.182.x`.** `@shadergradient/react` 2.4.20 crashes on three 0.187
   (`Can not resolve #include <cube_uv_reflection_fragment>`), and 0.183+ logs a Clock
   deprecation warning through fiber. `@types/three` matches. (`^0.182.0` in package.json is
   the same range as `~0.182.0` for a 0.x version.)
2. **three.js, ShaderGradient and html2canvas stay in lazy chunks.** The first-load JS must
   stay near **100 kB gzipped**. It is currently about 103 kB: an 80 kB entry chunk plus the
   preloaded `theme`, `env` and `jsx-runtime` chunks. It was 99 kB before the navigation layer
   and transitions were added. CSS is about 18 kB.
   - Lazy: every page except Today (through `src/pages/registry.ts`, preloaded when idle), the
     Settings UI, the quick drawer, the tab bar and the "More" sheet.
   - Measure the entry chunk plus every `<link rel="modulepreload">` in `dist/index.html`,
     not just `index-*.js`.
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
7. **No new runtime dependency unless unavoidable, and justify it.** The only additions in
   phase 2 were Fontsource font packages.
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
index.html                  theme-color meta, viewport-fit=cover (insets handled by --safe-* tokens), #root, favicon
vite.config.ts              base './', React plugin
.github/workflows/deploy.yml  push to main → npm ci, build → GitHub Pages (Source must be "GitHub Actions")
src/main.tsx                font imports, the 6 stylesheets, startTheme() BEFORE createRoot
src/fonts.d.ts              declare module '@fontsource-variable/*' (bare side-effect imports)
src/App.tsx                 shell: skip link, Background, HudChrome, Header, notices, PageHost,
                            .vt-layer (fallback transition overlay), route announcer, Caption,
                            FabStack, lazy TabBar + MoreSheet (phones), lazy QuickSettings, Toaster, FpsMeter

src/data/
  plan.ts                   THE study plan (single source of content); typed sections, see §5
  settings-schema.ts        THE settings schema (single source of settings); see §6
  presets.ts                5 presets × dark/light palettes, presetBundles, moduleHues (Midnight)

src/lib/
  store.ts                  progress store, key study-dashboard:v1 (useSyncExternalStore), export/import
  settings.ts               settings store, key study-dashboard:settings:v1: coerce, migrate, sync, import/export
  theme.ts                  resolve(settings, media) → Resolved; applyTheme() → CSS vars + data-*; contrast checks, autoFix
  capabilities.ts           caps {webgl, chromium}; live media store {phone, osReducedMotion, osDark, visible}
  env.ts                    now() (real or simulated clock), useNow/useToday/useSimulation, DPR cap, and the
                            NAVIGATION LAYER: hash routes, navigate(), link interception, press origin,
                            per-entry scroll restore, focus + announce, tap replay during transitions
  transition.ts             page transitions: View Transition disc reveal / crossfade, overlay disc
                            (wash, and the no-API fallback), reduced motion, skip-to-latest
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
  glass/GlassLayer.tsx      per-target glass: svg refraction | blur | liquid-glass-js | off
  glass/displacementMap.ts  generates the SVG displacement map
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

  nav/TabBar.tsx            phone tab bar (lazy): 4 tabs + More, re-tap to top, keyboard watch, swipe
  nav/MoreSheet.tsx         "More" bottom sheet (lazy): modal, focus trap, Esc/backdrop/swipe-down close
  nav/pages.ts              PAGE_META (label, short label, icon per page), morePages(), swipeOrder()

src/pages/                  TodayPage (eager), Week, Plan, Resources, Absences, Check, Settings (lazy)
  registry.ts               page loaders, preloadPage() / preloadAll(), loadedPage()
src/styles/
  base.css                  fallback tokens, type roles (.label/.display/.giant), spacing scale, focus, skip link, reduced motion
  hud.css                   background layers, HUD frame/corners/grid/mats, top bar, nav, glass layers, banner, drawer, toast, responsive top bar
  components.css            buttons, fields, checkbox, segmented, tags, badges, status strip, hero, progress line, meta, cards, tables
  pages.css                 per-page layouts, settings page (incl. the tab picker), dither stand-in
  nav.css                   phone tab bar, "More" sheet, keyboard-open rule, phone --frame-bottom
  transitions.css           @property --vt-r, chrome view-transition-names, the disc mask, overlay layer

tools/verify/               headless-Chromium checks (dev only, not shipped): see §11
  matrix.cjs                screenshots + pixel contrast (phones: safe-area insets; ":sheet" opens More)
  settings-e2e.cjs          61 settings checks
  nav-e2e.cjs               tab bar, More sheet, focus, scroll restore, keyboard, swipe, transition settings
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
| `key`, `section`, `label`, `description` | Identity and the text shown in the UI |
| `control` | `segmented`, `select`, `toggle`, `range` (min/max/step/unit), `color` (swatches + hex, `null` = use the preset's colour), `checkboxes`, `date`, `time`, or `tabs` (exactly `count` distinct options in order; each slot is a select and picking a used option swaps) |
| `default` | Default value |
| `dependsOn: {key, is}` | Hidden when the condition isn't met |
| `requires: 'webgl' \| 'chromium'` | On the setting or on individual options; unmet options show "(needs …)" |
| `quick` / `quickLabel` | Appears in the drawer |
| `apply` | A bundle patch applied on change; presets use it |

The object is checked with `satisfies { [K in SettingKey]: SettingDef<K> }`.

**All 45 keys:**
- `appearance.`: preset, colorMode, accent, background, textSize (90–120), density, radius
  (0–20, default 0), monoUppercase, displayFont
- `background.`: type (solid / gradient / dots / animated / dither, **default `dither`**),
  color1–3, speed, grain, quality (auto / low / high), pauseHidden (default on), allow3dPhone
  (default off)
- `glass.`: mode (off / blur / refraction / liquid, **default `refraction`**), blur, refraction,
  tint, saturation, edge, applyTo (header / cards / buttons)
- `hud.`: frame, corners, grid, caption, orb, orbStyle (dotted / liquid)
- `nav.`: transition (reveal / wash / fade / none, **default `reveal`**), duration (300–1200 ms,
  default 650), softness (0–100 %, default 35), origin (press / center), bottomBar (default on),
  labels (default on), swipe (default off), tabs (exactly 4 `NavPage`s, default
  today/week/plan/absences)
- `motion.`: mode (auto / reduced / full), speed
- `sim.`: enabled, date, time
- `diag.`: fps

The six quick keys are preset, colorMode, accent, background.type, glass.mode and motion.mode.

**Adding a setting:**
1. Add the key to `Settings` and an entry to `schema`. The page and drawer pick it up.
2. Consume it in one of two ways:
   - Map it in `applyTheme()` to a CSS variable or `data-*` attribute, then style it in CSS.
     Prefer this for visual settings.
   - Read it with `useSetting('key')` in a component.
3. If it needs WebGL or Chromium, add `requires`, and handle the fallback in `resolve()`.
4. Add it to `tools/verify/settings-e2e.cjs`.

**Store** (`lib/settings.ts`, `useSyncExternalStore`):
- **Format:** `{ version: 1, values: {...} }` under `study-dashboard:settings:v1`.
- **Load:** goes through `migrations` (v0 = a bare values map), then `coerce()` per key. An
  invalid value falls back to its own default, never the whole file.
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
  colorMode, radius, background type, glass mode and tint, grid, and orb style. colorMode then
  picks the preset's dark or light palette.
- Only Midnight colours modules (`moduleHues`); the others use `ink2`.

**Resolution** (`lib/theme.ts`): `resolve(settings, media)` returns what is actually used:
- **mode** and **palette**, including derived `raised`, `desk`, `line`, `lineStrong` and
  `accentInk`.
- **reducedMotion:** the auto mode follows the OS.
- **glass engine:** `off | blur | svg | liquid`.
  - `svg` (refraction) needs Chromium; otherwise it falls back to `blur`.
  - `liquid` needs WebGL; otherwise it falls back to `svg` or `blur`.
  - A `glassNote` explains any downgrade, and `glassOn` holds the per-target flags.
- **background type in use:**
  - `animated` falls back to the static `gradient` on phones (unless allow3dPhone is on),
    without WebGL, or with reduced motion.
  - `dither` becomes a static stand-in without WebGL and holds still under reduced motion.
  - Also resolves `bgPaused` (tab hidden and pauseHidden on) and quality.
- **contrast:** `contrastChecks()` lists ink, ink2 (on bg and raised), accent on bg, text on
  accent, plus ink2 over the gradient's worst spot and on glass when a gradient is in use.
  `autoFix()` binary-searches the fewest colour changes to reach AA.

## 7. Theming and visual language

**Application.** `applyTheme()` writes CSS custom properties and `data-*` attributes on `<html>`.
It runs before the first render (`startTheme()` in `main.tsx`) and on every settings or media
change. Components rarely read settings directly; CSS keys off these.

- **Data attributes:** `data-mode` (dark/light), `data-preset`, `data-glass` (the *engine in
  use*: off/blur/svg/liquid, not the setting value), `data-glass-header|cards|buttons`,
  `data-motion` (reduced/full), `data-density`, `data-mono-case`, `data-frame`,
  `data-corners`, `data-grid`, `data-caption`, `data-bg` (the type in use).
- **Colour variables:** `--bg --raised --desk --ink --ink-2 --line --line-strong --accent
  --accent-ink --warn-ink --ok --warn --alarm --focus --g1..3 --dot --gridline`.
- **Precomputed mixes** (use these instead of `color-mix`, see hard rule 10): `--g1-a85 --g1-a50
  --g2-a85 --glass-tint-liquid --scrim --ink-wash --accent-wash --accent-tint --m-<id>-tint
  --m-<id>-line`. Need a new mix? Add it in `applyTheme()`.
- **Sizing and fonts:** `--text-scale` (html font-size), `--density` (0.72 or 1, scales
  `--s1..--s7` and `--control-h`), `--r-lg/md/sm` (radius), `--font-display`,
  `--display-weight`, `--display-tracking`.
- **Glass and motion:** `--glass-tint`, `--glass-tint-strong`, `--glass-blur`, `--glass-sat`,
  `--glass-edge`, `--glass-edge-soft`, `--grain`, `--motion-k` (0 when reduced, otherwise
  1/speed; multiplies `--dur`).
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
`<html data-tabbar>`).
- **Bar:**
  - fixed, `--tabbar-h` 64 px (56 px with labels off) plus `--safe-b`;
  - glass = the header's GlassLayer target;
  - z 46, above the mats.
- **Bottom of the frame:** `--frame-bottom` on phones with the bar = bar + inset + a 30 px
  caption strip. The floating buttons, toasts, drawer and `.shell` padding all key off it.
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

**More sheet** (`nav/MoreSheet.tsx`). A modal dialog:
- focus starts on the first link and is trapped;
- Esc, the backdrop, the close button or a drag down (> 90 px or > 0.6 px/ms) close it with
  `'dismiss'`, and App returns focus to the More button;
- choosing a page closes it with `'navigate'`, and the router focuses the heading;
- a drag that ends on a link does not click it.

**Safe areas.** `--safe-t/r/b/l` = `env(safe-area-inset-*, 0px)`. `--frame-t/-l/-r` and
`--frame-bottom` include them. All four are 0 on desktops, so desktop geometry is unchanged.

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
- Tab bar: labelled `<nav>`, targets ≥ 48 px, active tab = indicator bar + bold label +
  `aria-current` (never colour alone); labels off keeps accessible names.
- Toasts use `role=status`; the contrast summary is `aria-live`.
- The Week grid has a screen-reader list version.
- Status is never colour-only: icons and words too.
- Reduced motion is respected via `data-motion='reduced'` (`--motion-k: 0`, 3D held still).

## 11. Verifying a change: do this before calling it done

1. `npm run lint`, then `npm run build`: no errors. Check the first-load JS (hard rule 2).
2. Serve the **production build**: `npm run preview -- --port 5173 --strictPort`. Prefer it to
   the dev server for screenshots (see trap 8 in §12).
3. One-time setup for the checks: `npm i --no-save playwright pngjs && npx playwright install
   chromium`.
4. `node tools/verify/settings-e2e.cjs` runs 61 checks: every control applies live without a
   reload, persistence, cross-tab sync, export/import, corrupt and partial imports, migration,
   reset with undo, the drawer, blocked storage, the progress key untouched, no console errors.
5. `node tools/verify/matrix.cjs verify-out/matrix all` takes 78 screenshots (5 presets × 7
   pages × 1440/390 px, plus 4 glass modes × 2 widths). It measures every visible text run
   against the **rendered** background pixels and flags anything below AA, plus any console
   errors. Use `only mono-noir:today:390 glass-liquid:today:1440 …` for a subset.
   `python3 tools/verify/sheets.py verify-out/matrix verify-out/sheets` makes contact sheets.
6. Look at the screenshots. The numbers don't catch layout breakage.

**Notes on the checks:**
- They run headless Chromium with SwiftShader, which is fine for correctness but says nothing
  about frame rate.
- Before each screenshot, the matrix fakes a hidden tab so the 3D loops pause; software
  rendering of the animated gradient under many blurred cards is otherwise too slow to capture.
- The measurement only counts text inside the HUD frame window, skips text covered by the
  sticky header (via `elementFromPoint`), and ignores the outer 2 px of each line box.
- All tests run with simulated time Wed 2026-11-18 14:40 and the progress seed in
  `tools/verify/seed.json`.

**Last full verification (2026-10-31, final phase-2 build):**
- lint and typecheck clean;
- 61/61 settings checks;
- 78/78 screenshots with 0 text runs below AA (17,890 measured) and 0 console errors.

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
20. **Glass rendering noise:** refraction/blur over the same page can differ by a few levels
    between runs (max Δ ≈ 18 of 765 summed RGB in the header strip). `desktop-diff.cjs`
    prints max Δ; compare against a second run of the same build before calling something a
    change.

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
- a tap during a transition lands a frame late (skip + replay).

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
