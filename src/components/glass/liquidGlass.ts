/**
 * Loader for the vendored liquid-glass-js (plain global scripts, not ES modules).
 * The files are imported as text on demand and run in a <script> element, unchanged.
 */

export interface LiquidContainer {
  element: HTMLDivElement
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext | null
  updateSizeFromDOM(): void
  render?: () => void
}

export interface LiquidGlassLib {
  Container: {
    new (options: { borderRadius?: number; type?: 'rounded' | 'circle' | 'pill'; tintOpacity?: number }): LiquidContainer
    instances: LiquidContainer[]
    pageSnapshot: HTMLCanvasElement | null
  }
}

declare global {
  interface Window {
    html2canvas?: unknown
    __liquidGlass?: LiquidGlassLib
  }
}

let loading: Promise<LiquidGlassLib> | null = null

export function loadLiquidGlass(): Promise<LiquidGlassLib> {
  loading ??= Promise.all([
    import('html2canvas'),
    import('../../vendor/liquid-glass-js/container.js?raw'),
    import('../../vendor/liquid-glass-js/button.js?raw'),
  ]).then(([{ default: html2canvas }, container, button]) => {
    window.html2canvas = html2canvas
    if (!window.__liquidGlass) {
      const script = document.createElement('script')
      script.textContent = `${container.default}\n${button.default}\nwindow.__liquidGlass = { Container, Button };`
      document.head.appendChild(script)
    }
    if (!window.__liquidGlass) throw new Error('liquid-glass-js failed to load')
    return window.__liquidGlass
  })
  return loading
}
