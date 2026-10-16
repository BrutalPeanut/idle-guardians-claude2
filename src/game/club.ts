/**
 * Treat Club: an optional monthly membership (phone app, via RevenueCat). Never interrupts anyone and never gates content.
 * While active:
 *   - 20 gems to claim every day (missed days are not banked)
 *   - +25% idle stash capacity
 *   - +1 Boss Raid attempt every day (granted with the daily claim)
 * RevenueCat setup: an auto-renewing subscription product, an entitlement named `treat_club`, and a package with identifier
 * `treat_club` in the current offering. The entitlement is re-checked at start-up and cached with its expiry date, so the perks
 * keep working offline until the paid period ends.
 */
import { G, save } from './sim'
import { W } from './data'
import { button, icons } from './render'
import { addScreen, panel } from './screens'
import { xs, addBonus, ON } from './ext'
import { IAP } from './iap'
import { dayKey } from './quests'
import { text, wrap, GREEN, GREY, GOLD } from './ui'
import { Audio_ } from './audio'
import { track } from './telemetry'
import type { Ctx } from './render'

export const CLUB = { gems: 20, stash: 0.25, raids: 1, entitlement: 'treat_club', pkg: 'treat_club' }
interface Ent { expirationDate?: string | null }
interface CI { entitlements?: { active?: Record<string, Ent> } }
interface Pkg { identifier: string; product?: { identifier?: string; priceString?: string } }
interface Api { getCustomerInfo: () => Promise<{ customerInfo?: CI }>; getOfferings: () => Promise<{ current?: { availablePackages?: Pkg[] } }>; purchasePackage: (o: { aPackage: Pkg }) => Promise<{ customerInfo?: CI }>; restorePurchases: () => Promise<{ customerInfo?: CI }> }

const st = () => xs('club', () => ({ until: 0, claimed: '', since: 0 }))
export const clubActive = (now = Date.now()) => st().until > now
export const canClaim = () => clubActive() && st().claimed !== dayKey()
let pkg: Pkg | null = null, msg = '', busy = false

function api(): Api | null {
  try {
    const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; registerPlugin?: (n: string) => unknown } }).Capacitor
    return c?.isNativePlatform?.() && c.registerPlugin ? c.registerPlugin('Purchases') as Api : null
  } catch { return null }
}
/** Read the entitlement into the cached expiry. A lifetime/unknown expiry counts as 31 days from now and is refreshed at every start. */
function apply(ci?: CI) {
  if (!ci) return
  const e = ci.entitlements?.active?.[CLUB.entitlement], s = st()
  if (e) { const exp = e.expirationDate ? Date.parse(e.expirationDate) : Date.now() + 31 * 864e5; if (!s.since) s.since = Date.now(); s.until = Number.isFinite(exp) ? exp : Date.now() + 31 * 864e5 }
  else if (s.until > Date.now()) s.until = Date.now() // cancelled or refunded: stop now
  save()
}
async function init() {
  // wait for iap.ts to configure RevenueCat (it owns configure())
  for (let i = 0; i < 40 && IAP.status === 'loading'; i++) await new Promise(r => setTimeout(r, 250))
  const a = api(); if (!a) return
  try {
    apply((await a.getCustomerInfo()).customerInfo)
    const pk = (await a.getOfferings()).current?.availablePackages ?? []
    pkg = pk.find(p => p.identifier === CLUB.pkg || (p.product?.identifier ?? '').includes(CLUB.pkg)) ?? null
  } catch { /* store not reachable: keep the cached expiry */ }
}
ON.load.push(() => { setTimeout(() => { void init() }, 1500) })

export async function join() {
  const a = api(); if (!a || !pkg || busy) return
  busy = true; msg = ''; track('club_tap')
  try { const r = await a.purchasePackage({ aPackage: pkg }); apply(r.customerInfo); msg = clubActive() ? 'Welcome to the Treat Club!' : ''; if (clubActive()) track('club_joined') }
  catch { msg = 'Purchase cancelled.' }
  busy = false
}
async function restore() { const a = api(); if (!a || busy) return; busy = true; try { apply((await a.restorePurchases()).customerInfo); msg = clubActive() ? 'Membership restored.' : 'No membership found.' } catch { msg = 'Could not restore.' } busy = false }

export function claim(): boolean {
  if (!canClaim()) return false
  const s = st(); s.claimed = dayKey(); G.gems += CLUB.gems; G.raidInfo.extra += CLUB.raids; save(); track('club_claim'); return true
}

// perks
addBonus('stash', () => clubActive() ? CLUB.stash : 0)

function treat(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.3); ctx.fillStyle = '#c47a3a'; ctx.strokeStyle = '#241810'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(-9, -3.5, 18, 7, 3); ctx.fill(); ctx.stroke()
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 9.5, sy * 3.5, 3.6, 0, 6.283); ctx.fill(); ctx.stroke() }
  ctx.fillRect(-8.5, -3, 17, 6); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-7, -2.5, 12, 1.4); ctx.restore()
}
function draw(ctx: Ctx, t: number) {
  panel(ctx, 'Treat Club')
  const on = clubActive(), native = !!api()
  const g = ctx.createLinearGradient(16, 54, W - 16, 54); g.addColorStop(0, '#c4631a'); g.addColorStop(1, '#ffb347')
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(16, 54, W - 32, 110, 16); ctx.fill()
  treat(ctx, 58, 104, 2.2 + 0.08 * Math.sin(t * 3))
  text(ctx, on ? 'You are a member!' : 'Monthly membership', 100, 84, 18, '#fff', 'left')
  text(ctx, on ? 'Renews or ends on ' + new Date(st().until).toLocaleDateString() : (pkg?.product?.priceString ? pkg.product.priceString + ' a month' : 'Cancel any time'), 100, 108, 12, '#fff3e0', 'left')
  wrap(ctx, 'Supports the game. Never required: everything is earnable for free.', 100, 134, W - 130, 10, '#ffe7c8', 'left', 12)
  const perks: [string, string, string][] = [['gem', CLUB.gems + ' gems every day', 'Claim once a day. That is 600 a month.'], ['coin', '+25% idle stash', 'Your pack banks more gold while you are away.'], ['sword', '+1 Boss Raid a day', 'An extra attempt with every daily claim.']]
  perks.forEach(([ic, a, b], i) => {
    const y = 178 + i * 58
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 50, 12); ctx.fill()
    ctx.save(); ctx.translate(42, y + 25); ctx.scale(1.3, 1.3); icons[ic]?.(ctx, 0, 0, '#ffd84a'); ctx.restore()
    text(ctx, a, 66, y + 17, 14, '#fff', 'left'); text(ctx, b, 66, y + 35, 10, '#9fb5aa', 'left')
  })
  const by = 362
  if (on) {
    const c = canClaim()
    button(ctx, 'cl_claim', 40, by, W - 80, 48, { ...(c ? GOLD : GREY), label: c ? 'Claim today: ' + CLUB.gems + ' gems + 1 raid' : 'Claimed. Back tomorrow!', size: 14, disabled: !c })
  } else if (native && pkg) button(ctx, 'cl_join', 40, by, W - 80, 48, { ...GREEN, label: 'Join for ' + (pkg.product?.priceString ?? '') + ' / month', size: 15, disabled: busy })
  else text(ctx, native ? 'Membership is not available right now.' : 'The Treat Club is available in the Android and iPhone app.', W / 2, by + 24, 12, '#c9d8d0')
  if (native) button(ctx, 'cl_restore', W / 2 - 60, by + 60, 120, 28, { ...GREY, label: 'Restore', size: 11 })
  if (msg) text(ctx, msg, W / 2, by + 104, 12, '#d6f2ff')
  wrap(ctx, 'Auto-renews monthly until cancelled in your Google Play or App Store subscriptions. Perks start right away.', W / 2, 520, W - 60, 9, '#7f929a', 'center', 11)
}
addScreen({
  tile: { id: 'club', label: 'Treat Club', sub: () => clubActive() ? (canClaim() ? 'Daily gems ready!' : 'Member') : 'Monthly perks', icon: 'gem', col: '#ffb347', badge: canClaim },
  section: 'rewards', minor: true, unlock: 5, draw,
  button: k => {
    if (k === 'cl_join') { void join(); return true }
    if (k === 'cl_restore') { void restore(); return true }
    if (k === 'cl_claim') { if (claim()) { Audio_.coins(); G.banner = { text: '+' + CLUB.gems + ' gems', sub: '+1 Boss Raid attempt today', t: 1.6 } } return true }
    return false
  },
})
