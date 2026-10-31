# liquid-glass-js (vendored)

- Source: https://github.com/dashersw/liquid-glass-js
- Commit: 78cb6ccb0b9987bb60a88b14ccbd13a9e6e8ab2a (2025-06-12)
- License: MIT, see `LICENSE` in this folder (Copyright (c) 2025 Armagan Amcalar)
- Files: `container.js` and `button.js`, copied unchanged.

The files are plain scripts that declare global classes. The app loads them on demand
(`src/components/glass/liquidGlass.ts`) when you pick **Settings → Glass → Mode →
Experimental: liquid-glass-js**: it imports them as text, sets `window.html2canvas` from the
npm package, and runs them in a `<script>` element so `Container` and `Button` become
available. Nothing in these two files was edited.
