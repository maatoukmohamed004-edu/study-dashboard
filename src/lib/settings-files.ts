/**
 * Settings files: export to JSON and import with per-key repair. Only the Settings page uses
 * these, so they stay out of the first-load bundle.
 */
import { settingsList, type SettingKey, type Settings } from '../data/settings-schema'
import { fromValues, getSettings, migrate, SETTINGS_FILE_KIND, SETTINGS_VERSION, SettingsFileError } from './settings'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function exportSettings(today: string) {
  const body = { kind: SETTINGS_FILE_KIND, version: SETTINGS_VERSION, exportedAt: new Date().toISOString(), values: getSettings() }
  const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `study-dashboard-settings-${today}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Reads a settings file. Rejects files that are not settings; repairs bad values one key at a time. */
export async function readSettingsFile(file: File): Promise<{ settings: Settings; rejected: SettingKey[]; recognised: number }> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new SettingsFileError(`${file.name} is not valid JSON.`)
  }
  if (!isObj(json)) throw new SettingsFileError(`${file.name} is not a settings file.`)
  if ('blocks' in json || 'sundayChecks' in json)
    throw new SettingsFileError(`${file.name} is a progress backup. Import it with "Import progress" instead.`)
  if (json.kind !== undefined && json.kind !== SETTINGS_FILE_KIND) throw new SettingsFileError(`${file.name} is not a settings file.`)
  const values = migrate(json)
  const recognised = settingsList.filter((d) => d.key in values).length
  if (recognised === 0) throw new SettingsFileError(`${file.name} has no settings this app recognises.`)
  return { ...fromValues(values), recognised }
}

