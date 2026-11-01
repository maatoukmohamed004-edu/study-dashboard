import { useEffect, useLayoutEffect, useRef } from 'react'
import type { MetalTarget } from '../../data/settings-schema'
import { useSettings } from '../../lib/settings'
import { useResolved } from '../../lib/theme'
import type { MetalHandle, MetalParams } from './metalEngine'

/**
 * <LiquidMetalSurface>: a thin chrome rim and sheen around an opaque dark fill, drawn behind
 * the content of the control it sits in (a real <button>, or the tab bar's current-tab pill).
 * Settings → Appearance → Liquid metal decides where it appears.
 *
 * - The CSS rim (a metallic conic gradient) is always painted, so the control is never empty.
 * - When WebGL 2 is allowed, the shader runtime loads in its own chunk and, budget permitting,
 *   draws the animated rim on top. Static and reduced motion show one still shader frame.
 * - Decorative only: aria-hidden, no pointer events; the host keeps its own focus ring.
 * - The host needs `position: relative; isolation: isolate` and sets --lm-r to its corner radius
 *   (metal.css), so the fill's corners are the host's minus the rim width.
 */
export function LiquidMetalSurface({ target, when = true }: { target: MetalTarget; when?: boolean }) {
  const r = useResolved()
  const s = useSettings()
  const on = when && r.metal.on[target]
  const live = on && r.metal.live
  const el = useRef<HTMLSpanElement>(null)
  const rim = useRef<HTMLSpanElement>(null)
  const handle = useRef<MetalHandle | null>(null)

  const tint = s['metal.tint']
  const params: MetalParams = {
    tint,
    accent: r.palette.accent,
    speed: s['metal.speed'],
    hover: s['metal.hoverSpeed'],
    still: r.metal.still,
  }
  const paramsRef = useRef(params)
  useLayoutEffect(() => {
    paramsRef.current = params
  })

  // Register with the shader runtime once per mount; settings changes go through update().
  useEffect(() => {
    if (!live || !el.current || !rim.current) return
    let dead = false
    const host = el.current
    import('./metalEngine')
      .then(({ attach }) => {
        if (!dead && rim.current) handle.current = attach(host, rim.current, target, paramsRef.current)
      })
      .catch((e: unknown) => {
        console.warn('Liquid metal: the shader chunk failed to load; keeping the CSS rim.', e)
        host.dataset.state = 'css'
      })
    return () => {
      dead = true
      handle.current?.dispose()
      handle.current = null
    }
  }, [live, target])

  const key = `${tint}|${params.accent}|${params.speed}|${params.hover}|${params.still}`
  useEffect(() => {
    handle.current?.update(paramsRef.current)
  }, [key])

  if (!on) return null
  return (
    <span ref={el} className="lm" data-tint={tint} data-state="css" aria-hidden="true">
      <span ref={rim} className="lm-rim" />
      <span className="lm-fill" />
    </span>
  )
}
