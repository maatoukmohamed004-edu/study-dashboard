import { useEffect, useState } from 'react'
import { weekFor } from '../../lib/schedule'
import { useToday, type PageId } from '../../lib/env'
import { useResolved } from '../../lib/theme'
import { useThisWeekStats } from '../../lib/useWeekProgress'
import { planStart } from '../../data/plan'
import { shortLabel } from '../../lib/dates'
import { GlassLayer } from '../glass/GlassLayer'
import { ArrowUpIcon, SlidersIcon } from '../icons'

/** Grid, the "desk" mats outside the frame, the double hairline frame and the corner brackets. */
export function HudChrome() {
  return (
    <div aria-hidden="true">
      <div className="hud-grid" />
      <div className="hud-mat hud-mat-top" />
      <div className="hud-mat hud-mat-bottom" />
      <div className="hud-mat hud-mat-left" />
      <div className="hud-mat hud-mat-right" />
      <div className="hud-frame" />
      <span className="hud-corner tl" />
      <span className="hud-corner tr" />
      <span className="hud-corner bl" />
      <span className="hud-corner br" />
    </div>
  )
}

const PAGE_CAPTION: Record<PageId, string> = {
  today: 'Today',
  week: 'Week',
  plan: 'Plan',
  resources: 'Resources',
  absences: 'Absences',
  check: 'Sunday check',
  settings: 'Settings',
}

/** Fixed bottom-left mono caption, e.g. "TODAY — WEEK 3 · P2 DAILY PLAN · 25%". */
export function Caption({ page }: { page: PageId }) {
  const today = useToday()
  const stats = useThisWeekStats(today)
  const wk = weekFor(today)
  const pct = stats.ratio === null ? null : `${Math.round(stats.ratio * 100)}%`
  const parts = [wk ? `Week ${wk.index + 1}` : today < planStart ? `Plan starts ${shortLabel(planStart)}` : 'After the plan', 'P2 daily plan']
  if (pct) parts.push(pct)
  return (
    <p className="hud-caption label" aria-hidden="true">
      {PAGE_CAPTION[page]} — {parts.join(' · ')}
    </p>
  )
}

/** Square floating buttons, bottom-right: back to top, and quick settings. */
export function FabStack({ quickOpen, onQuick, showQuick = true }: { quickOpen: boolean; onQuick: (opener: HTMLElement) => void; showQuick?: boolean }) {
  const r = useResolved()
  const [scrolled, setScrolled] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 320)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <div className="fab-stack">
      {(scrolled || focused) && (
        <button
          type="button"
          className="square-btn"
          aria-label="Back to top"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={() => {
            window.scrollTo({ top: 0, behavior: r.reducedMotion ? 'auto' : 'smooth' })
            document.getElementById('main')?.focus({ preventScroll: true })
          }}
        >
          <GlassLayer target="buttons" bezel={8} strengthScale={0.6} />
          <ArrowUpIcon />
        </button>
      )}
      {showQuick && (
        <button type="button" className="square-btn" aria-label="Quick settings" aria-expanded={quickOpen} aria-controls="quick-settings" onClick={(e) => onQuick(e.currentTarget)}>
          <GlassLayer target="buttons" bezel={8} strengthScale={0.6} />
          <SlidersIcon />
        </button>
      )}
    </div>
  )
}
