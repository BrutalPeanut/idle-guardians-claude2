/**
 * Feature modules. Each one registers its own screens, bonuses and hooks through ext.ts / screens.addScreen when imported.
 * Imported once from input.ts (after screens.ts), so registration happens before the first frame.
 */
import { G, save } from './sim'
import { R } from './render'
import { XS } from './ext'

// ?debug in the URL exposes the game state for testing in the browser console. Harmless in normal play.
try { if (/[?&]debug\b/.test(location.search)) (window as unknown as { __ww: unknown }).__ww = { G, R, XS, save } } catch { /* no location */ }
import './notify'
import './events'
import './haptics'
