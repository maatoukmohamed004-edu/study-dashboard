import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useSettings } from '../../lib/settings'
import { useResolved } from '../../lib/theme'
import { displacementMap } from './displacementMap'
import { loadLiquidGlass, type LiquidContainer } from './liquidGlass'

/**
 * Glass behind the header bar and main buttons. The engine comes from Settings → Glass:
 * - refraction ('svg'): backdrop-filter with an SVG displacement map, a lens at the rim. Chromium only.
 * - blur: CSS backdrop-filter (styled in hud.css).
 * - liquid: the vendored liquid-glass-js (experimental; samples the page once).
 * - off, or this target unchecked in "Apply to": renders nothing.
 */
interface Props {
  target: 'header' | 'buttons'
  /** Corner radius in px; defaults to the radius setting. */
  radius?: number
  /** Width of the refracting rim in px. */
  bezel?: number
  /** 0–1 share of the refraction strength setting. */
  strengthScale?: number
}

export function GlassLayer({ target, radius, bezel = 12, strengthScale = 1 }: Props) {
  const r = useResolved()
  const s = useSettings()
  if (!r.glassOn[target]) return null
  const rad = radius ?? s['appearance.radius']
  if (r.glass === 'liquid') return <LiquidLayer radius={rad} />
  if (r.glass === 'svg')
    return <SvgLayer radius={rad} bezel={bezel} strength={s['glass.refraction'] * strengthScale} blur={s['glass.blur'] / 2} saturation={s['glass.saturation']} />
  return <span className="lg-layer" aria-hidden="true" style={{ borderRadius: rad }} />
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      const h = Math.round(entry.contentRect.height)
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

function SvgLayer({ radius, bezel, strength, blur, saturation }: { radius: number; bezel: number; strength: number; blur: number; saturation: number }) {
  const [ref, size] = useSize<HTMLSpanElement>()
  const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const map = size && size.w > 0 && size.h > 0 ? displacementMap(size.w, size.h, radius, bezel) : ''
  const filter = map ? `url(#${id}) saturate(${saturation}%)` : undefined

  return (
    <span ref={ref} className="lg-layer" aria-hidden="true" style={{ borderRadius: radius, backdropFilter: filter, WebkitBackdropFilter: filter }}>
      {map && size && (
        <svg className="lg-defs" width="0" height="0" focusable="false">
          <filter id={id} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="soft" />
            <feDisplacementMap in="soft" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
    </span>
  )
}

/** Wraps a liquid-glass-js Container as a background layer. */
function LiquidLayer({ radius }: { radius: number }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = ref.current
    if (!host) return
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
  }, [radius])

  return <span ref={ref} className="lg-layer lg-liquid" aria-hidden="true" style={{ borderRadius: radius }} />
}
