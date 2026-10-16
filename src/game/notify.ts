/**
 * Local push notifications (phone app only, through @capacitor/local-notifications). No server: when the app goes to the
 * background we schedule up to three reminders, and cancel them all as soon as the player is back.
 *   1. Stash full    — when the idle stash will hit its cap.
 *   2. Daily reset   — next morning: fresh quests, spin and Boss Raid attempts.
 *   3. Come back     — after 3 quiet days, a single nudge.
 * The player is asked once (after their first welcome-back collect, from stage 3), and every reminder can be switched off
 * from Menu > More > Alerts. On the web this module does nothing.
 */
import { G, idleCap, idleRate, save } from './sim'
import { R } from './render'
import { W } from './data'
import { xs, ON } from './ext'
import { addScreen, panel, XSCREENS, XBUTTONS } from './screens'
import { button } from './render'
import { text, wrap, toggleRow, card, icon, GREEN, GREY } from './ui'
import { track } from './telemetry'
import type { Ctx } from './render'

interface Pending { id: number }
interface LNApi {
  checkPermissions: () => Promise<{ display: string }>
  requestPermissions: () => Promise<{ display: string }>
  schedule: (o: { notifications: { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle?: boolean }; smallIcon?: string }[] }) => Promise<unknown>
  getPending: () => Promise<{ notifications: Pending[] }>
  cancel: (o: { notifications: Pending[] }) => Promise<unknown>
}
const ID = { stash: 101, daily: 102, back: 103 }
const st = () => xs('notif', () => ({ asked: false, granted: false, stash: true, daily: true, back: true }))

function plugin(): LNApi | null {
  try {
    const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; registerPlugin?: (n: string) => unknown; isPluginAvailable?: (n: string) => boolean } }).Capacitor
    if (!c?.isNativePlatform?.() || !c.registerPlugin) return null
    if (c.isPluginAvailable && !c.isPluginAvailable('LocalNotifications')) return null
    return c.registerPlugin('LocalNotifications') as LNApi
  } catch { return null }
}
export const notifySupported = () => plugin() !== null

/** When each reminder should fire, given the current state (pure, so it can be tested). */
export function plan(now: number, s = st()) {
  const out: { id: number; title: string; body: string; at: number }[] = []
  if (s.stash && G.best >= 3) {
    const rate = idleRate(G.stage), cap = idleCap(G.stage), left = cap - G.stash
    if (rate > 0 && left > 0) { const mins = left / rate; if (mins >= 20) out.push({ id: ID.stash, title: 'Your stash is full! 🐾', body: 'Rudy and Cooper guarded ' + fmtGold(cap) + ' gold. Collect it before they get bored.', at: now + mins * 60000 }) }
  }
  if (s.daily && G.best >= 2) {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0)
    out.push({ id: ID.daily, title: 'New day, new treats', body: 'Fresh daily quests, a free Lucky Spin' + (G.best >= 8 ? ' and Boss Raid attempts' : '') + ' are waiting.', at: d.getTime() })
  }
  if (s.back) out.push({ id: ID.back, title: 'The pack misses you', body: 'Zombies are sniffing around your kennel. Come back and show them who is a good dog.', at: now + 3 * 864e5 })
  return out
}
const fmtGold = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : '' + Math.floor(n)

async function cancelAll(api: LNApi) {
  try { const p = await api.getPending(); const mine = p.notifications.filter(n => Object.values(ID).includes(n.id)); if (mine.length) await api.cancel({ notifications: mine.map(n => ({ id: n.id })) }) } catch { /* nothing pending */ }
}
async function scheduleAll() {
  const api = plugin(), s = st(); if (!api || !s.granted) return
  await cancelAll(api)
  const list = plan(Date.now(), s); if (!list.length) return
  try { await api.schedule({ notifications: list.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true } })) }); track('notif_sched', { n: list.length }) } catch (e) { console.warn('notif', e) }
}
async function onVisible() { const api = plugin(); if (api) await cancelAll(api) }

export async function requestPermission(): Promise<boolean> {
  const api = plugin(), s = st(); s.asked = true
  if (!api) return false
  try { const r = await api.requestPermissions(); s.granted = r.display === 'granted'; track('notif_perm', { ok: s.granted ? 1 : 0 }) } catch { s.granted = false }
  save()
  return s.granted
}

// background / foreground
try { document.addEventListener('visibilitychange', () => { if (document.hidden) void scheduleAll(); else void onVisible() }) } catch { /* no document */ }
// re-check the OS permission at start-up (the player may have changed it in Settings)
ON.load.push(() => { const api = plugin(); if (!api) return; void onVisible(); api.checkPermissions().then(r => { st().granted = r.display === 'granted' }).catch(() => { /* ignore */ }) })

// ---- one-time ask, right after the first welcome-back collect (the moment the stash means something) ----
let sawAway = false
setInterval(() => {
  try {
    if (G.away) { sawAway = true; return }
    const s = st()
    if (sawAway && !s.asked && G.best >= 3 && !R.screen && notifySupported()) { R.screen = 'notif_ask'; track('notif_ask') }
    sawAway = false
  } catch { /* game not ready */ }
}, 700)

XSCREENS.notif_ask = (ctx: Ctx) => {
  const c = card(ctx, 290)
  icon(ctx, 'coin', W / 2, c.y + 50, 2.6, '#ffd84a')
  text(ctx, 'Stash reminders?', W / 2, c.y + 98, 22, '#fff')
  wrap(ctx, 'We can ping you when your gold stash is full and when new daily quests are ready. Only a few, and you can turn them off any time.', W / 2, c.y + 132, c.w - 40, 12, '#c9d8d0')
  button(ctx, 'na_yes', c.x + 30, c.y + 196, c.w - 60, 46, { ...GREEN, label: 'Yes, remind me', size: 16 })
  button(ctx, 'na_no', c.x + 30, c.y + 248, c.w - 60, 30, { ...GREY, label: 'Not now', size: 12 })
}
XBUTTONS.push(k => {
  if (k === 'na_yes') { R.screen = null; void requestPermission(); return true }
  if (k === 'na_no') { st().asked = true; R.screen = null; save(); return true }
  return false
})

// ---- settings screen ----
function drawAlerts(ctx: Ctx) {
  panel(ctx, 'Alerts')
  const s = st(), native = notifySupported()
  wrap(ctx, native ? (s.granted ? 'Reminders arrive while the game is closed. They are cancelled the moment you open it.' : 'Notifications are blocked. Tap below to allow them, or enable them in your phone settings.') : 'Reminders work in the phone app. On the web there is nothing to set up.', W / 2, 62, W - 50, 11, '#9fb5aa')
  if (native && !s.granted) button(ctx, 'nt_allow', 40, 94, W - 80, 40, { ...GREEN, label: 'Allow notifications', size: 14 })
  const y0 = native && !s.granted ? 146 : 100, on = native && s.granted
  toggleRow(ctx, 'nt_stash', y0, 'Stash full', 'When your idle gold stash reaches its cap.', s.stash, 'coin', '#ffd84a', on)
  toggleRow(ctx, 'nt_daily', y0 + 68, 'Daily reset', 'Next morning at 10am: quests, spin and raids.', s.daily, 'gem', '#6fd6ff', on)
  toggleRow(ctx, 'nt_back', y0 + 136, 'Miss you', 'One nudge if you have been away 3 days.', s.back, 'star', '#ff9ad8', on)
}
addScreen({
  tile: { id: 'alerts', label: 'Alerts', sub: () => notifySupported() ? (st().granted ? 'On' : 'Off') : 'Phone app', icon: 'bolt', col: '#6fd6ff' },
  section: 'more', minor: true, draw: drawAlerts, unlock: 1,
  button: k => {
    const s = st()
    if (k === 'nt_allow') { void requestPermission(); return true }
    if (k === 'nt_stash') { s.stash = !s.stash; save(); return true }
    if (k === 'nt_daily') { s.daily = !s.daily; save(); return true }
    if (k === 'nt_back') { s.back = !s.back; save(); return true }
    return false
  },
})
