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
Settings. Tap the current tab again to jump back to the top. The gear in the top bar opens Quick
settings. The bar hides while you type in a field, so it never covers the field or floats above
the keyboard. You can pick the four tabs, hide their labels, turn on swiping between pages, or go
back to the scrolling top bar in **Settings → Navigation**.

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
| **Appearance** | Preset (Mono Noir, Midnight, Graphite, High contrast, Light) · color mode (dark / light / system) · accent and background colour (swatches or hex; "Preset" uses the preset's own) · text size 90–120% · density · corner radius 0–20 px · uppercase mono labels · display font (Sofia Sans Extra Condensed, Antonio, Big Shoulders Display) |
| **Background** | Type: solid, static gradient, dot grid, animated gradient (ShaderGradient) or dithered sphere (with a lens that follows your cursor) · three gradient colours · speed · grain · quality (auto / low / high) · pause when the tab is hidden · allow 3D on phones (off by default) |
| **Glass** | Mode: off, frosted blur, refraction, or experimental liquid-glass-js · blur · refraction strength · tint opacity · saturation · edge highlight · apply to header / cards / buttons. A note shows the mode actually in use if your browser can't do the one you picked. |
| **HUD & layout** | Frame, corner brackets, grid, bottom caption, header orb and its style (dotted / liquid) |
| **Navigation** | Page transition: **Disc reveal** (default), **Disc wash** (an accent-tinted disc covers the page, the page changes underneath, the disc fades), Crossfade or None · duration 300–1200 ms (650 by default, scaled by animation speed) · edge softness · where the disc starts (press point or screen centre) · tab bar on phones · tab labels · swipe between pages (off by default) · which four pages get a tab, in order (always exactly four; the rest go to More) |
| **Motion** | Auto (follows your device), reduced or full · animation speed. Reduced motion turns page transitions into a short crossfade. |
| **Simulation & diagnostics** | Simulated date and time. Every page behaves as if it were that moment, and a banner with **Back to real time** stays on screen. Also an FPS counter and what this browser supports. |
| **Data** | Export or import settings (`study-dashboard-settings-YYYY-MM-DD.json`) · export or import progress (unchanged, see [Your data](#your-data)) · reset all settings. Each section also has **Reset section**. Every reset, import and preset change offers **Undo**. |

**Contrast check.** Appearance shows the WCAG ratio of every colour pair in use: text,
secondary text and accent on the background, text on accent buttons and, with gradient
backgrounds, text over the gradient and on glass. A warning appears below AA, and **Fix
automatically** changes the fewest colours needed to pass (with undo).

**How settings are stored.**
- Settings live under `study-dashboard:settings:v1` as `{ version, values }`.
- Each value is checked on its own against the schema, so a bad value in a saved or imported
  file falls back to its default without discarding the rest. Older files are migrated by
  version.
- If the browser blocks storage, settings still work for the session and a notice says so.
- Open tabs stay in sync.
- An import that isn't a settings file, including a progress backup or broken JSON, is
  rejected and nothing changes.

**Adding a setting.** Add one entry to [`src/data/settings-schema.ts`](src/data/settings-schema.ts)
with key, section, label, description, control (`segmented`, `select`, `toggle`, `range`,
`color`, `checkboxes`, `date`, `time`), default, min/max/step, `dependsOn` and `requires`
(`webgl` or `chromium`). The Settings page and drawer are generated from that list. Read the
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
- **Glass:** cards use CSS `backdrop-filter`. The header and main buttons can also refract:
  a generated SVG displacement map bends what's behind near the rim. liquid-glass-js stays
  vendored in `src/vendor/liquid-glass-js/` (MIT, unchanged) as the experimental mode.
- **3D**, all lazy-loaded with a CSS stand-in while loading or if WebGL fails:
  - the ShaderGradient background,
  - the header orb: dotted (lit dots = this week's blocks-done share) or liquid,
  - the dithered sphere: a 4×4 Bayer dither shader with a smooth lens under the cursor.
  Each one pauses when the tab is hidden and holds still with reduced motion.
- **Performance:**
  - devicePixelRatio is capped at 1.5. The gradient renders at 1× ("high" allows 1.5×).
  - Quality "auto" uses drei's `PerformanceMonitor` to lower the resolution when frames drop.
  - three.js, ShaderGradient, html2canvas, the Settings UI and every page except Today are
    lazy chunks. The first load is about 99 kB of gzipped JavaScript (an 80 kB entry chunk
    plus the shared theme, settings and router chunks) and 16 kB of CSS.
- **Accessibility:**
  - Skip link, logical tab order and a visible focus ring everywhere.
  - Segmented controls are radio groups with arrow-key support.
  - The quick drawer and the "More" sheet are modal dialogs that trap focus and return it to
    their button on Esc (the sheet also closes on a backdrop tap or a swipe down).
  - The phone tab bar is a labelled `<nav>` with 48 px+ targets. The active tab has
    `aria-current="page"` and shows an indicator bar and a bold label, not just a colour.
  - After a page change, focus moves to the page heading and a live region announces the page.
  - Live regions announce results and toasts.
  - The timetable grid has a screen-reader list version.
  - Text contrast was measured on rendered pixels for every page in Mono Noir, Midnight,
    Graphite, Light and High contrast, at 1440 px and 390 px, and for each glass mode.

### Version pins

- **`three` stays at `~0.182.0`.** `@shadergradient/react` 2.4.20 crashes on three 0.187
  (`Can not resolve #include <cube_uv_reflection_fragment>`), and 0.183+ logs a deprecation
  warning through fiber.
- `three-stdlib` and `camera-controls` are installed as ShaderGradient peers. Its runtime
  doesn't import them, so the bundler leaves them out.

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
