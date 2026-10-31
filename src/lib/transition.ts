/**
 * Page-change animations, run by the navigation layer in env.ts (never by individual links).
 *
 * - Disc reveal (default): the new page appears inside a soft-edged disc that grows from the press
 *   point to the farthest viewport corner. With the View Transitions API this is a radial mask on
 *   ::view-transition-new(root); the radius is a registered custom property (transitions.css).
 *   Without the API, a page-coloured disc grows over the old page, the page changes underneath,
 *   and the disc fades out.
 * - Disc wash: an accent-tinted disc grows over the old page, the page changes while it is
 *   covered, then the disc fades. Same overlay in every browser.
 * - Crossfade: a View Transition crossfade, or a page-coloured veil without the API.
 *
 * Timing and edge were measured from the reference video: the disc follows a strong ease-in-out,
 * cubic-bezier(.54, 0, .34, .99), and the old page does not dim. Persistent chrome (header, tab
 * bar, HUD frame, caption) is captured separately and held still; see transitions.css.
 */
import { getSettings } from './settings'
import { getResolved } from './theme'

export interface Point {
  x: number
  y: number
}

type Style = 'reveal' | 'wash' | 'fade' | 'none'

/** The disc's growth curve, fitted to the reference video. */
export const DISC_EASING = 'cubic-bezier(.54, 0, .34, .99)'
const REDUCED_MS = 160

/** The running transition, so a newer navigation can jump it to its end state. */
let active: { finish: () => Promise<void> } | null = null
/** Bumped per View Transition, so a skipped one never clears the flag of the one replacing it. */
let vtSeq = 0

/** Jumps the running transition to its end. Resolves once its overlay is gone. */
export function skipActiveTransition(): Promise<void> {
  const a = active
  active = null
  return a ? a.finish() : Promise.resolve()
}

export const transitionRunning = () => active !== null

function plan(origin: Point | null): { style: Style; duration: number; origin: Point | null; softness: number } {
  const s = getSettings()
  const r = getResolved()
  let style = s['nav.transition'] as Style
  let duration = s['nav.duration'] / s['motion.speed']
  const o = s['nav.origin'] === 'center' ? { x: innerWidth / 2, y: innerHeight / 2 } : origin
  if (r.reducedMotion && style !== 'none') {
    style = 'fade'
    duration = REDUCED_MS
  }
  // Back/forward with no earlier press: a plain crossfade.
  if ((style === 'reveal' || style === 'wash') && !o) style = 'fade'
  return { style, duration, origin: o, softness: s['nav.softness'] / 100 }
}

/** Distance from a point to the farthest viewport corner. */
function farthest(o: Point) {
  return Math.hypot(Math.max(o.x, innerWidth - o.x), Math.max(o.y, innerHeight - o.y))
}

const canViewTransition = () => typeof document.startViewTransition === 'function'

/**
 * Runs `update` (which must change the DOM synchronously) inside the configured transition.
 * The DOM always ends up updated, even if an animation fails or is skipped.
 */
export function runTransition(update: () => void, origin: Point | null) {
  skipActiveTransition()
  const p = plan(origin)
  if (p.style === 'none' || document.visibilityState === 'hidden') return update()
  if (p.style === 'wash') return overlayDisc(update, p.origin!, p.duration, p.softness, 'var(--vt-wash)')
  if (canViewTransition()) return viewTransition(update, p)
  if (p.style === 'reveal') return overlayDisc(update, p.origin!, p.duration, p.softness, 'var(--bg)')
  return overlayVeil(update, p.duration)
}

// ─── View Transitions API ───────────────────────────────────────────────────

function viewTransition(update: () => void, p: ReturnType<typeof plan>) {
  const root = document.documentElement
  const id = ++vtSeq
  let vt: ViewTransition
  try {
    root.dataset.vt = p.style
    if (p.style === 'reveal') {
      // Feather grows a little with the disc: f(r) = k·r + f0 (softness 35% ≈ the video's edge).
      const o = p.origin!
      const R = farthest(o)
      const k = 0.17 * p.softness
      const f0 = 0.11 * p.softness * R
      root.style.setProperty('--vt-x', `${o.x}px`)
      root.style.setProperty('--vt-y', `${o.y}px`)
      root.style.setProperty('--vt-k', String(k))
      root.style.setProperty('--vt-f0', `${f0}px`)
      root.style.setProperty('--vt-end', `${Math.ceil((R + f0) / (1 - k)) + 2}px`)
    }
    vt = document.startViewTransition(update)
  } catch {
    delete root.dataset.vt
    return update()
  }

  const animations: Animation[] = []
  const done = () => {
    if (active === handle) active = null
    if (vtSeq === id) delete root.dataset.vt
    // The animations hold their end state until the snapshot is gone; release them now.
    animations.forEach((a) => a.cancel())
  }
  const handle = {
    finish: () => {
      animations.forEach((a) => a.finish())
      vt.skipTransition()
      return vt.finished.then(
        () => undefined,
        () => undefined,
      )
    },
  }
  active = handle

  vt.ready
    .then(() => {
      const timing: KeyframeAnimationOptions = { duration: p.duration, fill: 'both' }
      if (p.style === 'reveal') {
        const end = root.style.getPropertyValue('--vt-end')
        animations.push(root.animate({ '--vt-r': ['0px', end] }, { ...timing, easing: DISC_EASING, pseudoElement: '::view-transition-new(root)' }))
      } else {
        animations.push(root.animate({ opacity: [0, 1] }, { ...timing, easing: 'ease', pseudoElement: '::view-transition-new(root)' }))
        animations.push(root.animate({ opacity: [1, 0] }, { ...timing, easing: 'ease', pseudoElement: '::view-transition-old(root)' }))
      }
    })
    .catch(done)
  vt.finished.then(done, done)
}

// ─── Fallback overlays (no View Transitions, and the wash style) ─────────────

/** Fixed layer inside .shell: above the page content, below the header, tab bar and HUD frame. */
function layer(): HTMLElement | null {
  return document.querySelector('.vt-layer')
}

function overlayDisc(update: () => void, o: Point, duration: number, softness: number, color: string) {
  const host = layer()
  if (!host) return update()
  const feather = 0.3 * softness // share of the radius that fades out
  const r = Math.ceil(farthest(o) / (1 - feather)) + 2
  const disc = document.createElement('div')
  disc.className = 'vt-disc'
  Object.assign(disc.style, {
    left: `${o.x - r}px`,
    top: `${o.y - r}px`,
    width: `${2 * r}px`,
    height: `${2 * r}px`,
    background: `radial-gradient(circle closest-side, ${color} ${Math.round((1 - feather) * 1000) / 10}%, transparent 100%)`,
  })
  host.appendChild(disc)
  coverThenReveal(update, disc, duration, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], DISC_EASING)
}

function overlayVeil(update: () => void, duration: number) {
  const host = layer()
  if (!host) return update()
  const veil = document.createElement('div')
  veil.className = 'vt-veil'
  host.appendChild(veil)
  coverThenReveal(update, veil, duration, [{ opacity: 0 }, { opacity: 1 }], 'ease-in')
}

/** Phase 1 covers the old page, the page changes while covered, phase 2 fades the cover out. */
function coverThenReveal(update: () => void, el: HTMLElement, duration: number, cover: Keyframe[], easing: string) {
  let swapped = false
  const swap = () => {
    if (swapped) return
    swapped = true
    update()
  }
  const coverAnim = el.animate(cover, { duration: duration * 0.55, easing, fill: 'forwards' })
  let fadeAnim: Animation | null = null
  const handle = {
    finish: () => {
      coverAnim.cancel()
      fadeAnim?.cancel()
      swap()
      el.remove()
      return Promise.resolve()
    },
  }
  active = handle
  coverAnim.finished
    .then(() => {
      swap()
      fadeAnim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration * 0.45, easing: 'ease-out', fill: 'forwards' })
      return fadeAnim.finished
    })
    .then(() => {
      el.remove()
      if (active === handle) active = null
    })
    .catch(() => {
      // Cancelled by a newer navigation: finish() already swapped and cleaned up.
    })
}
