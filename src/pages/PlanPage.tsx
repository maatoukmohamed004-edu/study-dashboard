import { useEffect, useId, type CSSProperties } from 'react'
import {
  badDay,
  checkpointMarking,
  checkpoints,
  checkpointScale,
  doFirst,
  examMode,
  fixedDates,
  goal,
  modules,
  rules,
  weekByWeek,
  weeks,
  type Checkpoint,
  type PlanWeek,
  type Verdict,
} from '../data/plan'
import { Rich } from '../components/Rich'
import { daysBetween, ddmm, shortLabel } from '../lib/dates'
import { useToday } from '../lib/env'
import { hoursLabel, weekFor } from '../lib/schedule'
import { setCheckpointScore, setRecord, useStore } from '../lib/store'
import { fmt } from '../lib/stats'
import { Diamond } from '../components/icons'
import { Hero, StatusStrip } from '../components/ui/Hud'

export function PlanPage({ section }: { section: string | null }) {
  const today = useToday()
  const current = weekFor(today)

  useEffect(() => {
    if (!section) return
    // Wait a frame so the page has laid out before scrolling.
    const id = requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(id)
  }, [section])

  const elapsed = current ? current.index + 1 : today < weeks[0].start ? 0 : weeks.length
  const now = current ? weeks[current.index] : null
  const nextCheckpoint = checkpoints.find((c) => c.date >= today)

  return (
    <div className="plan-page">
      <StatusStrip
        label="Plan overview"
        cells={[
          { top: 'Goal', bottom: goal.title },
          { top: 'Target', bottom: `z ≥ ${goal.k} in every period` },
          { top: 'Weeks', bottom: `${weeks.length} · ${ddmm(weeks[0].start)} → exams` },
          { top: 'Next checkpoint', bottom: nextCheckpoint ? nextCheckpoint.when.split(',')[0] : 'Done' },
        ]}
      />
      <Hero
        index="03"
        tag="Plan · week by week"
        number={`${elapsed} / ${weeks.length}`}
        unit="Weeks"
        numberLabel={`Week ${elapsed} of ${weeks.length}`}
        progress={{ value: elapsed / weeks.length, label: `Week ${elapsed} of ${weeks.length}` }}
        meta={{
          left: { k: 'From', v: `${ddmm(weeks[0].start)} · restart`, s: `${hoursLabel(weeks[0])} the first week` },
          right: { k: 'Now', v: now ? `Week ${elapsed} · ${now.label}` : today < weeks[0].start ? 'Before the plan' : 'After the plan', s: now ? hoursLabel(now) : '' },
        }}
        lede={
          <>
            <p>{goal.text}</p>
            <Formula />
          </>
        }
        title={goal.title.replace(' of 54', '')}
      />

      <div className="plan-layout section">
        <section aria-labelledby="timeline-title" className="plan-main">
          <div className="section-head">
            <h2 id="timeline-title" className="section-title">
              Week by week
            </h2>
            <p className="label muted">{weeks.length} weeks</p>
          </div>
          <p className="muted plan-intro">{weekByWeek.intro}</p>
          <ol className="timeline">
            {weeks.map((w, i) => (
              <WeekNode key={w.start} week={w} n={i + 1} today={today} current={current?.index === i} />
            ))}
          </ol>
        </section>

        <aside className="plan-side">
          <DoFirstList />
          <ModulePriority />
        </aside>
      </div>

      <section id="checkpoints" className="plan-section section" aria-labelledby="checkpoints-title">
        <div className="section-head">
          <h2 id="checkpoints-title" className="section-title">
            Checkpoints
          </h2>
          <p className="label muted">2 checkpoints</p>
        </div>
        <p className="muted">{checkpointMarking}</p>
        <div className="cp-grid">
          {checkpoints.map((cp) => (
            <CheckpointCard key={cp.n} cp={cp} />
          ))}
        </div>
        <ScaleTable />
      </section>

      <section id="rules" className="plan-section section" aria-labelledby="rules-title">
        <div className="section-head">
          <h2 id="rules-title" className="section-title">
            Rules, bad days, exam weeks
          </h2>
          <p className="label muted">6 rules</p>
        </div>
        <div className="rules-grid">
          <div className="card">
            <h3 className="sub-title">Six rules</h3>
            <ol className="numbered">
              {rules.map((r) => (
                <li key={r.title}>
                  <strong>{r.title}</strong> {r.text}
                </li>
              ))}
            </ol>
          </div>
          <div className="card">
            <h3 className="sub-title">{badDay.title}</h3>
            <ol className="numbered">
              {badDay.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="rules-foot">{badDay.footer}</p>
          </div>
          <div className="card rules-exam">
            <h3 className="sub-title">{examMode.title}</h3>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">What to do</th>
                </tr>
              </thead>
              <tbody>
                {examMode.items.map((i) => (
                  <tr key={i.id}>
                    <td className="num">{i.time.replace(/^19:00$/, 'After 19:00')}</td>
                    <td>{i.text.replace(/^After 19:00: f/, 'F')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rules-foot">{examMode.dayBefore}</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function Formula() {
  const { k, example } = goal
  return (
    <div className="formula" role="math" aria-label={`target approximately equals mean plus ${k} standard deviations, which is ${example.mean} plus ${k} times ${example.sd}, about ${example.target}`}>
      <span className="f-var">target</span>
      <span className="f-op">≈</span>
      <span>
        <span className="f-var">μ</span> + {k}
        <span className="f-var">σ</span>
      </span>
      <span className="f-op">=</span>
      <span className="num">
        {example.mean} + {k} × {example.sd}
      </span>
      <span className="f-op">≈</span>
      <span className="num f-result">{example.target}</span>
    </div>
  )
}

function WeekNode({ week, n, today, current }: { week: PlanWeek; n: number; today: string; current: boolean }) {
  const past = week.end !== null && week.end < today
  const events = fixedDates.filter((f) => f.date >= week.start && (week.end === null || f.date <= week.end))
  const until = daysBetween(today, week.start)
  const state = current ? 'is-current' : past ? 'is-past' : 'is-future'

  return (
    <li className={`tl-week ${state}`} aria-current={current ? 'step' : undefined}>
      <span className="tl-node" aria-hidden="true" />
      <div className={current ? 'card tl-body' : 'tl-body'}>
        <p className="tl-head">
          <span className="tl-label display">{week.label}</span>
          <span className="tl-hours label">{hoursLabel(week)}</span>
          {current && <span className="badge badge-accent label">This week</span>}
          {!current && n === 1 && until > 0 && <span className="badge label">Starts in {until} {until === 1 ? 'day' : 'days'}</span>}
          <span className="sr-only">, week {n}</span>
        </p>
        <p className="tl-focus">
          <Rich text={week.focus} />
        </p>
        {events.length > 0 && (
          <ul className="tl-events">
            {events.map((e) => (
              <li key={e.id} className={`tl-event label${e.kind === 'checkpoint' ? ' is-checkpoint' : ''}`}>
                <Diamond />
                <span className="tl-event-date">{shortLabel(e.date)}</span>{' '}
                {e.checkpoint ? <a href="#/plan/checkpoints">{e.label}</a> : e.label}
                {e.start && <span className="tl-event-time">, {e.start}–{e.end}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

function verdictFor(cp: Checkpoint, score: number): Verdict {
  if (score >= cp.onTrackFrom) return 'on-track'
  if (score >= cp.behindFrom) return 'behind'
  return 'far'
}

function CheckpointCard({ cp }: { cp: Checkpoint }) {
  const scores = useStore((s) => s.checkpointScores)
  const base = useId()
  return (
    <article className="card cp-card" aria-labelledby={`${base}-t`}>
      <h3 id={`${base}-t`} className="cp-title">
        <Diamond /> Checkpoint {cp.n}
      </h3>
      <p className="cp-when label">{cp.when}</p>
      <ul className="cp-parts">
        {cp.parts.map((p, i) => {
          const key = `${cp.n}:${i}`
          const score = scores[key]
          const v = score === undefined ? null : verdictFor(cp, score)
          const row = v && checkpointScale.find((r) => r.verdict === v)!
          return (
            <li key={key} className="cp-part">
              <label className="cp-label" htmlFor={`${base}-${i}`}>
                {p.label}
              </label>
              <div className="cp-score">
                <input
                  id={`${base}-${i}`}
                  className="input cp-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={20}
                  step={0.25}
                  value={score ?? ''}
                  onChange={(e) => {
                    const n = e.target.value === '' ? null : Number(e.target.value)
                    setCheckpointScore(key, n === null || Number.isNaN(n) ? null : Math.min(20, Math.max(0, n)))
                  }}
                  aria-describedby={`${base}-${i}-v`}
                />
                <span className="muted">/20</span>
              </div>
              <p id={`${base}-${i}-v`} className={`cp-verdict${v ? ` v-${v}` : ''}`} aria-live="polite">
                {row ? (
                  <>
                    <strong>{row.meaning}.</strong> {row.change === 'Nothing' ? 'Change nothing.' : `${row.change}.`}
                  </>
                ) : (
                  <span className="muted">
                    On track from {fmt(cp.onTrackFrom)}, behind from {fmt(cp.behindFrom)}.
                  </span>
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </article>
  )
}

function ScaleTable() {
  return (
    <div className="card scale">
      <table className="table">
        <caption className="sub-title">What a checkpoint score means</caption>
        <thead>
          <tr>
            <th scope="col">Score /20 (Checkpoint 2 in brackets)</th>
            <th scope="col">Meaning</th>
            <th scope="col">What to change</th>
          </tr>
        </thead>
        <tbody>
          {checkpointScale.map((r) => (
            <tr key={r.verdict}>
              <td className="num">{r.score}</td>
              <td>
                <span className={`dot v-${r.verdict}`} aria-hidden="true" />
                {r.meaning}
              </td>
              <td>{r.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DoFirstList() {
  const done = useStore((s) => s.doFirst)
  return (
    <section className="card" aria-labelledby="plan-do-first">
      <h2 id="plan-do-first" className="sub-title">
        Do these first
      </h2>
      <ul className="do-first-list">
        {doFirst.map((item) => (
          <li key={item.id}>
            <label className="check check-top">
              <input type="checkbox" checked={!!done[item.id]} onChange={(e) => setRecord('doFirst', item.id, e.target.checked)} />
              <span>
                <span className="do-when">{item.when}</span>
                <span className="do-text">
                  <Rich text={item.text} />
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ModulePriority() {
  const ranked = modules.filter((m) => m.priority <= 6)
  const rest = modules.filter((m) => m.priority > 6)
  return (
    <section className="card" aria-labelledby="plan-priority">
      <h2 id="plan-priority" className="sub-title">
        Module priority
      </h2>
      <ol className="priority">
        {ranked.map((m) => (
          <li key={m.id} style={{ '--mod': `var(--m-${m.id})` } as CSSProperties}>
            <span className="priority-name">
              {m.name}
              {m.coef && <span className="muted"> (coef. {m.coef})</span>}
            </span>
            <span className="priority-why">{m.why}</span>
          </li>
        ))}
        <li style={{ '--mod': 'var(--m-none)' } as CSSProperties}>
          <span className="priority-name">{rest.map((m) => (m.id === 'r' ? 'R' : m.name)).join(', ')}</span>
          <span className="priority-why">Class work only.</span>
        </li>
      </ol>
    </section>
  )
}
