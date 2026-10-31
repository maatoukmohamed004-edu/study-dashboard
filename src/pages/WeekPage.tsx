import { useMemo, useState, type CSSProperties } from 'react'
import { everyDay, fixedDates, moduleById, planStart, weeks } from '../data/plan'
import { Rich } from '../components/Rich'
import { plain } from '../lib/text'
import { addDays, ddmm, durationLabel, minutesOf, mondayOf, shortLabel } from '../lib/dates'
import { useMedia, useToday } from '../lib/env'
import { hoursLabel, plannedMinutes, weekSchedule, type DaySchedule } from '../lib/schedule'
import { useStore, type SavedState } from '../lib/store'
import { useWeekStats } from '../lib/useWeekProgress'
import { Chevron, Diamond } from '../components/icons'
import { GlassLayer } from '../components/glass/GlassLayer'
import { Hero, StatusStrip } from '../components/ui/Hud'

const DAY_START = minutesOf('08:00')
const DAY_END = minutesOf('20:00')
const SLOT = 5 // minutes per grid row
const UNTIMED_LENGTH = 30 // drawn height for items with a start time only

/** A module's colour plus its precomputed tint and border (set in applyTheme). */
const modVars = (module: string | undefined) => {
  const id = module ?? 'none'
  return { '--mod': `var(--m-${id})`, '--mod-tint': `var(--m-${id}-tint)`, '--mod-line': `var(--m-${id}-line)` }
}

const firstMonday = mondayOf(planStart)
const lastMonday = mondayOf(fixedDates.reduce((max, f) => (f.date > max ? f.date : max), planStart))

function clampMonday(m: string) {
  return m < firstMonday ? firstMonday : m > lastMonday ? lastMonday : m
}

const row = (hhmm: string) => Math.round((minutesOf(hhmm) - DAY_START) / SLOT) + 2
const rowEnd = (start: string, end?: string) => (end ? row(end) : row(start) + UNTIMED_LENGTH / SLOT)

export function WeekPage() {
  const today = useToday()
  const [monday, setMonday] = useState(() => clampMonday(mondayOf(today)))
  const days = useMemo(() => weekSchedule(monday), [monday])
  const stats = useWeekStats(monday)
  const wide = useMedia('(min-width: 900px)')
  const logs = useStore((s) => s.blocks)

  const planWeeks = weeks
    .map((w, i) => ({ w, n: i + 1 }))
    .filter(({ w }) => days.some((d) => d.date >= w.start && (w.end === null || d.date <= w.end)))
  const sunday = addDays(monday, 6)

  const current = planWeeks[planWeeks.length - 1]
  const weekNo = current ? current.n : null
  const minutes = days.reduce((m, d) => m + plannedMinutes(d), 0)
  const nav = (
    <>
      <button type="button" className="btn" disabled={monday <= firstMonday} onClick={() => setMonday(addDays(monday, -7))}>
        <GlassLayer target="buttons" bezel={8} strengthScale={0.5} />
        <Chevron dir="left" />
        <span>Previous week</span>
      </button>
      {mondayOf(today) !== monday && mondayOf(today) >= firstMonday && mondayOf(today) <= lastMonday && (
        <button type="button" className="btn" onClick={() => setMonday(mondayOf(today))}>
          <GlassLayer target="buttons" bezel={8} strengthScale={0.5} />
          <span>This week</span>
        </button>
      )}
      <button type="button" className="btn" disabled={monday >= lastMonday} onClick={() => setMonday(addDays(monday, 7))}>
        <GlassLayer target="buttons" bezel={8} strengthScale={0.5} />
        <span>Next week</span>
        <Chevron dir="right" />
      </button>
    </>
  )

  return (
    <div className="week-page">
      <StatusStrip
        label="Week overview"
        cells={[
          { top: 'Week of', bottom: `${ddmm(monday)}–${ddmm(sunday)}` },
          { top: weekNo ? `Plan week ${weekNo}` : 'Plan week', bottom: planWeeks.map(({ w }) => w.label).join(' + ') || 'Outside the plan' },
          { top: 'Planned', bottom: minutes ? durationLabel(minutes) : 'No blocks' },
          { top: 'Done', bottom: `${stats.done} of ${stats.planned} blocks` },
        ]}
      />
      <Hero
        index="02"
        tag={`Week · ${ddmm(monday)}–${ddmm(sunday)}${mondayOf(today) === monday ? ' · this week' : ''}`}
        live={mondayOf(today) === monday}
        number={`${stats.done} / ${stats.planned}`}
        unit="Blocks"
        numberLabel={`${stats.done} of ${stats.planned} blocks done this week`}
        progress={stats.planned ? { value: stats.done / stats.planned, label: `${stats.done} of ${stats.planned} blocks done this week` } : undefined}
        meta={{
          left: { k: 'From', v: shortLabel(monday), s: weekNo ? `Week ${weekNo} of ${weeks.length}` : 'Before the plan' },
          right: { k: 'To', v: shortLabel(sunday), s: current ? hoursLabel(current.w) : '' },
        }}
        lede={
          <div className="week-focus">
            {planWeeks.map(({ w, n }) => (
              <p key={n}>
                <strong>
                  Week {n}, {w.label}:
                </strong>{' '}
                <Rich text={w.focus} />
              </p>
            ))}
          </div>
        }
        actions={nav}
        title={weekNo ? `Week ${String(weekNo).padStart(2, '0')}` : 'Week'}
      />

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">Timetable</h2>
          <p className="label muted">Mon–Sun · 08:00–20:00</p>
        </div>
      <Legend />

      {wide ? (
        <>
          {/* The grid is visual only; screen readers get the same week as a list. */}
          <Grid days={days} today={today} logs={logs} />
          <div className="sr-only">
            <DayList days={days} today={today} logs={logs} />
          </div>
        </>
      ) : (
        <DayList days={days} today={today} logs={logs} />
      )}

        <div className="week-notes muted small">
          <p>{everyDay.commute}</p>
          <p>{everyDay.sideWork}</p>
        </div>
      </div>
    </div>
  )
}

function dayTotal(d: DaySchedule): string {
  if (d.mode === 'rest') return 'Rest day'
  if (d.mode === 'exam') return 'Exam mode'
  return d.blocks.length ? durationLabel(plannedMinutes(d)) : 'No blocks'
}

function Legend() {
  return (
    <ul className="legend label" aria-label="Legend">
      <li>
        <span className="swatch swatch-classes" aria-hidden="true" /> Classes
      </li>
      <li>
        <span className="swatch swatch-block" aria-hidden="true" /> Study block
      </li>
      <li>
        <span className="swatch swatch-later" aria-hidden="true" /> Joins in a later week
      </li>
      <li>
        <span className="swatch swatch-event" aria-hidden="true" /> Fixed date
      </li>
    </ul>
  )
}

type Logs = SavedState['blocks']

function Grid({ days, today, logs }: { days: DaySchedule[]; today: string; logs: Logs }) {
  const hours: string[] = []
  for (let m = DAY_START; m < DAY_END; m += 60) hours.push(`${String(m / 60).padStart(2, '0')}:00`)
  const rows = (DAY_END - DAY_START) / SLOT

  return (
    <div className="card wk-card">
      <div className="wk-grid" style={{ '--rows': rows } as CSSProperties} aria-hidden="true">
        <div className="wk-corner" />
        {days.map((d, i) => (
          <div
            key={d.date}
            className={`wk-dayhead${d.date === today ? ' is-today' : ''}`}
            style={{ gridColumn: i + 2 }}
          >
            <span className="wk-dayname">{shortLabel(d.date)}</span>
            <span className="wk-daytotal">{dayTotal(d)}</span>
            {d.events.map((e) => (
              <span key={e.id} className="wk-chip">
                <Diamond /> {e.label}
                {e.start && (
                  <span className="wk-chip-time">
                    {' '}
                    {e.start}
                    {e.end && `–${e.end}`}
                  </span>
                )}
              </span>
            ))}
          </div>
        ))}

        {hours.map((h) => (
          <div key={h} className="wk-hour" style={{ gridRow: `${row(h)} / span ${60 / SLOT}` }} aria-hidden="true">
            {h}
          </div>
        ))}

        {days.map((d, i) => (
          <div key={`col-${d.date}`} className={`wk-col${d.date === today ? ' is-today' : ''}`} style={{ gridColumn: i + 2 }} />
        ))}

        {days.map((d, i) => {
          const col = i + 2
          const items = []
          if (d.classes)
            items.push(
              <div key="c" className="wk-item wk-classes" style={{ gridColumn: col, gridRow: `${row(d.classes.start)} / ${row(d.classes.end)}` }}>
                <span className="wk-time">
                  {d.classes.start}–{d.classes.end}
                </span>
                <span className="wk-title">Classes</span>
              </div>,
            )
          for (const b of d.blocks) {
            const done = logs[d.date]?.[b.id]?.done
            const short = rowEnd(b.start, b.end) - row(b.start) <= 30 / SLOT
            items.push(
              <div
                key={b.id}
                className={`wk-item wk-block${b.kind === 'exam' ? ' wk-exam' : ''}${done ? ' is-done' : ''}${short ? ' is-short' : ''}`}
                style={{ gridColumn: col, gridRow: `${row(b.start)} / ${rowEnd(b.start, b.end)}`, ...modVars(b.module) } as CSSProperties}
                title={`${b.start}${b.end ? `–${b.end}` : ''} ${b.title}`}
              >
                <span className="wk-time">
                  {b.start}
                  {b.end && `–${b.end}`}
                </span>
                <span className="wk-title">
                  {b.label}
                  {done && <span className="sr-only">, done</span>}
                </span>
              </div>,
            )
          }
          for (const b of d.laterBlocks)
            items.push(
              <div key={`later-${b.id}`} className={`wk-item wk-later${row(b.end) - row(b.start) <= 30 / SLOT ? ' is-short' : ''}`} style={{ gridColumn: col, gridRow: `${row(b.start)} / ${row(b.end)}` }}>
                <span className="wk-time">
                  {b.start}–{b.end}
                </span>
                <span className="wk-title">{b.module ? moduleById[b.module].short : b.title}</span>
                <span className="sr-only">, joins in a later week</span>
              </div>,
            )
          for (const e of d.events.filter((e) => e.start))
            items.push(
              // Outline only, so the blocks it overlaps stay readable; its label is in the day header.
              <div key={e.id} className="wk-item wk-event" style={{ gridColumn: col, gridRow: `${row(e.start!)} / ${rowEnd(e.start!, e.end)}` }} />,
            )
          for (const n of d.notes)
            items.push(
              <div key={`n-${n.time}`} className="wk-item wk-note is-short" style={{ gridColumn: col, gridRow: `${row(n.time)} / span ${UNTIMED_LENGTH / SLOT}` }}>
                <span className="wk-title">{n.label}</span>
              </div>,
            )
          return items
        })}
      </div>
    </div>
  )
}

function DayList({ days, today, logs }: { days: DaySchedule[]; today: string; logs: Logs }) {
  return (
    <ol className="wk-list">
      {days.map((d) => {
        type Item = { key: string; start: string; end?: string; label: string; cls: string; mod?: string; done?: boolean }
        const items: Item[] = []
        if (d.classes) items.push({ key: 'c', start: d.classes.start, end: d.classes.end, label: 'Classes', cls: 'wk-classes' })
        for (const b of d.blocks)
          items.push({
            key: b.id,
            start: b.start,
            end: b.end,
            label: b.kind === 'exam' ? b.title : b.module ? `${moduleById[b.module].short}: ${b.task}` : b.title,
            cls: b.kind === 'exam' ? 'wk-block wk-exam' : 'wk-block',
            mod: b.module,
            done: logs[d.date]?.[b.id]?.done,
          })
        for (const b of d.laterBlocks)
          items.push({ key: `l-${b.id}`, start: b.start, end: b.end, label: `${b.module ? moduleById[b.module].short : b.title} (joins in a later week)`, cls: 'wk-later' })
        for (const e of d.events) items.push({ key: e.id, start: e.start ?? '00:00', end: e.end, label: e.label, cls: 'wk-event' })
        for (const n of d.notes) items.push({ key: `n-${n.time}`, start: n.time, label: n.text, cls: 'wk-note' })
        items.sort((a, b) => minutesOf(a.start) - minutesOf(b.start))

        return (
          <li key={d.date} className={`card wk-listday${d.date === today ? ' is-today' : ''}`}>
            <h2 className="wk-listhead">
              <span>{shortLabel(d.date)}</span>
              <span className="muted small">{dayTotal(d)}</span>
            </h2>
            {items.length > 0 && (
              <ul>
                {items.map((it) => (
                  <li key={it.key} className={`wk-row ${it.cls}${it.done ? ' is-done' : ''}`} style={{ '--mod': it.mod ? `var(--m-${it.mod})` : 'var(--m-none)' } as CSSProperties}>
                    <span className="wk-time num">{it.start === '00:00' ? 'All day' : `${it.start}${it.end ? `–${it.end}` : ''}`}</span>
                    <span>
                      {it.cls.includes('wk-event') && <Diamond />}
                      {plain(it.label)}
                      {it.done && <span className="badge">Done</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}
