import type { Weekday } from '../data/plan'

/** Local calendar date as YYYY-MM-DD. */
export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local midnight of an ISO date. */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Monday = 1 … Sunday = 7 */
export function isoWeekday(iso: string): Weekday {
  const js = fromISO(iso).getDay()
  return (js === 0 ? 7 : js) as Weekday
}

export function mondayOf(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso))
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromISO(toIso).getTime() - fromISO(fromIso).getTime()) / 86_400_000)
}

export function weekDates(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i))
}

/** "HH:MM" → minutes after midnight */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function at(iso: string, hhmm: string): Date {
  const d = fromISO(iso)
  const mins = minutesOf(hhmm)
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return d
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 135 → "2 h 15", 60 → "1 h", 45 → "45 min" */
export function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

const longDay = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' })

/** "Saturday" */
export function weekdayName(iso: string): string {
  return longDay.format(fromISO(iso))
}

/** "31 October" */
export function dayMonthLabel(iso: string): string {
  return dayMonth.format(fromISO(iso))
}

/** "Sat 31/10" — the plan's own date style */
export function shortLabel(iso: string): string {
  const parts = shortDate.formatToParts(fromISO(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('weekday')} ${get('day')}/${get('month')}`
}

/** "31/10" */
export function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
