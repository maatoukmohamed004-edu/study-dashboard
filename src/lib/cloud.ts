/**
 * Cloud sync through the Claude artifact database.
 *
 * When the app runs as a published Claude artifact, `window.claude.use('db')` gives a document
 * store shared by every device you open it on, and readable/writable by Claude. Elsewhere
 * (GitHub Pages, `npm run dev`) it resolves to nothing and the app stays local-only, exactly as
 * before. localStorage (`study-dashboard:v1`) keeps working as the offline cache either way.
 *
 * Layout in the store (all paths are documents):
 *   days/<YYYY-MM-DD>   { blocks, classes?, firstTask?, badDay?, badDaySteps }
 *   meta/core           { doFirst, absences, checkpointScores }
 *   checks/<weekOf>     one Sunday check
 *   tasks/<id>, resources/<id>, nudges/<id>   see extras.ts
 */
import { useSyncExternalStore } from 'react'
import { applyRemote, getState, normalize, onLocalChange, type SavedState } from './store'

// ─── Minimal types for the runtime API we use ─────────────────────────────────

export interface DocSnap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
  metadata: { fromCache: boolean; hasPendingWrites: boolean }
}
export interface QuerySnap {
  docs: DocSnap[]
  metadata: { fromCache: boolean; hasPendingWrites: boolean }
}
interface DbError {
  code: string
  message: string
}
export interface DocRef {
  set(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  onSnapshot(next: (s: DocSnap) => void, error?: (e: DbError) => void): () => void
}
export interface CollRef {
  doc(id: string): DocRef
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: DbError) => void): () => void
}
export interface Db {
  doc(path: string): DocRef
  collection(path: string): CollRef
}

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> }
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

export type SyncStatus = 'local' | 'connecting' | 'synced' | 'saving' | 'offline' | 'error'

let status: SyncStatus = 'connecting'
let statusDetail = ''
const statusListeners = new Set<() => void>()
function setStatus(next: SyncStatus, detail = '') {
  if (next === status && detail === statusDetail) return
  status = next
  statusDetail = detail
  for (const l of statusListeners) l()
}
function subscribeStatus(l: () => void) {
  statusListeners.add(l)
  return () => statusListeners.delete(l)
}
export function useSyncStatus(): { status: SyncStatus; detail: string } {
  const s = useSyncExternalStore(subscribeStatus, () => status)
  const d = useSyncExternalStore(subscribeStatus, () => statusDetail)
  return { status: s, detail: d }
}

// ─── Database handle ──────────────────────────────────────────────────────────

let resolveDb: (db: Db | null) => void = () => {}
/** Resolves to the database, or null when the app runs outside a Claude artifact. */
export const dbReady: Promise<Db | null> = new Promise((r) => (resolveDb = r))

async function connect(): Promise<Db | null> {
  if (typeof window === 'undefined' || typeof window.claude?.use !== 'function') return null
  try {
    return ((await window.claude.use('db')) as Db | null) ?? null
  } catch {
    return null
  }
}

// ─── Mapping between SavedState and documents ────────────────────────────────

type Doc = Record<string, unknown>

function datesIn(s: SavedState): Set<string> {
  const out = new Set<string>([...Object.keys(s.blocks), ...Object.keys(s.classes), ...Object.keys(s.firstTask), ...Object.keys(s.badDay)])
  for (const k of Object.keys(s.badDaySteps)) out.add(k.slice(0, 10))
  return out
}

function dayDoc(s: SavedState, date: string): Doc {
  const steps: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(s.badDaySteps)) if (k.startsWith(`${date}:`)) steps[k.slice(11)] = v
  const doc: Doc = { blocks: s.blocks[date] ?? {}, badDaySteps: steps }
  if (date in s.classes) doc.classes = s.classes[date]
  if (date in s.firstTask) doc.firstTask = s.firstTask[date]
  if (date in s.badDay) doc.badDay = s.badDay[date]
  return doc
}

function metaDoc(s: SavedState): Doc {
  return { doFirst: s.doFirst, absences: s.absences, checkpointScores: s.checkpointScores }
}

function checkDoc(s: SavedState, weekOf: string): Doc | null {
  const c = s.sundayChecks.find((x) => x.weekOf === weekOf)
  return c ? { ...c } : null
}

function docFor(s: SavedState, path: string): Doc | null {
  const [coll, id] = path.split('/')
  if (coll === 'days') return dayDoc(s, id)
  if (coll === 'meta') return metaDoc(s)
  return checkDoc(s, id)
}

function assemble(days: Record<string, Doc>, meta: Doc | null, checks: Record<string, Doc>): SavedState {
  const raw = {
    version: 1,
    blocks: {} as Record<string, unknown>,
    classes: {} as Record<string, unknown>,
    firstTask: {} as Record<string, unknown>,
    badDay: {} as Record<string, unknown>,
    badDaySteps: {} as Record<string, unknown>,
    doFirst: meta?.doFirst ?? {},
    absences: meta?.absences ?? {},
    checkpointScores: meta?.checkpointScores ?? {},
    sundayChecks: Object.values(checks),
  }
  for (const [date, d] of Object.entries(days)) {
    if (d.blocks && typeof d.blocks === 'object') raw.blocks[date] = d.blocks
    if ('classes' in d) raw.classes[date] = d.classes
    if ('firstTask' in d) raw.firstTask[date] = d.firstTask
    if ('badDay' in d) raw.badDay[date] = d.badDay
    if (d.badDaySteps && typeof d.badDaySteps === 'object') {
      for (const [i, v] of Object.entries(d.badDaySteps as Record<string, unknown>)) raw.badDaySteps[`${date}:${i}`] = v
    }
  }
  return normalize(raw)
}

/** Paths whose document differs between two states. */
function changedPaths(prev: SavedState, next: SavedState): string[] {
  const out: string[] = []
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  for (const date of new Set([...datesIn(prev), ...datesIn(next)])) {
    if (!same(dayDoc(prev, date), dayDoc(next, date))) out.push(`days/${date}`)
  }
  if (!same(metaDoc(prev), metaDoc(next))) out.push('meta/core')
  const weeks = new Set([...prev.sundayChecks, ...next.sundayChecks].map((c) => c.weekOf))
  for (const w of weeks) if (!same(checkDoc(prev, w), checkDoc(next, w))) out.push(`checks/${w}`)
  return out
}

function hasData(s: SavedState): boolean {
  return (
    Object.keys(s.blocks).length > 0 ||
    Object.keys(s.firstTask).length > 0 ||
    Object.keys(s.doFirst).length > 0 ||
    Object.keys(s.absences).length > 0 ||
    s.sundayChecks.length > 0 ||
    Object.keys(s.checkpointScores).length > 0
  )
}

// ─── Sync engine ──────────────────────────────────────────────────────────────

let started = false

export async function startCloud() {
  if (started) return
  started = true
  const db = await connect()
  resolveDb(db)
  if (!db) {
    setStatus('local')
    return
  }
  setStatus('connecting')

  let days: Record<string, Doc> = {}
  let meta: Doc | null = null
  let checks: Record<string, Doc> = {}
  const got = { days: false, meta: false, checks: false }
  let ready = false

  /** Paths changed here and not yet written, with a counter so a write knows if it is stale. */
  const dirty = new Map<string, number>()
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let flushing = false

  const loadTimer = setTimeout(() => {
    if (!ready) setStatus('offline', 'Your synced data could not be reached yet. Changes stay on this device until it connects.')
  }, 10_000)

  function rebuild() {
    if (!(got.days && got.meta && got.checks)) return
    if (!ready) {
      ready = true
      clearTimeout(loadTimer)
      const cloudEmpty = Object.keys(days).length === 0 && !meta && Object.keys(checks).length === 0
      const local = getState()
      if (cloudEmpty && hasData(local)) {
        // First run in the artifact: upload what this browser already has.
        for (const p of changedPaths(normalize({ version: 1 }), local)) dirty.set(p, (dirty.get(p) ?? 0) + 1)
        if (!dirty.has('meta/core')) dirty.set('meta/core', 1)
        void flush()
        return
      }
      if (status !== 'saving') setStatus('synced')
    }
    const cloud = assemble(days, meta, checks)
    if (dirty.size === 0) {
      applyRemote(cloud)
      return
    }
    // Keep this tab's unsaved edits on top of what the cloud says.
    const local = getState()
    const merged: SavedState = structuredClone(cloud)
    for (const path of dirty.keys()) {
      const [coll, id] = path.split('/')
      if (coll === 'meta') {
        merged.doFirst = local.doFirst
        merged.absences = local.absences
        merged.checkpointScores = local.checkpointScores
      } else if (coll === 'checks') {
        merged.sundayChecks = merged.sundayChecks.filter((c) => c.weekOf !== id)
        const c = local.sundayChecks.find((x) => x.weekOf === id)
        if (c) merged.sundayChecks.push(c)
        merged.sundayChecks.sort((a, b) => a.weekOf.localeCompare(b.weekOf))
      } else {
        for (const key of ['blocks', 'classes', 'firstTask', 'badDay'] as const) {
          const src = local[key] as Record<string, unknown>
          const dst = merged[key] as Record<string, unknown>
          if (id in src) dst[id] = src[id]
          else delete dst[id]
        }
        for (const k of Object.keys(merged.badDaySteps)) if (k.startsWith(`${id}:`)) delete merged.badDaySteps[k]
        for (const [k, v] of Object.entries(local.badDaySteps)) if (k.startsWith(`${id}:`)) merged.badDaySteps[k] = v
      }
    }
    applyRemote(merged)
  }

  function fail(e: DbError) {
    if (e.code === 'revoked' || e.code === 'not_granted') setStatus('error', 'Sync stopped for this visit. Changes stay on this device.')
    else setStatus('offline', 'Lost the connection to your synced data. Reload the page to reconnect.')
  }

  db.collection('days').onSnapshot((snap) => {
    days = Object.fromEntries(snap.docs.filter((d) => d.exists).map((d) => [d.id, d.data() ?? {}]))
    if (!snap.metadata.fromCache) got.days = true
    rebuild()
  }, fail)
  db.doc('meta/core').onSnapshot((snap) => {
    meta = snap.exists ? (snap.data() ?? null) : null
    if (!snap.metadata.fromCache) got.meta = true
    rebuild()
  }, fail)
  db.collection('checks').onSnapshot((snap) => {
    checks = Object.fromEntries(snap.docs.filter((d) => d.exists).map((d) => [d.id, d.data() ?? {}]))
    if (!snap.metadata.fromCache) got.checks = true
    rebuild()
  }, fail)

  async function flush() {
    if (flushing) return
    flushing = true
    setStatus('saving')
    let failed = false
    while (dirty.size > 0) {
      const [path, ver] = dirty.entries().next().value as [string, number]
      const body = docFor(getState(), path)
      try {
        if (body) await db!.doc(path).set(body)
        else await db!.doc(path).delete()
        if (dirty.get(path) === ver) dirty.delete(path)
      } catch (e) {
        failed = true
        const code = (e as DbError)?.code
        if (code === 'unavailable') {
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 800))
          continue
        }
        setStatus('error', `A change could not be saved (${(e as DbError)?.message ?? 'unknown error'}). It is kept on this device.`)
        break
      }
    }
    flushing = false
    if (!failed && ready) setStatus('synced')
    else if (!failed) setStatus('connecting')
  }

  onLocalChange((prev, next) => {
    for (const p of changedPaths(prev, next)) dirty.set(p, (dirty.get(p) ?? 0) + 1)
    if (dirty.size === 0) return
    setStatus('saving')
    if (flushTimer) clearTimeout(flushTimer)
    // Typing in a text field fires on every key: wait for a pause, then write once.
    flushTimer = setTimeout(() => {
      flushTimer = null
      void flush().then(() => {
        if (dirty.size > 0) void flush()
      })
    }, 600)
  })
}
