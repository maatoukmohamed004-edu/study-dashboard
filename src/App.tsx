import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Background } from './components/Background'
import { FpsMeter } from './components/FpsMeter'
import { Header } from './components/Header'
import { Caption, FabStack, HudChrome } from './components/hud/HudChrome'
import { Toaster } from './components/Toast'
import { PAGES, useRoute, type PageId } from './lib/env'
import { useSetting, useSettingsProblem } from './lib/settings'
import { useStorageProblem } from './lib/store'
import { TodayPage } from './pages/TodayPage'

// Today is the landing page and ships in the main bundle; the other pages and the
// Settings UI load on first visit, which keeps the main bundle near 100 kB gzipped.
const WeekPage = lazy(() => import('./pages/WeekPage').then((m) => ({ default: m.WeekPage })))
const PlanPage = lazy(() => import('./pages/PlanPage').then((m) => ({ default: m.PlanPage })))
const ResourcesPage = lazy(() => import('./pages/ResourcesPage').then((m) => ({ default: m.ResourcesPage })))
const AbsencesPage = lazy(() => import('./pages/AbsencesPage').then((m) => ({ default: m.AbsencesPage })))
const CheckPage = lazy(() => import('./pages/CheckPage').then((m) => ({ default: m.CheckPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const QuickSettings = lazy(() => import('./components/settings/QuickSettings'))

function PageSwitch({ page, sub }: { page: PageId; sub: string | null }) {
  switch (page) {
    case 'today':
      return <TodayPage />
    case 'week':
      return <WeekPage />
    case 'plan':
      return <PlanPage section={sub} />
    case 'resources':
      return <ResourcesPage filter={sub} />
    case 'absences':
      return <AbsencesPage />
    case 'check':
      return <CheckPage />
    case 'settings':
      return <SettingsPage section={sub} />
  }
}

function Page(props: { page: PageId; sub: string | null }) {
  return (
    <Suspense fallback={<p className="label muted page-loading">Loading</p>}>
      <PageSwitch {...props} />
    </Suspense>
  )
}

export default function App() {
  const { page, sub } = useRoute()
  const storageProblem = useStorageProblem()
  const settingsProblem = useSettingsProblem()
  const fps = useSetting('diag.fps')
  const [quickOpen, setQuickOpen] = useState(false)
  const quickButton = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const label = page === 'settings' ? 'Settings' : (PAGES.find((p) => p.id === page)?.label ?? 'Today')
    document.title = `${label} – Study dashboard`
  }, [page])

  useEffect(() => {
    if (!sub) window.scrollTo({ top: 0 })
  }, [page, sub])

  const openQuick = useCallback(() => {
    quickButton.current = document.activeElement as HTMLElement
    setQuickOpen((o) => !o)
  }, [])

  const closeQuick = useCallback(() => {
    setQuickOpen(false)
    // Return focus to the button that opened the drawer.
    requestAnimationFrame(() => quickButton.current?.focus())
  }, [])

  return (
    <>
      <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>
        Skip to content
      </button>
      <Background />
      <HudChrome />
      <div className="shell">
        <Header page={page} />
        <main id="main" className="main" tabIndex={-1}>
          {storageProblem && (
            <p className="notice" role="alert">
              {storageProblem}
            </p>
          )}
          {settingsProblem && (
            <p className="notice" role="alert">
              {settingsProblem}
            </p>
          )}
          <Page page={page} sub={sub} />
        </main>
      </div>
      <Caption page={page} />
      <FabStack quickOpen={quickOpen} onQuick={openQuick} />
      {quickOpen && (
        <Suspense fallback={null}>
          <QuickSettings onClose={closeQuick} />
        </Suspense>
      )}
      <Toaster />
      {fps && <FpsMeter />}
    </>
  )
}
