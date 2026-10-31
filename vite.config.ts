import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths: the build works at https://<user>.github.io/<any-repo-name>/
  // (the app uses hash routes, so GitHub Pages never needs to resolve sub-paths).
  base: './',
  plugins: [react()],
  optimizeDeps: {
    // Pre-bundle the lazily imported 3D libraries so the dev server never has to
    // re-optimize mid-session (which breaks the first dynamic import).
    include: ['@shadergradient/react', '@react-three/fiber', '@react-three/drei', 'three', 'html2canvas'],
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
