import { lazy, Suspense, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useResolved } from '../../lib/theme'
import { SafeBoundary } from '../SafeBoundary'

const DitherSphere = lazy(() => import('../DitherSphere'))

/** "[ 01 ] · TODAY · SAT 31/10" */
export function Tag({ index, children, live }: { index?: string; children: ReactNode; live?: boolean }) {
  return (
    <p className="tag label">
      {live && <span className="tag-live" aria-hidden="true" />}
      {index && <span className="tag-index">[ {index} ]</span>}
      {index && <span aria-hidden="true">·</span>}
      <span>{children}</span>
    </p>
  )
}

/** The partially filled hairline under a hero number. */
export function ProgressLine({ value, label }: { value: number; label: string }) {
  const v = Math.min(1, Math.max(0, value))
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      style={{ '--p': v } as CSSProperties}
    >
      <span className="progress-fill" />
    </div>
  )
}

export interface MetaCol {
  k: string
  v: ReactNode
  s?: ReactNode
}

/** Two-column FROM / NOW block. */
export function MetaPair({ left, right }: { left: MetaCol; right: MetaCol }) {
  return (
    <div className="meta2">
      {[left, right].map((c, i) => (
        <div key={i}>
          <span className="meta-k label">{c.k}</span>
          <span className="meta-v label">{c.v}</span>
          {c.s && <span className="meta-s label">{c.s}</span>}
        </div>
      ))}
    </div>
  )
}

/** A row of label pairs under the top bar. */
export function StatusStrip({ cells, label }: { cells: { top: ReactNode; bottom: ReactNode }[]; label: string }) {
  return (
    <dl className="strip" aria-label={label}>
      {cells.map((c, i) => (
        <div className="strip-cell" key={i}>
          <dt className="label">{c.top}</dt>
          <dd className="label">{c.bottom}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One huge word that fills the width of its container. */
export function GiantTitle({ text, max = 190 }: { text: string; max?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box) return
    const fit = () => {
      el.style.fontSize = '100px'
      const w = el.scrollWidth
      const avail = box.clientWidth
      // Fill the width, but never taller than about a fifth of the screen.
      const cap = Math.min(max, window.innerHeight * 0.22)
      if (w > 0 && avail > 0) el.style.fontSize = `${Math.min(cap, Math.floor(((100 * avail) / w) * 0.985))}px`
    }
    fit()
    // Refit only when the width changes, on the next frame, so resizing the text can't loop the observer.
    let lastW = box.clientWidth
    let raf = 0
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w === lastW) return
      lastW = w
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    })
    ro.observe(box)
    const fonts = document.fonts
    fonts?.ready.then(fit)
    fonts?.addEventListener?.('loadingdone', fit)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      fonts?.removeEventListener?.('loadingdone', fit)
    }
  }, [text, max])
  return (
    <h1 className="hero-title giant">
      <span ref={ref} className="fit">
        {text}
      </span>
    </h1>
  )
}

interface HeroProps {
  index: string
  tag: ReactNode
  live?: boolean
  /** Visual hero number, e.g. "3 / 7" */
  number: ReactNode
  unit?: string
  /** What the number means, for screen readers. */
  numberLabel: string
  progress?: { value: number; label: string }
  meta?: { left: MetaCol; right: MetaCol }
  lede?: ReactNode
  actions?: ReactNode
  title: string
}

/** The shared page header: tag, condensed number, progress hairline, meta, giant title, optional sphere. */
export function Hero({ index, tag, live, number, unit, numberLabel, progress, meta, lede, actions, title }: HeroProps) {
  const r = useResolved()
  const art = r.bg === 'dither'
  return (
    <section className={`hero${art ? '' : ' no-art'}`} aria-label="Summary">
      <div className="hero-main">
        <Tag index={index} live={live}>
          {tag}
        </Tag>
        <p className="hero-number display">
          <span aria-hidden="true">{number}</span>
          {unit && (
            <span className="hero-unit" aria-hidden="true">
              {unit}
            </span>
          )}
          <span className="sr-only">{numberLabel}</span>
        </p>
        {progress && <ProgressLine value={progress.value} label={progress.label} />}
        {meta && <MetaPair left={meta.left} right={meta.right} />}
        {lede && <div className="hero-lede">{lede}</div>}
        {actions && <div className="hero-actions">{actions}</div>}
      </div>
      {art && (
        <div className="hero-art" aria-hidden="true">
          {r.bg3d ? (
            <SafeBoundary label="The dithered sphere" fallback={<StaticSphere />}>
              <Suspense fallback={<StaticSphere />}>
                <DitherSphere />
              </Suspense>
            </SafeBoundary>
          ) : (
            <StaticSphere />
          )}
        </div>
      )}
      <GiantTitle text={title} />
    </section>
  )
}

/** CSS stand-in for the sphere: phones, no WebGL, and while the 3D loads. */
export function StaticSphere() {
  return <span className="static-sphere" />
}
