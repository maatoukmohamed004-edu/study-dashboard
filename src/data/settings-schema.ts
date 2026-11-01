/**
 * Every setting the app has, in one declarative list.
 * The Settings page and the quick drawer are generated from this file:
 * to add a setting, add one entry here (and read it with useSetting/useResolved).
 *
 * Each entry: key, section, label, control, default,
 * min/max/step for ranges, options for choices, dependsOn (only shown when
 * another setting has one of the listed values) and requires (webgl | webgl2 | chromium).
 * Help text lives in settings-text.ts, which only the (lazy) Settings UI loads.
 */
import { presetBundles, presetList, type PresetId } from './presets'

// ─── Value types ────────────────────────────────────────────────────────────

export type ColorMode = 'dark' | 'light' | 'system'
export type Density = 'compact' | 'comfortable'
export type DisplayFont = 'sofia' | 'antonio' | 'shoulders'
export type BgType = 'solid' | 'gradient' | 'dots' | 'animated' | 'dither'
export type Quality = 'auto' | 'low' | 'high'
export type GlassMode = 'off' | 'blur' | 'refraction' | 'liquid'
export type GlassTarget = 'header' | 'navbar' | 'cards' | 'buttons'
export type OrbStyle = 'dotted' | 'liquid'
export type MotionMode = 'auto' | 'reduced' | 'full'
export type NavTransition = 'reveal' | 'wash' | 'fade' | 'none'
export type NavOrigin = 'press' | 'center'
export type BarStyle = 'floating' | 'docked'
export type TabHighlight = 'pill' | 'underline'
export type MetalTarget = 'tab' | 'primary' | 'floating'
export type MetalTint = 'silver' | 'warm' | 'cool' | 'accent'
/** Appearance → Roundness presets; 'custom' = the master slider is at another value. */
export type Roundness = 'square' | 'soft' | 'rounded' | 'very' | 'pill' | 'custom'
/** Per-group override when "Link all to master" is off. */
export type RadiusOverride = 'master' | 'square' | 'soft' | 'rounded' | 'very' | 'pill'
/** Every routable page; the bottom tab bar shows four of them. */
export type NavPage = 'today' | 'week' | 'plan' | 'resources' | 'absences' | 'check' | 'settings'
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
  /** Master corner radius in px (0–40). */
  'appearance.radius': number
  'appearance.roundness': Roundness
  'appearance.radiusLink': boolean
  'appearance.radiusNav': RadiusOverride
  'appearance.radiusCards': RadiusOverride
  'appearance.radiusButtons': RadiusOverride
  'appearance.radiusInputs': RadiusOverride
  'appearance.radiusSheets': RadiusOverride
  'appearance.radiusHud': RadiusOverride
  'metal.enabled': boolean
  'metal.applyTo': MetalTarget[]
  'metal.tint': MetalTint
  /** Animation speed at rest and under the pointer or focus (shader time multiplier). */
  'metal.speed': number
  'metal.hoverSpeed': number
  'metal.static': boolean
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
  'nav.transition': NavTransition
  /** Milliseconds at animation speed 1×. */
  'nav.duration': number
  'nav.softness': number
  'nav.origin': NavOrigin
  'nav.bottomBar': boolean
  'nav.labels': boolean
  'nav.swipe': boolean
  /** Floating glass pill, or the full-width bar docked to the bottom edge. */
  'nav.barStyle': BarStyle
  /** Floating bar: gap to the left and right screen edges, px. */
  'nav.barMargin': number
  /** Floating bar: gap above the bottom edge (plus the home-indicator inset), px. */
  'nav.barGap': number
  'nav.highlight': TabHighlight
  'nav.hideOnScroll': boolean
  /** Exactly four pages, in tab order; the rest go to "More". */
  'nav.tabs': NavPage[]
  'sim.enabled': boolean
  /** YYYY-MM-DD, '' = today */
  'sim.date': string
  /** HH:MM, '' = the real time of day */
  'sim.time': string
  'diag.fps': boolean
}

export type SettingKey = keyof Settings

// ─── Sections ───────────────────────────────────────────────────────────────

export type SectionId = 'appearance' | 'background' | 'glass' | 'hud' | 'navigation' | 'motion' | 'diagnostics' | 'data'

export const sections: { id: SectionId; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'background', label: 'Background' },
  { id: 'glass', label: 'Glass' },
  { id: 'hud', label: 'HUD & layout' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'motion', label: 'Motion' },
  { id: 'diagnostics', label: 'Simulation & diagnostics' },
  { id: 'data', label: 'Data' },
]

// ─── Entry types ────────────────────────────────────────────────────────────

export type Requirement = 'webgl' | 'webgl2' | 'chromium'

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
  default: Settings[K]
  /** Only shown when the other setting currently has one of these values. */
  dependsOn?: { key: SettingKey; is: readonly (string | boolean)[] }
  requires?: Requirement
  /** Shown in the quick-settings drawer. */
  quick?: boolean
  /** Label in the drawer, where the section heading is not visible. */
  quickLabel?: string
  /** Other settings to write together with this one (e.g. a preset's bundle). */
  apply?: (value: Settings[K], current: Settings) => Partial<Settings>
  /** Show an "Applied … / Undo" toast after a change (settings that rewrite many others). */
  undo?: boolean
  /** Sub-heading inside the section; consecutive entries with the same group share it. */
  group?: string
}

export type SettingDef<K extends SettingKey = SettingKey> = Common<K> &
  (
    | { control: 'segmented' | 'select'; options: Option[] }
    | { control: 'toggle'; onLabel?: string; offLabel?: string }
    | { control: 'range'; min: number; max: number; step: number; unit: string }
    | { control: 'color'; swatches: string[]; nullLabel: string }
    | { control: 'checkboxes'; options: Option[] }
    | { control: 'date' | 'time' }
    /** Pick exactly `count` distinct options, in order (each slot is a select; choosing a used option swaps). */
    | { control: 'tabs'; options: Option[]; count: number; slotLabel: string }
  )

const ON_WEBGL = ['animated', 'dither'] as const

/** Master radius of each roundness preset. Pill = Very round plus fully round controls. */
export const ROUNDNESS_PX: Record<Exclude<Roundness, 'custom'>, number> = { square: 0, soft: 8, rounded: 16, very: 28, pill: 28 }

/** The preset a master radius corresponds to (Pill is kept while the radius stays at 28). */
export function roundnessFor(radius: number, current: Roundness): Roundness {
  if (current === 'pill' && radius === ROUNDNESS_PX.pill) return 'pill'
  const hit = (['square', 'soft', 'rounded', 'very'] as const).find((k) => ROUNDNESS_PX[k] === radius)
  return hit ?? 'custom'
}

const ROUND_OPTIONS = [
  { value: 'square', label: 'Square' },
  { value: 'soft', label: 'Soft' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'very', label: 'Very round' },
  { value: 'pill', label: 'Pill' },
]
const OVERRIDE_OPTIONS: Option[] = [{ value: 'master', label: 'Same as master' }, ...ROUND_OPTIONS]
const UNLINKED = { key: 'appearance.radiusLink', is: [false] } as const

function radiusOverride<K extends 'appearance.radiusNav' | 'appearance.radiusCards' | 'appearance.radiusButtons' | 'appearance.radiusInputs' | 'appearance.radiusSheets' | 'appearance.radiusHud'>(
  key: K,
  label: string,
  def: RadiusOverride = 'master',
) {
  return { key, section: 'appearance', group: 'Roundness', label, control: 'select', options: OVERRIDE_OPTIONS, default: def, dependsOn: UNLINKED } as const
}
const DISC = ['reveal', 'wash'] as const

/** All pages, in their canonical order (used for the tab picker and the "More" sheet). */
export const NAV_PAGES: { value: NavPage; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'plan', label: 'Plan' },
  { value: 'resources', label: 'Resources' },
  { value: 'absences', label: 'Absences' },
  { value: 'check', label: 'Sunday check' },
  { value: 'settings', label: 'Settings' },
]
export const DEFAULT_TABS: NavPage[] = ['today', 'week', 'plan', 'absences']

// ─── The schema ─────────────────────────────────────────────────────────────

export const schema = {
  // Appearance
  'appearance.preset': {
    key: 'appearance.preset',
    section: 'appearance',
    label: 'Preset',
    control: 'select',
    options: presetList.map((p) => ({ value: p.id, label: p.label })),
    default: 'mono-noir',
    quick: true,
    undo: true,
    apply: (id) => presetBundles[id],
  },
  'appearance.colorMode': {
    key: 'appearance.colorMode',
    section: 'appearance',
    label: 'Color mode',
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
  'appearance.monoUppercase': {
    key: 'appearance.monoUppercase',
    section: 'appearance',
    label: 'Uppercase mono labels',
    control: 'toggle',
    default: true,
  },
  'appearance.displayFont': {
    key: 'appearance.displayFont',
    section: 'appearance',
    label: 'Display font',
    control: 'segmented',
    options: [
      { value: 'sofia', label: 'Sofia Sans' },
      { value: 'antonio', label: 'Antonio' },
      { value: 'shoulders', label: 'Big Shoulders' },
    ],
    default: 'sofia',
  },
  'appearance.roundness': {
    key: 'appearance.roundness',
    section: 'appearance',
    group: 'Roundness',
    label: 'Roundness',
    control: 'segmented',
    options: [...ROUND_OPTIONS, { value: 'custom', label: 'Custom' }],
    default: 'square',
    apply: (v) => (v === 'custom' ? {} : { 'appearance.radius': ROUNDNESS_PX[v] }),
  },
  'appearance.radius': {
    key: 'appearance.radius',
    section: 'appearance',
    group: 'Roundness',
    label: 'Corner radius',
    control: 'range',
    min: 0,
    max: 40,
    step: 1,
    unit: 'px',
    default: 0,
    apply: (v, cur) => ({ 'appearance.roundness': roundnessFor(v, cur['appearance.roundness']) }),
  },
  'appearance.radiusLink': {
    key: 'appearance.radiusLink',
    section: 'appearance',
    group: 'Roundness',
    label: 'Link all to master',
    control: 'toggle',
    default: true,
  },
  'appearance.radiusNav': radiusOverride('appearance.radiusNav', 'Navigation bar', 'pill'),
  'appearance.radiusCards': radiusOverride('appearance.radiusCards', 'Cards & panels'),
  'appearance.radiusButtons': radiusOverride('appearance.radiusButtons', 'Buttons & chips'),
  'appearance.radiusInputs': radiusOverride('appearance.radiusInputs', 'Inputs'),
  'appearance.radiusSheets': radiusOverride('appearance.radiusSheets', 'Sheets & dialogs'),
  'appearance.radiusHud': radiusOverride('appearance.radiusHud', 'HUD frame'),
  'metal.enabled': {
    key: 'metal.enabled',
    section: 'appearance',
    group: 'Liquid metal',
    label: 'Liquid metal',
    control: 'toggle',
    default: true,
  },
  'metal.applyTo': {
    key: 'metal.applyTo',
    section: 'appearance',
    group: 'Liquid metal',
    label: 'Apply to',
    control: 'checkboxes',
    options: [
      { value: 'tab', label: 'Selected tab (tab bar)' },
      { value: 'primary', label: 'Primary buttons (Start, Export, Import)' },
      { value: 'floating', label: 'Floating buttons (Quick settings, Back to top)' },
    ],
    default: ['tab'],
    dependsOn: { key: 'metal.enabled', is: [true] },
  },
  'metal.tint': {
    key: 'metal.tint',
    section: 'appearance',
    group: 'Liquid metal',
    label: 'Tint',
    control: 'segmented',
    options: [
      { value: 'silver', label: 'Silver' },
      { value: 'warm', label: 'Warm' },
      { value: 'cool', label: 'Cool' },
      { value: 'accent', label: 'Accent' },
    ],
    default: 'silver',
    dependsOn: { key: 'metal.enabled', is: [true] },
  },
  'metal.speed': {
    key: 'metal.speed',
    section: 'appearance',
    group: 'Liquid metal',
    label: 'Idle speed',
    control: 'range',
    min: 0.1,
    max: 2,
    step: 0.1,
    unit: '×',
    default: 0.6,
    requires: 'webgl2',
    dependsOn: { key: 'metal.static', is: [false] },
  },
  'metal.hoverSpeed': {
    key: 'metal.hoverSpeed',
    section: 'appearance',
    group: 'Liquid metal',
    label: 'Hover speed',
    control: 'range',
    min: 0.1,
    max: 3,
    step: 0.1,
    unit: '×',
    default: 1,
    requires: 'webgl2',
    dependsOn: { key: 'metal.static', is: [false] },
  },
  'metal.static': {
    key: 'metal.static',
    section: 'appearance',
    group: 'Liquid metal',
    label: 'Static (no animation)',
    control: 'toggle',
    default: false,
    requires: 'webgl2',
    dependsOn: { key: 'metal.enabled', is: [true] },
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
      { value: 'animated', label: 'Animated gradient', requires: 'webgl' },
      { value: 'dither', label: 'Dithered sphere', requires: 'webgl' },
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
      { value: 'off', label: 'Off' },
      { value: 'blur', label: 'Frosted blur' },
      { value: 'refraction', label: 'Refraction', requires: 'chromium' },
      {
        value: 'liquid',
        label: 'Experimental: liquid-glass-js',
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
      { value: 'navbar', label: 'Navigation bar (phones)' },
      { value: 'cards', label: 'Cards' },
      { value: 'buttons', label: 'Buttons' },
    ],
    default: ['header', 'navbar', 'cards', 'buttons'],
    dependsOn: { key: 'glass.mode', is: ['blur', 'refraction', 'liquid'] },
  },

  // HUD & layout
  'hud.frame': { key: 'hud.frame', section: 'hud', label: 'Frame', control: 'toggle', default: true },
  'hud.corners': { key: 'hud.corners', section: 'hud', label: 'Corner brackets', control: 'toggle', default: true },
  'hud.grid': { key: 'hud.grid', section: 'hud', label: 'Background grid', control: 'toggle', default: true },
  'hud.caption': {
    key: 'hud.caption',
    section: 'hud',
    label: 'Bottom caption',
    control: 'toggle',
    default: true,
  },
  'hud.orb': {
    key: 'hud.orb',
    section: 'hud',
    label: 'Header orb',
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

  // Navigation
  'nav.transition': {
    key: 'nav.transition',
    section: 'navigation',
    label: 'Page transition',
    control: 'select',
    options: [
      { value: 'reveal', label: 'Disc reveal' },
      { value: 'wash', label: 'Disc wash' },
      { value: 'fade', label: 'Crossfade' },
      { value: 'none', label: 'None' },
    ],
    default: 'reveal',
  },
  'nav.duration': {
    key: 'nav.duration',
    section: 'navigation',
    label: 'Duration',
    control: 'range',
    min: 300,
    max: 1200,
    step: 50,
    unit: 'ms',
    default: 650,
    dependsOn: { key: 'nav.transition', is: ['reveal', 'wash', 'fade'] },
  },
  'nav.softness': {
    key: 'nav.softness',
    section: 'navigation',
    label: 'Edge softness',
    control: 'range',
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    default: 35,
    dependsOn: { key: 'nav.transition', is: DISC },
  },
  'nav.origin': {
    key: 'nav.origin',
    section: 'navigation',
    label: 'Disc starts at',
    control: 'segmented',
    options: [
      { value: 'press', label: 'Press point' },
      { value: 'center', label: 'Screen centre' },
    ],
    default: 'press',
    dependsOn: { key: 'nav.transition', is: DISC },
  },
  'nav.bottomBar': {
    key: 'nav.bottomBar',
    section: 'navigation',
    label: 'Tab bar on phones',
    control: 'toggle',
    default: true,
  },
  'nav.labels': {
    key: 'nav.labels',
    section: 'navigation',
    label: 'Tab labels',
    control: 'toggle',
    default: true,
    dependsOn: { key: 'nav.bottomBar', is: [true] },
  },
  'nav.swipe': {
    key: 'nav.swipe',
    section: 'navigation',
    label: 'Swipe between pages',
    control: 'toggle',
    default: false,
    dependsOn: { key: 'nav.bottomBar', is: [true] },
  },
  'nav.barStyle': {
    key: 'nav.barStyle',
    section: 'navigation',
    label: 'Tab bar style',
    control: 'segmented',
    options: [
      { value: 'floating', label: 'Floating' },
      { value: 'docked', label: 'Docked' },
    ],
    default: 'floating',
    dependsOn: { key: 'nav.bottomBar', is: [true] },
  },
  'nav.barMargin': {
    key: 'nav.barMargin',
    section: 'navigation',
    label: 'Side margin',
    control: 'range',
    min: 0,
    max: 32,
    step: 1,
    unit: 'px',
    default: 16,
    dependsOn: { key: 'nav.barStyle', is: ['floating'] },
  },
  'nav.barGap': {
    key: 'nav.barGap',
    section: 'navigation',
    label: 'Bottom gap',
    control: 'range',
    min: 0,
    max: 32,
    step: 1,
    unit: 'px',
    default: 12,
    dependsOn: { key: 'nav.barStyle', is: ['floating'] },
  },
  'nav.highlight': {
    key: 'nav.highlight',
    section: 'navigation',
    label: 'Current tab',
    control: 'segmented',
    options: [
      { value: 'pill', label: 'Pill' },
      { value: 'underline', label: 'Underline' },
    ],
    default: 'pill',
    dependsOn: { key: 'nav.barStyle', is: ['floating'] },
  },
  'nav.hideOnScroll': {
    key: 'nav.hideOnScroll',
    section: 'navigation',
    label: 'Hide while scrolling down',
    control: 'toggle',
    default: false,
    dependsOn: { key: 'nav.bottomBar', is: [true] },
  },
  'nav.tabs': {
    key: 'nav.tabs',
    section: 'navigation',
    label: 'Tabs',
    control: 'tabs',
    options: NAV_PAGES,
    count: 4,
    slotLabel: 'Tab',
    default: DEFAULT_TABS,
    dependsOn: { key: 'nav.bottomBar', is: [true] },
  },

  // Simulation & diagnostics
  'sim.enabled': {
    key: 'sim.enabled',
    section: 'diagnostics',
    label: 'Simulate a date and time',
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
    control: 'time',
    default: '',
    dependsOn: { key: 'sim.enabled', is: [true] },
  },
  'diag.fps': {
    key: 'diag.fps',
    section: 'diagnostics',
    label: 'FPS counter',
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
