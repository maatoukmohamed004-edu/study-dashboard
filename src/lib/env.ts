import { useEffect, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import type { NavPage } from '../data/settings-schema'
import { toISO } from './dates'
import { getSettings, useSettings } from './settings'
import { runTransition, skipActiveTransition, transitionRunning, type Point } from './transition'

// ─── Clock (real, or simulated from Settings → Simulation) ──────────────────

/** The moment the app treats as "now". */
export function now(): Date {
  const real = new Date()
  const s = getSettings()
  if (!s['sim.enabled']) return real
  const t = new Date(real)
  if (s['sim.date']) {
    const [y, m, d] = s['sim.date'].split('-').map(Number)
    t.setFullYear(y, m - 1, d)
  }
  if (s['sim.time']) {
    const [h, min] = s['sim.time'].split(':').map(Number)
    t.setHours(h, min, 0, 0)
  }
  return t
}

export function useSimulation(): { on: boolean; date: string; time: string } {
  const s = useSettings()
  return { on: s['sim.enabled'], date: s['sim.date'], time: s['sim.time'] }
}

/** Re-renders every `ms` (and when the simulation changes) so "today" and delays stay current. */
export function useNow(ms = 30_000): Date {
  const sim = useSimulation()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms)
    const onVisible = () => document.visibilityState === 'visible' && setTick((t) => t + 1)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms])
  // tick and sim are inputs so the value refreshes; now() reads the current settings.
  void tick
  void sim
  return now()
}

export function useToday(): string {
  return toISO(useNow())
}

// ─── Media query hook ───────────────────────────────────────────────────────

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Cap for devicePixelRatio across the app's WebGL canvases. */
export const DPR_CAP = 1.5
export const cappedDpr = () => Math.min(window.devicePixelRatio || 1, DPR_CAP)

// ─── Navigation layer (hash router) ─────────────────────────────────────────
//
// The one place where navigation happens. It intercepts clicks on in-app links ("#/…"), pushes a
// history entry, and commits the new route inside the page transition (transition.ts). It also:
// - remembers the press point (or the activated element's centre for keyboard) as the disc origin;
// - keeps a scroll position per history entry and restores it on back/forward;
// - moves focus to the new page's heading and announces the page in a live region;
// - waits for a page's code chunk before animating, and lets a newer navigation win.

export type PageId = NavPage

/** Pages in the main navigation. Settings is reached from the gear button. */
export const PAGES: { id: Exclude<PageId, 'settings'>; label: string; short: string }[] = [
  { id: 'today', label: 'Today', short: 'Today' },
  { id: 'week', label: 'Week', short: 'Week' },
  { id: 'plan', label: 'Plan', short: 'Plan' },
  { id: 'resources', label: 'Resources', short: 'Resources' },
  { id: 'absences', label: 'Absences', short: 'Absences' },
  { id: 'check', label: 'Sunday check', short: 'Sunday' },
]

const ALL_PAGES: PageId[] = [...PAGES.map((p) => p.id), 'settings']

export const pageLabel = (id: PageId) => (id === 'settings' ? 'Settings' : (PAGES.find((p) => p.id === id)?.label ?? 'Today'))

export interface Route {
  page: PageId
  sub: string | null
}

function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  const page = ALL_PAGES.includes(parts[0] as PageId) ? (parts[0] as PageId) : 'today'
  return { page, sub: parts[1] || null }
}

const sameRoute = (a: Route, b: Route) => a.page === b.page && a.sub === b.sub

let route = parseHash(window.location.hash)
/** Where the latest navigation is heading (equals `route` once it has been committed). */
let target = route
const routeListeners = new Set<() => void>()

export const getRoute = () => route

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      routeListeners.add(cb)
      return () => routeListeners.delete(cb)
    },
    getRoute,
  )
}

/** Set by the app: starts loading a page's chunk, or returns null when it is ready. */
let preloadPage: (id: PageId) => Promise<unknown> | null = () => null
export function setPagePreloader(fn: typeof preloadPage) {
  preloadPage = fn
}

// History entries carry a key, so each can remember its own scroll position.
let seq = 0
const newKey = () => `${Date.now().toString(36)}.${(seq++).toString(36)}`
const scrollByKey = new Map<string, number>()
let currentKey = ''
let navToken = 0
let lastOrigin: Point | null = null
let lastPress: (Point & { t: number }) | null = null

function keyOf(state: unknown): string | null {
  return state && typeof state === 'object' && 'navKey' in state ? String((state as { navKey: unknown }).navKey) : null
}

function adoptCurrentEntry() {
  currentKey = keyOf(history.state) ?? newKey()
  if (!keyOf(history.state)) history.replaceState({ ...((history.state as object | null) ?? {}), navKey: currentKey }, '')
}

/** Navigate to an in-app hash ("#/week"). Used by every link, the tab bar, swipes and code. */
export function navigate(hash: string, opts: { origin?: Point | null; replace?: boolean } = {}) {
  const next = parseHash(hash)
  if (sameRoute(next, target)) {
    // Same page (e.g. "#/today" while the URL has no hash yet): only tidy the URL.
    if (hash !== window.location.hash) history.replaceState({ navKey: currentKey }, '', hash)
    return
  }
  scrollByKey.set(currentKey, window.scrollY)
  currentKey = newKey()
  if (opts.replace) history.replaceState({ navKey: currentKey }, '', hash)
  else history.pushState({ navKey: currentKey }, '', hash)
  commit(next, opts.origin ?? null, next.sub ? null : 0)
}

function onPopState() {
  const next = parseHash(window.location.hash)
  adoptCurrentEntry()
  // Back/forward fires popstate and hashchange: handle the first, ignore the echo.
  if (sameRoute(next, target)) return
  // Back/forward: reuse the last press point (or crossfade), and restore where you were.
  commit(next, lastOrigin, scrollByKey.get(currentKey) ?? (next.sub ? null : 0))
}

function commit(next: Route, origin: Point | null, scrollTo: number | null) {
  const token = ++navToken
  const pageChanged = next.page !== target.page
  target = next
  if (origin) lastOrigin = origin

  const apply = () => {
    if (token !== navToken) return
    flushSync(() => {
      route = next
      routeListeners.forEach((l) => l())
    })
    if (scrollTo !== null) window.scrollTo(0, scrollTo)
    if (pageChanged) afterPageChange(next)
  }

  if (!pageChanged) return apply()
  const start = () => {
    if (token === navToken) runTransition(apply, origin)
  }
  const ready = preloadPage(next.page)
  if (!ready) return start()
  // Never block navigation on a slow chunk: animate once it's here, or go after 1.5 s regardless.
  Promise.race([ready, new Promise((r) => setTimeout(r, 1500))]).then(start, start)
}

/** Focus the new page's heading (or main) and announce it to screen readers. */
function afterPageChange(next: Route) {
  const main = document.getElementById('main')
  if (!next.sub) {
    const h1 = main?.querySelector<HTMLElement>('h1')
    const target = h1 ?? main
    if (target) {
      if (h1) h1.tabIndex = -1
      target.focus({ preventScroll: true })
    }
  }
  const live = document.getElementById('route-announcer')
  if (live) {
    // Clear, then set after a beat, so the same text is announced again on a repeat visit.
    live.textContent = ''
    window.setTimeout(() => (live.textContent = `${pageLabel(next.page)} page`), 80)
  }
}

/** Where a link was activated: the press point, or the element's centre for keyboard. */
function originFor(e: MouseEvent, el: Element): Point {
  if (e.detail > 0) return { x: e.clientX, y: e.clientY }
  if (lastPress && performance.now() - lastPress.t < 700) return { x: lastPress.x, y: lastPress.y }
  const r = el.getBoundingClientRect()
  if (r.width && r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  return { x: innerWidth / 2, y: innerHeight / 2 }
}

function onLinkClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as Element | null)?.closest?.('a[href]')
  if (!(a instanceof HTMLAnchorElement)) return
  const href = a.getAttribute('href') ?? ''
  if (!href.startsWith('#/') || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
  e.preventDefault()
  navigate(href, { origin: originFor(e, a) })
}

// While a View Transition runs, its overlay receives every tap. Skip it at once and pass the tap
// to whatever is really under the finger, so rapid taps always reach the latest target.
let replay: (Point & { gone: Promise<void> }) | null = null

function onPress(e: PointerEvent) {
  lastPress = { x: e.clientX, y: e.clientY, t: performance.now() }
  if (transitionRunning() && e.target === document.documentElement) {
    replay = { x: e.clientX, y: e.clientY, gone: skipActiveTransition() }
  }
}

function onOverlayClick(e: MouseEvent) {
  if (!replay || e.target !== document.documentElement) return
  const { x, y, gone } = replay
  replay = null
  e.stopPropagation()
  // Wait until the skipped transition's overlay is gone, then hit-test the real page.
  void gone.then(() => {
    const el = document.elementFromPoint(x, y)
    const target = el?.closest<HTMLElement>('a[href], button, summary, label, [role="button"], [role="radio"], [role="tab"]')
    if (target) target.click()
    else el?.closest<HTMLElement>('input, select, textarea')?.focus()
  })
}

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
adoptCurrentEntry()
window.addEventListener('scroll', () => scrollByKey.set(currentKey, window.scrollY), { passive: true })
window.addEventListener('popstate', onPopState)
// A typed URL fires popstate too; hashchange is the fallback if it ever doesn't.
window.addEventListener('hashchange', onPopState)
document.addEventListener('click', onLinkClick)
document.addEventListener('pointerdown', onPress, true)
document.addEventListener('click', onOverlayClick, true)
