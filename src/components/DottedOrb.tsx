import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, type Points, type ShaderMaterial } from 'three'
import { cappedDpr } from '../lib/env'

/**
 * A sphere of dots. The share of lit dots equals this week's blocks-done ratio;
 * dots light from the bottom up, so the level is readable at a glance.
 */
const COUNT = 520

const vertex = /* glsl */ `
  attribute float aRank;
  uniform float uLit;
  uniform float uSize;
  varying float vLit;
  varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFacing = n.z;
    vLit = step(aRank, uLit - 0.0001);
    gl_PointSize = uSize * (0.55 + 0.45 * smoothstep(-0.3, 1.0, n.z)) * (0.85 + 0.6 * vLit);
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  uniform vec3 uLitColor;
  uniform vec3 uDimColor;
  varying float vLit;
  varying float vFacing;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (max(abs(c.x), abs(c.y)) > 0.5) discard;
    float front = smoothstep(-0.35, 0.5, vFacing);
    vec3 col = mix(uDimColor, uLitColor, vLit);
    float a = mix(0.18, 1.0, front) * mix(0.55, 1.0, vLit);
    gl_FragColor = vec4(col, a);
  }
`

function buildGeometry() {
  const pos = new Float32Array(COUNT * 3)
  const rank = new Float32Array(COUNT)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const th = golden * i
    pos[i * 3] = Math.cos(th) * r
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = Math.sin(th) * r
    // Rank by height: the bottom dot lights first.
    rank[i] = 1 - i / (COUNT - 1)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('aRank', new BufferAttribute(rank, 1))
  return g
}

function Dots({ ratio, lit, dim, animate }: { ratio: number; lit: string; dim: string; animate: boolean }) {
  const ref = useRef<Points>(null)
  const mat = useRef<ShaderMaterial>(null)
  const { gl, invalidate } = useThree()
  const geometry = useMemo(buildGeometry, [])
  const uniforms = useMemo(
    () => ({ uLit: { value: animate ? 0 : ratio }, uSize: { value: 2.4 }, uLitColor: { value: new Color(lit) }, uDimColor: { value: new Color(dim) } }),
    // colours and ratio are updated below without rebuilding the material
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    uniforms.uLitColor.value.set(lit)
    uniforms.uDimColor.value.set(dim)
    invalidate()
  }, [lit, dim, uniforms, invalidate])

  useEffect(() => {
    invalidate()
  }, [ratio, invalidate])

  useFrame((_, delta) => {
    const m = mat.current
    if (!m) return
    m.uniforms.uSize.value = 2.3 * gl.getPixelRatio()
    if (animate) {
      m.uniforms.uLit.value += (ratio - m.uniforms.uLit.value) * Math.min(1, delta * 2.5)
      if (ref.current) ref.current.rotation.y += delta * 0.35
    } else {
      m.uniforms.uLit.value = ratio
    }
  })

  return (
    <points ref={ref} geometry={geometry} rotation={[0.35, 0, 0]}>
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  )
}

function Loop({ mode }: { mode: 'always' | 'demand' | 'never' }) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => setFrameloop(mode), [mode, setFrameloop])
  return null
}

export default function DottedOrb({ ratio, lit, dim, animate, paused }: { ratio: number; lit: string; dim: string; animate: boolean; paused: boolean }) {
  const mode = paused ? 'never' : animate ? 'always' : 'demand'
  return (
    <Canvas dpr={cappedDpr()} frameloop={mode} camera={{ fov: 30, position: [0, 0, 4.3] }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} style={{ width: '100%', height: '100%' }}>
      <Loop mode={mode} />
      <Dots ratio={Math.min(1, Math.max(0, ratio))} lit={lit} dim={dim} animate={animate} />
    </Canvas>
  )
}
