/**
 * Settings store. Separate from your progress ("study-dashboard:v1"), which it never touches.
 * - Saved under "study-dashboard:settings:v1" as { version, values }.
 * - Every value is checked on its own against the schema: a bad value falls back to
 *   its default without discarding the rest of the file.
 * - If storage is blocked, settings live in memory and a notice says so.
 * - Open tabs stay in sync through the storage event.
 */
import { useSyncExternalStore } from 'react'
import { defaults, roundnessFor, schema, sections, settingsList, type SectionId, type SettingDef, type SettingKey, type Settings } from '../data/settings-schema'
import { normalizeHex } from './color'

export const SETTINGS_KEY = 'study-dashboard:settings:v1'
export const SETTINGS_VERSION = 2
export const SETTINGS_FILE_KIND = 'study-dashboard-settings'

// ─── Coercion (per key) ─────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Returns the value to use and whether the raw value was acceptable as-is. */
export function coerce(def: SettingDef, raw: unknown): { value: unknown; ok: boolean } {
  const fallback = Array.isArray(def.default) ? [...def.default] : def.default
  switch (def.control) {
    case 'select':
    case 'segmented':
      return typeof raw === 'string' && def.options.some((o) => o.value === raw) ? { value: raw, ok: true } : { value: fallback, ok: false }
    case 'toggle':
      return typeof raw === 'boolean' ? { value: raw, ok: true } : { value: fallback, ok: false }
    case 'range': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { value: fallback, ok: false }
      const clamped = Math.min(def.max, Math.max(def.min, raw))
      const stepped = Math.round((def.min + Math.round((clamped - def.min) / def.step) * def.step) * 1000) / 1000
      return { value: stepped, ok: stepped === raw }
    }
    case 'color': {
      if (raw === null) return { value: null, ok: true }
      const hex = normalizeHex(raw)
      return hex ? { value: hex, ok: true } : { value: fallback, ok: false }
    }
    case 'checkboxes': {
      if (!Array.isArray(raw)) return { value: fallback, ok: false }
      const allowed = def.options.map((o) => o.value)
      const value = allowed.filter((v) => raw.includes(v))
      return { value, ok: value.length === raw.length }
    }
    case 'date': {
      if (raw === '') return { value: '', ok: true }
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00`).getTime()))
        return { value: raw, ok: true }
      return { value: fallback, ok: false }
    }
    case 'time': {
      if (raw === '') return { value: '', ok: true }
      if (typeof raw === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) return { value: raw, ok: true }
      return { value: fallback, ok: false }
    }
    case 'tabs': {
      // Exactly `count` distinct, known pages; anything else falls back to the default list.
      const allowed = def.options.map((o) => o.value)
      const valid = Array.isArray(raw) && raw.length === def.count && new Set(raw).size === raw.length && raw.every((v) => typeof v === 'string' && allowed.includes(v))
      return valid ? { value: [...(raw as string[])], ok: true } : { value: fallback, ok: false }
    }
  }
}

// ─── Versions and migrations ────────────────────────────────────────────────

type Migration = (values: Record<string, unknown>) => Record<string, unknown>

/** migrations[n] upgrades values from version n to n + 1. */
const migrations: Record<number, Migration> = {
  // 0 → 1: unversioned data was a bare { key: value } map; the keys are unchanged.
  0: (values) => values,
  // 1 → 2: new keys get their defaults (fromValues does that); two derive from saved values.
  1: (values) => {
    const out = { ...values }
    // The tab bar used to take its glass from "Header"; it now has its own "Navigation bar" box.
    const apply = out['glass.applyTo']
    if (Array.isArray(apply) && apply.includes('header') && !apply.includes('navbar')) out['glass.applyTo'] = [...apply, 'navbar']
    // The roundness preset that matches a saved radius (old range 0–20, still valid).
    const radius = out['appearance.radius']
    if (typeof radius === 'number' && !('appearance.roundness' in out)) out['appearance.roundness'] = roundnessFor(radius, 'square')
    return out
  },
}

export class SettingsFileError extends Error {}

/** Unwraps { version, values } (or a bare map) and runs migrations up to the current version. */
export function migrate(raw: unknown): Record<string, unknown> {
  if (!isObj(raw)) throw new SettingsFileError('The file is not a settings file (expected a JSON object).')
  let version = typeof raw.version === 'number' && Number.isInteger(raw.version) ? raw.version : 0
  let values: Record<string, unknown> = version === 0 ? raw : isObj(raw.values) ? raw.values : {}
  if (version > SETTINGS_VERSION) {
    // Written by a newer app: keep whatever still matches this schema.
    return values
  }
  while (version < SETTINGS_VERSION) {
    values = (migrations[version] ?? ((v) => v))(values)
    version++
  }
  return values
}

/** Builds full settings from raw values, key by key. */
export function fromValues(values: Record<string, unknown>): { settings: Settings; rejected: SettingKey[] } {
  const out = defaults() as unknown as Record<string, unknown>
  const rejected: SettingKey[] = []
  for (const def of settingsList) {
    if (!(def.key in values)) continue
    const { value, ok } = coerce(def, values[def.key])
    out[def.key] = value
    if (!ok) rejected.push(def.key)
  }
  return { settings: out as unknown as Settings, rejected }
}

// ─── Store ──────────────────────────────────────────────────────────────────

const listeners = new Set<() => void>()
let problem: string | null = null

function load(): Settings {
  let raw: string | null
  try {
    raw = localStorage.getItem(SETTINGS_KEY)
  } catch {
    problem = 'This browser is blocking storage, so settings changes last only until you close the tab. Use Export settings to keep them.'
    return defaults()
  }
  if (!raw) return defaults()
  try {
    return fromValues(migrate(JSON.parse(raw))).settings
  } catch {
    problem = 'Your saved settings could not be read, so the defaults are in use.'
    return defaults()
  }
}

let settings: Settings = load()

function persist() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, values: settings }))
  } catch {
    if (!problem) problem = 'Settings could not be saved (storage blocked or full). They will last until you close the tab.'
  }
}

function emit() {
  for (const l of listeners) l()
}

export function subscribeSettings(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function getSettings(): Settings {
  return settings
}

/** Writes values (each coerced) plus any bundle a setting carries, e.g. a preset. */
export function setSettings(patch: Partial<Settings>) {
  const next = { ...settings } as unknown as Record<string, unknown>
  for (const [key, raw] of Object.entries(patch)) {
    const def = (schema as Record<string, SettingDef>)[key]
    if (!def) continue
    next[key] = coerce(def, raw).value
  }
  settings = next as unknown as Settings
  persist()
  emit()
}

export function setSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  const def = schema[key] as SettingDef<K>
  const bundle = def.apply ? def.apply(value, settings) : {}
  setSettings({ ...bundle, [key]: value } as Partial<Settings>)
}

/** Replaces everything (used by undo and import). */
export function replaceSettings(next: Settings) {
  settings = fromValues(next as unknown as Record<string, unknown>).settings
  persist()
  emit()
}

export function resetSection(section: SectionId): Settings {
  const previous = settings
  const d = defaults()
  const patch: Record<string, unknown> = {}
  for (const def of settingsList) if (def.section === section) patch[def.key] = d[def.key]
  setSettings(patch as Partial<Settings>)
  return previous
}

export function resetAll(): Settings {
  const previous = settings
  replaceSettings(defaults())
  return previous
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings)
}

export function useSetting<K extends SettingKey>(key: K): Settings[K] {
  return useSyncExternalStore(subscribeSettings, () => settings[key])
}

export function useSettingsProblem(): string | null {
  return useSyncExternalStore(subscribeSettings, () => problem)
}

window.addEventListener('storage', (e) => {
  if (e.key !== SETTINGS_KEY) return
  if (e.newValue === null) {
    settings = defaults()
    emit()
    return
  }
  try {
    settings = fromValues(migrate(JSON.parse(e.newValue))).settings
    emit()
  } catch {
    /* a bad write from another tab: keep ours */
  }
})

export const sectionLabel = (id: SectionId) => sections.find((s) => s.id === id)?.label ?? id
