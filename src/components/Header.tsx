import { useEffect, useRef } from 'react'
import { planStart } from '../data/plan'
import { hhmm, shortLabel, toISO } from '../lib/dates'
import { PAGES, useNow, useSimulation, useToday, type PageId } from '../lib/env'
import { weekFor } from '../lib/schedule'
import { setSetting } from '../lib/settings'
import { useResolved } from '../lib/theme'
import { useThisWeekStats } from '../lib/useWeekProgress'
import { GlassLayer } from './glass/GlassLayer'
import { GearIcon } from './icons'
import { ProgressOrb } from './ProgressOrb'

/**
 * Three columns: wordmark (with the orb) · monogram · navigation and the settings gear.
 * `compact` (phones with the tab bar): no navigation here, and the gear opens Quick settings.
 */
export function Header({
  page,
  compact = false,
  quickOpen = false,
  onQuick,
}: {
  page: PageId
  compact?: boolean
  quickOpen?: boolean
  onQuick?: (opener: HTMLElement) => void
}) {
  const today = useToday()
  const stats = useThisWeekStats(today)
  const current = weekFor(today)
  const r = useResolved()
  const pct = stats.ratio === null ? null : Math.round(stats.ratio * 100)
  const navRef = useRef<HTMLElement>(null)

  // On narrow screens the nav scrolls sideways. Keep the current page's link clear of the
  // edges, and mark which edges hide more links (CSS fades those). Redone when the links change
  // size (web fonts arriving, rotation), since that moves them without a scroll event.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const update = () => {
      const more = nav.scrollWidth - nav.clientWidth
      nav.dataset.more = more <= 1 ? 'none' : nav.scrollLeft <= 1 ? 'end' : nav.scrollLeft >= more - 1 ? 'start' : 'both'
    }
    const reveal = () => {
      const link = nav.querySelector<HTMLElement>('[aria-current="page"]')
      if (link && nav.scrollWidth > nav.clientWidth) {
        const n = nav.getBoundingClientRect()
        const l = link.getBoundingClientRect()
        if (l.left < n.left + 44) nav.scrollLeft -= n.left + 44 - l.left
        else if (l.right > n.right - 44) nav.scrollLeft += l.right - (n.right - 44)
      }
      update()
    }
    let frame = 0
    const later = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reveal)
    }
    reveal()
    const ro = new ResizeObserver(later)
    ro.observe(nav)
    nav.querySelectorAll('.nav-link').forEach((a) => ro.observe(a))
    nav.addEventListener('scroll', update, { passive: true })
    document.fonts?.addEventListener('loadingdone', later)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      nav.removeEventListener('scroll', update)
      document.fonts?.removeEventListener('loadingdone', later)
    }
  }, [page, compact])

  return (
    // In liquid mode, "glass-container" makes html2canvas leave the header out of its page snapshot.
    <header className={`header${r.glass === 'liquid' ? ' glass-container' : ''}`}>
      <div className="topbar">
        <GlassLayer target="header" radius={0} bezel={16} />
        <div className="tb-left">
          <ProgressOrb ratio={stats.ratio ?? 0} />
          <div className="tb-id">
            <a className="wordmark label" href="#/today">
              P2.Daily.Plan
            </a>
            <p className="tb-stat label">
              {pct !== null ? (
                <>
                  <strong>{pct}%</strong> · {stats.done}/{stats.planned} blocks{current ? ` · week ${current.index + 1}` : ''}
                </>
              ) : today < planStart ? (
                `Starts ${shortLabel(planStart)}`
              ) : (
                'No blocks this week'
              )}
            </p>
          </div>
        </div>

        <a className="monogram" href="#/today" aria-label="Top 3, go to Today">
          T3
        </a>

        <div className="tb-right">
          {!compact && (
          <nav className="tb-nav" aria-label="Pages" ref={navRef}>
            <ul>
              {PAGES.map((p) => (
                <li key={p.id}>
                  <a className="nav-link label" href={`#/${p.id}`} aria-current={p.id === page ? 'page' : undefined}>
                    {p.short === p.label ? (
                      p.label
                    ) : (
                      <>
                        <span className="nav-full">{p.label}</span>
                        <span className="nav-short">{p.short}</span>
                      </>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          )}
          {compact ? (
            <button
              type="button"
              className="square-btn tb-gear"
              aria-label="Quick settings"
              aria-expanded={quickOpen}
              aria-controls={quickOpen ? 'quick-settings' : undefined}
              onClick={(e) => onQuick?.(e.currentTarget)}
            >
              <GlassLayer target="buttons" bezel={8} strengthScale={0.6} />
              <GearIcon />
            </button>
          ) : (
          <a className="square-btn tb-gear" href="#/settings" aria-label="Settings" aria-current={page === 'settings' ? 'page' : undefined}>
            <GlassLayer target="buttons" bezel={8} strengthScale={0.6} />
            <GearIcon />
          </a>
          )}
        </div>
      </div>
      <SimBanner />
    </header>
  )
}

function SimBanner() {
  const sim = useSimulation()
  const clock = useNow()
  if (!sim.on) return null
  return (
    <div className="sim-banner" role="region" aria-label="Simulated date and time">
      <p className="label">
        Simulated time: {shortLabel(toISO(clock))} {hhmm(clock)}
      </p>
      <button type="button" onClick={() => setSetting('sim.enabled', false)}>
        Back to real time
      </button>
    </div>
  )
}
