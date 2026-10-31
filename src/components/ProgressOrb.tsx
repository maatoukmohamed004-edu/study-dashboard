import { lazy, Suspense, type CSSProperties } from 'react'
import { caps, useMediaState } from '../lib/capabilities'
import { useSettings } from '../lib/settings'
import { useResolved } from '../lib/theme'
import { SafeBoundary } from './SafeBoundary'

const DottedOrb = lazy(() => import('./DottedOrb'))
const OrbScene = lazy(() => import('./OrbScene'))

/** CSS ring: shown while the 3D orb loads, and in its place if WebGL is unavailable. */
export function OrbFallback({ ratio }: { ratio: number }) {
  return <span className="orb-fallback" style={{ '--p': ratio } as CSSProperties} />
}

export function ProgressOrb({ ratio }: { ratio: number }) {
  const s = useSettings()
  const r = useResolved()
  const media = useMediaState()
  if (!s['hud.orb']) return null
  const fallback = <OrbFallback ratio={ratio} />
  const animate = !r.reducedMotion
  const paused = s['background.pauseHidden'] && !media.visible
  const p = r.palette

  return (
    <span className="orb" aria-hidden="true">
      {caps.webgl ? (
        <SafeBoundary label="The progress orb" fallback={fallback}>
          <Suspense fallback={fallback}>
            {s['hud.orbStyle'] === 'dotted' ? (
              <DottedOrb ratio={ratio} lit={p.accent} dim={p.ink2} animate={animate} paused={paused} />
            ) : (
              <OrbScene ratio={ratio} liquid={p.accent} glass={p.raised} rim={p.ink2} animate={animate} paused={paused} />
            )}
          </Suspense>
        </SafeBoundary>
      ) : (
        fallback
      )}
    </span>
  )
}
