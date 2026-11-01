import { schema, type Requirement, type SettingDef, type Settings } from '../../data/settings-schema'
import { caps } from '../../lib/capabilities'
import { getSettings, replaceSettings, setSettings } from '../../lib/settings'
import { showToast } from '../../lib/toast'

export function meets(req: Requirement | undefined): boolean {
  if (!req) return true
  return req === 'webgl' ? caps.webgl : caps.chromium
}

export const REQ_TEXT: Record<Requirement, string> = { webgl: 'needs WebGL', chromium: 'needs a Chromium browser' }

/** Whether a setting is shown: the setting it depends on has a listed value and is itself shown. */
export function isVisible(def: SettingDef, s: Settings): boolean {
  if (!def.dependsOn) return true
  if (!def.dependsOn.is.includes(s[def.dependsOn.key] as string | boolean)) return false
  return isVisible(schema[def.dependsOn.key] as SettingDef, s)
}


/** Writes several settings at once (used by "Fix automatically"). */
export function applyPatch(patch: Partial<Settings>, message: string) {
  const previous = getSettings()
  setSettings(patch)
  showToast(message, { action: { label: 'Undo', run: () => replaceSettings(previous) } })
}
