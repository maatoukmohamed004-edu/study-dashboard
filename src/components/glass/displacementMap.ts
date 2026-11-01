/**
 * Builds a displacement map for an SVG feDisplacementMap "lens" effect on a
 * rounded rectangle: near the rim, pixels are pulled from further inside,
 * which reads as thick curved glass. Red = x offset, green = y offset.
 * `radius` is one value or the four corners [top-left, top-right, bottom-right, bottom-left],
 * as the host's computed border-radius gives them (a pill passes 9999 and is clamped here).
 */
const cache = new Map<string, string>()

export type Corners = [number, number, number, number]

export function displacementMap(width: number, height: number, radius: number | Corners, bezel: number): string {
  const w = Math.max(2, Math.round(width))
  const h = Math.max(2, Math.round(height))
  const radii = (typeof radius === 'number' ? [radius, radius, radius, radius] : radius).map((v) => Math.round(Math.max(0, Math.min(v, w / 2, h / 2)))) as Corners
  const key = `${w}x${h}r${radii.join(',')}b${bezel}`
  const hit = cache.get(key)
  if (hit) return hit

  const scale = 0.5 // half resolution is plenty; feImage stretches it
  const cw = Math.max(2, Math.round(w * scale))
  const ch = Math.max(2, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(cw, ch)
  const hw = w / 2
  const hh = h / 2

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const px = (x + 0.5) / scale
      const py = (y + 0.5) / scale
      const dx = px - hw
      const dy = py - hh
      const r = dy < 0 ? (dx < 0 ? radii[0] : radii[1]) : dx < 0 ? radii[3] : radii[2]
      // Signed distance to the rounded rectangle (negative inside).
      const qx = Math.abs(dx) - (hw - r)
      const qy = Math.abs(dy) - (hh - r)
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
      const inside = Math.min(Math.max(qx, qy), 0)
      const depth = -(outside + inside - r) // distance in from the rim
      const t = Math.min(1, Math.max(0, 1 - depth / bezel))
      const mag = t * t * (3 - 2 * t) // smoothstep: strongest at the rim

      // Outward normal of the nearest edge.
      let nx: number
      let ny: number
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1
        nx = qx / len
        ny = qy / len
      } else if (qx > qy) {
        nx = 1
        ny = 0
      } else {
        nx = 0
        ny = 1
      }
      nx *= Math.sign(dx) || 1
      ny *= Math.sign(dy) || 1

      const i = (y * cw + x) * 4
      img.data[i] = Math.round(128 - nx * mag * 127)
      img.data[i + 1] = Math.round(128 - ny * mag * 127)
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL()
  cache.set(key, url)
  return url
}
