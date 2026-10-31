import { useEffect, useState } from 'react'

/** Frames per second, averaged over one second (Settings → Simulation & diagnostics). */
export function FpsMeter() {
  const [fps, setFps] = useState<number | null>(null)
  useEffect(() => {
    let frames = 0
    let start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      frames++
      if (t - start >= 1000) {
        setFps(Math.round((frames * 1000) / (t - start)))
        frames = 0
        start = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <p className="fps label" aria-hidden="true">
      {fps === null ? 'FPS –' : `FPS ${fps}`}
    </p>
  )
}
