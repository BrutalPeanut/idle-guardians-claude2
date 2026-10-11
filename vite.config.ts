import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { assetsInlineLimit: 200000 }, // inline the display font as a data URI (single-file build)
})
