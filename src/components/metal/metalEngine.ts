/**
 * The liquid-metal shader runtime. Lazy chunk: loaded only when a metal surface is on screen and
 * WebGL 2 is allowed. Imports nothing from @paper-design/shaders but ShaderMount and the
 * liquid-metal fragment shader (the package is side-effect free, so the rest is tree-shaken).
 *
 * Budget: at most MAX_LIVE canvases (1 on phones, 2 elsewhere). Surfaces register with a priority
 * (selected tab > floating buttons > primary buttons); the visible ones with the highest priority
 * get a canvas, the others keep the CSS rim that is always painted underneath.
 *
 * Frames: the library's own loop is never started (speed 0). One shared ticker draws each live
 * canvas at most FPS times a second with setFrame(), and stops entirely while nothing animates:
 * off-screen, tab hidden, during page transitions, Static or reduced motion. A failed or lost
 * WebGL context drops that surface back to the CSS rim for good.
 */
import { liquidMetalFragmentShader, ShaderMount } from '@paper-design/shaders'
import type { MetalTint } from '../../data/settings-schema'

export interface MetalParams {
  tint: MetalTint
  /** The palette accent, for the Accent tint. */
  accent: string
  speed: number
  hover: number
  /** One still frame, no animation loop. */
  still: boolean
}

export interface MetalHandle {
  update: (p: MetalParams) => void
  dispose: () => void
}

interface Entry {
  el: HTMLElement
  rim: HTMLElement
  host: HTMLElement
  priority: number
  order: number
  visible: boolean
  failed: boolean
  params: MetalParams
  mount: ShaderMount | null
  /** Shader time (ms) and when it was last drawn. */
  frame: number
  lastDraw: number
  hovered: boolean
  boostUntil: number
  boostTimer: number
  ro: ResizeObserver | null
  off: () => void
}

const DPR_CAP = 1.5
const MAX_PIXELS = 360_000
/** A pleasant still frame for Static and reduced motion (shader time in ms). */
const STILL_FRAME = 4200
const BOOST_MS = 320
/** A slow sheen needs no more; halves the GPU work of a 60 Hz loop (battery). */
const FPS = 30
const FRAME_MS = 1000 / FPS

const entries = new Set<Entry>()
let order = 0
// Page transitions (lib/transition.ts) flag <html data-navigating> and fire 'navigating'.
const navigating = () => document.documentElement.hasAttribute('data-navigating')
let paused = navigating()
const maxLive = () => (matchMedia('(max-width: 640px)').matches ? 1 : 2)

window.addEventListener('navigating', () => {
  paused = navigating()
  for (const e of entries) applySpeed(e)
})
document.addEventListener('visibilitychange', () => wake())
// Crossing the phone breakpoint changes the budget.
matchMedia('(max-width: 640px)').addEventListener('change', () => schedule())

const io = new IntersectionObserver(
  (list) => {
    for (const it of list) {
      const e = [...entries].find((x) => x.el === it.target)
      if (e) e.visible = it.isIntersecting
    }
    schedule()
    wake()
  },
  // A little margin so a surface scrolled just out of view keeps its canvas (no thrashing).
  { rootMargin: '120px' },
)

let pending = 0
function schedule() {
  if (pending) return
  pending = requestAnimationFrame(() => {
    pending = 0
    allocate()
  })
}

/** Gives canvases to the most important visible surfaces, within the budget. */
function allocate() {
  const cap = maxLive()
  const rank = (a: Entry, b: Entry) => b.priority - a.priority || a.order - b.order
  const want = [...entries].filter((e) => e.visible && !e.failed).sort(rank).slice(0, cap)
  const mounted = [...entries].filter((e) => e.mount)
  // Free slots: drop canvases that aren't wanted, least important first.
  for (const e of mounted.filter((m) => !want.includes(m)).sort(rank).reverse()) {
    if (mounted.filter((m) => m.mount).length + want.filter((w) => !w.mount).length <= cap) break
    stop(e)
  }
  for (const e of want) {
    if (e.mount) continue
    if ([...entries].filter((m) => m.mount).length >= cap) break
    start(e)
  }
}

const TINTS = { warm: '#ffb06a', cool: '#7cc4ff' } as const

/** RGBA 0–1; alpha = how strongly the tint colours the chrome (0 = plain silver). */
function tintRgba(p: MetalParams): number[] {
  if (p.tint === 'silver') return [1, 1, 1, 0]
  const hex = (p.tint === 'accent' ? p.accent : TINTS[p.tint]).replace('#', '')
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(0.55)
}

function uniforms(p: MetalParams) {
  return {
    u_colorBack: [0, 0, 0, 0],
    u_colorTint: tintRgba(p),
    u_repetition: 3.2,
    u_softness: 0.4,
    u_shiftRed: 0.22,
    u_shiftBlue: 0.28,
    u_distortion: 0.1,
    u_contour: 0.2,
    u_angle: 70,
    // A circle zoomed far past the surface: the whole canvas is inside the metal.
    u_shape: 1,
    u_isImage: false,
    u_fit: 1,
    u_scale: 6,
    u_rotation: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_offsetX: 0.08,
    u_offsetY: -0.06,
    u_worldWidth: 0,
    u_worldHeight: 0,
  }
}

function speedOf(e: Entry): number {
  if (paused || e.params.still) return 0
  if (performance.now() < e.boostUntil) return Math.max(2.4, e.params.hover * 2.4)
  return e.hovered ? e.params.hover : e.params.speed
}

/** The speed in force, also exposed as data-speed for tests and diagnostics. */
function applySpeed(e: Entry) {
  e.el.dataset.speed = e.mount ? String(speedOf(e)) : '0'
  wake()
}

// ─── The shared ticker ───
let raf = 0
function wake() {
  if (!raf) raf = requestAnimationFrame(tick)
}

function tick(now: number) {
  raf = 0
  if (document.hidden) return
  let animating = false
  for (const e of entries) {
    const speed = speedOf(e)
    if (!e.mount || !e.visible || speed === 0) continue
    animating = true
    if (now - e.lastDraw < FRAME_MS - 2) continue
    // After a pause, continue from where it stopped instead of jumping ahead.
    const dt = now - e.lastDraw > 4 * FRAME_MS ? FRAME_MS : now - e.lastDraw
    e.frame += dt * speed
    e.lastDraw = now
    e.mount.setFrame(e.frame)
  }
  if (animating) raf = requestAnimationFrame(tick)
}

/** Pixel budget: DPR capped at 1.5 for this surface's size, and never above MAX_PIXELS. */
function pixelsFor(e: Entry) {
  const w = Math.max(1, e.rim.offsetWidth)
  const h = Math.max(1, e.rim.offsetHeight)
  return Math.min(MAX_PIXELS, Math.round(w * h * DPR_CAP * DPR_CAP))
}

function start(e: Entry) {
  try {
    const mount = new ShaderMount(
      e.rim,
      liquidMetalFragmentShader,
      uniforms(e.params),
      { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', premultipliedAlpha: true },
      0, // the library's own loop stays off; the shared ticker draws frames
      e.frame,
      1, // render at the device ratio (capped below), not the library's 2× default
      pixelsFor(e),
    )
    mount.canvasElement.setAttribute('aria-hidden', 'true')
    mount.canvasElement.addEventListener('webglcontextlost', () => {
      e.failed = true
      stop(e)
      schedule()
    })
    e.mount = mount
    e.ro = new ResizeObserver(() => e.mount?.setMaxPixelCount(pixelsFor(e)))
    e.ro.observe(e.rim)
    e.el.dataset.state = e.params.still ? 'still' : 'live'
    applySpeed(e)
  } catch (err) {
    // No WebGL 2, a shader compile error or too many contexts: keep the CSS rim.
    console.warn('Liquid metal falls back to the CSS rim:', err)
    e.failed = true
    e.el.dataset.state = 'css'
    e.rim.querySelector('canvas')?.remove()
  }
}

function stop(e: Entry) {
  e.ro?.disconnect()
  e.ro = null
  if (e.mount) {
    const gl = e.mount.canvasElement.getContext('webgl2')
    e.mount.dispose()
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
  e.mount = null
  e.el.dataset.state = 'css'
}

const PRIORITY = { tab: 3, floating: 2, primary: 1 } as const

/** Registers a surface; it gets a canvas when the budget allows. */
export function attach(el: HTMLElement, rim: HTMLElement, kind: keyof typeof PRIORITY, params: MetalParams): MetalHandle {
  // Pointer, focus and press come from the control the surface decorates (or the sliding tab pill).
  const host = (el.closest('button, a, .tab-pill') as HTMLElement | null) ?? el.parentElement ?? el
  const e: Entry = {
    el,
    rim,
    host,
    priority: PRIORITY[kind],
    order: order++,
    visible: false,
    failed: false,
    params,
    mount: null,
    frame: STILL_FRAME,
    lastDraw: 0,
    hovered: false,
    boostUntil: 0,
    boostTimer: 0,
    ro: null,
    off: () => {},
  }
  const hover = (on: boolean) => () => {
    e.hovered = on
    applySpeed(e)
  }
  // A press (or the pill starting to slide) speeds the metal up briefly. The reset reads the
  // entry's state when it fires, so it never restores a stale hover value.
  const boost = () => {
    e.boostUntil = performance.now() + BOOST_MS
    applySpeed(e)
    window.clearTimeout(e.boostTimer)
    e.boostTimer = window.setTimeout(() => applySpeed(e), BOOST_MS + 16)
  }
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter' || ev.key === ' ') boost()
  }
  const listeners: [string, EventListener][] = [
    ['pointerenter', hover(true)],
    ['pointerleave', hover(false)],
    ['pointercancel', hover(false)],
    ['focusin', hover(true)],
    ['focusout', hover(false)],
    ['pointerdown', boost],
    ['keydown', onKey as EventListener],
  ]
  // The tab pill speeds up while it slides to the new tab.
  if (host.classList.contains('tab-pill')) listeners.push(['transitionrun', boost])
  for (const [type, fn] of listeners) host.addEventListener(type, fn)
  e.off = () => {
    for (const [type, fn] of listeners) host.removeEventListener(type, fn)
  }
  entries.add(e)
  io.observe(el)
  return {
    update(p) {
      const tintChanged = p.tint !== e.params.tint || p.accent !== e.params.accent
      e.params = p
      if (e.mount) {
        if (tintChanged) e.mount.setUniforms({ u_colorTint: tintRgba(p) })
        e.el.dataset.state = p.still ? 'still' : 'live'
        applySpeed(e)
      }
    },
    dispose() {
      window.clearTimeout(e.boostTimer)
      io.unobserve(el)
      e.off()
      stop(e)
      entries.delete(e)
      schedule()
    },
  }
}

/** For tests and diagnostics: how many canvases are live right now. */
export const liveCount = () => [...entries].filter((e) => e.mount).length
