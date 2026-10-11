import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/lilita-one/latin-400.css'
import './index.css'
try { void document.fonts.load('20px "Lilita One"') } catch { /* canvas falls back to the system font */ }
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
