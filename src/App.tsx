import { createElement, lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Background } from './components/Background'
import { FpsMeter } from './components/FpsMeter'
import { Header } from './components/Header'
import type { SheetClose } from './components/nav/MoreSheet'
import { Caption, FabStack, HudChrome } from './components/hud/HudChrome'
import { Toaster } from './components/Toast'
import { pageLabel, setPagePreloader, useRoute, type PageId } from './lib/env'
import { useSetting, useSettingsProblem } from './lib/settings'
import { useStorageProblem } from './lib/store'
import { SyncNotice } from './components/Extras'
import { useMediaState } from './lib/capabilities'
import { loadedPage, preloadAll, preloadPage } from './pages/registry'

// Today ships in the main bundle; the other pages are chunks that load when the browser is idle
// (or on first visit), which keeps the main bundle near 100 kB gzipped.
setPagePreloader(preloadPage)
const QuickSettings = lazy(() => import('./components/settings/QuickSettings'))
const MoreSheet = lazy(() => import('./components/nav/MoreSheet'))
// Only phones render the tab bar, so desktops never download it.
const TabBar = lazy(() => import('./components/nav/TabBar').then((m) => ({ default: m.TabBar })))

/** Renders a page, loading its chunk first if needed. */
function PageHost({ page, sub }: { page: PageId; sub: string | null }) {
  const C = loadedPage(page)
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (C) return
    preloadPage(page)?.then(bump, () => setFailed(true))
  }, [page, C])

  // C is the stored component from the registry (stable across renders).
  if (C) return createElement(C, { sub })
  return failed ? (
    <p className="notice" role="alert">
      This page could not load. Check your connection, then reload.
    </p>
  ) : (
    <p className="label muted page-loading">Loading</p>
  )
}

export default function App() {
  const { page, sub } = useRoute()
  const storageProblem = useStorageProblem()
  const settingsProblem = useSettingsProblem()
  const fps = useSetting('diag.fps')
  const [quickOpen, setQuickOpen] = useState(false)
  const quickButton = useRef<HTMLElement | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButton = useRef<HTMLElement | null>(null)
  // Phones with the tab bar: navigation at the bottom, and the top gear opens Quick settings.
  const media = useMediaState()
  const bottomBar = useSetting('nav.bottomBar')
  const phoneBar = media.phone && bottomBar
  // Leaving the phone layout (rotation, setting turned off) closes the sheet.
  const [wasPhoneBar, setWasPhoneBar] = useState(phoneBar)
  if (wasPhoneBar !== phoneBar) {
    setWasPhoneBar(phoneBar)
    if (!phoneBar) setMoreOpen(false)
  }

  useEffect(() => {
    document.title = `${pageLabel(page)} – Study dashboard`
  }, [page])

  // Load the other pages once the first one is on screen, so changing page never waits.
  useEffect(() => {
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(preloadAll, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(preloadAll, 2000)
    return () => window.clearTimeout(id)
  }, [])

  // The opener is passed in: on touch devices a tapped button does not always take focus.
  const openQuick = useCallback((opener?: HTMLElement) => {
    quickButton.current = opener ?? (document.activeElement as HTMLElement)
    setQuickOpen((o) => !o)
  }, [])

  const closeQuick = useCallback(() => {
    setQuickOpen(false)
    // Return focus to the button that opened the drawer.
    requestAnimationFrame(() => quickButton.current?.focus())
  }, [])

  const openMore = useCallback((opener: HTMLElement) => {
    moreButton.current = opener
    setMoreOpen((o) => !o)
  }, [])

  const closeMore = useCallback((how: SheetClose) => {
    setMoreOpen(false)
    // Dismissed: back to the "More" button. Navigating: the new page's heading takes focus.
    if (how === 'dismiss') requestAnimationFrame(() => moreButton.current?.focus())
  }, [])

  return (
    <>
      <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>
        Skip to content
      </button>
      <Background />
      <HudChrome />
      <div className="shell">
        <Header page={page} compact={phoneBar} quickOpen={quickOpen} onQuick={openQuick} />
        <main id="main" className="main" tabIndex={-1}>
          {storageProblem && (
            <p className="notice" role="alert">
              {storageProblem}
            </p>
          )}
          <SyncNotice />
          {settingsProblem && (
            <p className="notice" role="alert">
              {settingsProblem}
            </p>
          )}
          <PageHost key={page} page={page} sub={sub} />
        </main>
        <div className="vt-layer" aria-hidden="true" />
      </div>
      <p id="route-announcer" className="sr-only" aria-live="polite" aria-atomic="true" />
      <Caption page={page} />
      <FabStack quickOpen={quickOpen} onQuick={openQuick} showQuick={!phoneBar} />
      {phoneBar && (
        <Suspense fallback={<nav className="tabbar" aria-label="Pages" />}>
          <TabBar moreOpen={moreOpen} onMore={openMore} />
        </Suspense>
      )}
      {phoneBar && moreOpen && (
        <Suspense fallback={null}>
          <MoreSheet onClose={closeMore} />
        </Suspense>
      )}
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
