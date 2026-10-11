import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/lilita-one/latin-400.css'
import './index.css'
try { void document.fonts.load('20px "Lilita One"') } catch { /* canvas falls back to the system font */ }
import App from './App.tsx'

// Older Android WebViews lack canvas roundRect; without it the renderer throws mid-frame.
{
  const P = CanvasRenderingContext2D.prototype as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r?: number | number[]) => void; arcTo: CanvasRenderingContext2D['arcTo'] }
  if (!P.roundRect) {
    P.roundRect = function (this: CanvasRenderingContext2D, x, y, w, h, r = 0) {
      const rr = Math.max(0, Math.min(Array.isArray(r) ? (r[0] ?? 0) : r, Math.abs(w) / 2, Math.abs(h) / 2))
      this.moveTo(x + rr, y); this.arcTo(x + w, y, x + w, y + h, rr); this.arcTo(x + w, y + h, x, y + h, rr)
      this.arcTo(x, y + h, x, y, rr); this.arcTo(x, y, x + w, y, rr); this.closePath()
    }
  }
}

document.getElementById('root')!.innerHTML = ''
;(window as unknown as { __igOK: boolean }).__igOK = true
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
