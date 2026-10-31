import { useEffect, useState, useSyncExternalStore } from 'react'
import { toISO } from './dates'
import { getSettings, useSettings } from './settings'

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

// ─── Hash router ────────────────────────────────────────────────────────────

export type PageId = 'today' | 'week' | 'plan' | 'resources' | 'absences' | 'check' | 'settings'

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

function readHash(): { page: PageId; sub: string | null } {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/')
  const page = ALL_PAGES.includes(parts[0] as PageId) ? (parts[0] as PageId) : 'today'
  return { page, sub: parts[1] || null }
}

let route = readHash()
window.addEventListener('hashchange', () => {
  route = readHash()
})

export function useRoute() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb)
      return () => window.removeEventListener('hashchange', cb)
    },
    () => route,
  )
}
