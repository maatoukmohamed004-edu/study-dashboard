import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Color, type ShaderMaterial } from 'three'
import { cappedDpr } from '../lib/env'
import { useSettings } from '../lib/settings'
import { useResolved } from '../lib/theme'

/**
 * A shaded sphere drawn as ordered-dither dots (4×4 Bayer) with a lens that follows the
 * cursor and shows the smooth, slightly magnified shading underneath.
 */
const vertex = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragment = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uLens;
  uniform float uLensOn;
  uniform float uCell;
  uniform vec3 uInk;

  float shade(vec2 frag) {
    vec2 c = uRes * 0.5;
    float R = min(uRes.x, uRes.y) * 0.44;
    vec2 d = (frag - c) / R;
    float r2 = dot(d, d);
    if (r2 > 1.0) return 0.0;
    float z = sqrt(1.0 - r2);
    vec3 n = vec3(d, z);
    float t = uTime;
    float w = 0.2 * sin(5.5 * n.x + 1.6 * t) * cos(4.5 * n.y - 1.1 * t) + 0.12 * sin(8.0 * (n.x + n.y) + 1.3 * t);
    n = normalize(n + vec3(w * 0.7, w * 0.45, 0.0));
    vec3 L = normalize(vec3(-0.55 + 0.25 * sin(t * 0.25), 0.62, 0.68));
    float diff = max(dot(n, L), 0.0);
    float rim = pow(1.0 - z, 3.0) * 0.4;
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 22.0) * 0.55;
    return clamp(diff * 0.92 + rim + spec, 0.0, 1.0) * (1.0 - smoothstep(0.97, 1.0, sqrt(r2)));
  }

  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 idx = floor(frag / uCell);
    float s = shade((idx + 0.5) * uCell);
    float threshold = bayer4(idx) + 1.0 / 32.0;
    float on = step(threshold, pow(s, 1.7) * 0.94);
    vec2 f = fract(frag / uCell);
    float sq = step(0.16, f.x) * step(f.x, 0.84) * step(0.16, f.y) * step(f.y, 0.84);
    float a = on * sq;

    vec2 toM = frag - uMouse;
    float dist = length(toM);
    float inside = (1.0 - smoothstep(uLens - 1.5, uLens, dist)) * uLensOn;
    if (inside > 0.001) {
      float smoothShade = shade(uMouse + toM * 0.72);
      a = mix(a, pow(smoothShade, 1.2) * 0.88, inside);
      float ring = smoothstep(uLens - 3.5, uLens - 2.0, dist) * (1.0 - smoothstep(uLens - 1.0, uLens, dist));
      a = max(a, ring * 0.85 * uLensOn);
    }
    gl_FragColor = vec4(uInk, a);
  }
`

function Sphere({ ink, speed, still }: { ink: string; speed: number; still: boolean }) {
  const mat = useRef<ShaderMaterial>(null)
  const { size, gl, invalidate } = useThree()
  const mouse = useRef({ x: -9999, y: -9999, on: 0, target: 0 })
  const uniforms = useMemo(
    () => ({
      uRes: { value: [1, 1] },
      uTime: { value: 2.0 },
      uMouse: { value: [-9999, -9999] },
      uLens: { value: 60 },
      uLensOn: { value: 0 },
      uCell: { value: 5 },
      uInk: { value: new Color(ink) },
    }),
    // ink changes are applied below without rebuilding the material
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    uniforms.uInk.value.set(ink)
    invalidate()
  }, [ink, uniforms, invalidate])

  // Track the cursor relative to the canvas, in device pixels with y up.
  useEffect(() => {
    const canvas = gl.domElement
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const dpr = gl.getPixelRatio()
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      mouse.current.x = (e.clientX - r.left) * dpr
      mouse.current.y = (r.bottom - e.clientY) * dpr
      mouse.current.target = inside && e.pointerType !== 'touch' ? 1 : 0
      invalidate()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [gl, invalidate])

  useFrame((_, delta) => {
    const m = mat.current
    if (!m) return
    const dpr = gl.getPixelRatio()
    const u = m.uniforms
    u.uRes.value = [size.width * dpr, size.height * dpr]
    u.uCell.value = Math.max(3, Math.round(5 * dpr))
    u.uLens.value = 64 * dpr
    if (!still) u.uTime.value += delta * 0.6 * speed
    // The lens eases in and out; with reduced motion it simply appears.
    const k = still ? 1 : Math.min(1, delta * 10)
    mouse.current.on += (mouse.current.target - mouse.current.on) * k
    u.uLensOn.value = mouse.current.on
    u.uMouse.value = [mouse.current.x, mouse.current.y]
    if (still && Math.abs(mouse.current.target - mouse.current.on) > 0.01) invalidate()
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthTest={false} />
    </mesh>
  )
}

function Loop({ mode }: { mode: 'always' | 'demand' | 'never' }) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => setFrameloop(mode), [mode, setFrameloop])
  return null
}

function Quality({ quality }: { quality: 'auto' | 'low' | 'high' }) {
  const setDpr = useThree((s) => s.setDpr)
  const high = cappedDpr()
  useEffect(() => setDpr(quality === 'low' ? Math.min(high, 0.75) : high), [quality, high, setDpr])
  if (quality !== 'auto') return null
  return <PerformanceMonitor flipflops={3} onDecline={() => setDpr(Math.min(high, 0.75))} onIncline={() => setDpr(high)} onFallback={() => setDpr(Math.min(high, 0.75))} />
}

export default function DitherSphere() {
  const r = useResolved()
  const s = useSettings()
  const mode = r.bgPaused ? 'never' : r.bgStill ? 'demand' : 'always'
  return (
    <div className="dither">
      <Canvas dpr={cappedDpr()} frameloop={mode} gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }} style={{ width: '100%', height: '100%' }}>
        <Loop mode={mode} />
        <Quality quality={s['background.quality']} />
        <Sphere ink={r.palette.ink} speed={s['background.speed']} still={r.bgStill} />
      </Canvas>
    </div>
  )
}
