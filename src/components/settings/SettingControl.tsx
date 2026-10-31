import { useId, useState, type ReactNode } from 'react'
import { presetById } from '../../data/presets'
import { schema, type SettingDef, type SettingKey } from '../../data/settings-schema'
import { normalizeHex } from '../../lib/color'
import { getSettings, replaceSettings, setSetting, useSettings } from '../../lib/settings'
import { meets, REQ_TEXT } from './helpers'
import { showToast } from '../../lib/toast'
import { Segmented } from '../ui/Segmented'

/** One row of the Settings UI, generated from its schema entry. */
export function SettingControl({ k, compact = false }: { k: SettingKey; compact?: boolean }) {
  const def = schema[k] as SettingDef
  const s = useSettings()
  const id = useId()
  const value = s[k]
  const labelId = `${id}-label`
  const descId = def.description ? `${id}-desc` : undefined

  function write(v: unknown) {
    if (def.apply) {
      // Settings that carry a bundle (presets) change many values: offer undo.
      const previous = getSettings()
      setSetting(k, v as never)
      const label = def.key === 'appearance.preset' ? presetById[v as keyof typeof presetById]?.label : String(v)
      showToast(`Applied ${label}.`, { action: { label: 'Undo', run: () => replaceSettings(previous) } })
    } else setSetting(k, v as never)
  }

  let control: ReactNode
  switch (def.control) {
    case 'segmented':
      control = (
        <Segmented
          label={def.label}
          labelledBy={labelId}
          describedBy={descId}
          value={value as string}
          options={def.options.map((o) => ({ value: o.value, label: o.label, note: meets(o.requires) ? undefined : REQ_TEXT[o.requires!] }))}
          onChange={write}
        />
      )
      break
    case 'toggle':
      control = (
        <Segmented
          label={def.label}
          labelledBy={labelId}
          describedBy={descId}
          value={value ? 'on' : 'off'}
          options={[
            { value: 'off', label: def.offLabel ?? 'Off' },
            { value: 'on', label: def.onLabel ?? 'On' },
          ]}
          onChange={(v) => write(v === 'on')}
        />
      )
      break
    case 'select':
      control = (
        <select id={`${id}-input`} className="input" value={value as string} onChange={(e) => write(e.target.value)} aria-describedby={descId}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {meets(o.requires) ? '' : ` (${REQ_TEXT[o.requires!]})`}
            </option>
          ))}
        </select>
      )
      break
    case 'range':
      control = (
        <div className="range">
          <input
            id={`${id}-input`}
            type="range"
            min={def.min}
            max={def.max}
            step={def.step}
            value={value as number}
            onChange={(e) => write(Number(e.target.value))}
            aria-describedby={descId}
            aria-valuetext={`${value}${def.unit === '×' ? ' times' : def.unit === '%' ? ' percent' : ` ${def.unit}`}`}
          />
          <output className="range-out label" htmlFor={`${id}-input`}>
            {value as number}
            {def.unit}
          </output>
        </div>
      )
      break
    case 'color':
      control = <ColorControl def={def} value={value as string | null} onChange={write} labelId={labelId} descId={descId} />
      break
    case 'checkboxes': {
      const list = value as string[]
      control = (
        <div className="checks" role="group" aria-labelledby={labelId} aria-describedby={descId}>
          {def.options.map((o) => (
            <label key={o.value} className="check">
              <input
                type="checkbox"
                checked={list.includes(o.value)}
                onChange={(e) => write(e.target.checked ? [...list, o.value] : list.filter((x) => x !== o.value))}
              />
              {o.label}
            </label>
          ))}
        </div>
      )
      break
    }
    case 'date':
    case 'time':
      control = (
        <div className="datetime">
          <input
            id={`${id}-input`}
            className="input"
            type={def.control}
            value={value as string}
            onChange={(e) => write(e.target.value)}
            aria-describedby={descId}
          />
          {value !== '' && (
            <button type="button" className="btn-link" onClick={() => write('')}>
              Clear
            </button>
          )}
        </div>
      )
      break
  }

  const usesHtmlLabel = def.control === 'select' || def.control === 'range' || def.control === 'date' || def.control === 'time'
  const unmet = !meets(def.requires)
  const label = compact && def.quickLabel ? def.quickLabel : def.label

  return (
    <div className={`setting${compact ? ' is-compact' : ''}`} data-key={def.key}>
      <div className="setting-text">
        {usesHtmlLabel ? (
          <label id={labelId} className="setting-label" htmlFor={`${id}-input`}>
            {label}
          </label>
        ) : (
          <p id={labelId} className="setting-label">
            {label}
          </p>
        )}
        {def.description && !compact && (
          <p id={descId} className="setting-desc">
            {def.description}
          </p>
        )}
        {unmet && <p className="setting-note">Not available here: {REQ_TEXT[def.requires!]}.</p>}
      </div>
      <div className="setting-control">{control}</div>
    </div>
  )
}

function ColorControl({
  def,
  value,
  onChange,
  labelId,
  descId,
}: {
  def: Extract<SettingDef, { control: 'color' }>
  value: string | null
  onChange: (v: string | null) => void
  labelId: string
  descId?: string
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const shown = draft ?? value ?? ''

  function commit(text: string) {
    if (text.trim() === '') {
      onChange(null)
      setError(false)
      setDraft(null)
      return
    }
    const hex = normalizeHex(text)
    if (hex) {
      onChange(hex)
      setError(false)
      setDraft(null)
    } else setError(true)
  }

  return (
    <div className="color-ctl">
      <div className="swatches" role="group" aria-labelledby={labelId} aria-describedby={descId}>
        <button type="button" aria-pressed={value === null} className="swatch-btn swatch-null label" onClick={() => onChange(null)}>
          {def.nullLabel}
        </button>
        {def.swatches.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={value === c}
            aria-label={c}
            className="swatch-btn"
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <div className="hex">
        <label className="sr-only" htmlFor={`${id}-hex`}>
          Hex value
        </label>
        <span className="hex-chip" style={{ background: value ?? 'transparent' }} aria-hidden="true" />
        <input
          id={`${id}-hex`}
          className="input hex-input label"
          value={shown}
          placeholder="#rrggbb"
          maxLength={7}
          spellCheck={false}
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(false)
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
          }}
        />
        {error && (
          <p id={`${id}-err`} className="field-error" role="alert">
            Use a hex colour like #1a2b3c.
          </p>
        )}
      </div>
    </div>
  )
}
