import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Body
import '@fontsource-variable/atkinson-hyperlegible-next/index.css'
import '@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css'
// Labels, tags, coordinates
import '@fontsource-variable/atkinson-hyperlegible-mono'
// Condensed display (three choices; only the one in use is downloaded)
import '@fontsource-variable/sofia-sans-extra-condensed'
import '@fontsource-variable/antonio'
import '@fontsource-variable/big-shoulders-display'
// Heavy extended page title
import '@fontsource-variable/unbounded'
import './styles/base.css'
import './styles/hud.css'
import './styles/components.css'
import './styles/pages.css'
import './styles/nav.css'
import './styles/transitions.css'
import { startTheme } from './lib/theme'
import App from './App.tsx'

// Apply settings to :root before the first render, so there is no flash of the wrong theme.
startTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
