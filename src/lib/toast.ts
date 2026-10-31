import { useSyncExternalStore } from 'react'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
  action?: { label: string; run: () => void }
}

let current: Toast | null = null
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showToast(text: string, opts: { tone?: Toast['tone']; action?: Toast['action'] } = {}) {
  current = { id: ++seq, text, tone: opts.tone ?? 'ok', action: opts.action }
  emit()
}

export function dismiss(id: number) {
  if (current?.id === id) {
    current = null
    emit()
  }
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
