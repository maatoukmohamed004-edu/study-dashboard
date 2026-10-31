import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'
import type { Quality } from '../data/settings-schema'

/** Stops the render loop entirely while paused (tab hidden). */
function PauseLoop({ paused }: { paused: boolean }) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    setFrameloop(paused ? 'never' : 'always')
  }, [paused, setFrameloop])
  return null
}

/**
 * Resolution: a soft gradient gains nothing from extra pixels, so "auto" and "high"
 * start at 1× (always under the 1.5 cap) and "low" uses 0.6×. On "auto", drei's
 * PerformanceMonitor drops to 0.6× when the frame rate falls.
 */
function Resolution({ quality }: { quality: Quality }) {
  const setDpr = useThree((s) => s.setDpr)
  const base = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.5 : 1)
  useEffect(() => setDpr(quality === 'low' ? base * 0.6 : base), [quality, base, setDpr])
  if (quality !== 'auto') return null
  return <PerformanceMonitor flipflops={3} onDecline={() => setDpr(base * 0.6)} onIncline={() => setDpr(base)} onFallback={() => setDpr(base * 0.6)} />
}

export default function GradientScene({
  preserveDrawingBuffer = false,
  colors,
  speed,
  quality,
  paused,
}: {
  preserveDrawingBuffer?: boolean
  colors: [string, string, string]
  speed: number
  quality: Quality
  paused: boolean
}) {
  return (
    <div className="bg-canvas">
      <ShaderGradientCanvas
        pixelDensity={Math.min(window.devicePixelRatio || 1, 1)}
        lazyLoad={false}
        pointerEvents="none"
        powerPreference="low-power"
        preserveDrawingBuffer={preserveDrawingBuffer}
        style={{ position: 'absolute', inset: 0 }}
      >
        <PauseLoop paused={paused} />
        <Resolution quality={quality} />
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate={paused ? 'off' : 'on'}
          uSpeed={0.07 * speed}
          uStrength={1.6}
          uDensity={1.1}
          uFrequency={3}
          uAmplitude={0}
          color1={colors[0]}
          color2={colors[1]}
          color3={colors[2]}
          lightType="3d"
          brightness={0.8}
          grain="off"
          cAzimuthAngle={180}
          cPolarAngle={90}
          cDistance={3.4}
          cameraZoom={1}
          positionX={-0.6}
          positionY={0.2}
          positionZ={0}
          rotationX={0}
          rotationY={10}
          rotationZ={40}
          reflection={0.05}
        />
      </ShaderGradientCanvas>
    </div>
  )
}
