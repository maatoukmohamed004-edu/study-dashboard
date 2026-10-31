import type { SavedState } from './store'
import { weekSchedule } from './schedule'
import { weekDates } from './dates'

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface WeekStats {
  planned: number
  done: number
  /** 0–1, or null when nothing is planned */
  ratio: number | null
  delays: number[]
  medianDelay: number | null
  absences: number
}

/** Blocks planned and done for the week starting on this Monday. */
export function weekStats(mondayIso: string, state: Pick<SavedState, 'blocks' | 'absences'>): WeekStats {
  let planned = 0
  let done = 0
  const delays: number[] = []
  for (const day of weekSchedule(mondayIso)) {
    const logs = state.blocks[day.date] ?? {}
    for (const b of day.blocks) {
      planned++
      const log = logs[b.id]
      if (log?.done) done++
      if (log?.delayMin !== undefined) delays.push(log.delayMin)
    }
  }
  const dates = new Set(weekDates(mondayIso))
  let absences = 0
  for (const rec of Object.values(state.absences)) {
    for (const e of rec?.log ?? []) if (dates.has(e.date)) absences += e.delta
  }
  return {
    planned,
    done,
    ratio: planned ? done / planned : null,
    delays,
    medianDelay: median(delays),
    absences: Math.max(0, absences),
  }
}

export function zScore(grade: number | null, mean: number | null, sd: number | null): number | null {
  if (grade === null || mean === null || sd === null || sd <= 0) return null
  return (grade - mean) / sd
}

export const fmt = (n: number, digits = 2) =>
  n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: digits })
