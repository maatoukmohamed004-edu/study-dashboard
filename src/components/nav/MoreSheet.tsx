import { useEffect, useId, useRef, type PointerEvent } from 'react'
import { useRoute, type PageId } from '../../lib/env'
import { useSettings } from '../../lib/settings'
import { useResolved } from '../../lib/theme'
import { CloseIcon } from '../icons'
import { morePages, PAGE_META } from './pages'

export type SheetClose = 'dismiss' | 'navigate'

/**
 * The pages that are not tabs, in a bottom sheet. A modal dialog: focus stays inside while it is
 * open; Esc, a tap on the backdrop, the close button or a swipe down close it, and focus goes back
 * to the "More" button (the app does that on 'dismiss'). Choosing a page closes it with
 * 'navigate', and the navigation layer moves focus to the new page's heading.
 */
export default function MoreSheet({ onClose }: { onClose: (how: SheetClose) => void }) {
  const s = useSettings()
  const r = useResolved()
  const { page } = useRoute()
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const items = morePages(s['nav.tabs'] as PageId[])
  const drag = useRef<{ y: number; t: number; dy: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  useEffect(() => {
    const el = panel.current
    // Start on the first page link: choosing a page is why the sheet was opened.
    ;(el?.querySelector<HTMLElement>('a[href]') ?? el?.querySelector<HTMLElement>('button'))?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose('dismiss')
        return
      }
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter((x) => x.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Swipe down to close: the sheet follows the finger; far or fast enough closes it.
  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, moved: false }
    dragged.current = false
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag.current
    const el = panel.current
    if (!d || !el) return
    const dy = Math.max(0, e.clientY - d.y)
    if (!d.moved && dy > 8) {
      d.moved = true
      el.setPointerCapture(e.pointerId)
    }
    if (d.moved) {
      d.dy = dy
      el.style.transition = 'none'
      el.style.transform = `translateY(${dy}px)`
    }
  }

  function onPointerUp() {
    const d = drag.current
    const el = panel.current
    drag.current = null
    if (!d?.moved || !el) return
    dragged.current = true
    const speed = d.dy / Math.max(1, performance.now() - d.t)
    if (d.dy > 90 || speed > 0.6) {
      if (r.reducedMotion) return onClose('dismiss')
      el.animate([{ transform: `translateY(${d.dy}px)` }, { transform: 'translateY(100%)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished.then(
        () => onClose('dismiss'),
        () => onClose('dismiss'),
      )
    } else {
      el.style.transition = r.reducedMotion ? 'none' : 'transform 180ms ease-out'
      el.style.transform = ''
    }
  }

  return (
    <>
      <div className="scrim sheet-scrim" onClick={() => onClose('dismiss')} aria-hidden="true" />
      <div
        ref={panel}
        id="more-sheet"
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // A drag that ends on a link is not a tap.
          if (dragged.current) {
            dragged.current = false
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <span className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={titleId} className="label">
            More
          </h2>
          <button type="button" className="square-btn sheet-close" onClick={() => onClose('dismiss')} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <ul className="sheet-list">
          {items.map((id) => {
            const { Icon, label } = PAGE_META[id]
            const current = id === page
            return (
              <li key={id}>
                <a
                  className="sheet-link"
                  href={`#/${id}`}
                  aria-current={current ? 'page' : undefined}
                  onClick={(e) => {
                    if (current) {
                      e.preventDefault()
                      onClose('dismiss')
                    } else onClose('navigate')
                  }}
                >
                  <Icon />
                  <span className="sheet-link-label">{label}</span>
                  {current && <span className="badge label">Current</span>}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
