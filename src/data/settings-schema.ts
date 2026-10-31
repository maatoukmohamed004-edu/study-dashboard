/**
 * Every setting the app has, in one declarative list.
 * The Settings page and the quick drawer are generated from this file:
 * to add a setting, add one entry here (and read it with useSetting/useResolved).
 *
 * Each entry: key, section, label, description, control, default,
 * min/max/step for ranges, options for choices, dependsOn (only shown when
 * another setting has one of the listed values) and requires (webgl | chromium).
 */
import { presetBundles, presetList, type PresetId } from './presets'

// ─── Value types ────────────────────────────────────────────────────────────

export type ColorMode = 'dark' | 'light' | 'system'
export type Density = 'compact' | 'comfortable'
export type DisplayFont = 'sofia' | 'antonio' | 'shoulders'
export type BgType = 'solid' | 'gradient' | 'dots' | 'animated' | 'dither'
export type Quality = 'auto' | 'low' | 'high'
export type GlassMode = 'off' | 'blur' | 'refraction' | 'liquid'
export type GlassTarget = 'header' | 'cards' | 'buttons'
export type OrbStyle = 'dotted' | 'liquid'
export type MotionMode = 'auto' | 'reduced' | 'full'
export type { PresetId }

export interface Settings {
  'appearance.preset': PresetId
  'appearance.colorMode': ColorMode
  /** null = the preset's accent */
  'appearance.accent': string | null
  /** null = the preset's background */
  'appearance.background': string | null
  'appearance.textSize': number
  'appearance.density': Density
  'appearance.radius': number
  'appearance.monoUppercase': boolean
  'appearance.displayFont': DisplayFont
  'background.type': BgType
  'background.color1': string | null
  'background.color2': string | null
  'background.color3': string | null
  'background.speed': number
  'background.grain': number
  'background.quality': Quality
  'background.pauseHidden': boolean
  'background.allow3dPhone': boolean
  'glass.mode': GlassMode
  'glass.blur': number
  'glass.refraction': number
  'glass.tint': number
  'glass.saturation': number
  'glass.edge': number
  'glass.applyTo': GlassTarget[]
  'hud.frame': boolean
  'hud.corners': boolean
  'hud.grid': boolean
  'hud.caption': boolean
  'hud.orb': boolean
  'hud.orbStyle': OrbStyle
  'motion.mode': MotionMode
  'motion.speed': number
  'sim.enabled': boolean
  /** YYYY-MM-DD, '' = today */
  'sim.date': string
  /** HH:MM, '' = the real time of day */
  'sim.time': string
  'diag.fps': boolean
}

export type SettingKey = keyof Settings

// ─── Sections ───────────────────────────────────────────────────────────────

export type SectionId = 'appearance' | 'background' | 'glass' | 'hud' | 'motion' | 'diagnostics' | 'data'

export const sections: { id: SectionId; label: string; description: string }[] = [
  { id: 'appearance', label: 'Appearance', description: 'Preset, colours, type and shape.' },
  { id: 'background', label: 'Background', description: 'What sits behind the pages, and how hard the 3D works.' },
  { id: 'glass', label: 'Glass', description: 'Frosted and refracting surfaces on the header, cards and buttons.' },
  { id: 'hud', label: 'HUD & layout', description: 'Frame, brackets, grid, caption and the header orb.' },
  { id: 'motion', label: 'Motion', description: 'How much moves, and how fast.' },
  { id: 'diagnostics', label: 'Simulation & diagnostics', description: 'Preview another date and time, or count frames.' },
  { id: 'data', label: 'Data', description: 'Back up, restore or reset your settings and progress.' },
]

// ─── Entry types ────────────────────────────────────────────────────────────

export type Requirement = 'webgl' | 'chromium'

export interface Option {
  value: string
  label: string
  description?: string
  requires?: Requirement
}

interface Common<K extends SettingKey> {
  key: K
  section: SectionId
  label: string
  description?: string
  default: Settings[K]
  /** Only shown when the other setting currently has one of these values. */
  dependsOn?: { key: SettingKey; is: readonly (string | boolean)[] }
  requires?: Requirement
  /** Shown in the quick-settings drawer. */
  quick?: boolean
  /** Label in the drawer, where the section heading is not visible. */
  quickLabel?: string
  /** Other settings to write together with this one (e.g. a preset's bundle). */
  apply?: (value: Settings[K]) => Partial<Settings>
}

export type SettingDef<K extends SettingKey = SettingKey> = Common<K> &
  (
    | { control: 'segmented' | 'select'; options: Option[] }
    | { control: 'toggle'; onLabel?: string; offLabel?: string }
    | { control: 'range'; min: number; max: number; step: number; unit: string }
    | { control: 'color'; swatches: string[]; nullLabel: string }
    | { control: 'checkboxes'; options: Option[] }
    | { control: 'date' | 'time' }
  )

const ON_WEBGL = ['animated', 'dither'] as const

// ─── The schema ─────────────────────────────────────────────────────────────

export const schema = {
  // Appearance
  'appearance.preset': {
    key: 'appearance.preset',
    section: 'appearance',
    label: 'Preset',
    description: 'A starting point for colours, background and glass. You can change anything afterwards.',
    control: 'select',
    options: presetList.map((p) => ({ value: p.id, label: p.label, description: p.description })),
    default: 'mono-noir',
    quick: true,
    apply: (id) => presetBundles[id],
  },
  'appearance.colorMode': {
    key: 'appearance.colorMode',
    section: 'appearance',
    label: 'Color mode',
    description: 'System follows your device setting.',
    control: 'segmented',
    options: [
      { value: 'dark', label: 'Dark' },
      { value: 'light', label: 'Light' },
      { value: 'system', label: 'System' },
    ],
    default: 'dark',
    quick: true,
  },
  'appearance.accent': {
    key: 'appearance.accent',
    section: 'appearance',
    label: 'Accent color',
    description: 'Used for progress, the current page and primary buttons.',
    control: 'color',
    swatches: ['#f2f0ea', '#79e3c5', '#8ec5ff', '#ffe500', '#ff9f6b', '#c9a7ff'],
    nullLabel: 'Preset',
    default: null,
    quick: true,
  },
  'appearance.background': {
    key: 'appearance.background',
    section: 'appearance',
    label: 'Background color',
    description: 'The page colour. Surfaces and lines are derived from it.',
    control: 'color',
    swatches: ['#0a0a0a', '#070a1f', '#17181b', '#000000', '#f4f1ea'],
    nullLabel: 'Preset',
    default: null,
  },
  'appearance.textSize': {
    key: 'appearance.textSize',
    section: 'appearance',
    label: 'Text size',
    control: 'range',
    min: 90,
    max: 120,
    step: 5,
    unit: '%',
    default: 100,
  },
  'appearance.density': {
    key: 'appearance.density',
    section: 'appearance',
    label: 'Density',
    control: 'segmented',
    options: [
      { value: 'compact', label: 'Compact' },
      { value: 'comfortable', label: 'Comfortable' },
    ],
    default: 'comfortable',
  },
  'appearance.radius': {
    key: 'appearance.radius',
    section: 'appearance',
    label: 'Corner radius',
    control: 'range',
    min: 0,
    max: 20,
    step: 1,
    unit: 'px',
    default: 0,
  },
  'appearance.monoUppercase': {
    key: 'appearance.monoUppercase',
    section: 'appearance',
    label: 'Uppercase mono labels',
    description: 'Small labels, tags and captions in capitals.',
    control: 'toggle',
    default: true,
  },
  'appearance.displayFont': {
    key: 'appearance.displayFont',
    section: 'appearance',
    label: 'Display font',
    description: 'The condensed face for big numbers and headings.',
    control: 'segmented',
    options: [
      { value: 'sofia', label: 'Sofia Sans' },
      { value: 'antonio', label: 'Antonio' },
      { value: 'shoulders', label: 'Big Shoulders' },
    ],
    default: 'sofia',
  },

  // Background
  'background.type': {
    key: 'background.type',
    section: 'background',
    label: 'Type',
    quickLabel: 'Background',
    control: 'select',
    options: [
      { value: 'solid', label: 'Solid' },
      { value: 'gradient', label: 'Static gradient' },
      { value: 'dots', label: 'Dot grid' },
      { value: 'animated', label: 'Animated gradient', description: 'ShaderGradient (3D).', requires: 'webgl' },
      { value: 'dither', label: 'Dithered sphere', description: 'A 3D sphere in the page header, with a lens that follows your cursor.', requires: 'webgl' },
    ],
    default: 'dither',
    quick: true,
  },
  'background.color1': {
    key: 'background.color1',
    section: 'background',
    label: 'Gradient color 1',
    control: 'color',
    swatches: ['#1c1c1c', '#141c63', '#2a2c31', '#3a2410'],
    nullLabel: 'Preset',
    default: null,
    dependsOn: { key: 'background.type', is: ['gradient', 'animated'] },
  },
  'background.color2': {
    key: 'background.color2',
    section: 'background',
    label: 'Gradient color 2',
    control: 'color',
    swatches: ['#3b3b3b', '#3b2496', '#3a3d44', '#1d3a3a'],
    nullLabel: 'Preset',
    default: null,
    dependsOn: { key: 'background.type', is: ['gradient', 'animated'] },
  },
  'background.color3': {
    key: 'background.color3',
    section: 'background',
    label: 'Gradient color 3',
    control: 'color',
    swatches: ['#060606', '#05071a', '#121316', '#000000'],
    nullLabel: 'Preset',
    default: null,
    dependsOn: { key: 'background.type', is: ['gradient', 'animated'] },
  },
  'background.speed': {
    key: 'background.speed',
    section: 'background',
    label: 'Speed',
    control: 'range',
    min: 0.25,
    max: 3,
    step: 0.25,
    unit: '×',
    default: 1,
    dependsOn: { key: 'background.type', is: ON_WEBGL },
  },
  'background.grain': {
    key: 'background.grain',
    section: 'background',
    label: 'Grain',
    description: 'Film grain over the background.',
    control: 'range',
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    default: 0,
  },
  'background.quality': {
    key: 'background.quality',
    section: 'background',
    label: 'Quality',
    description: 'Auto lowers the resolution when the frame rate drops.',
    control: 'segmented',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' },
    ],
    default: 'auto',
    dependsOn: { key: 'background.type', is: ON_WEBGL },
  },
  'background.pauseHidden': {
    key: 'background.pauseHidden',
    section: 'background',
    label: 'Pause when the tab is hidden',
    control: 'toggle',
    default: true,
    dependsOn: { key: 'background.type', is: ON_WEBGL },
  },
  'background.allow3dPhone': {
    key: 'background.allow3dPhone',
    section: 'background',
    label: 'Allow 3D on phones',
    description: 'Off by default: 3D drains battery and can stutter on phones.',
    control: 'toggle',
    default: false,
    dependsOn: { key: 'background.type', is: ON_WEBGL },
  },

  // Glass
  'glass.mode': {
    key: 'glass.mode',
    section: 'glass',
    label: 'Mode',
    quickLabel: 'Glass',
    control: 'select',
    options: [
      { value: 'off', label: 'Off', description: 'Solid surfaces.' },
      { value: 'blur', label: 'Frosted blur', description: 'CSS backdrop blur. Works in every modern browser.' },
      { value: 'refraction', label: 'Refraction', description: 'Blur plus a lens at the edges (SVG displacement).', requires: 'chromium' },
      {
        value: 'liquid',
        label: 'Experimental: liquid-glass-js',
        description: 'Samples the page once, so it goes stale over moving backgrounds.',
        requires: 'webgl',
      },
    ],
    default: 'refraction',
    quick: true,
  },
  'glass.blur': {
    key: 'glass.blur',
    section: 'glass',
    label: 'Blur strength',
    control: 'range',
    min: 0,
    max: 40,
    step: 1,
    unit: 'px',
    default: 16,
    dependsOn: { key: 'glass.mode', is: ['blur', 'refraction'] },
  },
  'glass.refraction': {
    key: 'glass.refraction',
    section: 'glass',
    label: 'Refraction strength',
    control: 'range',
    min: 0,
    max: 60,
    step: 2,
    unit: 'px',
    default: 22,
    dependsOn: { key: 'glass.mode', is: ['refraction'] },
  },
  'glass.tint': {
    key: 'glass.tint',
    section: 'glass',
    label: 'Tint opacity',
    description: 'How much of the page colour covers what is behind the glass. Higher is easier to read.',
    control: 'range',
    min: 20,
    max: 95,
    step: 5,
    unit: '%',
    default: 70,
    dependsOn: { key: 'glass.mode', is: ['blur', 'refraction', 'liquid'] },
  },
  'glass.saturation': {
    key: 'glass.saturation',
    section: 'glass',
    label: 'Saturation',
    control: 'range',
    min: 50,
    max: 200,
    step: 10,
    unit: '%',
    default: 110,
    dependsOn: { key: 'glass.mode', is: ['blur', 'refraction'] },
  },
  'glass.edge': {
    key: 'glass.edge',
    section: 'glass',
    label: 'Edge highlight',
    control: 'range',
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    default: 35,
    dependsOn: { key: 'glass.mode', is: ['blur', 'refraction', 'liquid'] },
  },
  'glass.applyTo': {
    key: 'glass.applyTo',
    section: 'glass',
    label: 'Apply to',
    control: 'checkboxes',
    options: [
      { value: 'header', label: 'Header' },
      { value: 'cards', label: 'Cards' },
      { value: 'buttons', label: 'Buttons' },
    ],
    default: ['header', 'cards', 'buttons'],
    dependsOn: { key: 'glass.mode', is: ['blur', 'refraction', 'liquid'] },
  },

  // HUD & layout
  'hud.frame': { key: 'hud.frame', section: 'hud', label: 'Frame', description: 'Double hairline border around the app.', control: 'toggle', default: true },
  'hud.corners': { key: 'hud.corners', section: 'hud', label: 'Corner brackets', control: 'toggle', default: true },
  'hud.grid': { key: 'hud.grid', section: 'hud', label: 'Background grid', control: 'toggle', default: true },
  'hud.caption': {
    key: 'hud.caption',
    section: 'hud',
    label: 'Bottom caption',
    description: 'The status line in the bottom-left corner.',
    control: 'toggle',
    default: true,
  },
  'hud.orb': {
    key: 'hud.orb',
    section: 'hud',
    label: 'Header orb',
    description: "Shows this week's blocks-done percentage.",
    control: 'toggle',
    default: true,
  },
  'hud.orbStyle': {
    key: 'hud.orbStyle',
    section: 'hud',
    label: 'Orb style',
    control: 'segmented',
    options: [
      { value: 'dotted', label: 'Dotted' },
      { value: 'liquid', label: 'Liquid' },
    ],
    default: 'dotted',
    dependsOn: { key: 'hud.orb', is: [true] },
  },

  // Motion
  'motion.mode': {
    key: 'motion.mode',
    section: 'motion',
    label: 'Motion',
    description: 'Auto follows your device setting for reduced motion.',
    control: 'segmented',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'reduced', label: 'Reduced' },
      { value: 'full', label: 'Full' },
    ],
    default: 'auto',
    quick: true,
  },
  'motion.speed': {
    key: 'motion.speed',
    section: 'motion',
    label: 'Animation speed',
    control: 'range',
    min: 0.5,
    max: 2,
    step: 0.25,
    unit: '×',
    default: 1,
    dependsOn: { key: 'motion.mode', is: ['auto', 'full'] },
  },

  // Simulation & diagnostics
  'sim.enabled': {
    key: 'sim.enabled',
    section: 'diagnostics',
    label: 'Simulate a date and time',
    description: 'Every page behaves as if it were that moment. A banner stays on screen while this is on.',
    control: 'toggle',
    default: false,
  },
  'sim.date': {
    key: 'sim.date',
    section: 'diagnostics',
    label: 'Simulated date',
    control: 'date',
    default: '',
    dependsOn: { key: 'sim.enabled', is: [true] },
  },
  'sim.time': {
    key: 'sim.time',
    section: 'diagnostics',
    label: 'Simulated time',
    description: 'Leave empty to use the real time of day.',
    control: 'time',
    default: '',
    dependsOn: { key: 'sim.enabled', is: [true] },
  },
  'diag.fps': {
    key: 'diag.fps',
    section: 'diagnostics',
    label: 'FPS counter',
    description: 'Frames per second, bottom-right. Use it to check smoothness on your own machine.',
    control: 'toggle',
    default: false,
  },
} satisfies { [K in SettingKey]: SettingDef<K> }

export const settingsList = Object.values(schema) as SettingDef[]

export function defaults(): Settings {
  const out = {} as Record<string, unknown>
  for (const def of settingsList) out[def.key] = Array.isArray(def.default) ? [...def.default] : def.default
  return out as unknown as Settings
}

export const quickKeys = settingsList.filter((d) => d.quick).map((d) => d.key)
