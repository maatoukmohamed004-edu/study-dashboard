import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, type ShaderMaterial } from 'three'
import { cappedDpr } from '../lib/env'

/** The original liquid-filled glass orb ("Orb style: Liquid"). */
const vertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  uniform float uFill;
  uniform float uTime;
  uniform float uWave;
  uniform vec3 uLiquid;
  uniform vec3 uGlass;
  uniform vec3 uRim;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.4);
    float spec = pow(max(dot(vNormal, normalize(vec3(-0.45, 0.65, 0.62))), 0.0), 36.0);
    float level = mix(-1.02, 1.02, uFill);
    float wave = (0.05 * sin(vPos.x * 5.0 + uTime * 1.5) + 0.03 * sin(vPos.z * 7.0 - uTime * 1.1)) * uWave;
    wave *= smoothstep(0.0, 0.08, uFill) * smoothstep(1.0, 0.92, uFill);
    float surface = level + wave;
    vec3 color;
    float alpha;
    if (vPos.y < surface) {
      float t = clamp((vPos.y + 1.0) / 2.0, 0.0, 1.0);
      color = mix(uLiquid * 0.55, uLiquid, t);
      color += smoothstep(0.07, 0.0, abs(vPos.y - surface)) * 0.3 + fres * 0.2;
      alpha = 1.0;
    } else {
      color = uGlass + fres * uRim * 0.8;
      alpha = 0.92;
    }
    color += spec * 0.8;
    gl_FragColor = vec4(color, alpha);
  }
`

function Orb({ ratio, animate, liquid, glass, rim }: { ratio: number; animate: boolean; liquid: string; glass: string; rim: string }) {
  const mat = useRef<ShaderMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)
  const uniforms = useMemo(
    () => ({
      uFill: { value: 0 },
      uTime: { value: 0 },
      uWave: { value: animate ? 1 : 0 },
      uLiquid: { value: new Color(liquid) },
      uGlass: { value: new Color(glass) },
      uRim: { value: new Color(rim) },
    }),
    // colours update below without rebuilding the material
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [animate],
  )

  useEffect(() => {
    uniforms.uLiquid.value.set(liquid)
    uniforms.uGlass.value.set(glass)
    uniforms.uRim.value.set(rim)
    invalidate()
  }, [liquid, glass, rim, uniforms, invalidate])

  useEffect(() => {
    invalidate()
  }, [ratio, invalidate])

  useFrame((_, delta) => {
    const u = mat.current?.uniforms
    if (!u) return
    if (animate) {
      u.uTime.value += delta
      u.uFill.value += (ratio - u.uFill.value) * Math.min(1, delta * 2.5)
    } else {
      u.uFill.value = ratio
    }
  })

  return (
    <mesh>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent />
    </mesh>
  )
}

function Loop({ mode }: { mode: 'always' | 'demand' | 'never' }) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => setFrameloop(mode), [mode, setFrameloop])
  return null
}

export default function OrbScene({
  ratio,
  liquid,
  glass,
  rim,
  animate,
  paused,
}: {
  ratio: number
  liquid: string
  glass: string
  rim: string
  animate: boolean
  paused: boolean
}) {
  const mode = paused ? 'never' : animate ? 'always' : 'demand'
  return (
    <Canvas dpr={cappedDpr()} frameloop={mode} camera={{ fov: 30, position: [0, 0, 4.15] }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} style={{ width: '100%', height: '100%' }}>
      <Loop mode={mode} />
      <Orb ratio={Math.min(1, Math.max(0, ratio))} animate={animate} liquid={liquid} glass={glass} rim={rim} />
    </Canvas>
  )
}
