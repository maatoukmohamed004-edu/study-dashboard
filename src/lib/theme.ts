/**
 * Turns settings + device state into what the page uses:
 * - resolve(): the palette in force, the glass engine and background actually used, motion.
 * - applyTheme(): CSS custom properties on :root plus data-* attributes. Components style
 *   themselves from those; nothing reads URL parameters.
 * - contrastChecks() / autoFix(): the WCAG guard on the chosen colours.
 */
import { useSyncExternalStore } from 'react'
import { modules, type ModuleId } from '../data/plan'
import { moduleHues, presetById } from '../data/presets'
import { ROUNDNESS_PX, type BgType, type RadiusOverride, type Settings } from '../data/settings-schema'
import { caps, getMedia, subscribeMedia, type Media } from './capabilities'
import { contrast, inkOn, mix, rgba } from './color'
import { getSettings, subscribeSettings } from './settings'

export interface ResolvedPalette {
  bg: string
  raised: string
  desk: string
  ink: string
  ink2: string
  line: string
  lineStrong: string
  accent: string
  accentInk: string
  ok: string
  warn: string
  alarm: string
  focus: string
  gradient: [string, string, string]
  modules: Record<ModuleId, string>
}

export type GlassEngine = 'off' | 'blur' | 'svg' | 'liquid'

export interface Resolved {
  mode: 'dark' | 'light'
  palette: ResolvedPalette
  reducedMotion: boolean
  /** Multiplier for animation speed (1 = normal). */
  speed: number
  glass: GlassEngine
  glassNote: string | null
  glassOn: { header: boolean; navbar: boolean; cards: boolean; buttons: boolean }
  /** Background actually shown. */
  bg: BgType
  /** For 'dither': true = WebGL sphere, false = static CSS stand-in. */
  bg3d: boolean
  /** 3D is drawn once and held still (reduced motion). */
  bgStill: boolean
  /** 3D render loop paused (tab hidden and pausing is on). */
  bgPaused: boolean
  bgNote: string | null
  /** Pixel ratio for the background canvas; 'auto' adapts at runtime. */
  bgQuality: Settings['background.quality']
  phone: boolean
  metal: ResolvedMetal
}

export interface ResolvedMetal {
  /** The rim is drawn on these targets (shader or CSS). */
  on: { tab: boolean; primary: boolean; floating: boolean }
  /** The WebGL 2 shader may run; otherwise the static CSS rim is shown. */
  live: boolean
  /** One still shader frame (Static, or reduced motion). */
  still: boolean
}

const DISPLAY_FONTS: Record<Settings['appearance.displayFont'], { family: string; weight: number; tracking: string }> = {
  sofia: { family: "'Sofia Sans Extra Condensed Variable', 'Arial Narrow', sans-serif", weight: 300, tracking: '0' },
  antonio: { family: "'Antonio Variable', 'Arial Narrow', sans-serif", weight: 200, tracking: '0' },
  shoulders: { family: "'Big Shoulders Display Variable', 'Arial Narrow', sans-serif", weight: 300, tracking: '0.01em' },
}

export function resolve(s: Settings, m: Media): Resolved {
  const preset = presetById[s['appearance.preset']]
  const mode = s['appearance.colorMode'] === 'system' ? (m.osDark ? 'dark' : 'light') : s['appearance.colorMode']
  const base = preset[mode]
  const bg = s['appearance.background'] ?? base.bg
  const accent = s['appearance.accent'] ?? base.accent
  const ink = base.ink
  const palette: ResolvedPalette = {
    bg,
    raised: mix(bg, ink, mode === 'dark' ? 0.05 : 0.04),
    desk: mix(bg, ink, mode === 'dark' ? 0.035 : 0.03),
    ink,
    ink2: base.ink2,
    line: rgba(ink, mode === 'dark' ? 0.16 : 0.2),
    lineStrong: rgba(ink, mode === 'dark' ? 0.36 : 0.45),
    accent,
    accentInk: inkOn(accent),
    ok: base.ok,
    warn: base.warn,
    alarm: base.alarm,
    focus: base.focus,
    gradient: [s['background.color1'] ?? base.gradient[0], s['background.color2'] ?? base.gradient[1], s['background.color3'] ?? base.gradient[2]],
    modules: Object.fromEntries(modules.map((mod) => [mod.id, base.modules === 'hue' ? moduleHues[mod.id][mode] : base.ink2])) as Record<ModuleId, string>,
  }

  const reducedMotion = s['motion.mode'] === 'reduced' || (s['motion.mode'] === 'auto' && m.osReducedMotion)

  // Glass
  let glass: GlassEngine = 'off'
  let glassNote: string | null = null
  switch (s['glass.mode']) {
    case 'off':
      glass = 'off'
      break
    case 'blur':
      glass = 'blur'
      break
    case 'refraction':
      if (caps.chromium) glass = 'svg'
      else {
        glass = 'blur'
        glassNote = 'Refraction needs a Chromium browser (Chrome, Edge, Brave, Arc). Using frosted blur instead.'
      }
      break
    case 'liquid':
      if (caps.webgl) {
        glass = 'liquid'
        glassNote = 'Experimental: liquid-glass-js samples the page once, so its refraction goes stale over moving backgrounds and after you change pages.'
      } else {
        glass = 'blur'
        glassNote = 'liquid-glass-js needs WebGL, which is unavailable here. Using frosted blur instead.'
      }
      break
  }
  const targets = s['glass.applyTo']
  // The tab bar and its "More" panel turn solid when glass can't be drawn or isn't wanted:
  // no backdrop-filter, Background quality Low, or the OS asks for reduced transparency.
  const navbarSolid = (glass !== 'liquid' && !caps.backdrop) || s['background.quality'] === 'low' || m.osReducedTransparency
  const glassOn = {
    header: glass !== 'off' && targets.includes('header'),
    navbar: glass !== 'off' && targets.includes('navbar') && !navbarSolid,
    cards: glass !== 'off' && targets.includes('cards'),
    buttons: glass !== 'off' && targets.includes('buttons'),
  }

  // Background
  let bgType: BgType = s['background.type']
  let bg3d = false
  let bgStill = false
  let bgNote: string | null = null
  const wants3d = bgType === 'animated' || bgType === 'dither'
  if (wants3d) {
    const blocked = !caps.webgl
      ? "WebGL isn't available in this browser"
      : m.phone && !s['background.allow3dPhone']
        ? '3D is off on phones (turn on "Allow 3D on phones" to change that)'
        : null
    if (bgType === 'animated') {
      if (blocked) {
        bgType = 'gradient'
        bgNote = `${blocked}, so the static gradient is shown.`
      } else if (reducedMotion) {
        bgType = 'gradient'
        bgNote = 'Reduced motion is on, so the gradient is static.'
      } else bg3d = true
    } else {
      if (blocked) bgNote = `${blocked}, so a static stand-in for the sphere is shown.`
      else {
        bg3d = true
        if (reducedMotion) {
          bgStill = true
          bgNote = 'Reduced motion is on, so the sphere holds still.'
        }
      }
    }
  }

  // Liquid metal
  const metalTargets = s['metal.enabled'] ? s['metal.applyTo'] : []
  const metalLive = caps.webgl2 && s['background.quality'] !== 'low'
  const metal: ResolvedMetal = {
    on: { tab: metalTargets.includes('tab'), primary: metalTargets.includes('primary'), floating: metalTargets.includes('floating') },
    live: metalLive,
    still: s['metal.static'] || reducedMotion,
  }

  return {
    mode,
    palette,
    reducedMotion,
    speed: s['motion.speed'],
    glass,
    glassNote,
    glassOn,
    bg: bgType,
    bg3d,
    bgStill,
    bgPaused: s['background.pauseHidden'] && !m.visible,
    bgNote,
    bgQuality: s['background.quality'],
    phone: m.phone,
    metal,
  }
}

// ─── Live resolved state ────────────────────────────────────────────────────

let cache: { s: Settings; m: ReturnType<typeof getMedia>; r: Resolved } | null = null

export function getResolved(): Resolved {
  const s = getSettings()
  const m = getMedia()
  if (cache && cache.s === s && cache.m === m) return cache.r
  cache = { s, m, r: resolve(s, m) }
  return cache.r
}

function subscribeBoth(l: () => void) {
  const a = subscribeSettings(l)
  const b = subscribeMedia(l)
  return () => {
    a()
    b()
  }
}

export function useResolved(): Resolved {
  return useSyncExternalStore(subscribeBoth, getResolved)
}

// ─── Tab bar contrast ───────────────────────────────────────────────────────

const BAR_NEED = 4.5 + 0.3 // AA plus a margin for the glass saturation boost

/**
 * Worst content that can pass behind the floating bar: pure white on dark pages, pure black on
 * light ones (the brightest and darkest anything can be), so the result holds for any page.
 */
export const barWorst = (r: Resolved) => (r.mode === 'dark' ? '#ffffff' : '#000000')

/**
 * Lowest tint opacity (0–1) at which the bar's labels and icons (drawn in --ink) keep AA over the
 * worst content, before any blur softens it. The Tint opacity setting is used when it's higher.
 */
export function navbarTint(s: Settings, r: Resolved): number {
  const p = r.palette
  const worst = barWorst(r)
  let a = s['glass.tint'] / 100
  while (a < 0.97 && contrast(p.ink, mix(worst, p.bg, a)) < BAR_NEED) a = Math.round((a + 0.01) * 100) / 100
  return a
}

/** The current-tab pill: an accent tint behind the label, kept at AA for --ink. */
export function navPillColor(r: Resolved): string {
  const p = r.palette
  let t = 0.28
  while (t > 0.04 && contrast(p.ink, mix(p.bg, p.accent, t)) < BAR_NEED) t -= 0.02
  return mix(p.bg, p.accent, t)
}

// ─── Roundness ──────────────────────────────────────────────────────────────

const px = (n: number) => `${Math.max(0, Math.round(n))}px`
const FULL = '9999px'

/**
 * Corner radii as CSS custom properties, all derived from the master radius (Appearance →
 * Corner radius). Stylesheets use only these; nothing else hard-codes a corner.
 * - Scale: --radius-xs/s/m/l/xl = 0.25/0.45/0.7/1/1.4 × master, plus --radius-full (pill/circle).
 * - Groups: one variable per kind of surface, so a group can be overridden on its own.
 * - Nested surfaces subtract their parent's padding in CSS: max(0px, calc(outer - padding)).
 */
interface Shape {
  /** Base radius of the group in px. */
  r: number
  /** Controls in the group become fully round (the Pill preset). */
  pill: boolean
}

type GroupKey = 'appearance.radiusNav' | 'appearance.radiusCards' | 'appearance.radiusButtons' | 'appearance.radiusInputs' | 'appearance.radiusSheets' | 'appearance.radiusHud'

/** A group's shape: the master (linked, or "Same as master") or its own preset. */
export function groupShape(s: Settings, key: GroupKey): Shape {
  // Linked: everything follows the master, except the floating tab bar, which is a pill by design.
  const o: RadiusOverride = s['appearance.radiusLink'] ? (key === 'appearance.radiusNav' ? 'pill' : 'master') : s[key]
  if (o === 'master') return { r: s['appearance.radius'], pill: s['appearance.roundness'] === 'pill' }
  return { r: ROUNDNESS_PX[o], pill: o === 'pill' }
}

export function radiusVars(s: Settings): Record<string, string> {
  const R = s['appearance.radius']
  const cards = groupShape(s, 'appearance.radiusCards')
  const buttons = groupShape(s, 'appearance.radiusButtons')
  const inputs = groupShape(s, 'appearance.radiusInputs')
  const sheets = groupShape(s, 'appearance.radiusSheets')
  const hud = groupShape(s, 'appearance.radiusHud')
  const nav = groupShape(s, 'appearance.radiusNav')
  return {
    '--radius-xs': px(R * 0.25),
    '--radius-s': px(R * 0.45),
    '--radius-m': px(R * 0.7),
    '--radius-l': px(R),
    '--radius-xl': px(R * 1.4),
    '--radius-full': FULL,
    // Cards & panels: cards, chart frames, notes, the week's blocks
    '--radius-card': px(cards.r),
    '--radius-card-m': px(cards.r * 0.7),
    '--radius-card-s': px(cards.r * 0.45),
    // Buttons & chips (square icon buttons, tags, badges)
    '--radius-btn': buttons.pill ? FULL : px(buttons.r * 0.45),
    // Inputs: text fields, selects, segmented switches, checkboxes; multi-line fields never go pill
    '--radius-input': inputs.pill ? FULL : px(inputs.r * 0.45),
    '--radius-area': px(inputs.pill ? 16 : inputs.r * 0.45),
    '--radius-check': px(Math.min(inputs.r * 0.45, 6)),
    // Sheets & dialogs: the quick drawer, the "More" sheet, toasts, tooltips
    '--radius-sheet': px(sheets.r),
    '--radius-toast': px(sheets.r * 0.7),
    '--radius-tip': px(sheets.r * 0.45),
    // HUD frame and its corner brackets
    '--radius-hud': px(hud.r),
    // Floating tab bar (clamped to half its height in CSS)
    '--radius-nav': nav.pill ? FULL : px(nav.r),
    // Small marks (dots, swatches, progress bars): follow the master
    '--radius-mark': px(R * 0.25),
  }
}

// ─── Apply to the document ──────────────────────────────────────────────────

export function applyTheme(s: Settings, r: Resolved) {
  const root = document.documentElement
  const p = r.palette
  const font = DISPLAY_FONTS[s['appearance.displayFont']]
  const vars: Record<string, string> = {
    '--bg': p.bg,
    '--raised': p.raised,
    '--desk': p.desk,
    '--ink': p.ink,
    '--ink-2': p.ink2,
    '--line': p.line,
    '--line-strong': p.lineStrong,
    '--accent': p.accent,
    '--accent-ink': p.accentInk,
    '--warn-ink': inkOn(p.warn),
    '--tick': `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'><path d='M2.5 7.4 5.6 10.3 11.5 3.9' fill='none' stroke='${p.accentInk}' stroke-width='2.4' stroke-linecap='square'/></svg>`)}")`,
    '--ok': p.ok,
    '--warn': p.warn,
    '--alarm': p.alarm,
    '--focus': p.focus,
    '--g1': p.gradient[0],
    '--g2': p.gradient[1],
    '--g3': p.gradient[2],
    '--dot': rgba(p.ink, r.mode === 'dark' ? 0.16 : 0.2),
    '--gridline': rgba(p.ink, r.mode === 'dark' ? 0.045 : 0.06),
    '--text-scale': String(s['appearance.textSize'] / 100),
    '--density': s['appearance.density'] === 'compact' ? '0.72' : '1',
    ...radiusVars(s),
    '--font-display': font.family,
    '--display-weight': String(font.weight),
    '--display-tracking': font.tracking,
    '--glass-tint': rgba(p.bg, s['glass.tint'] / 100),
    '--glass-tint-strong': rgba(p.bg, Math.min(0.97, s['glass.tint'] / 100 + 0.15)),
    '--glass-blur': `${s['glass.blur']}px`,
    '--glass-sat': `${s['glass.saturation']}%`,
    '--glass-edge': rgba(p.ink, (s['glass.edge'] / 100) * 0.55),
    '--glass-edge-soft': rgba(p.ink, (s['glass.edge'] / 100) * 0.18),
    '--grain': String(s['background.grain'] / 100),
    '--motion-k': r.reducedMotion ? '0' : String(1 / s['motion.speed']),
  }
  // Mixed colours are computed here rather than with CSS color-mix(): html2canvas (used by the
  // experimental liquid-glass mode) can't parse color-mix() or the color(srgb …) values it computes to.
  Object.assign(vars, {
    '--g1-a85': rgba(p.gradient[0], 0.85),
    '--g1-a50': rgba(p.gradient[0], 0.5),
    '--g2-a85': rgba(p.gradient[1], 0.85),
    '--glass-tint-liquid': rgba(p.bg, (s['glass.tint'] / 100) * 0.6),
    '--scrim': rgba(p.bg, 0.55),
    '--ink-wash': mix(p.bg, p.ink, 0.18),
    '--accent-wash': rgba(p.accent, 0.07),
    '--accent-tint': mix(p.bg, p.accent, 0.16),
    // The "Disc wash" page transition: an accent tint that hides the page without a bright flash.
    '--vt-wash': mix(p.bg, p.accent, 0.24),
    // Floating tab bar
    '--bar-margin': `${s['nav.barMargin']}px`,
    '--bar-gap': `${s['nav.barGap']}px`,
    '--navbar-tint': rgba(p.bg, navbarTint(s, r)),
    '--navbar-blur': `${s['glass.blur'] * 1.5}px`,
    '--navbar-sat': `${s['glass.saturation'] + 40}%`,
    '--nav-pill': navPillColor(r),
    '--nav-pill-line': rgba(p.accent, 0.55),
    // Liquid metal: an opaque dark fill and a light label in every preset (AA by construction)
    '--metal-fill': '#111214',
    '--metal-ink': '#f3f3f0',
    '--metal-tint': p.accent,
    '--bar-shadow':
      r.mode === 'dark' ? '0 16px 36px -12px rgba(0, 0, 0, 0.75), 0 2px 8px rgba(0, 0, 0, 0.35)' : '0 16px 36px -14px rgba(20, 20, 18, 0.35), 0 2px 8px rgba(20, 20, 18, 0.12)',
  })
  const modColours: [string, string][] = [...modules.map((m): [string, string] => [m.id, p.modules[m.id]]), ['none', p.ink2]]
  for (const [id, c] of modColours) {
    vars[`--m-${id}`] = c
    vars[`--m-${id}-tint`] = mix(p.bg, c, 0.16)
    vars[`--m-${id}-line`] = rgba(c, 0.65)
  }
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)

  const data: Record<string, string> = {
    mode: r.mode,
    preset: s['appearance.preset'],
    glass: r.glass,
    glassHeader: r.glassOn.header ? 'on' : 'off',
    glassNavbar: r.glassOn.navbar ? 'on' : 'off',
    glassCards: r.glassOn.cards ? 'on' : 'off',
    glassButtons: r.glassOn.buttons ? 'on' : 'off',
    motion: r.reducedMotion ? 'reduced' : 'full',
    density: s['appearance.density'],
    monoCase: s['appearance.monoUppercase'] ? 'upper' : 'none',
    frame: s['hud.frame'] ? 'on' : 'off',
    corners: s['hud.corners'] ? 'on' : 'off',
    grid: s['hud.grid'] ? 'on' : 'off',
    caption: s['hud.caption'] ? 'on' : 'off',
    bg: r.bg,
    tabbar: s['nav.bottomBar'] ? 'on' : 'off',
    bar: s['nav.barStyle'],
    tabHighlight: s['nav.highlight'],
    tabLabels: s['nav.labels'] ? 'on' : 'off',
  }
  for (const [k, v] of Object.entries(data)) root.dataset[k] = v
  root.style.colorScheme = r.mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', r.mode)
}

/** Applies now and on every change to settings or device state. */
export function startTheme() {
  const run = () => applyTheme(getSettings(), getResolved())
  run()
  subscribeBoth(run)
}
