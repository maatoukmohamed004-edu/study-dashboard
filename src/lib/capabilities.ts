/** What this browser and device can do. Read once; media queries are live. */
import { useSyncExternalStore } from 'react'

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

interface UADataLike {
  brands?: { brand: string }[]
}

function detectChromium(): boolean {
  const data = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData
  if (data?.brands?.some((b) => b.brand === 'Chromium')) return true
  // Chrome, Edge, Opera, Brave and Arc all report "Chrome/"; Firefox and Safari don't.
  return /Chrome\/\d+/.test(navigator.userAgent)
}

function detectBackdrop(): boolean {
  try {
    return CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
  } catch {
    return false
  }
}

export const caps = {
  webgl: detectWebGL(),
  /** SVG filters in backdrop-filter (the refraction) only work in Chromium. */
  chromium: detectChromium(),
  /** backdrop-filter at all (glass needs it; without it surfaces fall back to a solid tint). */
  backdrop: detectBackdrop(),
}

// ─── Live media state ───────────────────────────────────────────────────────

export interface Media {
  phone: boolean
  osReducedMotion: boolean
  osDark: boolean
  /** prefers-reduced-transparency: glass bars become solid. */
  osReducedTransparency: boolean
  visible: boolean
}

const queries = {
  phone: '(max-width: 640px)',
  osReducedMotion: '(prefers-reduced-motion: reduce)',
  osDark: '(prefers-color-scheme: dark)',
  osReducedTransparency: '(prefers-reduced-transparency: reduce)',
}

function read(): Media {
  return {
    phone: matchMedia(queries.phone).matches,
    osReducedMotion: matchMedia(queries.osReducedMotion).matches,
    osDark: matchMedia(queries.osDark).matches,
    osReducedTransparency: matchMedia(queries.osReducedTransparency).matches,
    visible: document.visibilityState === 'visible',
  }
}

let media = read()
const listeners = new Set<() => void>()

function refresh() {
  const next = read()
  if (
    next.phone !== media.phone ||
    next.osReducedMotion !== media.osReducedMotion ||
    next.osDark !== media.osDark ||
    next.osReducedTransparency !== media.osReducedTransparency ||
    next.visible !== media.visible
  ) {
    media = next
    for (const l of listeners) l()
  }
}

for (const q of Object.values(queries)) matchMedia(q).addEventListener('change', refresh)
document.addEventListener('visibilitychange', refresh)

export function getMedia(): Media {
  return media
}

export function subscribeMedia(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useMediaState(): Media {
  return useSyncExternalStore(subscribeMedia, getMedia)
}
