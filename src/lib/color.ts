/** Small colour helpers: hex parsing, WCAG contrast, mixing. sRGB only. */

export type RGB = [number, number, number]

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** "#abc", "abc", "#aabbcc" → "#aabbcc" (lowercase), or null if not a colour. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const m = input.trim().match(HEX)
  if (!m) return null
  let h = m[1].toLowerCase()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return `#${h}`
}

export function hexToRgb(hex: string): RGB {
  const h = normalizeHex(hex) ?? '#000000'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function luminance(hex: string): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG 2 contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** a·(1−t) + b·t */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`
}

export const isDark = (hex: string) => luminance(hex) < 0.18

/** Black or white, whichever reads better on this colour. */
export function inkOn(hex: string): string {
  return contrast(hex, '#000000') >= contrast(hex, '#ffffff') ? '#0a0a0a' : '#ffffff'
}

/**
 * Smallest move of `color` toward `toward` that reaches `need` against `against`.
 * Keeps the hue as far as possible. Returns null if even `toward` fails.
 */
export function nudge(color: string, toward: string, against: string, need: number): string | null {
  if (contrast(color, against) >= need) return color
  if (contrast(toward, against) < need) return null
  let lo = 0
  let hi = 1
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (contrast(mix(color, toward, mid), against) >= need) hi = mid
    else lo = mid
  }
  return mix(color, toward, hi)
}
