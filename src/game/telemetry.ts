/**
 * Anonymous usage + crash reporting, kept in our own Supabase project (see supabase/telemetry.sql).
 * No device IDs, no personal data: a random ID stored on the device, the app version and platform, and a handful of
 * named events. Players can switch it off in Menu > More > Save Data. Everything fails soft.
 */
import { LB_URL, LB_KEY, APP_VER } from './config'

const store = (k: string, v?: string): string | null => { try { if (v !== undefined) localStorage.setItem(k, v); return localStorage.getItem(k) } catch { return null } }
const uuid = () => (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) })
const aid = () => { let id = store('ig_aid'); if (!id) { id = uuid(); store('ig_aid', id) } return id }
export const telemetryOn = () => store('ig_tel_off') !== '1'
export const setTelemetry = (on: boolean) => { store('ig_tel_off', on ? '0' : '1'); if (!on) queue.length = 0 }
const plat = () => { try { const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor; return c?.isNativePlatform?.() ? (c.getPlatform?.() ?? 'native') : 'web' } catch { return 'web' } }

interface Ev { n: string; p?: Record<string, string | number | boolean> }
const queue: Ev[] = []
const MAX_QUEUE = 100
let errCount = 0

export function track(n: string, p?: Ev['p']) {
  if (!LB_URL || !LB_KEY || !telemetryOn()) return
  if (queue.length >= MAX_QUEUE) queue.shift()
  queue.push(p ? { n, p } : { n })
}
export function trackError(msg: string, src = '') {
  if (++errCount > 10) return // a render loop can fail every frame; keep only the first few per session
  track('error', { m: String(msg).slice(0, 200), s: String(src).slice(0, 120) })
}
export async function flush() {
  if (!queue.length || !LB_URL || !LB_KEY || !telemetryOn()) return
  const batch = queue.splice(0, 50)
  try {
    const r = await fetch(LB_URL + '/rest/v1/rpc/log_batch', { method: 'POST', keepalive: true, headers: { apikey: LB_KEY, Authorization: 'Bearer ' + LB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_aid: aid(), p_ver: APP_VER, p_plat: plat(), p_events: batch }) })
    if (!r.ok) throw new Error(String(r.status))
  } catch { queue.unshift(...batch.slice(0, 20)) /* offline: keep a few and retry next time */ }
}
export function initTelemetry() {
  if (!LB_URL || !LB_KEY) return
  window.addEventListener('error', e => trackError(e.message || 'error', (e.filename || '').split('/').pop() + ':' + (e.lineno || 0)))
  window.addEventListener('unhandledrejection', e => trackError('rejection: ' + String((e.reason && (e.reason.message || e.reason)) || ''), 'promise'))
  track('session_start')
  setInterval(() => { void flush() }, 30000)
  document.addEventListener('visibilitychange', () => { if (document.hidden) void flush() })
}
