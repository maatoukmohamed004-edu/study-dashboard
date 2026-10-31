import { useRef } from 'react'
import { exportJSON, getState, ImportError, parseBackup, replaceState } from '../lib/store'
import { useToday } from '../lib/env'
import { showToast } from '../lib/toast'

/** Progress export and import. Same file format and behaviour as before the redesign. */
export function BackupButtons() {
  const today = useToday()
  const input = useRef<HTMLInputElement>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      const next = await parseBackup(file)
      const previous = getState()
      replaceState(next)
      const days = Object.keys(next.blocks).length
      const checks = next.sundayChecks.length
      showToast(`Imported ${file.name}: ${days} ${days === 1 ? 'day' : 'days'} of blocks, ${checks} Sunday ${checks === 1 ? 'check' : 'checks'}.`, {
        action: { label: 'Undo import', run: () => replaceState(previous) },
      })
    } catch (e) {
      const msg = e instanceof ImportError ? e.message : `Could not read ${file.name}.`
      showToast(`${msg} Nothing was changed.`, { tone: 'error' })
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="backup" role="group" aria-label="Progress backup">
      <button type="button" className="btn" onClick={() => exportJSON(today)}>
        Export progress
      </button>
      <button type="button" className="btn" onClick={() => input.current?.click()}>
        Import progress
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  )
}
