/**
 * Triggered offers: shown once, at the moment they solve the problem in front of the player, and only in the phone app.
 *   Wall Breaker — after the first time a stage walls you (2+ wipes in a row): gems, a Golden chest and 30 min of Pack Boost.
 *   Rebirth Bundle — right after your first Rebirth: gems, 2 Golden chests and bones for Pack Training.
 * After the one-time card, each offer stays in Menu > Rewards > Offers for 48 hours, then disappears. No countdown pressure
 * on the card itself, no repeats.
 * RevenueCat: consumable products in the current offering with package identifiers `offer_wall` and `offer_rebirth`.
 */
import { G, save, addChest, BOOST, WALL_WIPES } from './sim'
import { W } from './data'
import { R, button, icons } from './render'
import { addScreen, panel, XSCREENS, XBUTTONS } from './screens'
import { xs, ON } from './ext'
import { IAP, starterShowing } from './iap'
import { addBones } from './doglevels'
import { text, wrap, card, GREY, GOLD } from './ui'
import { Audio_ } from './audio'
import { track } from './telemetry'
import type { Ctx } from './render'

interface OfferDef { id: string; pkg: string; title: string; why: string; lines: [string, string][]; give: () => void }
export const OFFERS: OfferDef[] = [
  { id: 'wall', pkg: 'offer_wall', title: 'Wall Breaker', why: 'Stuck on a tough stage? This gets the pack over the hump.',
    lines: [['gem', '250 gems'], ['collar', 'Golden Chest'], ['bolt', '30 min Pack Boost']],
    give: () => { G.gems += 250; addChest(2); G.boostT = Math.min(BOOST.cap, G.boostT + 1800) } },
  { id: 'rebirth', pkg: 'offer_rebirth', title: 'Rebirth Bundle', why: 'A fresh run goes faster with a head start.',
    lines: [['gem', '400 gems'], ['collar', '2 Golden Chests'], ['bone', '60 bones']],
    give: () => { G.gems += 400; addChest(2, 2); addBones(60) } },
]
const WINDOW = 48 * 3600e3
const st = () => xs('offers', () => ({ at: {} as Record<string, number>, bought: [] as string[], queued: '' }))
interface Pkg { identifier: string; product?: { identifier?: string; priceString?: string } }
interface Api { getOfferings: () => Promise<{ current?: { availablePackages?: Pkg[] } }>; purchasePackage: (o: { aPackage: Pkg }) => Promise<unknown> }
const pkgs: Record<string, Pkg> = {}
let msg = '', busy = false

function api(): Api | null {
  try { const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; registerPlugin?: (n: string) => unknown } }).Capacitor; return c?.isNativePlatform?.() && c.registerPlugin ? c.registerPlugin('Purchases') as Api : null } catch { return null }
}
async function init() {
  for (let i = 0; i < 40 && IAP.status === 'loading'; i++) await new Promise(r => setTimeout(r, 250))
  const a = api(); if (!a) return
  try { const pk = (await a.getOfferings()).current?.availablePackages ?? []; for (const o of OFFERS) { const p = pk.find(x => x.identifier === o.pkg || (x.product?.identifier ?? '').endsWith(o.pkg)); if (p) pkgs[o.id] = p } } catch { /* offline */ }
}
ON.load.push(() => { setTimeout(() => { void init() }, 1600) })

const sellable = (o: OfferDef) => !!pkgs[o.id] && !st().bought.includes(o.id)
export const liveOffers = (now = Date.now()) => OFFERS.filter(o => { const at = st().at[o.id]; return at && now - at < WINDOW && sellable(o) })

/** Called by the triggers: remember the moment and queue the one-time card. */
function trigger(id: string) {
  const s = st(); if (s.at[id]) return
  s.at[id] = Date.now(); s.queued = id; save(); track('offer_trigger', { o: id })
}
ON.gevent.push(e => { if (e.type === 'rebirth') trigger('rebirth') })
let shownCard = ''
setInterval(() => {
  try {
    if (G.wipe && G.wipe.fails >= WALL_WIPES) trigger('wall')
    const s = st(), o = OFFERS.find(x => x.id === s.queued)
    if (o && !G.wipe && !G.away && !G.pick && !R.screen && !starterShowing()) {
      s.queued = ''; save()
      if (sellable(o)) { shownCard = o.id; R.screen = 'offer_card'; track('offer_shown', { o: o.id }) }
    }
  } catch { /* not ready */ }
}, 800)

async function buy(o: OfferDef) {
  const a = api(), p = pkgs[o.id]; if (!a || !p || busy) return
  busy = true; msg = ''; track('offer_tap', { o: o.id })
  try { await a.purchasePackage({ aPackage: p }); o.give(); st().bought.push(o.id); save(); Audio_.fanfare(); msg = 'Thank you! Rewards added.'; track('offer_bought', { o: o.id }); if (R.screen === 'offer_card') R.screen = null }
  catch { msg = 'Purchase cancelled.' }
  busy = false
}
function offerBody(ctx: Ctx, o: OfferDef, x: number, y: number, w: number, key: string) {
  text(ctx, o.title, x + w / 2, y, 22, '#ffd84a')
  wrap(ctx, o.why, x + w / 2, y + 30, w - 40, 12, '#dfe9e4')
  o.lines.forEach(([ic, label], i) => {
    const ly = y + 62 + i * 34
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.roundRect(x + 24, ly, w - 48, 28, 9); ctx.fill()
    ctx.save(); ctx.translate(x + 44, ly + 14); icons[ic]?.(ctx, 0, 0, '#ffd84a'); ctx.restore()
    text(ctx, label, x + 64, ly + 14, 13, '#fff', 'left')
  })
  const p = pkgs[o.id]
  button(ctx, key, x + 30, y + 172, w - 60, 44, { ...GOLD, label: p?.product?.priceString ?? 'Buy', size: 17, disabled: busy || !p })
}

XSCREENS.offer_card = (ctx: Ctx) => {
  const o = OFFERS.find(x => x.id === shownCard); if (!o) { R.screen = null; return }
  const c = card(ctx, 300)
  offerBody(ctx, o, c.x, c.y + 32, c.w, 'of_buy_' + o.id)
  button(ctx, 'of_close', c.x + 70, c.y + 258, c.w - 140, 30, { ...GREY, label: 'No thanks', size: 12 })
  if (msg) text(ctx, msg, W / 2, c.y + c.h + 16, 12, '#d6f2ff')
}
XBUTTONS.push(k => {
  if (k === 'of_close') { R.screen = null; msg = ''; return true }
  if (k.startsWith('of_buy_')) { const o = OFFERS.find(x => x.id === k.slice(7)); if (o) void buy(o); return true }
  return false
})
function draw(ctx: Ctx) {
  panel(ctx, 'Offers')
  const list = liveOffers()
  if (!list.length) { wrap(ctx, 'No offers right now. Special bundles appear here for 48 hours at key moments.', W / 2, 200, W - 80, 13, '#c9d8d0'); return }
  list.slice(0, 2).forEach((o, i) => {
    const y = 64 + i * 250
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 238, 16); ctx.fill()
    offerBody(ctx, o, 16, y + 24, W - 32, 'of_buy_' + o.id)
    const left = Math.max(0, WINDOW - (Date.now() - st().at[o.id])), h = Math.floor(left / 3600e3)
    text(ctx, 'Available for ' + (h >= 1 ? h + 'h' : Math.ceil(left / 60e3) + 'm') + ' more', W / 2, y + 226, 10, '#7f929a')
  })
  if (msg) text(ctx, msg, W / 2, 572, 12, '#d6f2ff')
}
addScreen({
  tile: { id: 'offers', label: 'Offers', sub: () => liveOffers().length ? liveOffers().length + ' available' : 'None right now', icon: 'gem', col: '#ffd24a', badge: () => liveOffers().length > 0 },
  section: 'rewards', minor: true, unlock: 1, draw,
})
