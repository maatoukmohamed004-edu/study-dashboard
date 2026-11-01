/**
 * Colour presets. Each has a dark and a light palette; "Color mode" picks one.
 * Choosing a preset also applies its bundle (background type, glass, radius…),
 * after which every setting can still be changed on its own.
 *
 * Every palette is checked for WCAG AA (ink, ink2 and accent on bg; accent text
 * on accent buttons; status colours) by the contrast check in src/lib/theme.ts.
 */
import type { Settings } from './settings-schema'

export type PresetId = 'mono-noir' | 'midnight' | 'graphite' | 'high-contrast' | 'light'

export interface Palette {
  bg: string
  /** Primary text */
  ink: string
  /** Secondary text (must also pass AA) */
  ink2: string
  accent: string
  ok: string
  warn: string
  alarm: string
  focus: string
  /** Background gradient colours */
  gradient: [string, string, string]
  /** Module markers: one hue per module, or all neutral */
  modules: 'hue' | 'mono'
}

export interface Preset {
  id: PresetId
  label: string
  dark: Palette
  light: Palette
}

const paper: Palette = {
  bg: '#f4f2ec',
  ink: '#141412',
  ink2: '#4f4e48',
  accent: '#141412',
  ok: '#17724d',
  warn: '#7f5200',
  alarm: '#b3261e',
  focus: '#1f5fd6',
  gradient: ['#dedbd2', '#cfccc2', '#f8f7f3'],
  modules: 'mono',
}

const noir: Palette = {
  bg: '#0a0a0a',
  ink: '#edede8',
  ink2: '#a7a7a1',
  accent: '#f2f0ea',
  ok: '#8fd6b0',
  warn: '#e8b04b',
  alarm: '#ff8080',
  focus: '#ffd166',
  gradient: ['#1e1e1e', '#3a3a3a', '#060606'],
  modules: 'mono',
}

export const presetList: Preset[] = [
  {
    id: 'mono-noir',
    label: 'Mono Noir',
    dark: noir,
    light: paper,
  },
  {
    id: 'midnight',
    label: 'Midnight',
    dark: {
      bg: '#070a1f',
      ink: '#f1f2ff',
      ink2: '#bcc1e6',
      accent: '#79e3c5',
      ok: '#79e3c5',
      warn: '#ffc46b',
      alarm: '#ff8595',
      focus: '#ffe38a',
      gradient: ['#141c63', '#3b2496', '#05071a'],
      modules: 'hue',
    },
    light: {
      bg: '#eef0ff',
      ink: '#10143a',
      ink2: '#454b78',
      accent: '#2c3aa8',
      ok: '#0f6b54',
      warn: '#7f4f00',
      alarm: '#ad213a',
      focus: '#6d28d9',
      gradient: ['#cdd1f8', '#dccdf6', '#f5f6ff'],
      modules: 'hue',
    },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    dark: {
      bg: '#17181b',
      ink: '#ececec',
      ink2: '#b0b3b9',
      accent: '#8ec5ff',
      ok: '#8fd6b0',
      warn: '#e8b04b',
      alarm: '#ff8a8a',
      focus: '#ffd166',
      gradient: ['#2a2c31', '#3a3d44', '#111215'],
      modules: 'mono',
    },
    light: {
      bg: '#e8e9ec',
      ink: '#1a1b1e',
      ink2: '#4b4e55',
      accent: '#1d55a0',
      ok: '#17704c',
      warn: '#7a4f00',
      alarm: '#ad2420',
      focus: '#6d28d9',
      gradient: ['#d5d7dc', '#c6c9d0', '#f1f2f4'],
      modules: 'mono',
    },
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    dark: {
      bg: '#000000',
      ink: '#ffffff',
      ink2: '#e8e8e8',
      accent: '#ffe500',
      ok: '#5cffb0',
      warn: '#ffcc00',
      alarm: '#ff7070',
      focus: '#00e5ff',
      gradient: ['#000000', '#111111', '#000000'],
      modules: 'mono',
    },
    light: {
      bg: '#ffffff',
      ink: '#000000',
      ink2: '#1c1c1c',
      accent: '#0033cc',
      ok: '#006b3c',
      warn: '#6b4300',
      alarm: '#a8001c',
      focus: '#c2185b',
      gradient: ['#ffffff', '#eeeeee', '#ffffff'],
      modules: 'mono',
    },
  },
  {
    id: 'light',
    label: 'Light',
    dark: noir,
    light: paper,
  },
]

export const presetById = Object.fromEntries(presetList.map((p) => [p.id, p])) as Record<PresetId, Preset>

/** Colour overrides are cleared so the preset's own colours show. */
const colors = {
  'appearance.accent': null,
  'appearance.background': null,
  'background.color1': null,
  'background.color2': null,
  'background.color3': null,
} as const

export const presetBundles: Record<PresetId, Partial<Settings>> = {
  'mono-noir': {
    ...colors,
    'appearance.colorMode': 'dark',
    'appearance.radius': 0,
    'appearance.roundness': 'square',
    'background.type': 'dither',
    'glass.mode': 'refraction',
    'glass.tint': 70,
    'hud.grid': true,
    'hud.orbStyle': 'dotted',
  },
  midnight: {
    ...colors,
    'appearance.colorMode': 'dark',
    'appearance.radius': 14,
    'appearance.roundness': 'custom',
    'background.type': 'animated',
    'glass.mode': 'refraction',
    'glass.tint': 60,
    'hud.grid': false,
    'hud.orbStyle': 'liquid',
  },
  graphite: {
    ...colors,
    'appearance.colorMode': 'dark',
    'appearance.radius': 6,
    'appearance.roundness': 'custom',
    'background.type': 'dots',
    'glass.mode': 'blur',
    'glass.tint': 70,
    'hud.grid': true,
    'hud.orbStyle': 'dotted',
  },
  'high-contrast': {
    ...colors,
    'appearance.colorMode': 'dark',
    'appearance.radius': 0,
    'appearance.roundness': 'square',
    'background.type': 'solid',
    'glass.mode': 'off',
    'hud.grid': false,
    'hud.orbStyle': 'dotted',
  },
  light: {
    ...colors,
    'appearance.colorMode': 'light',
    'appearance.radius': 0,
    'appearance.roundness': 'square',
    'background.type': 'dots',
    'glass.mode': 'blur',
    'glass.tint': 75,
    'hud.grid': true,
    'hud.orbStyle': 'dotted',
  },
}

/** Module marker hues for presets that use them (Midnight). */
export const moduleHues: Record<string, { dark: string; light: string }> = {
  proba: { dark: '#9db8ff', light: '#2f4fb0' },
  micro: { dark: '#f3a6c8', light: '#a12d63' },
  introEco: { dark: '#f7c887', light: '#8a5400' },
  demo: { dark: '#b9e39a', light: '#3d6b16' },
  statDes: { dark: '#8fddf0', light: '#0e6577' },
  algo: { dark: '#cdb2ff', light: '#5b34b8' },
  r: { dark: '#9ee6cf', light: '#16705a' },
  envInfo: { dark: '#c9cce6', light: '#4b4e6b' },
  anglais: { dark: '#c9cce6', light: '#4b4e6b' },
  techCom: { dark: '#c9cce6', light: '#4b4e6b' },
}
