import { lazy, Suspense } from 'react'
import { useSettings } from '../lib/settings'
import { useResolved } from '../lib/theme'
import { SafeBoundary } from './SafeBoundary'

const GradientScene = lazy(() => import('./GradientScene'))

/**
 * Solid, static gradient and dot grid are pure CSS (see [data-bg] in hud.css).
 * The animated gradient loads ShaderGradient on top of the static one.
 * The dithered sphere lives in each page's hero (see ui/Hud.tsx).
 */
export function Background() {
  const r = useResolved()
  const s = useSettings()
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-base" />
      {r.bg === 'animated' && r.bg3d && (
        <SafeBoundary label="The animated background" fallback={null}>
          <Suspense fallback={null}>
            <GradientScene
              // liquid-glass-js reads the canvas with html2canvas, which needs the drawing buffer kept.
              key={r.glass === 'liquid' ? 'keep-buffer' : 'normal'}
              preserveDrawingBuffer={r.glass === 'liquid'}
              colors={r.palette.gradient}
              speed={s['background.speed']}
              quality={s['background.quality']}
              paused={r.bgPaused}
            />
          </Suspense>
        </SafeBoundary>
      )}
      {s['background.grain'] > 0 && <div className="bg-grain" />}
    </div>
  )
}
