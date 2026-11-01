import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useSettings } from '../../lib/settings'
import { useResolved } from '../../lib/theme'
import { displacementMap, type Corners } from './displacementMap'
import { loadLiquidGlass, type LiquidContainer } from './liquidGlass'

/**
 * Glass behind the header bar, the phone tab bar and the main buttons. The engine comes from
 * Settings → Glass:
 * - refraction ('svg'): backdrop-filter with an SVG displacement map, a lens at the rim. Chromium only.
 * - blur: CSS backdrop-filter (styled in hud.css).
 * - liquid: the vendored liquid-glass-js (experimental; samples the page once).
 * - off, or this target unchecked in "Apply to": renders nothing.
 *
 * The layer inherits its host's border-radius (`border-radius: inherit` in hud.css) and reads the
 * computed corners back, so the refraction map always matches the real shape: on resize, on
 * orientation change and whenever a roundness setting changes.
 */
interface Props {
  target: 'header' | 'buttons'
  /** Width of the refracting rim in px. */
  bezel?: number
  /** 0–1 share of the refraction strength setting. */
  strengthScale?: number
}

export function GlassLayer({ target, bezel = 12, strengthScale = 1 }: Props) {
  const r = useResolved()
  const s = useSettings()
  if (!r.glassOn[target]) return null
  if (r.glass === 'liquid') return <LiquidLayer />
  if (r.glass === 'svg') return <SvgLayer bezel={bezel} strength={s['glass.refraction'] * strengthScale} blur={s['glass.blur'] / 2} saturation={s['glass.saturation']} />
  return <span className="lg-layer" aria-hidden="true" />
}

interface Box {
  w: number
  h: number
  radii: Corners
}

function cornerPx(v: string, w: number, h: number): number {
  const n = parseFloat(v) || 0
  return v.trim().endsWith('%') ? (n / 100) * Math.min(w, h) : n
}

function readBox(el: HTMLElement): Box {
  // Layout size, not getBoundingClientRect: a transform (sliding sheet, hiding bar) must not change the map.
  const w = el.offsetWidth
  const h = el.offsetHeight
  const cs = getComputedStyle(el)
  const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) =>
    Math.round(Math.min(cornerPx(v, w, h), w / 2, h / 2)),
  ) as Corners
  return { w, h, radii }
}

const same = (a: Box | null, b: Box) => !!a && a.w === b.w && a.h === b.h && a.radii.every((v, i) => v === b.radii[i])

/** Size and computed corners of the layer, kept current on resize and after every render. */
function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [box, setBox] = useState<Box | null>(null)
  const measure = useRef(() => {
    const el = ref.current
    if (!el) return
    const next = readBox(el)
    setBox((prev) => (same(prev, next) ? prev : next))
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => measure.current())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Settings re-render the layer; the theme has already written the new radius variables by then.
  useLayoutEffect(() => measure.current())
  return [ref, box] as const
}

function SvgLayer({ bezel, strength, blur, saturation }: { bezel: number; strength: number; blur: number; saturation: number }) {
  const [ref, box] = useBox<HTMLSpanElement>()
  const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const map = box && box.w > 0 && box.h > 0 ? displacementMap(box.w, box.h, box.radii, bezel) : ''
  const filter = map ? `url(#${id}) saturate(${saturation}%)` : undefined

  return (
    <span ref={ref} className="lg-layer" aria-hidden="true" style={{ backdropFilter: filter, WebkitBackdropFilter: filter }}>
      {map && box && (
        <svg className="lg-defs" width="0" height="0" focusable="false">
          <filter id={id} x="0" y="0" width={box.w} height={box.h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x="0" y="0" width={box.w} height={box.h} preserveAspectRatio="none" result="map" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="soft" />
            <feDisplacementMap in="soft" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
    </span>
  )
}

/** Wraps a liquid-glass-js Container as a background layer. */
function LiquidLayer() {
  const [ref, box] = useBox<HTMLSpanElement>()
  const radius = box ? box.radii[0] : null

  useEffect(() => {
    const host = ref.current
    if (!host || radius === null) return
    let instance: LiquidContainer | null = null
    let ro: ResizeObserver | null = null
    let cancelled = false
    // Give the background time to draw before the library takes its one page snapshot.
    const timer = window.setTimeout(() => {
      loadLiquidGlass()
        .then(({ Container }) => {
          if (cancelled) return
          instance = new Container({ borderRadius: Math.max(radius, 1), type: 'rounded', tintOpacity: 0.2 })
          Object.assign(instance.element.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', padding: '0' })
          host.appendChild(instance.element)
          instance.updateSizeFromDOM()
          ro = new ResizeObserver(() => instance?.updateSizeFromDOM())
          ro.observe(host)
        })
        .catch((e: unknown) => console.warn('liquid-glass-js could not start:', e))
    }, 1200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      ro?.disconnect()
      if (instance) {
        instance.element.remove()
        instance.gl?.getExtension('WEBGL_lose_context')?.loseContext()
        const list = window.__liquidGlass?.Container.instances
        const i = list ? list.indexOf(instance) : -1
        if (list && i > -1) list.splice(i, 1)
      }
    }
  }, [radius, ref])

  return <span ref={ref} className="lg-layer lg-liquid" aria-hidden="true" />
}
