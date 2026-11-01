import { useState, type CSSProperties, type FormEvent } from 'react'
import { moduleById, modules, type ModuleId } from '../data/plan'
import { daysBetween, shortLabel } from '../lib/dates'
import { useSyncStatus } from '../lib/cloud'
import { addResource, addTask, deleteResource, deleteTask, dismissNudge, setTaskDone, useExtras, type Task } from '../lib/extras'

const modStyle = (id: ModuleId | null) => ({ '--mod': id ? `var(--m-${id})` : 'var(--ink-2)' }) as CSSProperties

function ModuleSelect({ id, value, onChange }: { id: string; value: ModuleId | ''; onChange: (v: ModuleId | '') => void }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as ModuleId | '')}>
      <option value="">No module</option>
      {modules.map((m) => (
        <option key={m.id} value={m.id}>
          {m.short}
        </option>
      ))}
    </select>
  )
}

// ─── Notes from Claude ────────────────────────────────────────────────────────

export function NudgesCard() {
  const nudges = useExtras('nudges')
    .filter((n) => !n.dismissed)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (nudges.length === 0) return null
  return (
    <section className="card nudges" aria-labelledby="nudges-title">
      <h2 id="nudges-title" className="sub-title">
        From Claude
      </h2>
      <ul className="nudge-list">
        {nudges.map((n) => (
          <li key={n.id} className={`nudge is-${n.level}`}>
            <p>
              {n.level !== 'info' && <span className={`badge ${n.level === 'alarm' ? 'badge-alarm' : 'badge-warn'}`}>{n.level === 'alarm' ? 'Urgent' : 'Heads up'}</span>}
              <span className="nudge-text">{n.text}</span>
            </p>
            <div className="nudge-foot">
              <span className="label muted">{n.createdAt.slice(0, 10).split('-').reverse().join('/')}</span>
              <button type="button" className="btn-link" onClick={() => dismissNudge(n)}>
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

function dueBadge(t: Task, today: string) {
  if (!t.due || t.done) return null
  const d = daysBetween(today, t.due)
  if (d < 0) return <span className="badge badge-warn">Overdue {-d} d</span>
  if (d === 0) return <span className="badge badge-accent">Today</span>
  if (d === 1) return <span className="badge">Tomorrow</span>
  return null
}

function TaskRow({ task, today }: { task: Task; today: string }) {
  return (
    <li className={`task${task.done ? ' is-done' : ''}`} style={modStyle(task.module)}>
      <label className="check check-top">
        <input type="checkbox" checked={task.done} onChange={(e) => setTaskDone(task, e.target.checked)} />
        <span>
          <span className="task-title">{task.title}</span>
          <span className="task-meta label">
            {task.module && (
              <span className="task-mod">
                <span className="chip-dot" aria-hidden="true" />
                {moduleById[task.module].short}
              </span>
            )}
            {task.due ? <span>{shortLabel(task.due)}</span> : <span className="muted">No date</span>}
            {task.source === 'claude' && <span className="muted">· added by Claude</span>}
            {dueBadge(task, today)}
          </span>
          {task.note && <span className="task-note">{task.note}</span>}
        </span>
      </label>
      <button type="button" className="btn-link task-del" onClick={() => deleteTask(task)} aria-label={`Delete ${task.title}`}>
        Delete
      </button>
    </li>
  )
}

export function TasksCard({ today }: { today: string }) {
  const tasks = useExtras('tasks')
  const [showDone, setShowDone] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [mod, setMod] = useState<ModuleId | ''>('')

  const open = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt.localeCompare(b.createdAt))
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    addTask({ title, due: due || null, module: mod || null })
    setTitle('')
    setDue('')
  }

  return (
    <section className="card tasks" aria-labelledby="tasks-title">
      <h2 id="tasks-title" className="sub-title">
        Tasks · {open.length} open
      </h2>
      {open.length === 0 ? (
        <p className="muted small">Nothing open. Add a task below, or ask Claude to add one.</p>
      ) : (
        <ul className="task-list">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} today={today} />
          ))}
        </ul>
      )}
      <form className="task-form" onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor="task-title">
            New task
          </label>
          <input id="task-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="TD 4 ex. 2, Micro chapter 3…" autoComplete="off" />
        </div>
        <div className="task-form-row">
          <div className="field">
            <label className="field-label" htmlFor="task-due">
              Due
            </label>
            <input id="task-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="task-mod">
              Module
            </label>
            <ModuleSelect id="task-mod" value={mod} onChange={setMod} />
          </div>
        </div>
        <button type="submit" className="btn" disabled={!title.trim()}>
          Add task
        </button>
      </form>
      {done.length > 0 && (
        <>
          <button type="button" className="btn-link" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide done tasks' : `Show done tasks (${done.length})`}
          </button>
          {showDone && (
            <ul className="task-list">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} today={today} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

// ─── Your resources ───────────────────────────────────────────────────────────

export function UserResources({ active }: { active: ModuleId | null }) {
  const all = useExtras('resources')
  const shown = all.filter((r) => !active || r.module === active).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [mod, setMod] = useState<ModuleId | ''>(active ?? '')
  const urlOk = url.trim() === '' || /^https?:\/\/\S+$/i.test(url.trim())

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !urlOk) return
    addResource({ title, url, module: mod || null, note })
    setTitle('')
    setUrl('')
    setNote('')
  }

  return (
    <div className="section">
      <div className="section-head">
        <h2 className="section-title">Your resources</h2>
        <p className="label muted">
          {shown.length} {active ? `for ${moduleById[active].short}` : 'saved'}
        </p>
      </div>
      <div className="user-res">
        {shown.length === 0 ? (
          <p className="muted small">Nothing saved{active ? ` for ${moduleById[active].short}` : ''} yet. Add a link you found useful, or ask Claude to add one.</p>
        ) : (
          <ul className="user-res-list">
            {shown.map((r) => (
              <li key={r.id} className="card user-res-item" style={modStyle(r.module)}>
                <p className="label muted">
                  {r.module ? moduleById[r.module].short : 'General'}
                  {r.source === 'claude' ? ' · added by Claude' : ''}
                </p>
                <h3 className="res-title">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.title}
                    </a>
                  ) : (
                    r.title
                  )}
                </h3>
                {r.note && <p className="res-meta">{r.note}</p>}
                <button type="button" className="btn-link" onClick={() => deleteResource(r)} aria-label={`Remove ${r.title}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="card res-form" onSubmit={submit}>
          <h3 className="sub-title">Add a resource</h3>
          <div className="field">
            <label className="field-label" htmlFor="res-title">
              Title
            </label>
            <input id="res-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="res-url">
              Link (optional)
            </label>
            <input id="res-url" className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-invalid={!urlOk} aria-describedby={urlOk ? undefined : 'res-url-error'} />
            {!urlOk && (
              <p id="res-url-error" className="field-error">
                Start the link with https:// or http://.
              </p>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="res-mod">
              Module
            </label>
            <ModuleSelect id="res-mod" value={mod} onChange={setMod} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="res-note">
              Why it helps (optional)
            </label>
            <textarea id="res-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button type="submit" className="btn" disabled={!title.trim() || !urlOk}>
            Save resource
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Sync status ──────────────────────────────────────────────────────────────

const statusText: Record<string, string> = {
  local: 'Saved in this browser only. Open the Claude version to sync across devices.',
  connecting: 'Connecting to your synced data…',
  synced: 'Synced. Your phone, laptop and Claude see the same data.',
  saving: 'Saving…',
  offline: 'Not connected.',
  error: 'Sync problem.',
}

export function SyncLine() {
  const { status, detail } = useSyncStatus()
  return (
    <p className={`sync-line label is-${status}`} role="status">
      <span className="sync-dot" aria-hidden="true" />
      {detail || statusText[status]}
    </p>
  )
}

/** Shown above every page only when sync needs attention. */
export function SyncNotice() {
  const { status, detail } = useSyncStatus()
  if (status !== 'offline' && status !== 'error') return null
  return (
    <p className="notice" role="alert">
      {detail || statusText[status]}
    </p>
  )
}
