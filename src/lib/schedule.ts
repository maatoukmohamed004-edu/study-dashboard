import {
  dayTemplateByWeekday,
  examMode,
  fixedDates,
  moduleById,
  morningBefore,
  planStart,
  weeks,
  type BlockKind,
  type BlockTemplate,
  type FixedDate,
  type ModuleId,
  type PlanWeek,
} from '../data/plan'
import { isoWeekday, minutesOf, weekDates } from './dates'

export interface ScheduledBlock {
  id: string
  /** Short label for the timetable */
  label: string
  start: string
  end?: string
  module?: ModuleId
  title: string
  task: string
  kind: BlockKind | 'exam'
}

export type DayMode = 'before-plan' | 'blocks' | 'exam' | 'rest'

export interface DaySchedule {
  date: string
  mode: DayMode
  week: PlanWeek | null
  /** 1-based position of the week in the plan */
  weekNumber: number | null
  classes: { start: string; end: string } | null
  blocks: ScheduledBlock[]
  /** Template blocks that are not active yet in this ramp-up week. */
  laterBlocks: BlockTemplate[]
  events: FixedDate[]
  /** Exam mode items that are not study blocks (e.g. films after 19:00). */
  notes: { time: string; text: string; label: string }[]
}

export function weekFor(date: string): { week: PlanWeek; index: number } | null {
  const index = weeks.findIndex((w) => date >= w.start && (w.end === null || date <= w.end))
  return index === -1 ? null : { week: weeks[index], index }
}

const fromTemplate = (b: BlockTemplate): ScheduledBlock => ({
  id: b.id,
  label: b.module ? moduleById[b.module].short : b.title,
  start: b.start,
  end: b.end,
  module: b.module,
  title: b.title,
  task: b.task,
  kind: b.kind,
})

export function scheduleFor(date: string): DaySchedule {
  const weekday = isoWeekday(date)
  const template = dayTemplateByWeekday[weekday]
  const events = fixedDates.filter((f) => f.date === date)
  const found = weekFor(date)
  const base: DaySchedule = {
    date,
    mode: 'before-plan',
    week: found?.week ?? null,
    weekNumber: found ? found.index + 1 : null,
    classes: null,
    blocks: [],
    laterBlocks: [],
    events,
    notes: [],
  }

  if (date < planStart || !found) return base

  if (events.some((e) => e.kind === 'rest')) return { ...base, mode: 'rest' }

  const { schedule } = found.week
  if (schedule.kind === 'exam') {
    return {
      ...base,
      mode: 'exam',
      blocks: examMode.items
        .filter((i) => i.block)
        .map((i) => ({ id: i.id, label: i.label, start: i.time, end: i.end, title: i.text, task: '', kind: 'exam' as const })),
      notes: examMode.items.filter((i) => !i.block).map((i) => ({ time: i.time, text: i.text, label: i.label })),
    }
  }

  const dayActive = schedule.days.includes(weekday)
  const active: BlockTemplate[] = []
  const later: BlockTemplate[] = []
  for (const b of template.blocks) {
    const isMorning = minutesOf(b.start) < minutesOf(morningBefore)
    if (dayActive && (schedule.morningBlocks || !isMorning)) active.push(b)
    else later.push(b)
  }

  return {
    ...base,
    mode: 'blocks',
    classes: template.classes,
    blocks: active.map(fromTemplate),
    laterBlocks: later,
  }
}

/** Minutes of planned study for a day (blocks with an end time only). */
export function plannedMinutes(day: DaySchedule): number {
  return day.blocks.reduce((sum, b) => (b.end ? sum + minutesOf(b.end) - minutesOf(b.start) : sum), 0)
}

export function weekSchedule(mondayIso: string): DaySchedule[] {
  return weekDates(mondayIso).map(scheduleFor)
}

/** "10" → "10 h", "about 4.5 a day" → "about 4.5 h a day", "—" → "Exam days" */
export function hoursLabel(w: PlanWeek): string {
  if (w.hours === '—') return 'Exam days'
  if (/^\d+(\.\d+)?$/.test(w.hours)) return `${w.hours} h`
  return w.hours.replace(/(\d+(\.\d+)?)/, '$1 h')
}
