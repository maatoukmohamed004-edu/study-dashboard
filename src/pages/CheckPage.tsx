import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { fixedDates, goal, planStart, sundayCheck } from '../data/plan'
import { TrendChart } from '../components/TrendChart'
import { Hero, StatusStrip } from '../components/ui/Hud'
import { showToast } from '../lib/toast'
import { addDays, ddmm, isoWeekday, mondayOf, shortLabel } from '../lib/dates'
import { useToday } from '../lib/env'
import { weekFor } from '../lib/schedule'
import { fmt, weekStats, zScore } from '../lib/stats'
import { deleteSundayCheck, getState, saveSundayCheck, useStore, type SavedState, type SundayCheck } from '../lib/store'

const firstSunday = addDays(mondayOf(planStart), 6)
const lastSunday = addDays(mondayOf(fixedDates.reduce((m, f) => (f.date > m ? f.date : m), planStart)), 6)

function sundaysInPlan(): string[] {
  const out: string[] = []
  for (let d = firstSunday; d <= lastSunday; d = addDays(d, 7)) out.push(d)
  return out
}

function defaultSunday(today: string): string {
  const d = isoWeekday(today) === 7 ? today : addDays(mondayOf(today), -1)
  return d < firstSunday ? firstSunday : d > lastSunday ? lastSunday : d
}

interface FormState {
  blocksDone: string
  blocksPlanned: string
  medianDelay: string
  grade: string
  mean: string
  sd: string
  absences: string
  whatWorked: string
  change: string
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))
const toNum = (s: string): number | null => {
  if (s.trim() === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Saved values for that Sunday, or values from the Today checklist for a new one. */
function initialForm(
  weekOf: string,
  checks: SundayCheck[],
  data: Pick<SavedState, 'blocks' | 'absences'>,
): { form: FormState; source: 'saved' | 'tracked' } {
  const saved = checks.find((c) => c.weekOf === weekOf)
  if (saved)
    return {
      source: 'saved',
      form: {
        blocksDone: str(saved.blocksDone),
        blocksPlanned: str(saved.blocksPlanned),
        medianDelay: str(saved.medianDelay),
        grade: str(saved.grade),
        mean: str(saved.mean),
        sd: str(saved.sd),
        absences: str(saved.absences),
        whatWorked: saved.whatWorked,
        change: saved.change,
      },
    }
  const stats = weekStats(mondayOf(weekOf), data)
  const previous = [...checks].reverse().find((c) => c.weekOf < weekOf && c.grade !== null)
  return {
    source: 'tracked',
    form: {
      blocksDone: String(stats.done),
      blocksPlanned: String(stats.planned),
      medianDelay: stats.medianDelay === null ? '' : String(Math.round(stats.medianDelay * 10) / 10),
      grade: str(previous?.grade),
      mean: str(previous?.mean),
      sd: str(previous?.sd),
      absences: String(stats.absences),
      whatWorked: '',
      change: '',
    },
  }
}

export function CheckPage() {
  const today = useToday()
  const checks = useStore((s) => s.sundayChecks)
  const blocks = useStore((s) => s.blocks)
  const absences = useStore((s) => s.absences)
  const [weekOf, setWeekOfRaw] = useState(() => defaultSunday(today))
  // The form shows saved or tracked values until you edit it; edits are kept separately,
  // so an untouched form follows your data (e.g. after an import).
  const initial = useMemo(() => initialForm(weekOf, checks, { blocks, absences }), [weekOf, checks, blocks, absences])
  const [edited, setEdited] = useState<FormState | null>(null)
  const form = edited ?? initial.form
  const source = initial.source
  const setForm = (patch: Partial<FormState>) => setEdited({ ...form, ...patch })
  const setWeekOf = (d: string) => {
    setEdited(null)
    setWeekOfRaw(d)
  }
  const id = useId()

  const options = useMemo(() => {
    const set = new Set([...sundaysInPlan(), ...checks.map((c) => c.weekOf)])
    return [...set].sort()
  }, [checks])

  const done = toNum(form.blocksDone)
  const planned = toNum(form.blocksPlanned)
  const pct = done !== null && planned ? (done / planned) * 100 : null
  const grade = toNum(form.grade)
  const mean = toNum(form.mean)
  const sd = toNum(form.sd)
  const z = zScore(grade, mean, sd)
  const sdInvalid = sd !== null && sd <= 0
  const targetGrade = mean !== null && sd !== null && sd > 0 ? mean + goal.k * sd : null
  const exists = checks.some((c) => c.weekOf === weekOf)

  function save(e: FormEvent) {
    e.preventDefault()
    if (sdInvalid) return
    saveSundayCheck({
      weekOf,
      blocksDone: done ?? 0,
      blocksPlanned: planned ?? 0,
      medianDelay: toNum(form.medianDelay),
      grade,
      mean,
      sd,
      absences: toNum(form.absences),
      whatWorked: form.whatWorked.trim(),
      change: form.change.trim(),
      savedAt: new Date().toISOString(),
    })
    setEdited(null)
    showToast(`Sunday check saved for ${shortLabel(weekOf)}.`)
  }

  function refill() {
    const s = getState()
    const stats = weekStats(mondayOf(weekOf), s)
    setForm({
      blocksDone: String(stats.done),
      blocksPlanned: String(stats.planned),
      medianDelay: stats.medianDelay === null ? '' : String(Math.round(stats.medianDelay * 10) / 10),
      absences: String(stats.absences),
    })
  }

  // Chart series
  const series = useMemo(() => {
    const blocks = checks.filter((c) => c.blocksPlanned > 0).map((c) => ({ label: ddmm(c.weekOf), value: (c.blocksDone / c.blocksPlanned) * 100 }))
    const delay = checks.filter((c) => c.medianDelay !== null).map((c) => ({ label: ddmm(c.weekOf), value: c.medianDelay! }))
    const zs = checks
      .map((c) => ({ label: ddmm(c.weekOf), value: zScore(c.grade, c.mean, c.sd) }))
      .filter((p): p is { label: string; value: number } => p.value !== null)
    return { blocks, delay, z: zs }
  }, [checks])

  const [mBlocks, mDelay, mZ] = sundayCheck.metrics
  const weekNo = weekFor(weekOf)
  const last = checks.at(-1)
  const lastZ = series.z.at(-1)?.value ?? null
  const lastBlocks = series.blocks.at(-1)?.value ?? null

  return (
    <div className="check-page">
      <StatusStrip
        label="Sunday check overview"
        cells={[
          { top: 'Every Sunday', bottom: sundayCheck.time },
          { top: 'Last check', bottom: last ? shortLabel(last.weekOf) : 'None yet' },
          { top: 'Blocks target', bottom: `${mBlocks.goal}% or more` },
          { top: 'z target', bottom: `${mZ.goal} or more` },
        ]}
      />
      <Hero
        index="06"
        tag="Sunday check · three numbers"
        number={lastZ === null ? '–' : fmt(lastZ, 2)}
        unit="z"
        numberLabel={lastZ === null ? 'No z-score saved yet' : `Latest z-score ${fmt(lastZ, 2)}`}
        progress={lastZ === null ? undefined : { value: Math.max(0, lastZ) / mZ.goal, label: `z ${fmt(lastZ, 2)} of the ${mZ.goal} target` }}
        meta={{
          left: { k: 'Blocks done', v: lastBlocks === null ? '–' : `${Math.round(lastBlocks)}%`, s: mBlocks.target.replace('Target: ', 'Target ') },
          right: { k: 'Start delay', v: last?.medianDelay == null ? '–' : `${fmt(last.medianDelay, 1)} min`, s: mDelay.target.replace('Target: ', 'Target ') },
        }}
        lede={<p>{sundayCheck.intro}</p>}
        title="Sunday"
      />

      <div className="check-layout section">
        <form className="card check-form" onSubmit={save} aria-labelledby={`${id}-form`}>
          <h2 id={`${id}-form`} className="sub-title">
            This week's numbers
          </h2>

          <div className="field">
            <label className="field-label" htmlFor={`${id}-week`}>
              Week of
            </label>
            <select id={`${id}-week`} className="input" value={weekOf} onChange={(e) => setWeekOf(e.target.value)}>
              {options.map((d) => {
                const w = weekFor(d)
                return (
                  <option key={d} value={d}>
                    {shortLabel(d)}
                    {w ? `, plan week ${w.index + 1}` : ''}
                    {checks.some((c) => c.weekOf === d) ? ' (saved)' : ''}
                  </option>
                )
              })}
            </select>
            <p className="field-hint">
              {source === 'saved'
                ? 'Showing the check you saved for this week.'
                : `Blocks, delay and absences are filled from your Today checklist for ${ddmm(mondayOf(weekOf))}–${ddmm(weekOf)}. Edit them if they are off.`}
            </p>
          </div>

          <fieldset className="check-group">
            <legend className="label">1. {mBlocks.title}</legend>
            <div className="check-row">
              <div className="field">
                <label className="field-hint" htmlFor={`${id}-done`}>
                  Done
                </label>
                <input id={`${id}-done`} className="input num" type="number" min={0} inputMode="numeric" value={form.blocksDone} onChange={(e) => setForm({ blocksDone: e.target.value })} />
              </div>
              <span className="check-of" aria-hidden="true">
                /
              </span>
              <div className="field">
                <label className="field-hint" htmlFor={`${id}-planned`}>
                  Planned
                </label>
                <input id={`${id}-planned`} className="input num" type="number" min={0} inputMode="numeric" value={form.blocksPlanned} onChange={(e) => setForm({ blocksPlanned: e.target.value })} />
              </div>
              <output className="check-result" htmlFor={`${id}-done ${id}-planned`}>
                {pct === null ? '–' : `${Math.round(pct)}%`}
              </output>
            </div>
            <p className="field-hint">
              {mBlocks.target} {mBlocks.why}
            </p>
          </fieldset>

          <fieldset className="check-group">
            <legend className="label">2. {mDelay.title}</legend>
            <div className="check-row">
              <div className="field">
                <label className="field-hint" htmlFor={`${id}-delay`}>
                  Minutes
                </label>
                <input id={`${id}-delay`} className="input num" type="number" min={0} step="any" inputMode="decimal" value={form.medianDelay} onChange={(e) => setForm({ medianDelay: e.target.value })} />
              </div>
            </div>
            <p className="field-hint">
              {mDelay.target} {mDelay.why}
            </p>
          </fieldset>

          <fieldset className="check-group">
            <legend className="label">3. {mZ.title}</legend>
            <div className="check-row check-row-3">
              <div className="field">
                <label className="field-hint" htmlFor={`${id}-grade`}>
                  Your grade /20
                </label>
                <input id={`${id}-grade`} className="input num" type="number" min={0} max={20} step="any" inputMode="decimal" value={form.grade} onChange={(e) => setForm({ grade: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-hint" htmlFor={`${id}-mean`}>
                  Class mean
                </label>
                <input id={`${id}-mean`} className="input num" type="number" min={0} max={20} step="any" inputMode="decimal" value={form.mean} onChange={(e) => setForm({ mean: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-hint" htmlFor={`${id}-sd`}>
                  Class standard deviation
                </label>
                <input
                  id={`${id}-sd`}
                  className="input num"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.sd}
                  onChange={(e) => setForm({ sd: e.target.value })}
                  aria-invalid={sdInvalid || undefined}
                  aria-describedby={sdInvalid ? `${id}-sd-err` : undefined}
                />
              </div>
            </div>
            {sdInvalid && (
              <p id={`${id}-sd-err`} className="field-error">
                The standard deviation must be above 0.
              </p>
            )}
            <ZFormula grade={grade} mean={mean} sd={sd} z={z} />
            <p className="field-hint">
              {mZ.target} {mZ.why}
              {targetGrade !== null && ` On this test, z = ${goal.k} means ${fmt(targetGrade, 2)}/20.`}
            </p>
          </fieldset>

          <div className="check-row check-extra">
            <div className="field">
              <label className="field-label" htmlFor={`${id}-abs`}>
                Absences this week
              </label>
              <input id={`${id}-abs`} className="input num" type="number" min={0} inputMode="numeric" value={form.absences} onChange={(e) => setForm({ absences: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`${id}-worked`}>
              What worked
            </label>
            <textarea id={`${id}-worked`} className="input" rows={2} value={form.whatWorked} onChange={(e) => setForm({ whatWorked: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`${id}-change`}>
              One change for next week
            </label>
            <textarea id={`${id}-change`} className="input" rows={2} value={form.change} onChange={(e) => setForm({ change: e.target.value })} />
          </div>

          <div className="check-actions">
            <button type="submit" className="btn btn-primary" disabled={sdInvalid}>
              {exists ? 'Update Sunday check' : 'Save Sunday check'}
            </button>
            <button type="button" className="btn" onClick={refill}>
              Refill from Today
            </button>
            {weekNo && <span className="muted small">Plan week {weekNo.index + 1}</span>}
          </div>
        </form>

        <section className="check-charts" aria-labelledby={`${id}-history`}>
          <div className="section-head">
            <h2 id={`${id}-history`} className="section-title">
              History
            </h2>
            <p className="label muted">{checks.length} saved</p>
          </div>
          {checks.length === 0 && (
            <p className="muted">
              No Sunday checks saved yet. The first is due {shortLabel(firstSunday)} at {sundayCheck.time}.
            </p>
          )}
          <ChartCard title={mBlocks.title} target={mBlocks.target} latest={series.blocks.at(-1)?.value} format={(v) => `${Math.round(v)}%`} good={(v) => v >= mBlocks.goal}>
            <TrendChart name={mBlocks.title} points={series.blocks} target={mBlocks.goal} targetLabel={`${mBlocks.goal}%`} format={(v) => `${Math.round(v)}%`} domain={[0, 100]} />
          </ChartCard>
          <ChartCard title={mDelay.title} target={mDelay.target} latest={series.delay.at(-1)?.value} format={(v) => `${fmt(v, 1)} min`} good={(v) => v <= mDelay.goal}>
            <TrendChart name={mDelay.title} points={series.delay} target={mDelay.goal} targetLabel={`${mDelay.goal} min`} format={(v) => `${fmt(v, 1)} min`} domain={[0, 20]} />
          </ChartCard>
          <ChartCard title={mZ.title} target={mZ.target} latest={series.z.at(-1)?.value} format={(v) => fmt(v, 2)} good={(v) => v >= mZ.goal}>
            <TrendChart name={mZ.title} points={series.z} target={mZ.goal} targetLabel={`z ${mZ.goal}`} format={(v) => `z = ${fmt(v, 2)}`} domain={[-0.5, 2]} />
          </ChartCard>
          {checks.length > 0 && <HistoryTable checks={checks} onEdit={setWeekOf} />}
        </section>
      </div>
    </div>
  )
}

function ZFormula({ grade, mean, sd, z }: { grade: number | null; mean: number | null; sd: number | null; z: number | null }) {
  const label = z === null ? 'z equals your grade minus the class mean, divided by the class standard deviation' : `z equals ${grade} minus ${mean}, divided by ${sd}, which is ${fmt(z, 2)}`
  return (
    <div className="formula z-formula" role="math" aria-label={label} aria-live="polite">
      <span className="f-var">z</span>
      <span className="f-op">=</span>
      <span className="frac">
        <span>your grade − class mean</span>
        <span>class standard deviation</span>
      </span>
      {z !== null && (
        <>
          <span className="f-op">=</span>
          <span className="frac num">
            <span>
              {fmt(grade!)} − {fmt(mean!)}
            </span>
            <span>{fmt(sd!)}</span>
          </span>
          <span className="f-op">=</span>
          <span className="f-result num">{fmt(z, 2)}</span>
        </>
      )}
    </div>
  )
}

function ChartCard({
  title,
  target,
  latest,
  format,
  good,
  children,
}: {
  title: string
  target: string
  latest: number | undefined
  format: (v: number) => string
  good: (v: number) => boolean
  children: ReactNode
}) {
  return (
    <article className="card chart-card">
      <div className="chart-head">
        <h3 className="chart-title label">{title}</h3>
        {latest !== undefined && (
          <p className="chart-latest">
            <span className="display">{format(latest)}</span>
            <span className={good(latest) ? 'chart-flag is-good' : 'chart-flag'}>{good(latest) ? 'On target' : 'Off target'}</span>
          </p>
        )}
      </div>
      <p className="field-hint">{target}</p>
      {children}
    </article>
  )
}

function HistoryTable({ checks, onEdit }: { checks: SundayCheck[]; onEdit: (weekOf: string) => void }) {
  const rows = [...checks].reverse()
  return (
    <div className="card history">
      <table className="table">
        <caption className="sub-title">Saved checks</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Blocks</th>
            <th scope="col">Delay</th>
            <th scope="col">z</th>
            <th scope="col">Absences</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const z = zScore(c.grade, c.mean, c.sd)
            return (
              <tr key={c.weekOf}>
                <th scope="row" className="num">
                  {shortLabel(c.weekOf)}
                </th>
                <td className="num">
                  {c.blocksDone}/{c.blocksPlanned}
                  {c.blocksPlanned > 0 && <span className="muted"> ({Math.round((c.blocksDone / c.blocksPlanned) * 100)}%)</span>}
                </td>
                <td className="num">{c.medianDelay === null ? '–' : `${fmt(c.medianDelay, 1)} min`}</td>
                <td className="num">{z === null ? '–' : fmt(z, 2)}</td>
                <td className="num">{c.absences ?? '–'}</td>
                <td className="history-actions">
                  <button type="button" className="btn-link" onClick={() => onEdit(c.weekOf)} aria-label={`Edit check for ${shortLabel(c.weekOf)}`}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      const removed = c
                      deleteSundayCheck(c.weekOf)
                      showToast(`Deleted the check for ${shortLabel(c.weekOf)}.`, { action: { label: 'Undo', run: () => saveSundayCheck(removed) } })
                    }}
                    aria-label={`Delete check for ${shortLabel(c.weekOf)}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
