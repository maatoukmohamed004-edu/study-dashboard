/**
 * The WCAG guard on the chosen colours (Settings → Appearance): which pairs fail AA, and the
 * smallest setting changes that fix them. Only the Settings UI uses it, so it stays out of the
 * first-load bundle.
 */
import type { Settings } from '../data/settings-schema'
import { contrast, inkOn, luminance, mix } from './color'
import type { Resolved } from './theme'

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
