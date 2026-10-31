import { useMemo, useState, type CSSProperties } from 'react'
import { badDay, doFirst, everyDay, examMode, goal, moduleById, planStart, sundayCheck, type FixedDate } from '../data/plan'
import { Rich } from '../components/Rich'
import { GlassLayer } from '../components/glass/GlassLayer'
import { Chevron, Diamond } from '../components/icons'
import { Hero, StatusStrip } from '../components/ui/Hud'
import { addDays, at, daysBetween, durationLabel, hhmm, isoWeekday, minutesOf, shortLabel, toISO, weekdayName } from '../lib/dates'
import { useNow } from '../lib/env'
import { hoursLabel, scheduleFor, type DaySchedule, type ScheduledBlock } from '../lib/schedule'
import { median } from '../lib/stats'
import { setFirstTask, setRecord, updateBlock, useStore, type BlockLog } from '../lib/store'

export function TodayPage() {
  const clock = useNow()
  const realToday = toISO(clock)
  const [viewDate, setViewDate] = useState(realToday)

  // Follow the calendar at midnight (or a simulated date change) if you were looking at "today".
  const [lastToday, setLastToday] = useState(realToday)
  if (lastToday !== realToday) {
    setLastToday(realToday)
    if (viewDate === lastToday) setViewDate(realToday)
  }

  const isToday = viewDate === realToday
  const day = useMemo(() => scheduleFor(viewDate), [viewDate])

  return (
    <div className="today">
      <Strip day={day} clock={clock} isToday={isToday} />
      <TodayHero day={day} clock={clock} isToday={isToday} today={realToday} onGo={setViewDate} />
      <div className="today-grid section">
        <Agenda day={day} isToday={isToday} clock={clock} />
        <aside className="today-side" aria-label="Notes for the day">
          <FirstTasks date={viewDate} />
          {day.mode !== 'before-plan' && day.mode !== 'rest' && <BadDayCard date={viewDate} />}
          <DoFirstCard key={viewDate} today={viewDate} />
        </aside>
      </div>
    </div>
  )
}

// ─── Strip and hero ─────────────────────────────────────────────────────────

function Strip({ day, clock, isToday }: { day: DaySchedule; clock: Date; isToday: boolean }) {
  return (
    <StatusStrip
      label="Day overview"
      cells={[
        { top: 'P2 daily plan', bottom: goal.title },
        day.week ? { top: `Week ${day.weekNumber}`, bottom: `${day.week.label} · ${hoursLabel(day.week)}` } : { top: 'Before the plan', bottom: `Starts ${shortLabel(planStart)}` },
        { top: isToday ? 'Viewing today' : 'Viewing', bottom: shortLabel(day.date) },
        { top: 'Local time', bottom: hhmm(clock) },
      ]}
    />
  )
}

function TodayHero({ day, clock, isToday, today, onGo }: { day: DaySchedule; clock: Date; isToday: boolean; today: string; onGo: (d: string) => void }) {
  const logs = useStore((s) => s.blocks[day.date])
  const firstDone = useStore((s) => s.doFirst)
  const rel = daysBetween(today, day.date)
  const relLabel = rel === 0 ? 'Today' : rel === 1 ? 'Tomorrow' : rel === -1 ? 'Yesterday' : rel > 0 ? `In ${rel} days` : `${-rel} days ago`
  const prev = addDays(day.date, -1)
  const next = addDays(day.date, 1)

  const actions = (
    <>
      <button type="button" className="btn" onClick={() => onGo(prev)} aria-label={`Previous day, ${shortLabel(prev)}`}>
        <GlassLayer target="buttons" bezel={8} strengthScale={0.5} />
        <Chevron dir="left" />
        <span>{shortLabel(prev)}</span>
      </button>
      {!isToday && (
        <button type="button" className="btn" onClick={() => onGo(today)}>
          <GlassLayer target="buttons" bezel={8} strengthScale={0.5} />
          <span>Back to today</span>
        </button>
      )}
      <button type="button" className="btn" onClick={() => onGo(next)} aria-label={`Next day, ${shortLabel(next)}`}>
        <GlassLayer target="buttons" bezel={8} strengthScale={0.5} />
        <span>{shortLabel(next)}</span>
        <Chevron dir="right" />
      </button>
    </>
  )

  if (day.mode === 'before-plan') {
    const until = Math.max(0, daysBetween(day.date, planStart))
    const doneCount = doFirst.filter((d) => firstDone[d.id]).length
    const nextItem = doFirst.find((d) => !firstDone[d.id])
    return (
      <Hero
        index="00"
        tag={`${relLabel} · ${shortLabel(day.date)} · before the plan`}
        live={isToday}
        number={until}
        unit={until === 1 ? 'Day' : 'Days'}
        numberLabel={`${until} ${until === 1 ? 'day' : 'days'} until the plan starts`}
        progress={{ value: doneCount / doFirst.length, label: `Do these first: ${doneCount} of ${doFirst.length} done` }}
        meta={{
          left: { k: 'Done', v: `${doneCount} / ${doFirst.length} first tasks`, s: 'Do these first' },
          right: { k: 'Next', v: nextItem ? nextItem.when : 'All done', s: `Plan starts ${shortLabel(planStart)}` },
        }}
        lede={<p>The plan starts on {weekdayName(planStart)} {shortLabel(planStart).slice(4)}. Until then, work through the “Do these first” list.</p>}
        actions={actions}
        title={weekdayName(day.date)}
      />
    )
  }

  const total = day.blocks.length
  const done = day.blocks.filter((b) => logs?.[b.id]?.done).length
  const doneMinutes = day.blocks.filter((b) => logs?.[b.id]?.done && b.end).reduce((m, b) => m + minutesOf(b.end!) - minutesOf(b.start), 0)
  const delays = day.blocks.map((b) => logs?.[b.id]?.delayMin).filter((d): d is number => d !== undefined)
  const med = median(delays)
  const nowMin = clock.getHours() * 60 + clock.getMinutes()
  const nextBlock = day.blocks.find((b) => !logs?.[b.id]?.done && (!isToday || nowMin < minutesOf(b.end ?? b.start) + (b.end ? 0 : 60)))
  let nextSub = ''
  if (nextBlock && isToday) {
    const until = minutesOf(nextBlock.start) - nowMin
    nextSub = until > 0 ? `In ${durationLabel(until)}` : 'Now'
  } else if (nextBlock) nextSub = nextBlock.task ? 'First open block' : ''

  return (
    <Hero
      index={isToday ? '01' : rel > 0 ? '+' + String(rel).padStart(2, '0') : '-' + String(-rel).padStart(2, '0')}
      tag={`${relLabel} · ${shortLabel(day.date)}${day.mode === 'exam' ? ' · exam mode' : ''}`}
      live={isToday}
      number={day.mode === 'rest' ? 'Rest' : `${done} / ${total}`}
      unit={day.mode === 'rest' ? 'Day' : 'Blocks'}
      numberLabel={day.mode === 'rest' ? 'Full rest day' : `${done} of ${total} blocks done`}
      progress={total ? { value: done / total, label: `${done} of ${total} blocks done` } : undefined}
      meta={{
        left: {
          k: 'Done',
          v: `${done} ${done === 1 ? 'block' : 'blocks'}${doneMinutes ? ` · ${durationLabel(doneMinutes)}` : ''}`,
          s: med === null ? 'No starts recorded' : `Median start ${Math.round(med)} min late`,
        },
        right: {
          k: 'Next',
          v: nextBlock ? `${nextBlock.start} · ${nextBlock.label}` : total ? 'All blocks done' : 'Nothing planned',
          s: nextSub || (day.week ? `Week ${day.weekNumber}` : ''),
        },
      }}
      lede={
        day.week ? (
          <p>
            <strong>
              Week {day.weekNumber}, {hoursLabel(day.week)}:
            </strong>{' '}
            <Rich text={day.week.focus} />
          </p>
        ) : undefined
      }
      actions={actions}
      title={weekdayName(day.date)}
    />
  )
}

// ─── Agenda ─────────────────────────────────────────────────────────────────

type Row =
  | { kind: 'classes'; start: string; end: string }
  | { kind: 'block'; start: string; block: ScheduledBlock }
  | { kind: 'event'; start: string; event: FixedDate }
  | { kind: 'note'; start: string; text: string }

function Agenda({ day, isToday, clock }: { day: DaySchedule; isToday: boolean; clock: Date }) {
  const logs = useStore((s) => s.blocks[day.date])
  const attended = useStore((s) => s.classes[day.date] ?? false)

  const untimed = day.events.filter((e) => !e.start)
  const rows: Row[] = []
  if (day.classes) rows.push({ kind: 'classes', ...day.classes })
  for (const b of day.blocks) rows.push({ kind: 'block', start: b.start, block: b })
  for (const e of day.events) if (e.start) rows.push({ kind: 'event', start: e.start, event: e })
  for (const n of day.notes) rows.push({ kind: 'note', start: n.time, text: n.text })
  rows.sort((a, b) => minutesOf(a.start) - minutesOf(b.start))

  const done = day.blocks.filter((b) => logs?.[b.id]?.done).length
  const nowMin = clock.getHours() * 60 + clock.getMinutes()
  const nextId = isToday
    ? day.blocks.find((b) => !logs?.[b.id]?.done && nowMin < minutesOf(b.end ?? b.start) + (b.end ? 0 : 60))?.id
    : undefined
  const sundayReminder = day.mode === 'blocks' && isoWeekday(day.date) === 7 && !day.blocks.some((b) => b.kind === 'check')

  return (
    <section className="agenda" aria-labelledby="agenda-title">
      <div className="section-head">
        <h2 id="agenda-title" className="section-title">
          {day.mode === 'exam' ? 'Exam mode' : day.mode === 'before-plan' ? 'Before the plan' : 'Classes and blocks'}
        </h2>
        {day.blocks.length > 0 && (
          <p className="label muted">
            {done} of {day.blocks.length} blocks done
          </p>
        )}
      </div>

      {untimed.length > 0 && (
        <ul className="fixed-today" aria-label="Fixed dates today">
          {untimed.map((e) => (
            <li key={e.id} className="fixed-chip label">
              <Diamond /> {e.label}
            </li>
          ))}
        </ul>
      )}

      {day.mode === 'rest' && <p className="rest-day">Full rest day.</p>}
      {day.mode === 'before-plan' && <p className="muted">No classes or study blocks are planned for this day yet.</p>}
      {day.mode === 'blocks' && day.blocks.length === 0 && (
        <p className="muted agenda-empty">No study blocks today in this ramp-up week. Classes still count: attend every one.</p>
      )}

      {rows.length > 0 && (
        <ol className="rail">
          {rows.map((r) => {
            if (r.kind === 'classes')
              return (
                <li key="classes" className="rail-item rail-classes">
                  <Time start={r.start} end={r.end} />
                  <div className="rail-body">
                    <p className="rail-title">Classes</p>
                    <p className="rail-task">Go to every class.</p>
                  </div>
                  <div className="rail-actions">
                    <label className="check">
                      <input type="checkbox" checked={attended} onChange={(e) => setRecord('classes', day.date, e.target.checked)} />
                      <span className="label">Attended</span>
                    </label>
                  </div>
                </li>
              )
            if (r.kind === 'block')
              return <BlockRow key={r.block.id} date={day.date} block={r.block} log={logs?.[r.block.id]} canStart={isToday} clock={clock} isNext={r.block.id === nextId} />
            if (r.kind === 'event') return <EventRow key={r.event.id} event={r.event} />
            return (
              <li key={`note-${r.start}`} className="rail-item rail-note">
                <span className="rail-time label">{r.start}</span>
                <div className="rail-body">
                  <p className="rail-task">{r.text}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {sundayReminder && (
        <p className="agenda-foot">
          {sundayCheck.intro} <a href="#/check">Open the Sunday check</a>
        </p>
      )}
      {day.laterBlocks.length > 0 && <LaterBlocks day={day} />}
      {day.mode === 'blocks' && day.blocks.length > 0 && <p className="agenda-foot">{everyDay.intro}</p>}
      {day.mode === 'exam' && <p className="agenda-foot">{examMode.dayBefore}</p>}
    </section>
  )
}

function Time({ start, end }: { start: string; end?: string }) {
  return (
    <span className="rail-time label">
      {start}
      {end && (
        <>
          <span aria-hidden="true">–</span>
          <span className="sr-only"> to </span>
          {end}
        </>
      )}
    </span>
  )
}

function BlockRow({ date, block, log, canStart, clock, isNext }: { date: string; block: ScheduledBlock; log: BlockLog | undefined; canStart: boolean; clock: Date; isNext: boolean }) {
  const started = log?.startedAt !== undefined
  const done = !!log?.done
  const mod = block.module ? moduleById[block.module] : undefined
  const style = { '--mod': block.module ? `var(--m-${block.module})` : 'var(--ink-2)' } as CSSProperties
  const length = block.end ? minutesOf(block.end) - minutesOf(block.start) : null
  const nowMin = clock.getHours() * 60 + clock.getMinutes()

  function start() {
    const planned = at(date, block.start)
    const delay = Math.max(0, Math.round((clock.getTime() - planned.getTime()) / 60_000))
    updateBlock(date, block.id, { startedAt: clock.toISOString(), delayMin: delay })
  }

  return (
    <li className={`rail-item rail-block${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`} style={style}>
      <Time start={block.start} end={block.end} />
      <div className="rail-body">
        <p className="rail-title">
          {block.title}
          {isNext && <span className="badge badge-accent label">{nowMin >= minutesOf(block.start) ? 'Now' : 'Next'}</span>}
        </p>
        {block.task && (
          <p className="rail-task">
            <Rich text={block.task} />
          </p>
        )}
        <p className="rail-meta label">
          {mod && <span>{mod.name}</span>}
          {length !== null && <span>{durationLabel(length)}</span>}
        </p>
      </div>
      <div className="rail-actions">
        {started ? (
          <p className="started label">
            Started {hhmm(new Date(log!.startedAt!))} ·{' '}
            <strong className={log!.delayMin! > 10 ? 'is-warn' : 'is-ok'}>{log!.delayMin === 0 ? 'on time' : `${log!.delayMin} min late`}</strong>{' '}
            <button type="button" className="btn-link" onClick={() => updateBlock(date, block.id, { startedAt: undefined, delayMin: undefined })} aria-label={`Undo start of ${block.title}`}>
              Undo
            </button>
          </p>
        ) : (
          canStart &&
          !done && (
            <button type="button" className="btn btn-start" onClick={start} aria-label={`Start ${block.title}, planned ${block.start}`}>
              Start
            </button>
          )
        )}
        <label className="check">
          <input type="checkbox" checked={done} onChange={(e) => updateBlock(date, block.id, { done: e.target.checked })} aria-label={`${block.title} done`} />
          <span className="label" aria-hidden="true">
            Done
          </span>
        </label>
      </div>
    </li>
  )
}

function EventRow({ event }: { event: FixedDate }) {
  return (
    <li className="rail-item rail-event">
      <Time start={event.start!} end={event.end} />
      <div className="rail-body">
        <p className="rail-title">
          <Diamond /> {event.label}
        </p>
        {event.checkpoint && (
          <p className="rail-task">
            Details and scoring on the <a href="#/plan/checkpoints">Plan page</a>.
          </p>
        )}
      </div>
    </li>
  )
}

function LaterBlocks({ day }: { day: DaySchedule }) {
  const items = day.laterBlocks.map((b) => {
    let from: string | null = null
    for (let d = addDays(day.date, 7), i = 0; i < 12; i++, d = addDays(d, 7)) {
      if (scheduleFor(d).blocks.some((x) => x.id === b.id)) {
        from = d
        break
      }
    }
    return { b, from }
  })
  return (
    <div className="later">
      <p className="label muted">Joins the plan in a later week</p>
      <ul>
        {items.map(({ b, from }) => (
          <li key={b.id}>
            <span className="label">{b.start}</span> {b.title}
            {from && <span className="muted">, from {shortLabel(from)}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Side cards ─────────────────────────────────────────────────────────────

function FirstTasks({ date }: { date: string }) {
  const tomorrow = addDays(date, 1)
  const todays = useStore((s) => s.firstTask[date] ?? '')
  const next = useStore((s) => s.firstTask[tomorrow] ?? '')

  return (
    <section className="card first-task" aria-labelledby="first-task-title">
      <h2 id="first-task-title" className="sub-title">
        First task · {shortLabel(date)}
      </h2>
      {todays.trim() ? (
        <p className="first-task-text display">{todays}</p>
      ) : (
        <p className="muted small">Nothing was written for {shortLabel(date)}. Pick a sheet and exercise number before you start.</p>
      )}
      <div className="field">
        <label className="field-label" htmlFor="tomorrow-task">
          Tomorrow's first task ({shortLabel(tomorrow)})
        </label>
        <textarea id="tomorrow-task" className="input" rows={2} value={next} onChange={(e) => setFirstTask(tomorrow, e.target.value)} aria-describedby="tomorrow-task-hint" />
        <p id="tomorrow-task-hint" className="field-hint">
          Before bed: a sheet and exercise number. Saved as you type.
        </p>
      </div>
    </section>
  )
}

function BadDayCard({ date }: { date: string }) {
  const active = useStore((s) => s.badDay[date] ?? false)
  const yesterday = useStore((s) => s.badDay[addDays(date, -1)] ?? false)
  const steps = useStore((s) => s.badDaySteps)

  return (
    <section className={`card bad-day${active ? ' is-active' : ''}`} aria-labelledby="bad-day-title">
      <h2 id="bad-day-title" className="sub-title">
        {badDay.title}
      </h2>
      {yesterday && (
        <p className="bad-day-warn is-warn">
          Yesterday was a bad day. <strong>{badDay.footer}</strong>
        </p>
      )}
      <label className="check">
        <input type="checkbox" checked={active} onChange={(e) => setRecord('badDay', date, e.target.checked)} />
        Use the minimum today
      </label>
      {active && (
        <ol className="bad-day-steps">
          {badDay.steps.map((s, i) => (
            <li key={i}>
              <label className="check check-top">
                <input type="checkbox" checked={steps[`${date}:${i}`] ?? false} onChange={(e) => setRecord('badDaySteps', `${date}:${i}`, e.target.checked)} />
                <span>{s}</span>
              </label>
            </li>
          ))}
        </ol>
      )}
      {!yesterday && <p className="field-hint">{badDay.footer}</p>}
    </section>
  )
}

function DoFirstCard({ today }: { today: string }) {
  const done = useStore((s) => s.doFirst)
  const open = doFirst.filter((i) => !done[i.id])
  const [showAll, setShowAll] = useState(false)
  if (open.length === 0) return null
  const list = showAll ? doFirst : open

  return (
    <section className="card do-first" aria-labelledby="do-first-title">
      <h2 id="do-first-title" className="sub-title">
        Do these first
      </h2>
      <ul className="do-first-list">
        {list.map((item) => {
          const due = item.date === today
          const overdue = item.date < today && !item.when.startsWith('From') && !done[item.id]
          return (
            <li key={item.id} className={due ? 'is-due' : overdue ? 'is-overdue' : undefined}>
              <label className="check check-top">
                <input type="checkbox" checked={!!done[item.id]} onChange={(e) => setRecord('doFirst', item.id, e.target.checked)} />
                <span>
                  <span className="do-when label">
                    {item.when}
                    {due && <span className="badge badge-accent">Today</span>}
                    {overdue && <span className="badge badge-warn">Overdue</span>}
                  </span>
                  <span className="do-text">
                    <Rich text={item.text} />
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {open.length < doFirst.length && (
        <button type="button" className="btn-link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Hide finished items' : `Show finished items (${doFirst.length - open.length})`}
        </button>
      )}
    </section>
  )
}
