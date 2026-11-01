import { useEffect, type CSSProperties } from 'react'
import { getRoute, navigate, pageLabel, useRoute, type PageId } from '../../lib/env'
import { useSettings } from '../../lib/settings'
import { useResolved } from '../../lib/theme'
import { GlassLayer } from '../glass/GlassLayer'
import { MoreIcon } from '../icons'
import { PAGE_META, swipeOrder } from './pages'

/**
 * Phone navigation in the thumb zone: four tabs (Settings → Navigation → Tabs) and "More".
 * - Floating (default): a glass pill; the current tab sits on a highlight that slides between
 *   tabs. Docked: the full-width bar with an indicator line at the top of the tab.
 * - The current tab always has a bold label and aria-current; tapping it again scrolls to the top.
 * - While a text field has focus the bar hides, so it never sits above the on-screen keyboard.
 */
export function TabBar({ moreOpen, onMore }: { moreOpen: boolean; onMore: (opener: HTMLElement) => void }) {
  const { page } = useRoute()
  const s = useSettings()
  const r = useResolved()
  const tabs = s['nav.tabs'] as PageId[]
  const inMore = !tabs.includes(page)
  const index = inMore ? tabs.length : tabs.indexOf(page)

  useKeyboardWatch()
  useSwipe(s['nav.swipe'], tabs)
  useHideOnScroll(s['nav.hideOnScroll'] && !moreOpen, page)

  return (
    <nav className="tabbar" aria-label="Pages">
      <GlassLayer target="navbar" bezel={14} strong />
      {/* One highlight for the whole bar: it moves with transform and is never re-mounted. */}
      <span className="tab-pill" aria-hidden="true" style={{ '--tab-i': index } as CSSProperties}>
        <span className="tab-pill-shape" />
      </span>
      <ul className="tabbar-list">
        {tabs.map((id) => {
          const { Icon, short } = PAGE_META[id]
          const current = id === page
          return (
            <li key={id}>
              <a
                className="tab"
                href={`#/${id}`}
                aria-current={current ? 'page' : undefined}
                onClick={(e) => {
                  if (!current) return
                  // Re-tapping the active tab scrolls back to the top.
                  e.preventDefault()
                  window.scrollTo({ top: 0, behavior: r.reducedMotion ? 'auto' : 'smooth' })
                }}
              >
                <span className="tab-mark" aria-hidden="true" />
                <Icon />
                <span className="tab-label">{short}</span>
              </a>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            className="tab tab-more"
            data-active={inMore ? 'true' : undefined}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? 'more-sheet' : undefined}
            onClick={(e) => onMore(e.currentTarget)}
          >
            <span className="tab-mark" aria-hidden="true" />
            <MoreIcon />
            <span className="tab-label">More</span>
            {inMore && <span className="sr-only">, current page: {pageLabel(page)}</span>}
          </button>
        </li>
      </ul>
    </nav>
  )
}

const NOT_TEXT = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image', 'hidden'])

function isTyping(el: Element | null) {
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !NOT_TEXT.has(el.type)
  return el instanceof HTMLElement && el.isContentEditable
}

/**
 * Sets <html data-kb="open"> while a text field has focus, which is when phones show the
 * on-screen keyboard. CSS then hides the tab bar, caption and floating button.
 */
function useKeyboardWatch() {
  useEffect(() => {
    const root = document.documentElement
    const update = () => {
      if (isTyping(document.activeElement)) root.dataset.kb = 'open'
      else delete root.dataset.kb
    }
    // focusout fires before the next element gains focus; check once focus has settled.
    const later = () => window.setTimeout(update, 0)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', later)
    update()
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', later)
      delete root.dataset.kb
    }
  }, [])
}

/** True when a swipe that starts on this element should be left alone. */
function swipeBlocked(el: Element | null) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches('input, textarea, select, [contenteditable="true"], [data-no-swipe], .tabbar, .sheet, .drawer, [aria-modal="true"]')) return true
    const ox = getComputedStyle(n).overflowX
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true
  }
  return false
}

/** Optional: a quick horizontal swipe moves to the previous or next page in tab order. */
function useSwipe(enabled: boolean, tabs: PageId[]) {
  const key = tabs.join()
  useEffect(() => {
    if (!enabled) return
    const order = swipeOrder(key.split(',') as PageId[])
    let start: { x: number; y: number; t: number } | null = null
    const onStart = (e: TouchEvent) => {
      // Event timestamps, not the time the handler runs: a busy main thread must not turn a flick into a pan.
      start = e.touches.length === 1 && !swipeBlocked(e.target as Element) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp } : null
    }
    const onEnd = (e: TouchEvent) => {
      const s0 = start
      start = null
      if (!s0 || document.querySelector('[aria-modal="true"]') || window.getSelection()?.toString()) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s0.x
      const dy = t.clientY - s0.y
      if (Math.abs(dx) < 70 || Math.abs(dx) < 1.8 * Math.abs(dy) || e.timeStamp - s0.t > 600) return
      const i = order.indexOf(getRoute().page)
      const next = i < 0 ? undefined : order[i + (dx < 0 ? 1 : -1)]
      if (next) navigate(`#/${next}`, { origin: { x: t.clientX, y: t.clientY } })
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [enabled, key])
}

/**
 * Settings → Navigation → Hide while scrolling down. Sets <html data-bar-hidden="true"> after a
 * deliberate scroll down and clears it on any scroll up, near the top or bottom of the page, on
 * a page change, and whenever focus is inside the bar (keyboard users always see where they are).
 */
function useHideOnScroll(enabled: boolean, page: PageId) {
  useEffect(() => {
    const root = document.documentElement
    const show = () => delete root.dataset.barHidden
    show()
    if (!enabled) return
    let lastY = window.scrollY
    let travel = 0
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY
      lastY = y
      const nearEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 24
      if (y < 64 || nearEnd || document.querySelector('.tabbar')?.contains(document.activeElement)) {
        travel = 0
        return show()
      }
      // Ignore jitter: hide after 24 px of travel down, show after 8 px up.
      travel = dy > 0 ? Math.max(0, travel) + dy : Math.min(0, travel) + dy
      if (travel > 24) root.dataset.barHidden = 'true'
      else if (travel < -8) show()
    }
    const onFocus = (e: FocusEvent) => {
      if ((e.target as Element | null)?.closest?.('.tabbar')) show()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('focusin', onFocus)
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('focusin', onFocus)
      show()
    }
  }, [enabled, page])
}
