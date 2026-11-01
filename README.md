# Study dashboard

A personal dashboard for the **P2 Daily Plan (Top 3)**. All plan content comes from one file,
[`src/data/plan.ts`](src/data/plan.ts). Your progress and your settings are saved in this
browser only. There is no server and no account.

| Page | What it does |
| --- | --- |
| **Today** | Detects the weekday. Shows a "3 / 7 BLOCKS" hero with a progress hairline and a DONE / NEXT block, then the day's classes and study blocks as a checklist. **Start** records how many minutes late you began. Also holds tomorrow's first task, the 40-minute bad-day minimum, and "Do these first". |
| **Week** | Monday–Sunday timetable. Classes are hatched, study blocks solid, blocks that start in a later ramp-up week dashed, fixed dates outlined. Phones get a day-by-day list. |
| **Plan** | The week-by-week table as a vertical timeline with the current week highlighted. Checkpoints 1 and 2 have score fields that tell you what to change. Also the rules, bad days and exam mode. |
| **Resources** | One card per module, filterable by module (the filter stays in the URL, e.g. `#/resources/micro`). Links open in a new tab. |
| **Absences** | A counter and an editable limit per module. Amber one absence before the limit, red at it, always with an icon and words as well as colour. |
| **Sunday check** | The three numbers, with trend charts against their targets. z is computed as shown below. |
| **Settings** | Theme, background, glass, HUD, navigation, motion, simulated time and data. See [Settings](#settings). |

```math
z = \frac{\text{your grade} - \text{class mean}}{\text{class standard deviation}}
```

**On a phone** (640 px wide or less), navigation sits in a tab bar at the bottom of the screen,
within thumb reach: **Today, Week, Plan, Absences**, plus **More** for Resources, Sunday check and
Settings.
- The bar floats: a frosted-glass pill inset from the edges, with the page scrolling behind
  and around it. The current tab sits on a highlight that slides between tabs, with a thin
  animated chrome rim (**Liquid metal**).
- **More** opens as a floating glass panel just above the bar.
- Tap the current tab again to jump back to the top. The gear in the top bar opens Quick
  settings.
- The bar hides while you type in a field, so it never covers the field or floats above the
  keyboard.
- In **Settings → Navigation** you can pick the four tabs, dock the bar to the bottom edge as
  before, change its margins, switch the highlight to an underline, hide the bar while
  scrolling down, hide the labels, turn on swiping between pages, or go back to the scrolling
  top bar.

**Changing page** plays a short animation: the new page opens inside a soft-edged disc that grows
from where you pressed or clicked. With the keyboard it grows from the link you activated.
Other styles, or none, are in Settings → Navigation.

## Run it

You need Node 20.19+ or 22.12+.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ locally
npm run lint         # oxlint
```

**Try it on your phone over Wi-Fi:** run `npm run dev -- --host`, then open the "Network" address
it prints (for example `http://192.168.1.20:5173/`) on a phone connected to the same Wi-Fi. If
it doesn't load, your computer's firewall may be blocking port 5173. Progress saved at that
address is separate from the deployed site's.

Changing the code? Read [`CLAUDE.md`](CLAUDE.md) first: it covers how the app is put together,
the rules that must not break, known traps, and the screenshot and settings checks in
`tools/verify/`.

## Settings

Open **Settings** with the gear in the top bar (`#/settings`), or jump to one section with
`#/settings/appearance`, `…/background`, `…/glass`, `…/hud`, `…/navigation`, `…/motion`, `…/diagnostics` or
`…/data`. The square sliders button in the bottom-right corner opens **Quick settings**, a
drawer with the six most-used controls: preset, color mode, accent, background, glass and
motion. Every change applies at once, with no reload.

| Section | Controls |
| --- | --- |
| **Appearance** | Preset (Mono Noir, Midnight, Graphite, High contrast, Light) · color mode (dark / light / system) · accent and background colour (swatches or hex; "Preset" uses the preset's own) · text size 90–120% · density · uppercase mono labels · display font (Sofia Sans Extra Condensed, Antonio, Big Shoulders Display) · **Roundness:** Square 0 / Soft 8 / Rounded 16 / Very round 28 / Pill, the master corner radius 0–40 px (0 by default), and "Link all to master" (on). Turn it off to set the navigation bar, cards & panels, buttons & chips, inputs, sheets & dialogs and the HUD frame separately · **Liquid metal:** on/off, apply to the selected tab (on), primary buttons (Start, Export, Import) and floating buttons (both off), tint (silver / warm / cool / accent), idle and hover speed, static |
| **Background** | Type: solid, static gradient, dot grid, animated gradient (ShaderGradient) or dithered sphere (with a lens that follows your cursor) · three gradient colours · speed · grain · quality (auto / low / high) · pause when the tab is hidden · allow 3D on phones (off by default) |
| **Glass** | Mode: off, frosted blur, refraction, or experimental liquid-glass-js · blur · refraction strength · tint opacity · saturation · edge highlight · apply to header / navigation bar / cards / buttons. A note shows the mode actually in use if your browser can't do the one you picked. |
| **HUD & layout** | Frame, corner brackets, grid, bottom caption, header orb and its style (dotted / liquid) |
| **Navigation** | Page transition: **Disc reveal** (default), **Disc wash** (an accent-tinted disc covers the page, the page changes underneath, the disc fades), Crossfade or None · duration 300–1200 ms (650 by default, scaled by animation speed) · edge softness · where the disc starts (press point or screen centre) · tab bar on phones · tab bar style (floating, default, or docked) · side margin 0–32 px (16) · bottom gap 0–32 px (12, added to the home-indicator space) · current tab: pill or underline · hide while scrolling down (off) · tab labels · swipe between pages (off by default) · which four pages get a tab, in order (always exactly four; the rest go to More) |
| **Motion** | Auto (follows your device), reduced or full · animation speed. Reduced motion turns page transitions into a short crossfade. |
| **Simulation & diagnostics** | Simulated date and time. Every page behaves as if it were that moment, and a banner with **Back to real time** stays on screen. Also an FPS counter and what this browser supports. |
| **Data** | Export or import settings (`study-dashboard-settings-YYYY-MM-DD.json`) · export or import progress (unchanged, see [Your data](#your-data)) · reset all settings. Each section also has **Reset section**. Every reset, import and preset change offers **Undo**. |

**Contrast check.** Appearance shows the WCAG ratio of every colour pair in use: text,
secondary text and accent on the background, text on accent buttons and, with gradient
backgrounds, text over the gradient and on glass. A warning appears below AA, and **Fix
automatically** changes the fewest colours needed to pass (with undo).

**How settings are stored.**
- Settings live under `study-dashboard:settings:v1` as `{ version, values }` (version 2 now).
- Each value is checked on its own against the schema, so a bad value in a saved or imported
  file falls back to its default without discarding the rest. Older files are migrated by
  version: new keys get their defaults, a saved corner radius keeps its value and picks the
  matching roundness preset, and glass that was on for the header stays on for the new
  navigation bar.
- If the browser blocks storage, settings still work for the session and a notice says so.
- Open tabs stay in sync.
- An import that isn't a settings file, including a progress backup or broken JSON, is
  rejected and nothing changes.

**Adding a setting.** Add one entry to [`src/data/settings-schema.ts`](src/data/settings-schema.ts)
with key, section, optional `group` (a sub-heading), label, control (`segmented`, `select`,
`toggle`, `range`, `color`, `checkboxes`, `date`, `time`, `tabs`), default, min/max/step,
`dependsOn` and `requires` (`webgl`, `webgl2` or `chromium`). Put its help text in
[`src/data/settings-text.ts`](src/data/settings-text.ts), which loads with the Settings page
rather than at startup. The Settings page and drawer are generated from that list. Read the
value in a component with `useSetting('your.key')`, or map it to a CSS variable or `data-*`
attribute in `applyTheme()` in [`src/lib/theme.ts`](src/lib/theme.ts).

## Edit your plan

Everything is in `src/data/plan.ts`, with typed sections in the same order as the plan:
`modules`, `goal`, `doFirst`, `week` (the 7-day template), `weeks` (week by week), `fixedDates`,
`checkpoints`, `rules`, `badDay`, `examMode`, `sundayCheck`, `resources`.

- Dates are `YYYY-MM-DD` and times are `HH:MM`.
- Text supports `[label](url)`, `*italic*` and `**bold**`. Links starting with `#/` stay in the app.
- **Exam dates:** the plan says "around 07/01: confirm the dates". When you know them, edit
  `fixedDates`.
- Block `id`s are what your progress is saved under, so keep them stable.

## Your data

- Progress lives in `localStorage` under `study-dashboard:v1`, separately from settings and
  never touched by them. **Export progress** and **Import progress** are in Settings → Data
  and in the Quick settings drawer. They work exactly as before, and the file format is
  unchanged.
- Every read and write is wrapped in `try/catch`. If saved data is ever unreadable, the app
  starts empty and keeps the old copy under a `…:unreadable-…` key instead of overwriting it.
- The deployed site and `localhost` have separate storage. Use the export and import buttons
  to move data between them.

## Deploy to GitHub Pages

The build uses relative paths and hash routes, so it works at
`https://<user>.github.io/<any-repo-name>/` with no extra configuration.

1. Push this folder to a GitHub repository, with `main` as the default branch.
2. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
3. Push to `main`, or run the workflow by hand from the **Actions** tab.
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs `npm ci && npm run build`
   and publishes `dist/`.
4. The site appears at `https://<user>.github.io/<repo>/`.

Without Actions: `npm run build && npx gh-pages -d dist`, then set Pages to the `gh-pages` branch.

## How it's built

- **Vite 8, React 19, TypeScript** (strict). Schedule logic is in `src/lib/schedule.ts`.
- **Navigation:** one navigation layer in `src/lib/env.ts` handles every in-app link (`#/…` hash
  routes). It records where you pressed, adds a history entry, restores your scroll position
  on back/forward, then moves focus to the new page's heading and announces the page.
  Pages are separate chunks, preloaded when the browser is idle, so a transition never waits
  on a download or shows "Loading".
- **Page transitions** (`src/lib/transition.ts`, `src/styles/transitions.css`):
  - **Disc reveal** uses the View Transitions API. The new page's snapshot is masked by a
    radial gradient whose radius (a registered `@property`) grows to the farthest corner of the
    screen. The timing follows the reference video: curve `cubic-bezier(.54, 0, .34, .99)` with
    a feathered edge, and the old page does not dim.
  - The header, tab bar, HUD frame and caption are captured separately and stay put, so
    only the page content changes.
  - Browsers without View Transitions get a page-coloured disc that covers the old page and
    fades off the new one. **Disc wash** uses an accent-tinted version of that disc everywhere.
  - Only transform and opacity animate in the fallbacks. A tap during a transition jumps to its
    end and goes to the newest target.
- **Look:** near-black and monochrome with one accent, inside a HUD. The HUD has a double
  hairline frame, corner brackets, a faint grid, a three-column top bar (wordmark, monogram,
  navigation) and a fixed bottom-left caption. Every page follows the same layout: status
  strip, bracket tag, condensed hero number, partly filled hairline, two-column meta block,
  and one huge extended title.
- **Settings plumbing:** components read settings through `useSettings()` / `useSetting()`
  (`useSyncExternalStore`). `applyTheme()` writes CSS custom properties and `data-*`
  attributes on `<html>` before the first render. No component reads URL parameters.
- **Fonts** (open source, self-hosted through Fontsource):
  - Body: Atkinson Hyperlegible Next.
  - Labels: Atkinson Hyperlegible Mono.
  - Display: Sofia Sans Extra Condensed, Antonio or Big Shoulders Display. Only the one in
    use is downloaded.
  - Page titles: Unbounded.
- **Glass:** cards use CSS `backdrop-filter`. The header, the phone tab bar and main buttons
  can also refract: a generated SVG displacement map bends what's behind near the rim. The map
  is built from the surface's real size and computed corners, so it follows roundness changes,
  resizes and rotation. liquid-glass-js stays vendored in `src/vendor/liquid-glass-js/` (MIT,
  unchanged) as the experimental mode.
- **Roundness:** every corner comes from CSS variables (`--radius-xs/s/m/l/xl/full` and one
  per group: `--radius-card`, `--radius-btn`, `--radius-input`, `--radius-sheet`,
  `--radius-hud`, `--radius-nav`, …) that `applyTheme()` derives from the master radius.
  Nested surfaces use their parent's radius minus its padding. A rounded HUD frame gets
  masked corner fillers so the desk around it stays solid. Circles stay circles.
- **Floating tab bar:** its tint opacity is raised automatically to the lowest value that keeps
  the labels and icons at WCAG AA over pure white (dark modes) or pure black (light), however
  the glass is set. It turns solid when the browser has no `backdrop-filter`, when Background
  quality is Low, or when the device asks for reduced transparency.
- **Liquid metal** (`src/components/metal/`): the chrome rim is the liquid-metal shader from
  [Paper Shaders](https://shaders.paper.design) (`@paper-design/shaders`), loaded in its own
  lazy chunk (about 10 kB gzipped) only when a metal surface is on screen.
  - At most two shader canvases run at once (one on phones), by priority: selected tab, then
    floating buttons, then primary buttons. The rest show a still CSS metallic rim, which is
    also the fallback without WebGL 2, at Background quality Low, or if the shader fails.
  - Canvases pause off-screen, while the tab is hidden and during page transitions. Their
    resolution is capped at 1.5×.
  - Static and reduced motion show one still frame. Labels sit on an opaque dark fill, so
    they stay readable whatever the rim does.
- **3D**, all lazy-loaded with a CSS stand-in while loading or if WebGL fails:
  - the ShaderGradient background,
  - the header orb: dotted (lit dots = this week's blocks-done share) or liquid,
  - the dithered sphere: a 4×4 Bayer dither shader with a smooth lens under the cursor.
  Each one pauses when the tab is hidden and holds still with reduced motion.
- **Performance:**
  - devicePixelRatio is capped at 1.5. The gradient renders at 1× ("high" allows 1.5×).
  - Quality "auto" uses drei's `PerformanceMonitor` to lower the resolution when frames drop.
  - three.js, ShaderGradient, html2canvas, the Settings UI, the phone tab bar and every page
    except Today are lazy chunks, and the pages are preloaded once the browser is idle. The
    first load is about 103 kB of gzipped JavaScript (an 80 kB entry chunk plus the shared
    theme and router chunks) and 20 kB of CSS. The floating bar, roundness and liquid metal
    added 0.3 kB of first-load JavaScript: the shader is lazy, and the Settings help text,
    contrast guard and settings import/export moved into the lazy Settings chunks to make room.
- **Accessibility:**
  - Skip link, logical tab order and a visible focus ring everywhere.
  - Segmented controls are radio groups with arrow-key support.
  - The quick drawer and the "More" sheet are modal dialogs that trap focus and return it to
    their button on Esc (the sheet also closes on a backdrop tap or a swipe down).
  - The phone tab bar is a labelled `<nav>` with 48 px+ targets. The active tab has
    `aria-current="page"`, a bold label and a highlight shape (pill or underline), never just
    a colour. The highlight's slide follows reduced motion.
  - Liquid-metal controls stay real `<button>`s with the usual focus ring; hover, focus and
    press work by touch, mouse and keyboard.
  - After a page change, focus moves to the page heading and a live region announces the page.
  - Live regions announce results and toasts.
  - The timetable grid has a screen-reader list version.
  - Text contrast was measured on rendered pixels for every page in Mono Noir, Midnight,
    Graphite, Light and High contrast, at 1440 px and 390 px, and for each glass mode.

### Version pins

- **`three` stays at `~0.182.0`.** `@shadergradient/react` 2.4.20 crashes on three 0.187
  (`Can not resolve #include <cube_uv_reflection_fragment>`), and 0.183+ logs a deprecation
  warning through fiber.
- **`@paper-design/shaders` is pinned to exactly `0.0.81`** (no `^`). It is a 0.0.x package, so
  any update can change the API; 0.0.81 was the newest release that was more than two weeks
  old when it was added. Only `ShaderMount` and `liquidMetalFragmentShader` are imported.
- `three-stdlib` and `camera-controls` are installed as ShaderGradient peers. Its runtime
  doesn't import them, so the bundler leaves them out.

## Third-party notices

- **Paper Shaders** (`@paper-design/shaders` 0.0.81) is licensed under the
  [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). Its NOTICE file reads:

  > Paper Shaders
  > Copyright 2026 Paper
  >
  > Powered by Paper Shaders:
  > https://shaders.paper.design

  The full licence ships in `node_modules/@paper-design/shaders/LICENSE`. The app uses the
  library unmodified.
- **liquid-glass-js** is vendored unchanged under the MIT licence; see
  `src/vendor/liquid-glass-js/`.

## Limits

1. **Smoothness on a real GPU is unverified.** All testing ran in headless Chromium with
   software WebGL (SwiftShader), which says nothing about frame rate. The screenshots were
   taken with the 3D paused on its last frame, because software rendering was too slow to
   capture the animated gradient behind many blurred cards. Turn on the FPS counter
   (Settings → Simulation & diagnostics) on your own machine.
2. **Refraction only works in Chromium browsers** (Chrome, Edge, Brave, Arc). Firefox and
   Safari fall back to frosted blur, and Settings says so.
3. **liquid-glass-js goes stale.** It takes one html2canvas snapshot of the page and redraws
   only on scroll, so over moving backgrounds or after a page change it shows an old picture.
   It is kept as "Experimental" for comparison.
4. **The contrast check covers colour pairs, not every pixel.** With custom gradient colours
   on the animated background, its lighting can brighten a spot slightly beyond what the
   check assumes. Raise the glass tint if text ever looks faint.
5. **The header orb loads three.js on phones too** (about 240 kB gzipped, after the page is
   usable). Turn it off in HUD & layout if that matters. Background 3D stays off on phones
   unless you allow it.
6. **Exam-mode items have start times only**, so the Week grid draws them as short markers.
7. **Absence limits start empty.** Enter the scolarité's numbers; no colour shows until a
   limit is set.
8. **Page transitions were tested only in Chromium**, and only headless.
   - Safari 18+ and recent Firefox also support View Transitions, so they should get the same
     disc, but neither was tested.
   - Browsers without the API get the overlay version. That was tested by removing the API in
     Chromium.
   - The disc's soft edge is a mask redrawn every frame, so how smooth it is on an older phone
     is unknown.
9. **A tap during a transition lands a moment late.** In Chromium the transition layer
   catches taps, so the app ends the transition and then passes your tap on (the newest tap
   always wins).
10. **The phone layout was tested in an emulated phone,** not on a real one. That includes the
    tab bar, the "More" sheet, notch and home-indicator spacing (emulated insets), keyboard
    hiding and swipes. Real-device feel is unverified.
11. **The tab bar hides whenever a text field has focus.** That also happens with a hardware
    keyboard, or after you close the on-screen keyboard while the field still has focus. Tap
    outside the field to bring the bar back.
12. **Swipe between pages** (off by default) can clash with the phone's own edge-swipe "back"
    gesture: start a swipe away from the screen edge.
13. **The floating bar's blur and the liquid-metal shader are untested on a real phone.** Both
    were checked in headless Chromium with software rendering, which shows that they draw
    correctly, not what they cost. The GPU load of a shader canvas and of a strong backdrop
    blur, and their effect on battery, are unknown. If the phone feels slow, set
    **Liquid metal → Static**, turn off "Navigation bar" under Glass → Apply to, or set
    Background quality to Low (which turns both into still, solid versions).
14. **Safari and Firefox were not tested** for the floating bar, roundness or liquid metal.
    The build adds the `-webkit-` prefix Safari needs for the blur, and the shader needs
    WebGL 2 (Safari 15+, Firefox 51+). Without it you get the still CSS rim, and Settings says
    so.
15. **The bar's automatic tint is deliberately cautious.** It assumes pure white (or black)
    right behind the labels and ignores the blur, so with a low tint setting the bar is more
    opaque than the slider suggests.
16. **Only one shader canvas runs on a phone** (two on larger screens). If you turn liquid metal
    on for buttons as well, the selected tab keeps the live shader and the others show the
    still rim.
17. **Desktop windows narrower than 641 px count as phones**, so they get the floating bar and
    the metal pill too.
