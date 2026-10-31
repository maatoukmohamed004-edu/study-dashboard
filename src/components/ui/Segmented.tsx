import { useRef, type KeyboardEvent } from 'react'

export interface SegOption<V extends string> {
  value: V
  label: string
  disabled?: boolean
  /** Extra text for screen readers, e.g. why it is disabled. */
  note?: string
}

interface Props<V extends string> {
  label: string
  value: V
  options: SegOption<V>[]
  onChange: (value: V) => void
  describedBy?: string
  labelledBy?: string
}

/** A radio group drawn as the small segmented switch. Arrow keys move and select. */
export function Segmented<V extends string>({ label, value, options, onChange, describedBy, labelledBy }: Props<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKey(e: KeyboardEvent, i: number) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    const jump = e.key === 'Home' ? 'first' : e.key === 'End' ? 'last' : null
    if (!dir && !jump) return
    e.preventDefault()
    const enabled = options.map((o, k) => (o.disabled ? -1 : k)).filter((k) => k >= 0)
    let j: number
    if (jump === 'first') j = enabled[0]
    else if (jump === 'last') j = enabled[enabled.length - 1]
    else {
      const pos = enabled.indexOf(i)
      j = enabled[(pos + dir + enabled.length) % enabled.length]
    }
    onChange(options[j].value)
    refs.current[j]?.focus()
  }

  const selectedIndex = options.findIndex((o) => o.value === value)

  return (
    <div
      className="seg"
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          className="seg-item"
          aria-checked={o.value === value}
          tabIndex={i === (selectedIndex < 0 ? 0 : selectedIndex) ? 0 : -1}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.label}
          {o.note && <span className="sr-only">, {o.note}</span>}
        </button>
      ))}
    </div>
  )
}
