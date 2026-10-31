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
import type { BgType, Settings } from '../data/settings-schema'
import { caps, getMedia, subscribeMedia, type Media } from './capabilities'
import { contrast, inkOn, luminance, mix, rgba } from './color'
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
  glassOn: { header: boolean; cards: boolean; buttons: boolean }
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
  const glassOn = {
    header: glass !== 'off' && targets.includes('header'),
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

// ─── Apply to the document ──────────────────────────────────────────────────

export function applyTheme(s: Settings, r: Resolved) {
  const root = document.documentElement
  const p = r.palette
  const font = DISPLAY_FONTS[s['appearance.displayFont']]
  const radius = s['appearance.radius']
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
    '--r-lg': `${radius}px`,
    '--r-md': `${Math.round(radius * 0.7)}px`,
    '--r-sm': `${Math.round(radius * 0.45)}px`,
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

// ─── Contrast guard ─────────────────────────────────────────────────────────

export type FixTarget = 'background' | 'accent' | 'gradient' | 'tint'

export interface ContrastCheck {
  id: string
  label: string
  fg: string
  bg: string
  ratio: number
  need: number
  pass: boolean
  fix: FixTarget
}

const AA = 4.5

/** The gradient colour that is hardest to read on (lightest in dark mode, darkest in light mode). */
function worstGradient(r: Resolved): string {
  const g = r.palette.gradient
  const pick = r.mode === 'dark' ? g.reduce((a, b) => (luminance(b) > luminance(a) ? b : a)) : g.reduce((a, b) => (luminance(b) < luminance(a) ? b : a))
  // The animated gradient's lighting can brighten colours a little.
  return r.bg === 'animated' ? mix(pick, r.mode === 'dark' ? '#ffffff' : '#000000', 0.08) : pick
}

export function contrastChecks(s: Settings, r: Resolved): ContrastCheck[] {
  const p = r.palette
  const list: Omit<ContrastCheck, 'ratio' | 'pass'>[] = [
    { id: 'ink-bg', label: 'Text on the background', fg: p.ink, bg: p.bg, need: AA, fix: 'background' },
    { id: 'ink2-bg', label: 'Secondary text on the background', fg: p.ink2, bg: p.bg, need: AA, fix: 'background' },
    { id: 'ink2-raised', label: 'Secondary text on cards', fg: p.ink2, bg: p.raised, need: AA, fix: 'background' },
    { id: 'accent-bg', label: 'Accent on the background', fg: p.accent, bg: p.bg, need: AA, fix: 'accent' },
    { id: 'accent-ink', label: 'Text on accent buttons', fg: p.accentInk, bg: p.accent, need: AA, fix: 'accent' },
  ]
  if (r.bg === 'gradient' || r.bg === 'animated') {
    const worst = worstGradient(r)
    list.push({ id: 'ink2-gradient', label: 'Secondary text over the gradient', fg: p.ink2, bg: worst, need: AA, fix: 'gradient' })
    if (r.glassOn.cards)
      list.push({
        id: 'ink2-glass',
        label: 'Secondary text on glass cards over the gradient',
        fg: p.ink2,
        bg: mix(worst, p.bg, s['glass.tint'] / 100),
        need: AA,
        fix: 'tint',
      })
  }
  return list.map((c) => {
    const ratio = contrast(c.fg, c.bg)
    return { ...c, ratio, pass: ratio >= c.need }
  })
}

/** Smallest t in [0, 1] for which ok(mix(from, to, t)) holds, or null. */
function search(from: string, to: string, ok: (c: string) => boolean): string | null {
  if (ok(from)) return from
  if (!ok(to)) return null
  let lo = 0
  let hi = 1
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (ok(mix(from, to, mid))) hi = mid
    else lo = mid
  }
  return mix(from, to, Math.min(1, hi + 0.01))
}

/** Settings that make every failing check pass, changing as little as possible. */
export function autoFix(s: Settings, r: Resolved): Partial<Settings> {
  const patch: Partial<Settings> = {}
  const p = r.palette
  const checks = contrastChecks(s, r)
  const failing = new Set(checks.filter((c) => !c.pass).map((c) => c.fix))
  const away = r.mode === 'dark' ? '#000000' : '#ffffff'
  const toward = r.mode === 'dark' ? '#ffffff' : '#000000'
  const margin = AA + 0.15

  let bg = p.bg
  if (failing.has('background')) {
    const raisedT = r.mode === 'dark' ? 0.05 : 0.04
    const fixed = search(p.bg, away, (c) => contrast(p.ink2, c) >= margin && contrast(p.ink2, mix(c, p.ink, raisedT)) >= margin && contrast(p.ink, c) >= margin)
    if (fixed) {
      bg = fixed
      patch['appearance.background'] = fixed
    }
  }

  if (failing.has('accent') || contrast(p.accent, bg) < AA) {
    const ok = (c: string) => contrast(c, bg) >= margin && contrast(inkOn(c), c) >= margin
    const fixed = search(p.accent, toward, ok) ?? search(p.accent, away, ok)
    if (fixed) patch['appearance.accent'] = fixed
  }

  if (failing.has('gradient') || failing.has('tint')) {
    const lift = (c: string) => (r.bg === 'animated' ? mix(c, toward, 0.08) : c)
    const keys = ['background.color1', 'background.color2', 'background.color3'] as const
    p.gradient.forEach((c, i) => {
      if (contrast(p.ink2, lift(c)) >= margin) return
      const fixed = search(c, bg, (x) => contrast(p.ink2, lift(x)) >= margin)
      if (fixed) patch[keys[i]] = fixed
    })
    if (failing.has('tint')) {
      let tint = s['glass.tint']
      const g = r.mode === 'dark' ? Math.max(...p.gradient.map(luminance)) : Math.min(...p.gradient.map(luminance))
      const worst = p.gradient.find((c) => luminance(c) === g) ?? p.gradient[0]
      while (tint < 95 && contrast(p.ink2, mix(lift(worst), bg, tint / 100)) < margin) tint += 5
      patch['glass.tint'] = tint
    }
  }
  return patch
}
