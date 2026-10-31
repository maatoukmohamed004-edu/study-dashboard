import { useId } from 'react'
import { doFirst, modules, rules, type Module } from '../data/plan'
import { useToday } from '../lib/env'
import { Hero, StatusStrip } from '../components/ui/Hud'
import { emptyAbsence, updateAbsence, useStore, type AbsenceRecord } from '../lib/store'

type Status = 'unset' | 'ok' | 'warn' | 'limit' | 'over'

function absenceStatus(a: AbsenceRecord): Status {
  if (a.limit === null) return 'unset'
  if (a.count > a.limit) return 'over'
  if (a.count === a.limit) return 'limit'
  if (a.count === a.limit - 1) return 'warn'
  return 'ok'
}

function statusText(a: AbsenceRecord, s: Status): string {
  switch (s) {
    case 'unset':
      return 'Limit not set yet.'
    case 'ok': {
      const left = a.limit! - a.count
      return `${left} absences left before the limit.`
    }
    case 'warn':
      return 'One absence before the limit.'
    case 'limit':
      return 'At the limit: one more absence puts you above it.'
    case 'over':
      return `Over the limit by ${a.count - a.limit!}.`
  }
}

export function AbsencesPage() {
  const all = useStore((s) => s.absences)
  const rule = rules[0]
  const scolarite = doFirst.find((d) => d.id === 'absence-count')

  const statuses = modules.map((m) => absenceStatus(all[m.id] ?? emptyAbsence()))
  const red = statuses.filter((s) => s === 'limit' || s === 'over').length
  const amber = statuses.filter((s) => s === 'warn').length
  const unset = statuses.filter((s) => s === 'unset').length

  const total = modules.reduce((n, m) => n + (all[m.id]?.count ?? 0), 0)
  const withLimit = modules.filter((m) => all[m.id]?.limit !== null && all[m.id]?.limit !== undefined && all[m.id]!.limit! > 0)
  const closest = withLimit
    .map((m) => ({ m, ratio: all[m.id]!.count / all[m.id]!.limit!, rec: all[m.id]! }))
    .sort((a, b) => b.ratio - a.ratio)[0]

  return (
    <div className="absences-page">
      <StatusStrip
        label="Absences overview"
        cells={[
          { top: 'Rule', bottom: 'Above 20% → no exam' },
          { top: 'Limits set', bottom: `${modules.length - unset} of ${modules.length}` },
          { top: 'At or over limit', bottom: String(red) },
          { top: 'One away', bottom: String(amber) },
        ]}
      />
      <Hero
        index="05"
        tag="Absences · per module"
        number={total}
        unit={total === 1 ? 'Absence' : 'Absences'}
        numberLabel={`${total} ${total === 1 ? 'absence' : 'absences'} in total`}
        progress={closest ? { value: closest.ratio, label: `Closest to its limit: ${closest.m.name}, ${closest.rec.count} of ${closest.rec.limit}` } : undefined}
        meta={{
          left: closest
            ? { k: 'Closest to limit', v: closest.m.short, s: `${closest.rec.count} of ${closest.rec.limit}` }
            : { k: 'Closest to limit', v: 'No limits set', s: 'Add them below' },
          right: { k: 'Confirm', v: scolarite ? scolarite.when : 'At the scolarité', s: 'Official count and limits' },
        }}
        lede={
          <p>
            <strong>{rule.title}</strong> {rule.text}
          </p>
        }
        title="Absences"
      />

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">By module</h2>
          <p className="label muted">Amber one before the limit · red at it</p>
        </div>
      <p className="abs-summary" aria-live="polite">
        {red > 0 && (
          <span className="abs-pill s-limit label">
            <StatusIcon s="limit" /> {red} at or over the limit
          </span>
        )}
        {amber > 0 && (
          <span className="abs-pill s-warn label">
            <StatusIcon s="warn" /> {amber} one away from the limit
          </span>
        )}
        {unset > 0 && (
          <span className="abs-pill s-unset label">
            {unset} of {modules.length} limits not set
          </span>
        )}
        {red === 0 && amber === 0 && unset === 0 && <span className="abs-pill s-ok label">All modules below their limit</span>}
      </p>

        <ul className="abs-grid">
          {modules.map((m) => (
            <AbsenceCard key={m.id} module={m} record={all[m.id] ?? emptyAbsence()} />
          ))}
        </ul>
        {scolarite && (
          <p className="field-hint abs-foot">
            To confirm at the scolarité ({scolarite.when}): {scolarite.text.charAt(0).toLowerCase() + scolarite.text.slice(1)}
          </p>
        )}
      </div>
    </div>
  )
}

function AbsenceCard({ module: m, record: a }: { module: Module; record: AbsenceRecord }) {
  const today = useToday()
  const id = useId()
  const s = absenceStatus(a)

  const add = (delta: 1 | -1) =>
    updateAbsence(m.id, (r) => {
      const count = Math.max(0, r.count + delta)
      if (count === r.count) return r
      return { ...r, count, log: [...r.log, { date: today, delta }] }
    })

  return (
    <li className={`card abs-card s-${s}`} aria-labelledby={`${id}-name`}>
      <h3 id={`${id}-name`} className="abs-name label">
        {m.name}
      </h3>

      <div className="abs-counter">
        <button type="button" className="btn btn-icon" onClick={() => add(-1)} disabled={a.count === 0} aria-label={`Remove one ${m.name} absence`}>
          <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <label className="sr-only" htmlFor={`${id}-count`}>
          {m.name} absences
        </label>
        <input
          id={`${id}-count`}
          className="abs-count display"
          type="number"
          inputMode="numeric"
          min={0}
          value={a.count}
          onChange={(e) => {
            const n = Math.max(0, Math.round(Number(e.target.value) || 0))
            updateAbsence(m.id, (r) => ({ ...r, count: n }))
          }}
          aria-describedby={`${id}-status`}
        />
        <button type="button" className="btn btn-icon" onClick={() => add(1)} aria-label={`Add one ${m.name} absence`}>
          <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true">
            <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="abs-limit">
        <label className="label" htmlFor={`${id}-limit`}>Limit</label>
        <input
          id={`${id}-limit`}
          className="input abs-limit-input"
          type="number"
          inputMode="numeric"
          min={0}
          value={a.limit ?? ''}
          onChange={(e) => {
            const v = e.target.value
            updateAbsence(m.id, (r) => ({ ...r, limit: v === '' ? null : Math.max(0, Math.round(Number(v) || 0)) }))
          }}
        />
      </div>

      <p id={`${id}-status`} className="abs-status">
        {s !== 'unset' && s !== 'ok' && <StatusIcon s={s} />}
        {statusText(a, s)}
      </p>
      {m.absenceNote && <p className="abs-note">{m.absenceNote}</p>}
    </li>
  )
}

function StatusIcon({ s }: { s: Status }) {
  if (s === 'warn')
    return (
      <svg className="abs-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M8 1.5 15 14H1z" fill="currentColor" />
        <path d="M8 6v3.5M8 11.6v.4" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg className="abs-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="var(--bg)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
