import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { assetsInlineLimit: 200000, target: ['es2019', 'safari13', 'chrome80'], modulePreload: false, rollupOptions: { input: 'app.html', output: { format: 'iife', inlineDynamicImports: true, banner: 'window.__igStage="bundle-start";' } } }, // inline the display font as a data URI (single-file build)
})
