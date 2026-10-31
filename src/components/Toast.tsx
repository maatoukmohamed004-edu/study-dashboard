import { useEffect } from 'react'
import { dismiss, useToast } from '../lib/toast'

export function Toaster() {
  const toast = useToast()

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => dismiss(toast.id), toast.action ? 12_000 : 6_000)
    return () => window.clearTimeout(t)
  }, [toast])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={`toast toast-${toast.tone}`}>
          <p>{toast.text}</p>
          {toast.action && (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                toast.action!.run()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => dismiss(toast.id)}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
