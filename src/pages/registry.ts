/**
 * Every page, and how it is loaded. Today ships in the main bundle; the others are separate
 * chunks, preloaded when the browser is idle. The navigation layer waits for a page's chunk
 * before it starts a transition, so a transition never captures a "Loading" placeholder.
 */
import { createElement, type ComponentType } from 'react'
import type { PageId } from '../lib/env'
import { TodayPage } from './TodayPage'

export type PageProps = { sub: string | null }
type Loader = () => Promise<ComponentType<PageProps>>

const loaders: Record<Exclude<PageId, 'today'>, Loader> = {
  week: () => import('./WeekPage').then((m) => () => createElement(m.WeekPage)),
  plan: () => import('./PlanPage').then((m) => ({ sub }: PageProps) => createElement(m.PlanPage, { section: sub })),
  resources: () => import('./ResourcesPage').then((m) => ({ sub }: PageProps) => createElement(m.ResourcesPage, { filter: sub })),
  absences: () => import('./AbsencesPage').then((m) => () => createElement(m.AbsencesPage)),
  check: () => import('./CheckPage').then((m) => () => createElement(m.CheckPage)),
  settings: () => import('./SettingsPage').then((m) => ({ sub }: PageProps) => createElement(m.default, { section: sub })),
}

const loaded: Partial<Record<PageId, ComponentType<PageProps>>> = { today: () => createElement(TodayPage) }
const pending = new Map<PageId, Promise<void>>()

/** The page's component, if its chunk has loaded. */
export const loadedPage = (id: PageId) => loaded[id]

/** Starts loading a page's chunk. Returns null when it is already loaded. */
export function preloadPage(id: PageId): Promise<void> | null {
  if (loaded[id] || id === 'today') return null
  let p = pending.get(id)
  if (!p) {
    p = loaders[id]().then((C) => {
      loaded[id] = C
    })
    pending.set(id, p)
    p.catch(() => pending.delete(id))
  }
  return p
}

/** Preloads every page (called once the app is idle). */
export function preloadAll() {
  for (const id of Object.keys(loaders) as PageId[]) preloadPage(id)?.catch(() => {})
}
