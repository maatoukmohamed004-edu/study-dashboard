import { useLayoutEffect, useRef, useState } from 'react'

export interface Point {
  /** x label, e.g. "15/11" */
  label: string
  value: number
}

interface Props {
  points: Point[]
  target: number
  targetLabel: string
  format: (v: number) => string
  /** Fixed y range; widened automatically to fit the data and the target. */
  domain: [number, number]
  /** Accessible name, e.g. "Blocks done, percent of planned" */
  name: string
}

const H = 132
const PAD = { top: 14, right: 46, bottom: 22, left: 8 }

/**
 * One series over the weeks, with a dashed target line.
 * Line 2px, markers 8px with a surface ring, the latest value labelled directly,
 * and a tooltip on hover or keyboard focus.
 */
export function TrendChart({ points, target, targetLabel, format, domain, name }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  const [active, setActive] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    let raf = 0
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(200, Math.round(e.contentRect.width))
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setW(w))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  const values = points.map((p) => p.value)
  const lo = Math.min(domain[0], target, ...values)
  const hi = Math.max(domain[1], target, ...values)
  const plotW = w - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * plotH
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const last = points.length - 1
  const tip = active !== null ? points[active] : null

  return (
    <div ref={box} className="trend">
      <svg width={w} height={H} role="group" aria-label={`${name}, ${points.length} weeks`}>
        {/* Baseline and target */}
        <line className="trend-base" x1={PAD.left} x2={w - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />
        <line className="trend-target" x1={PAD.left} x2={w - PAD.right} y1={y(target)} y2={y(target)} />
        <text className="trend-target-label" x={w - PAD.right + 6} y={y(target) + 4}>
          {targetLabel}
        </text>

        {points.length > 1 && <path className="trend-line" d={path} />}

        {/* First and last week on the x axis */}
        {points.length > 0 && (
          <text className="trend-x" x={x(0)} y={H - 4} textAnchor={points.length > 1 ? 'start' : 'middle'}>
            {points[0].label}
          </text>
        )}
        {points.length > 1 && (
          <text className="trend-x" x={x(last)} y={H - 4} textAnchor="end">
            {points[last].label}
          </text>
        )}

        {active !== null && <line className="trend-cross" x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} />}

        {points.map((p, i) => (
          <g
            key={i}
            tabIndex={0}
            role="img"
            aria-label={`Week of ${p.label}: ${format(p.value)}`}
            className="trend-point"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            {/* Hit target wider than the mark */}
            <rect
              x={x(i) - Math.max(10, plotW / Math.max(1, points.length) / 2)}
              y={PAD.top}
              width={Math.max(20, plotW / Math.max(1, points.length))}
              height={plotH}
              fill="transparent"
            />
            <circle className="trend-dot" cx={x(i)} cy={y(p.value)} r={active === i ? 5.5 : 4} />
          </g>
        ))}

        {points.length > 0 && active === null && (
          <text className="trend-last" x={x(last) - 8} y={y(points[last].value) + (points[last].value >= target ? -10 : 18)} textAnchor="end">
            {format(points[last].value)}
          </text>
        )}
      </svg>
      {tip && active !== null && (
        <div className="trend-tip" style={{ left: Math.min(Math.max(x(active), 60), w - 60), top: y(tip.value) - 12 }} aria-hidden="true">
          <span className="muted">{tip.label}</span> <strong>{format(tip.value)}</strong>
        </div>
      )}
    </div>
  )
}
