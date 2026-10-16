/**
 * Haptics: short vibrations on the moments that matter (merges, crits, boss kills, a dog going down, chests).
 * Phone app: @capacitor/haptics (crisp taptic pulses on iPhone, proper amplitudes on Android).
 * Web: navigator.vibrate where the browser supports it (Android Chrome); silently nothing elsewhere.
 * Throttled so a minigun crit storm is a light buzz, not a jackhammer. Toggle: Menu > More > Vibration.
 */
import { W } from './data'
import { xs, ON } from './ext'
import { addScreen, panel } from './screens'
import { save } from './sim'
import { toggleRow, wrap } from './ui'
import type { Ctx } from './render'

type Style = 'LIGHT' | 'MEDIUM' | 'HEAVY'
interface HapApi { impact: (o: { style: Style }) => Promise<void>; notification: (o: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void> }
const st = () => xs('haptics', () => ({ on: true }))

let api: HapApi | null | undefined
function plugin(): HapApi | null {
  if (api !== undefined) return api
  try {
    const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; registerPlugin?: (n: string) => unknown; isPluginAvailable?: (n: string) => boolean } }).Capacitor
    api = c?.isNativePlatform?.() && c.registerPlugin && (!c.isPluginAvailable || c.isPluginAvailable('Haptics')) ? c.registerPlugin('Haptics') as HapApi : null
  } catch { api = null }
  return api
}
const webVibe = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
export const hapticsSupported = () => !!plugin() || webVibe()

const MS: Record<Style, number> = { LIGHT: 12, MEDIUM: 25, HEAVY: 45 }
let last = 0, lightBudget = 0, lastBudget = 0
/** Fire one pulse. Light pulses are rate-limited to ~4 a second; anything stronger always gets through (with a 60 ms gap). */
export function buzz(style: Style, success = false) {
  if (!st().on) return
  const now = performance.now()
  if (now - last < 60) return
  if (style === 'LIGHT') { lightBudget = Math.min(4, lightBudget + (now - lastBudget) / 250); lastBudget = now; if (lightBudget < 1) return; lightBudget-- }
  last = now
  const p = plugin()
  if (p) { (success ? p.notification({ type: 'SUCCESS' }) : p.impact({ style })).catch(() => { /* no haptics hardware */ }); return }
  if (webVibe()) { try { navigator.vibrate(success ? [30, 50, 40] : MS[style]) } catch { /* blocked until a user gesture */ } }
}

ON.gevent.push(e => {
  switch (e.type) {
    case 'merge': buzz((e.level as number) >= 8 ? 'HEAVY' : 'MEDIUM'); break
    case 'kill': if (e.kind === 'boss') buzz('HEAVY', true); break
    case 'dmg': if (e.crit && !e.blast) buzz('LIGHT'); else if (e.blast) buzz('MEDIUM'); break
    case 'down': buzz('HEAVY'); break
    case 'chest_get': case 'unlock': case 'login_claim': buzz('MEDIUM'); break
    case 'rebirth': case 'raid_end': buzz('HEAVY', true); break
  }
})

function draw(ctx: Ctx) {
  panel(ctx, 'Vibration')
  const s = st(), ok = hapticsSupported()
  wrap(ctx, ok ? 'Short buzzes on merges, crits, boss kills and when a dog goes down.' : 'This device or browser cannot vibrate. In the phone app it can.', W / 2, 62, W - 50, 11, '#9fb5aa')
  toggleRow(ctx, 'hp_on', 100, 'Vibration', 'Haptic feedback during play.', s.on, 'bolt', '#ffb347', ok)
}
addScreen({
  tile: { id: 'vibration', label: 'Vibration', sub: () => st().on ? 'On' : 'Off', icon: 'bolt', col: '#ffb347' },
  section: 'more', minor: true, unlock: 1, draw,
  button: k => { if (k !== 'hp_on') return false; st().on = !st().on; save(); if (st().on) buzz('MEDIUM'); return true },
})
