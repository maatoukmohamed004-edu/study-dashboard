import type { CSSProperties } from 'react'
import { moduleById, resources, resourcesIntro, type ModuleId } from '../data/plan'
import { Rich } from '../components/Rich'
import { Hero, StatusStrip } from '../components/ui/Hud'

const filterable = resources.map((r) => r.module)
const linkCount = resources.reduce((n, r) => n + [r.understand, r.practise, r.howToUse].join(' ').split('](http').length - 1, 0)

/** The filter lives in the URL (#/resources/micro) so a filtered view can be bookmarked. */
export function ResourcesPage({ filter }: { filter: string | null }) {
  const active = filterable.includes(filter as ModuleId) ? (filter as ModuleId) : null
  const shown = active ? resources.filter((r) => r.module === active) : resources

  return (
    <div className="resources-page">
      <StatusStrip
        label="Resources overview"
        cells={[
          { top: 'Modules', bottom: `${resources.length} with references` },
          { top: 'Links', bottom: `${linkCount}, all free to read` },
          { top: 'Order', bottom: 'Cours → reference → practice' },
          { top: 'Showing', bottom: active ? moduleById[active].short : 'All modules' },
        ]}
      />
      <Hero
        index="04"
        tag="Resources · three layers"
        number={linkCount}
        unit="Links"
        numberLabel={`${linkCount} links across ${resources.length} modules`}
        meta={{
          left: { k: 'Checked', v: '30/10/2026', s: 'Free to read' },
          right: { k: 'Best resource', v: 'ESSAI past papers', s: 'With corrigés' },
        }}
        lede={
          <>
            <p>{resourcesIntro.layers}</p>
            <p>{resourcesIntro.checked}</p>
          </>
        }
        title="Resources"
      />

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">By module</h2>
          <p className="label muted" aria-live="polite">
            Showing {shown.length} of {resources.length}
          </p>
        </div>

        <nav className="filter" aria-label="Filter by module">
          <a className="chip label" href="#/resources" aria-current={active === null ? 'true' : undefined}>
            All
          </a>
          {filterable.map((id) => (
            <a key={id} className="chip label" href={`#/resources/${id}`} aria-current={active === id ? 'true' : undefined} style={{ '--mod': `var(--m-${id})` } as CSSProperties}>
              <span className="chip-dot" aria-hidden="true" />
              {moduleById[id].short}
            </a>
          ))}
        </nav>

        <ul className="res-grid">
          {shown.map((r) => {
            const m = moduleById[r.module]
            return (
              <li key={r.module} className="card res-card" style={{ '--mod': `var(--m-${r.module})` } as CSSProperties}>
                <p className="label muted">
                  [ {String(m.priority).padStart(2, '0')} ] · Priority {m.priority}
                  {m.coef ? ` · coef. ${m.coef}` : ''}
                </p>
                <h3 className="res-title">{r.title}</h3>
                <p className="res-meta">{m.why}</p>
                <dl className="res-list">
                  <div>
                    <dt className="label">Understand it</dt>
                    <dd>
                      <Rich text={r.understand} />
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Practise it, with corrections</dt>
                    <dd>
                      <Rich text={r.practise} />
                    </dd>
                  </div>
                  <div className="res-use">
                    <dt className="label">How to use it</dt>
                    <dd>
                      <Rich text={r.howToUse} />
                    </dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>

        <p className="res-foot">{resourcesIntro.footer}</p>
      </div>
    </div>
  )
}
