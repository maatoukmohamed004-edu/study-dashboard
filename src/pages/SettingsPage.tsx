import { useEffect, useRef } from 'react'
import { sections, settingsList, type SectionId, type SettingDef } from '../data/settings-schema'
import { sectionHelp } from '../data/settings-text'
import { BackupButtons } from '../components/BackupButtons'
import { LiquidMetalSurface } from '../components/metal/LiquidMetalSurface'
import { useMetalOn } from '../components/metal/useMetalOn'
import { ContrastGuard } from '../components/settings/ContrastGuard'
import { SettingControl } from '../components/settings/SettingControl'
import { isVisible } from '../components/settings/helpers'
import { GiantTitle, StatusStrip, Tag } from '../components/ui/Hud'
import { caps } from '../lib/capabilities'
import { useToday } from '../lib/env'
import { getSettings, replaceSettings, resetAll, resetSection, SettingsFileError, useSettings } from '../lib/settings'
import { exportSettings, readSettingsFile } from '../lib/settings-files'
import { useResolved } from '../lib/theme'
import { showToast } from '../lib/toast'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const ENGINE_LABEL = { off: 'Off', blur: 'Frosted blur', svg: 'Refraction', liquid: 'liquid-glass-js' } as const
const BG_LABEL = { solid: 'Solid', gradient: 'Static gradient', dots: 'Dot grid', animated: 'Animated gradient', dither: 'Dithered sphere' } as const

/** #/settings shows every section; #/settings/<section> shows one. */
export default function SettingsPage({ section }: { section: string | null }) {
  const active = sections.find((x) => x.id === section)?.id ?? null
  const shown = active ? sections.filter((x) => x.id === active) : sections
  const r = useResolved()
  const headRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Moving between sections: put focus on the section heading for keyboard and screen-reader users.
    if (active) headRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: false })
  }, [active])

  return (
    <div className="settings-page">
      <StatusStrip
        label="Current setup"
        cells={[
          { top: 'Settings', bottom: 'Saved in this browser' },
          { top: 'Glass in use', bottom: ENGINE_LABEL[r.glass] },
          { top: 'Background in use', bottom: `${BG_LABEL[r.bg]}${r.bg === 'dither' && !r.bg3d ? ' (static)' : ''}` },
          { top: 'Motion', bottom: r.reducedMotion ? 'Reduced' : 'Full' },
        ]}
      />
      <section className="hero no-art settings-hero" aria-label="Summary">
        <div className="hero-main">
          <Tag index="07">Settings · changes apply instantly</Tag>
          <p className="hero-lede">Everything here is saved on this device and applies as you change it. Your progress is kept separately and is never touched by these controls.</p>
        </div>
        <GiantTitle text="Settings" />
      </section>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <ul>
            <li>
              <a className="label" href="#/settings" aria-current={active === null ? 'page' : undefined}>
                All settings
              </a>
            </li>
            {sections.map((x, i) => (
              <li key={x.id}>
                <a className="label" href={`#/settings/${x.id}`} aria-current={active === x.id ? 'page' : undefined}>
                  <span aria-hidden="true">{String(i + 1).padStart(2, '0')} </span>
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="settings-sections" ref={headRef}>
          {shown.map((x) => (
            <SettingsSection key={x.id} id={x.id} focusable={active === x.id} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsSection({ id, focusable }: { id: SectionId; focusable: boolean }) {
  const meta = sections.find((x) => x.id === id)!
  const s = useSettings()
  const r = useResolved()
  const defs = settingsList.filter((d) => d.section === id && isVisible(d, s))
  // Consecutive entries with the same `group` share a sub-heading (Appearance → Roundness, …).
  const groups: { name: string | null; defs: SettingDef[] }[] = []
  for (const d of defs) {
    const name = d.group ?? null
    if (groups.length && groups[groups.length - 1].name === name) groups[groups.length - 1].defs.push(d)
    else groups.push({ name, defs: [d] })
  }
  const index = sections.findIndex((x) => x.id === id) + 1

  return (
    <section className="settings-section" id={`settings-${id}`} aria-labelledby={`h-${id}`}>
      <div className="section-head">
        <div>
          <p className="label muted">[ {String(index).padStart(2, '0')} ]</p>
          <h2 id={`h-${id}`} className="section-title" tabIndex={focusable ? -1 : undefined}>
            {meta.label}
          </h2>
        </div>
        {id !== 'data' && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const previous = resetSection(id)
              showToast(`${meta.label} reset to defaults.`, { action: { label: 'Undo', run: () => replaceSettings(previous) } })
            }}
          >
            Reset section
          </button>
        )}
      </div>
      <p className="settings-desc">{sectionHelp[id]}</p>

      {id === 'glass' && (
        <p className={`inline-note${r.glassNote ? '' : ' is-quiet'}`} role="status">
          <span className="label">In use: {ENGINE_LABEL[r.glass]}</span>
          {r.glassNote && <span>{r.glassNote}</span>}
        </p>
      )}
      {id === 'background' && (
        <p className={`inline-note${r.bgNote ? '' : ' is-quiet'}`} role="status">
          <span className="label">
            In use: {BG_LABEL[r.bg]}
            {r.bg === 'dither' && !r.bg3d ? ' (static)' : ''}
          </span>
          {r.bgNote && <span>{r.bgNote}</span>}
        </p>
      )}

      {groups.map((g) => (
        <div key={g.name ?? 'main'} className="settings-group" role={g.name ? 'group' : undefined} aria-labelledby={g.name ? `h-${id}-${slug(g.name)}` : undefined}>
          {g.name && (
            <h3 id={`h-${id}-${slug(g.name)}`} className="sub-title settings-group-title">
              {g.name}
            </h3>
          )}
          {g.name === 'Liquid metal' && <MetalNote />}
          <div className="settings-list">
            {g.defs.map((d) => (
              <SettingControl key={d.key} k={d.key} />
            ))}
          </div>
        </div>
      ))}

      {id === 'appearance' && <ContrastGuard />}
      {id === 'diagnostics' && <Diagnostics />}
      {id === 'data' && <DataSection />}
    </section>
  )
}

const METAL_LABEL = { live: 'Shader (WebGL 2)', still: 'Shader, still frame', css: 'Still metallic rim (CSS)', off: 'Off' } as const

function MetalNote() {
  const s = useSettings()
  const r = useResolved()
  const state = !s['metal.enabled'] || !s['metal.applyTo'].length ? 'off' : !r.metal.live ? 'css' : r.metal.still ? 'still' : 'live'
  const note = !caps.webgl2
    ? "WebGL 2 isn't available in this browser, so a still metallic rim (CSS) is shown and the shader settings are off."
    : s['background.quality'] === 'low'
      ? 'Background quality is Low, so a still metallic rim (CSS) is shown.'
      : r.reducedMotion && !s['metal.static']
        ? 'Reduced motion is on, so the metal holds still.'
        : null
  return (
    <p className={`inline-note${note ? '' : ' is-quiet'}`} role="status">
      <span className="label">In use: {METAL_LABEL[state]}</span>
      {note && <span>{note}</span>}
      {state === 'live' && <span>At most {r.phone ? 'one live surface on phones' : 'two live surfaces'}; the others show the still rim.</span>}
    </p>
  )
}

function Diagnostics() {
  const r = useResolved()
  return (
    <dl className="diag">
      <div>
        <dt className="label muted">WebGL</dt>
        <dd className="label">{caps.webgl ? 'Available' : 'Unavailable'}</dd>
      </div>
      <div>
        <dt className="label muted">WebGL 2</dt>
        <dd className="label">{caps.webgl2 ? 'Available' : 'Unavailable'}</dd>
      </div>
      <div>
        <dt className="label muted">Refraction (Chromium)</dt>
        <dd className="label">{caps.chromium ? 'Supported' : 'Not supported'}</dd>
      </div>
      <div>
        <dt className="label muted">Screen</dt>
        <dd className="label">{r.phone ? 'Phone width' : 'Wide'}</dd>
      </div>
      <div>
        <dt className="label muted">Colour mode in use</dt>
        <dd className="label">{r.mode}</dd>
      </div>
    </dl>
  )
}

function DataSection() {
  const today = useToday()
  const input = useRef<HTMLInputElement>(null)
  const metal = useMetalOn('primary') ? 'on' : undefined

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      const { settings, rejected, recognised } = await readSettingsFile(file)
      const previous = getSettings()
      replaceSettings(settings)
      const note = rejected.length ? ` ${rejected.length} invalid ${rejected.length === 1 ? 'value was' : 'values were'} reset to defaults (${rejected.join(', ')}).` : ''
      showToast(`Imported ${recognised} settings from ${file.name}.${note}`, { action: { label: 'Undo import', run: () => replaceSettings(previous) } })
    } catch (e) {
      showToast(`${e instanceof SettingsFileError ? e.message : `Could not read ${file.name}.`} Nothing was changed.`, { tone: 'error' })
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="data-grid">
      <div className="card">
        <h3 className="sub-title">Settings file</h3>
        <p className="setting-desc">Saved as study-dashboard-settings-{today}.json. Does not include your progress.</p>
        <div className="data-actions">
          <button type="button" className="btn" data-metal={metal} onClick={() => exportSettings(today)}>
            <LiquidMetalSurface target="primary" />
            Export settings
          </button>
          <button type="button" className="btn" data-metal={metal} onClick={() => input.current?.click()}>
            <LiquidMetalSurface target="primary" />
            Import settings
          </button>
          <input ref={input} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
      <div className="card">
        <h3 className="sub-title">Progress backup</h3>
        <p className="setting-desc">Your blocks, absences, checks and notes, as before (study-dashboard-{today}.json).</p>
        <BackupButtons />
      </div>
      <div className="card">
        <h3 className="sub-title">Reset</h3>
        <p className="setting-desc">Puts every setting back to its default. Your progress is not affected.</p>
        <div className="data-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const previous = resetAll()
              showToast('All settings reset to defaults.', { action: { label: 'Undo', run: () => replaceSettings(previous) } })
            }}
          >
            Reset all settings
          </button>
        </div>
      </div>
    </div>
  )
}

