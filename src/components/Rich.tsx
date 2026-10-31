import { Fragment, type ReactNode } from 'react'
import { TOKEN } from '../lib/text'

/**
 * Renders the tiny markdown used in plan.ts: [label](url), *italic*, **bold**.
 * Links to "#/…" stay in the app; everything else opens in a new tab.
 */
function render(text: string, keyPrefix: string, inLink = false): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    const key = `${keyPrefix}-${i++}`
    if (m[1] !== undefined && !inLink) {
      const href = m[2]
      const inner = render(m[1], key, true)
      out.push(
        href.startsWith('#/') ? (
          <a key={key} href={href}>
            {inner}
          </a>
        ) : (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="ext">
            {inner}
            <ExternalIcon />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ),
      )
    } else if (m[3] !== undefined) {
      out.push(<strong key={key}>{render(m[3], key, inLink)}</strong>)
    } else if (m[4] !== undefined) {
      out.push(<em key={key}>{render(m[4], key, inLink)}</em>)
    } else {
      out.push(m[0])
    }
    last = idx + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Rich({ text }: { text: string }) {
  return <Fragment>{render(text, 'r')}</Fragment>
}

function ExternalIcon() {
  return (
    <svg className="ext-icon" viewBox="0 0 12 12" width="0.7em" height="0.7em" aria-hidden="true" focusable="false">
      <path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
