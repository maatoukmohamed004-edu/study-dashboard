import { useEffect, useId, useRef } from 'react'
import { quickKeys } from '../../data/settings-schema'
import { BackupButtons } from '../BackupButtons'
import { CloseIcon } from '../icons'
import { ContrastGuard } from './ContrastGuard'
import { SettingControl } from './SettingControl'

/** The six most-used settings in a drawer. Esc or the scrim closes it; focus stays inside while open. */
export default function QuickSettings({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = panel.current
    el?.querySelector<HTMLElement>('button, a, input, select')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select, [tabindex="0"]')].filter(
        (x) => x.offsetParent !== null,
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={panel} id="quick-settings" className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="drawer-head">
          <h2 id={titleId} className="label">
            Quick settings
          </h2>
          <button type="button" className="square-btn" onClick={onClose} aria-label="Close quick settings">
            <CloseIcon />
          </button>
        </div>
        <div className="drawer-body">
          {quickKeys.map((k) => (
            <SettingControl key={k} k={k} compact />
          ))}
          <ContrastGuard compact />
        </div>
        <div className="drawer-foot">
          <a className="btn" href="#/settings" onClick={onClose}>
            All settings
          </a>
          <BackupButtons />
        </div>
      </div>
    </>
  )
}
