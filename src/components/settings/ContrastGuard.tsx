import { useId } from 'react'
import { useSettings } from '../../lib/settings'
import { autoFix, contrastChecks } from '../../lib/contrast'
import { useResolved } from '../../lib/theme'
import { applyPatch } from './helpers'

/** Live WCAG check of the colours in force, with a one-click repair. */
export function ContrastGuard({ compact = false }: { compact?: boolean }) {
  const s = useSettings()
  const r = useResolved()
  const checks = contrastChecks(s, r)
  const failing = checks.filter((c) => !c.pass)
  const titleId = useId()

  if (compact && failing.length === 0) return null

  return (
    <section className={`guard${failing.length ? ' has-fail' : ''}`} aria-labelledby={titleId}>
      <div className="guard-head">
        <h3 id={titleId} className="sub-title">
          Contrast check
        </h3>
        <p className="guard-summary" aria-live="polite">
          {failing.length === 0 ? (
            <span className="is-ok">
              <Mark ok /> All {checks.length} colour pairs meet WCAG AA.
            </span>
          ) : (
            <span className="is-alarm">
              <Mark ok={false} /> {failing.length} of {checks.length} colour pairs are below WCAG AA.
            </span>
          )}
        </p>
      </div>
      {!compact && (
        <table className="table guard-table">
          <thead>
            <tr>
              <th scope="col">Pair</th>
              <th scope="col">Ratio</th>
              <th scope="col">Needs</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <th scope="row">
                  <span className="pair-row">
                    <span className="pair" aria-hidden="true">
                      <span style={{ background: c.bg, color: c.fg }}>Aa</span>
                    </span>
                    <span>{c.label}</span>
                  </span>
                </th>
                <td className="num">{c.ratio.toFixed(2)}:1</td>
                <td className="num">{c.need}:1</td>
                <td className={c.pass ? 'is-ok' : 'is-alarm'}>
                  <Mark ok={c.pass} /> {c.pass ? 'Pass' : 'Fail'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {failing.length > 0 && (
        <button type="button" className="btn btn-primary" onClick={() => applyPatch(autoFix(s, r), 'Colours adjusted to meet WCAG AA.')}>
          Fix automatically
        </button>
      )}
    </section>
  )
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <svg className="mark" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      {ok ? (
        <path d="M2.5 8.5 6.2 12 13.5 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      ) : (
        <path d="M3 3l10 10M13 3 3 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      )}
    </svg>
  )
}
