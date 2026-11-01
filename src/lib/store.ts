import { useSyncExternalStore } from 'react'
import { modules, type ModuleId } from '../data/plan'
import { saveTextFile } from './saveFile'

// ─── Shape ──────────────────────────────────────────────────────────────────

export interface BlockLog {
  done?: boolean
  /** ISO timestamp of when Start was pressed */
  startedAt?: string
  /** Minutes after the planned start (0 if early or on time) */
  delayMin?: number
}

export interface AbsenceRecord {
  count: number
  /** null until you confirm the limit with the scolarité */
  limit: number | null
  /** One entry per +/− press, used to fill "Absences this week" */
  log: { date: string; delta: 1 | -1 }[]
}

export interface SundayCheck {
  /** Sunday the check belongs to (YYYY-MM-DD) */
  weekOf: string
  blocksDone: number
  blocksPlanned: number
  medianDelay: number | null
  grade: number | null
  mean: number | null
  sd: number | null
  absences: number | null
  whatWorked: string
  change: string
  savedAt: string
}

export interface SavedState {
  version: 1
  /** date → block id → log */
  blocks: Record<string, Record<string, BlockLog>>
  /** date → attended classes */
  classes: Record<string, boolean>
  /** date the task is for → text written the night before */
  firstTask: Record<string, string>
  /** "Do these first" item id → done */
  doFirst: Record<string, boolean>
  /** date → using the 40-minute minimum; plus steps ticked as "date:index" */
  badDay: Record<string, boolean>
  badDaySteps: Record<string, boolean>
  absences: Partial<Record<ModuleId, AbsenceRecord>>
  sundayChecks: SundayCheck[]
  /** "checkpoint:partIndex" → score /20 */
  checkpointScores: Record<string, number>
}

export const STORAGE_KEY = 'study-dashboard:v1'

export function emptyState(): SavedState {
  return {
    version: 1,
    blocks: {},
    classes: {},
    firstTask: {},
    doFirst: {},
    badDay: {},
    badDaySteps: {},
    absences: {},
    sundayChecks: [],
    checkpointScores: {},
  }
}

// ─── Validation (used for both localStorage and imported files) ───────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

function boolMap(v: unknown): Record<string, boolean> {
  if (!isObj(v)) return {}
  return Object.fromEntries(Object.entries(v).filter(([, b]) => typeof b === 'boolean')) as Record<string, boolean>
}

export class ImportError extends Error {}

/** Coerce unknown JSON into a valid SavedState, dropping anything malformed. */
export function normalize(raw: unknown): SavedState {
  if (!isObj(raw)) throw new ImportError('The file is not a dashboard backup (expected a JSON object).')
  if (raw.version !== 1) throw new ImportError(`This backup has version ${String(raw.version)}; this app reads version 1.`)

  const out = emptyState()

  if (isObj(raw.blocks)) {
    for (const [date, logs] of Object.entries(raw.blocks)) {
      if (!isDate(date) || !isObj(logs)) continue
      const day: Record<string, BlockLog> = {}
      for (const [id, l] of Object.entries(logs)) {
        if (!isObj(l)) continue
        const log: BlockLog = {}
        if (typeof l.done === 'boolean') log.done = l.done
        if (typeof l.startedAt === 'string') log.startedAt = l.startedAt
        const d = num(l.delayMin)
        if (d !== null) log.delayMin = Math.max(0, Math.round(d))
        day[id] = log
      }
      out.blocks[date] = day
    }
  }

  out.classes = boolMap(raw.classes)
  out.doFirst = boolMap(raw.doFirst)
  out.badDay = boolMap(raw.badDay)
  out.badDaySteps = boolMap(raw.badDaySteps)

  if (isObj(raw.firstTask)) {
    for (const [date, t] of Object.entries(raw.firstTask)) if (isDate(date) && typeof t === 'string') out.firstTask[date] = t
  }

  if (isObj(raw.absences)) {
    const ids = new Set(modules.map((m) => m.id))
    for (const [id, a] of Object.entries(raw.absences)) {
      if (!ids.has(id as ModuleId) || !isObj(a)) continue
      const log = Array.isArray(a.log)
        ? a.log.filter((e): e is { date: string; delta: 1 | -1 } => isObj(e) && typeof e.date === 'string' && (e.delta === 1 || e.delta === -1))
        : []
      const limit = num(a.limit)
      out.absences[id as ModuleId] = {
        count: Math.max(0, Math.round(num(a.count) ?? 0)),
        limit: limit === null ? null : Math.max(0, Math.round(limit)),
        log,
      }
    }
  }

  if (Array.isArray(raw.sundayChecks)) {
    for (const c of raw.sundayChecks) {
      if (!isObj(c) || typeof c.weekOf !== 'string' || !isDate(c.weekOf)) continue
      out.sundayChecks.push({
        weekOf: c.weekOf,
        blocksDone: num(c.blocksDone) ?? 0,
        blocksPlanned: num(c.blocksPlanned) ?? 0,
        medianDelay: num(c.medianDelay),
        grade: num(c.grade),
        mean: num(c.mean),
        sd: num(c.sd),
        absences: num(c.absences),
        whatWorked: str(c.whatWorked),
        change: str(c.change),
        savedAt: str(c.savedAt),
      })
    }
    out.sundayChecks.sort((a, b) => a.weekOf.localeCompare(b.weekOf))
  }

  if (isObj(raw.checkpointScores)) {
    for (const [k, v] of Object.entries(raw.checkpointScores)) {
      const n = num(v)
      if (/^[12]:\d+$/.test(k) && n !== null) out.checkpointScores[k] = n
    }
  }

  return out
}

// ─── Store ──────────────────────────────────────────────────────────────────

type Listener = () => void
const listeners = new Set<Listener>()

/** Why saving might not work, shown once in the UI. */
export let storageProblem: string | null = null

function readStorage(): SavedState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    storageProblem = 'This browser is blocking local storage, so nothing will be kept after you close the tab. Use Export to keep a copy.'
    return emptyState()
  }
  if (!raw) return emptyState()
  try {
    return normalize(JSON.parse(raw))
  } catch {
    // Keep the unreadable data rather than overwrite it.
    try {
      localStorage.setItem(`${STORAGE_KEY}:unreadable-${Date.now()}`, raw)
    } catch {
      /* ignore */
    }
    storageProblem = 'Your saved data could not be read, so the dashboard started empty. The old copy is kept in local storage; import a backup to restore.'
    return emptyState()
  }
}

let state: SavedState = readStorage()

function writeStorage(s: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    if (!storageProblem) {
      storageProblem = 'Saving failed (storage blocked or full). Use Export to keep a copy of your data.'
      emit()
    }
  }
}

function emit() {
  for (const l of listeners) l()
}

export function getState(): SavedState {
  return state
}

// Hooks told about every change made in this tab (the cloud sync pushes them).
type ChangeHook = (prev: SavedState, next: SavedState) => void
const changeHooks = new Set<ChangeHook>()

/** Called after every local change, with the state before and after. */
export function onLocalChange(hook: ChangeHook) {
  changeHooks.add(hook)
  return () => changeHooks.delete(hook)
}

function commitLocal(next: SavedState) {
  const prev = state
  state = next
  writeStorage(state)
  emit()
  for (const h of changeHooks) h(prev, state)
}

export function setState(update: (s: SavedState) => SavedState) {
  commitLocal(update(state))
}

export function replaceState(next: SavedState) {
  commitLocal(next)
}

/** State that arrived from the cloud: shown and cached, but not pushed back. */
export function applyRemote(next: SavedState) {
  if (JSON.stringify(next) === JSON.stringify(state)) return
  state = next
  writeStorage(state)
  emit()
}

function subscribe(l: Listener) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Keep several open tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || e.newValue === null) return
    try {
      state = normalize(JSON.parse(e.newValue))
      emit()
    } catch {
      /* ignore a bad write from another tab */
    }
  })
}

export function useStore<T>(select: (s: SavedState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state))
}

export function useStorageProblem(): string | null {
  return useSyncExternalStore(subscribe, () => storageProblem)
}

// ─── Updaters ───────────────────────────────────────────────────────────────

export function updateBlock(date: string, id: string, patch: Partial<BlockLog> | null) {
  setState((s) => {
    const day = { ...s.blocks[date] }
    if (patch === null) delete day[id]
    else day[id] = { ...day[id], ...patch }
    return { ...s, blocks: { ...s.blocks, [date]: day } }
  })
}

export function setRecord<K extends 'classes' | 'doFirst' | 'badDay' | 'badDaySteps'>(key: K, id: string, value: boolean) {
  setState((s) => ({ ...s, [key]: { ...s[key], [id]: value } }))
}

export function setFirstTask(date: string, text: string) {
  setState((s) => ({ ...s, firstTask: { ...s.firstTask, [date]: text } }))
}

export function emptyAbsence(): AbsenceRecord {
  return { count: 0, limit: null, log: [] }
}

export function updateAbsence(id: ModuleId, update: (a: AbsenceRecord) => AbsenceRecord) {
  setState((s) => ({ ...s, absences: { ...s.absences, [id]: update(s.absences[id] ?? emptyAbsence()) } }))
}

export function saveSundayCheck(check: SundayCheck) {
  setState((s) => {
    const rest = s.sundayChecks.filter((c) => c.weekOf !== check.weekOf)
    return { ...s, sundayChecks: [...rest, check].sort((a, b) => a.weekOf.localeCompare(b.weekOf)) }
  })
}

export function deleteSundayCheck(weekOf: string) {
  setState((s) => ({ ...s, sundayChecks: s.sundayChecks.filter((c) => c.weekOf !== weekOf) }))
}

export function setCheckpointScore(key: string, value: number | null) {
  setState((s) => {
    const next = { ...s.checkpointScores }
    if (value === null) delete next[key]
    else next[key] = value
    return { ...s, checkpointScores: next }
  })
}

// ─── Backup ─────────────────────────────────────────────────────────────────

export function exportJSON(today: string) {
  void saveTextFile(`study-dashboard-${today}.json`, JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2))
}

export async function parseBackup(file: File): Promise<SavedState> {
  const text = await file.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new ImportError(`${file.name} is not valid JSON.`)
  }
  return normalize(json)
}
