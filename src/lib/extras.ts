/**
 * Things you (or Claude) add on top of the plan: tasks, resources and notes from Claude.
 *
 * In the Claude artifact each item is one document (tasks/<id>, resources/<id>, nudges/<id>),
 * so Claude can add, edit or tick them from a chat or a scheduled task. Outside the artifact
 * they are kept in this browser under `study-dashboard:extras:v1` (separate from progress).
 */
import { useSyncExternalStore } from 'react'
import { modules, type ModuleId } from '../data/plan'
import { dbReady, type Db } from './cloud'
import { showToast } from './toast'

export interface Task {
  id: string
  title: string
  /** YYYY-MM-DD, or null for "no date" */
  due: string | null
  module: ModuleId | null
  note: string
  done: boolean
  doneAt: string | null
  /** Who added it */
  source: 'me' | 'claude'
  createdAt: string
}

export interface UserResource {
  id: string
  module: ModuleId | null
  title: string
  url: string
  note: string
  source: 'me' | 'claude'
  createdAt: string
}

export interface Nudge {
  id: string
  text: string
  level: 'info' | 'warn' | 'alarm'
  createdAt: string
  dismissed: boolean
}

interface Extras {
  tasks: Task[]
  resources: UserResource[]
  nudges: Nudge[]
}

type Kind = keyof Extras
const LOCAL_KEY = 'study-dashboard:extras:v1'

// ─── Coercion (Claude and older versions may write slightly different shapes) ──

const moduleIds = new Set<string>(modules.map((m) => m.id))
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
const mod = (v: unknown) => (typeof v === 'string' && moduleIds.has(v) ? (v as ModuleId) : null)
const src = (v: unknown): 'me' | 'claude' => (v === 'claude' ? 'claude' : 'me')

function toTask(id: string, d: unknown): Task | null {
  if (!isObj(d) || !str(d.title).trim()) return null
  return {
    id,
    title: str(d.title).trim(),
    due: date(d.due),
    module: mod(d.module),
    note: str(d.note),
    done: d.done === true,
    doneAt: typeof d.doneAt === 'string' ? d.doneAt : null,
    source: src(d.source),
    createdAt: str(d.createdAt, new Date(0).toISOString()),
  }
}

function toResource(id: string, d: unknown): UserResource | null {
  if (!isObj(d) || !str(d.title).trim()) return null
  const url = str(d.url).trim()
  return {
    id,
    title: str(d.title).trim(),
    url: /^https?:\/\//i.test(url) ? url : '',
    module: mod(d.module),
    note: str(d.note),
    source: src(d.source),
    createdAt: str(d.createdAt, new Date(0).toISOString()),
  }
}

function toNudge(id: string, d: unknown): Nudge | null {
  if (!isObj(d) || !str(d.text).trim()) return null
  const level = d.level === 'warn' || d.level === 'alarm' ? d.level : 'info'
  return { id, text: str(d.text).trim(), level, createdAt: str(d.createdAt, new Date(0).toISOString()), dismissed: d.dismissed === true }
}

const coerce = { tasks: toTask, resources: toResource, nudges: toNudge } as const

// ─── Store ────────────────────────────────────────────────────────────────────

function readLocal(): Extras {
  const empty: Extras = { tasks: [], resources: [], nudges: [] }
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return empty
    const j = JSON.parse(raw) as Record<string, unknown>
    const out = { ...empty }
    for (const kind of ['tasks', 'resources', 'nudges'] as const) {
      const list = Array.isArray(j[kind]) ? (j[kind] as unknown[]) : []
      // @ts-expect-error each kind's coerce returns that kind's item type
      out[kind] = list.map((x) => (isObj(x) ? coerce[kind](str(x.id), x) : null)).filter(Boolean)
    }
    return out
  } catch {
    return empty
  }
}

let extras: Extras = readLocal()
let db: Db | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}
function saveLocal() {
  if (db) return
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(extras))
  } catch {
    /* storage blocked: items live for this visit only */
  }
}
function setKind<K extends Kind>(kind: K, list: Extras[K]) {
  extras = { ...extras, [kind]: list }
  saveLocal()
  emit()
}

export function useExtras<K extends Kind>(kind: K): Extras[K] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => extras[kind],
  )
}

void dbReady.then((d) => {
  if (!d) return
  db = d
  for (const kind of ['tasks', 'resources', 'nudges'] as const) {
    d.collection(kind).onSnapshot(
      (snap) => {
        const list = snap.docs
          .filter((x) => x.exists)
          .map((x) => coerce[kind](x.id, x.data()))
          .filter(Boolean)
        setKind(kind, list as never)
      },
      () => {
        /* status and messaging are owned by the progress sync */
      },
    )
  }
})

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

async function write<K extends Kind>(kind: K, item: Extras[K][number] | null, id: string) {
  // Optimistic: show it now, the database snapshot confirms it.
  const others = (extras[kind] as { id: string }[]).filter((x) => x.id !== id)
  setKind(kind, (item ? [...others, item] : others) as Extras[K])
  if (!db) return
  try {
    if (item) {
      const { id: _drop, ...body } = item as unknown as { id: string } & Record<string, unknown>
      void _drop
      await db.collection(kind).doc(id).set(body)
    } else await db.collection(kind).doc(id).delete()
  } catch (e) {
    showToast(`Could not save that change (${(e as { message?: string })?.message ?? 'unknown error'}).`, { tone: 'error' })
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function addTask(input: { title: string; due: string | null; module: ModuleId | null; note?: string }) {
  const id = newId('t')
  void write('tasks', { id, title: input.title.trim(), due: input.due, module: input.module, note: input.note ?? '', done: false, doneAt: null, source: 'me', createdAt: new Date().toISOString() }, id)
}

export function setTaskDone(task: Task, done: boolean) {
  void write('tasks', { ...task, done, doneAt: done ? new Date().toISOString() : null }, task.id)
}

export function deleteTask(task: Task) {
  void write('tasks', null, task.id)
  showToast(`Deleted “${task.title}”.`, { action: { label: 'Undo', run: () => void write('tasks', task, task.id) } })
}

export function addResource(input: { title: string; url: string; module: ModuleId | null; note?: string }) {
  const id = newId('r')
  void write('resources', { id, title: input.title.trim(), url: input.url.trim(), module: input.module, note: input.note ?? '', source: 'me', createdAt: new Date().toISOString() }, id)
}

export function deleteResource(r: UserResource) {
  void write('resources', null, r.id)
  showToast(`Removed “${r.title}”.`, { action: { label: 'Undo', run: () => void write('resources', r, r.id) } })
}

export function dismissNudge(n: Nudge) {
  void write('nudges', { ...n, dismissed: true }, n.id)
}
