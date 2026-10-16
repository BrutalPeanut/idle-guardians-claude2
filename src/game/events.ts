/**
 * Limited-time events. Each event is pure data plus a few hooks: a date window, a currency that drops from kills and stage
 * clears, a reskin of the arena, and an event shop. Add the next holiday by appending to EVENTS.
 * Progress is stored per event id (which includes the year), so the same holiday next year starts fresh.
 *
 * Testing: add ?event=<key> to the URL to force an event on outside its dates.
 */
import { G, save, addChest, startBoost, BOOST } from './sim'
import { R, button } from './render'
import { W, ARENA } from './data'
import { xs, ON, DRAW } from './ext'
import { addScreen, panel } from './screens'
import { text, wrap, icon, font, GREEN, GREY } from './ui'
import { Audio_ } from './audio'
import { track } from './telemetry'
import type { Ctx } from './render'

interface ShopItem { id: string; name: string; sub: string; cost: number; max: number; ic: string; col: string; give: () => void; ok?: () => boolean }
interface EventDef {
  key: string; id: string; name: string; currency: string; col: string; col2: string
  /** local dates, inclusive, as [month (1-12), day] */
  from: [number, number]; to: [number, number]
  intro: string
  /** currency per kill: chance and amount for regular enemies, flat amount for bosses */
  drop: { chance: number; boss: number; clear: number; bossClear: number }
  shop: ShopItem[]
  drawEnemy?: (ctx: Ctx, e: { x: number; y: number; r: number; kind: string }, t: number) => void
  drawWorld?: (ctx: Ctx, t: number) => void
}

// ---------------- art ----------------
function candy(ctx: Ctx, x: number, y: number, s: number, col = '#ff7a1a') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.4)
  ctx.strokeStyle = '#241810'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'
  for (const sd of [-1, 1]) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(sd * 4, 0); ctx.lineTo(sd * 9, -4); ctx.lineTo(sd * 9, 4); ctx.closePath(); ctx.fill(); ctx.stroke() }
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 4.5, 0, 0, 6.283); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-2.5, -2.6); ctx.lineTo(1.5, 2.8); ctx.stroke()
  ctx.restore()
}
function pumpkin(ctx: Ctx, x: number, y: number, r: number, t: number) {
  ctx.save(); ctx.translate(x, y)
  ctx.strokeStyle = '#241810'; ctx.lineWidth = Math.max(1, r * 0.14)
  ctx.fillStyle = '#4a7a2a'; ctx.beginPath(); ctx.roundRect(-r * 0.12, -r * 1.25, r * 0.24, r * 0.4, r * 0.08); ctx.fill(); ctx.stroke()
  for (const [ox, w, c] of [[-0.48, 0.62, '#e8701a'], [0.48, 0.62, '#e8701a'], [0, 0.66, '#ff8a2a']] as [number, number, string][]) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(ox * r, 0, w * r, r * 0.92, 0, 0, 6.283); ctx.fill(); ctx.stroke() }
  const glow = 0.75 + 0.25 * Math.sin(t * 7 + x)
  ctx.fillStyle = 'rgba(255,' + Math.round(210 * glow) + ',60,1)'
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * r * 0.42, -r * 0.38); ctx.lineTo(sd * r * 0.16, -r * 0.08); ctx.lineTo(sd * r * 0.62, -r * 0.08); ctx.closePath(); ctx.fill() }
  ctx.beginPath(); ctx.moveTo(-r * 0.55, r * 0.22); for (let i = 0; i <= 6; i++) ctx.lineTo(-r * 0.55 + i * r * 0.183, r * (i % 2 ? 0.34 : 0.52)); ctx.lineTo(r * 0.55, r * 0.22); ctx.quadraticCurveTo(0, r * 0.36, -r * 0.55, r * 0.22); ctx.fill()
  ctx.restore()
}
function witchHat(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18); ctx.strokeStyle = '#241810'; ctx.lineWidth = Math.max(1, r * 0.12)
  ctx.fillStyle = '#3a2350'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.3, 0, 0, 6.283); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-r * 0.62, -r * 0.08); ctx.quadraticCurveTo(-r * 0.2, -r * 0.9, r * 0.35, -r * 1.55); ctx.quadraticCurveTo(r * 0.1, -r * 0.7, r * 0.62, -r * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#ff8a1a'; ctx.fillRect(-r * 0.6, -r * 0.3, r * 1.2, r * 0.2)
  ctx.restore()
}
function bat(ctx: Ctx, x: number, y: number, s: number, flap: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = 'rgba(20,10,30,.85)'
  const w = 6 + 4 * flap
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-w * 0.6, -4 * flap - 2, -w * 1.6, -1 + 3 * (1 - flap)); ctx.quadraticCurveTo(-w, 1, -w * 0.5, 2); ctx.quadraticCurveTo(-2, 1, 0, 3)
  ctx.quadraticCurveTo(2, 1, w * 0.5, 2); ctx.quadraticCurveTo(w, 1, w * 1.6, -1 + 3 * (1 - flap)); ctx.quadraticCurveTo(w * 0.6, -4 * flap - 2, 0, 0); ctx.fill()
  ctx.beginPath(); ctx.ellipse(0, 1, 2.2, 3, 0, 0, 6.283); ctx.fill(); ctx.restore()
}

// ---------------- events ----------------
const raidPlus = () => { G.raidInfo.extra++ }
export const EVENTS: EventDef[] = [{
  key: 'halloween', id: 'halloween-' + new Date().getFullYear(), name: 'Howl-o-ween', currency: 'Candy', col: '#ff8a1a', col2: '#7a3fb8',
  from: [10, 15], to: [11, 2],
  intro: 'The zombies raided a candy shop. Every one you knock down might drop some. Spend it in the event shop before November 3rd!',
  drop: { chance: 0.12, boss: 25, clear: 2, bossClear: 10 },
  shop: [
    { id: 'collar', name: 'Pumpkin collar', sub: 'Event exclusive look', cost: 400, max: 1, ic: 'collar', col: '#ff8a1a', give: () => { if (!G.collarOwned.includes('pumpkin')) G.collarOwned.push('pumpkin'); G.collar = 'pumpkin' } },
    { id: 'gold', name: 'Golden Chest', sub: 'The best gear odds', cost: 300, max: 3, ic: 'collar', col: '#ffd84a', give: () => addChest(2) },
    { id: 'silver', name: 'Silver Chest', sub: 'Better gear odds', cost: 120, max: 5, ic: 'collar', col: '#e8e8f0', give: () => addChest(1) },
    { id: 'gems', name: '25 Gems', sub: 'For rerolls, raids and more', cost: 150, max: 6, ic: 'gem', col: '#6fd6ff', give: () => { G.gems += 25 } },
    { id: 'raid', name: 'Raid Attempt', sub: '+1 Boss Raid try', cost: 100, max: 5, ic: 'sword', col: '#ff9a8a', give: raidPlus },
    { id: 'boost', name: 'Pack Boost', sub: '+10 min of boost', cost: 60, max: 10, ic: 'bolt', col: '#d9c4ff', give: () => startBoost(), ok: () => G.boostT < BOOST.cap },
  ],
  drawEnemy: (ctx, e, t) => {
    const s = e.r / 11
    if (e.kind === 'zombie') pumpkin(ctx, e.x + 1.2 * s, e.y - 8.2 * s, 9.6 * s, t)
    else if (e.kind === 'robot' || e.kind === 'gunner') witchHat(ctx, e.x, e.y - 13 * s, 10 * s)
  },
  drawWorld: (ctx, t) => {
    const g = ctx.createRadialGradient(W / 2, (ARENA.y0 + ARENA.y1) / 2, 120, W / 2, (ARENA.y0 + ARENA.y1) / 2, 300)
    g.addColorStop(0, 'rgba(60,20,90,0)'); g.addColorStop(1, 'rgba(60,20,90,.28)'); ctx.fillStyle = g; ctx.fillRect(ARENA.x0, ARENA.y0, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0)
    for (let i = 0; i < 3; i++) { const p = ((t * (0.05 + i * 0.013) + i * 0.37) % 1.4) - 0.2; if (p < 0 || p > 1) continue; bat(ctx, ARENA.x0 + p * (ARENA.x1 - ARENA.x0), ARENA.y0 + 30 + i * 46 + Math.sin(t * 2 + i) * 12, 1.1, 0.5 + 0.5 * Math.sin(t * 16 + i)) }
  },
}]

// ---------------- state ----------------
const forced = (() => { try { return new URLSearchParams(location.search).get('event') } catch { return null } })()
export function activeEvent(now = new Date()): EventDef | null {
  for (const e of EVENTS) {
    if (forced === e.key) return e
    const md = (now.getMonth() + 1) * 100 + now.getDate(), a = e.from[0] * 100 + e.from[1], b = e.to[0] * 100 + e.to[1]
    if (a <= b ? md >= a && md <= b : md >= a || md <= b) return e
  }
  return null
}
export const evState = (e: EventDef) => xs('ev_' + e.id, () => ({ cur: 0, earned: 0, bought: {} as Record<string, number>, seen: false }))
export function daysLeft(e: EventDef, now = new Date()) {
  let end = new Date(now.getFullYear(), e.to[0] - 1, e.to[1] + 1); if (end.getTime() < now.getTime() - 864e5 * 200) end = new Date(now.getFullYear() + 1, e.to[0] - 1, e.to[1] + 1)
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 864e5))
}
let pulse = 0
function gain(n: number) { const e = activeEvent(); if (!e || n <= 0) return; const s = evState(e); s.cur += n; s.earned += n; pulse = 1 }
export function buy(itemId: string): 'ok' | 'cost' | 'max' | 'no' {
  const e = activeEvent(); if (!e) return 'no'
  const it = e.shop.find(x => x.id === itemId); if (!it) return 'no'
  const s = evState(e), have = s.bought[it.id] ?? 0
  if (have >= it.max || (it.ok && !it.ok())) return 'max'
  if (s.cur < it.cost) return 'cost'
  s.cur -= it.cost; s.bought[it.id] = have + 1; it.give(); save(); track('event_buy', { e: e.key, i: it.id })
  return 'ok'
}

// ---------------- hooks ----------------
ON.kill.push(k => {
  const e = activeEvent(); if (!e || k.raid) return
  if (k.kind === 'boss') gain(e.drop.boss); else if (Math.random() < e.drop.chance) gain(1)
})
ON.clear.push((_stage, boss) => { const e = activeEvent(); if (e) gain(boss ? e.drop.bossClear : e.drop.clear) })
ON.load.push(() => {
  const e = activeEvent(); if (!e) return
  const s = evState(e); if (!s.seen) { s.seen = true; R.screen = null; G.banner = { text: e.name.toUpperCase() + '!', sub: 'Zombies are dropping ' + e.currency.toLowerCase() + '. Check the Menu.', t: 3.2 }; track('event_seen', { e: e.key }) }
})
DRAW.enemy.push((ctx, en, t) => { const e = activeEvent(); if (e?.drawEnemy) e.drawEnemy(ctx, en, t) })
DRAW.world.push((ctx, t) => { const e = activeEvent(); if (e?.drawWorld) e.drawWorld(ctx, t) })
// HUD chip under the weekly-modifier chip: currency count, tap to open the event
DRAW.hud.push((ctx, t) => {
  const e = activeEvent(); if (!e || R.screen) return
  const s = evState(e), w = 64, h = 18, x = W - w - 8, y = 90
  pulse = Math.max(0, pulse - 0.04); const sc = 1 + 0.15 * pulse
  ctx.fillStyle = 'rgba(20,12,30,.75)'; ctx.strokeStyle = e.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, 9); ctx.fill(); ctx.stroke()
  candy(ctx, x + 12, y + h / 2, 0.85 * sc, e.col)
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = font(12); ctx.fillStyle = '#fff'; ctx.fillText('' + s.cur, x + w - 7, y + h / 2 + 0.5)
  if (Math.sin(t * 3) > 0.92 && evAffordable()) { ctx.fillStyle = '#ff5a46'; ctx.beginPath(); ctx.arc(x + w - 2, y + 2, 4, 0, 6.283); ctx.fill() }
  R.btns.ev_open = { x: x - 4, y: y - 4, w: w + 8, h: h + 8 }
})
const evAffordable = () => { const e = activeEvent(); if (!e) return false; const s = evState(e); return e.shop.some(it => (s.bought[it.id] ?? 0) < it.max && s.cur >= it.cost && (!it.ok || it.ok())) }

// ---------------- screen ----------------
function drawEvent(ctx: Ctx, t: number) {
  const e = activeEvent()
  panel(ctx, e ? e.name : 'Event')
  if (!e) { text(ctx, 'No event right now. Check back soon!', W / 2, 200, 14, '#c9d8d0'); return }
  const s = evState(e)
  // header: currency, days left, blurb
  const g = ctx.createLinearGradient(16, 56, W - 16, 56); g.addColorStop(0, e.col2); g.addColorStop(1, e.col)
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(16, 54, W - 32, 92, 16); ctx.fill()
  pumpkin(ctx, 48, 96, 20, t)
  text(ctx, s.cur + ' ' + e.currency, 80, 80, 22, '#fff', 'left')
  text(ctx, daysLeft(e) + (daysLeft(e) === 1 ? ' day' : ' days') + ' left', W - 28, 80, 12, '#ffe7c8', 'right')
  wrap(ctx, e.intro, 80, 104, W - 112, 10, '#fff3e6', 'left', 12)
  e.shop.forEach((it, i) => {
    const y = 158 + i * 68, have = s.bought[it.id] ?? 0, sold = have >= it.max, blocked = !!it.ok && !it.ok(), can = !sold && !blocked && s.cur >= it.cost
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 60, 13); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(44, y + 30, 19, 0, 6.283); ctx.fill()
    icon(ctx, it.ic, 44, y + 30, 1.5, it.col)
    text(ctx, it.name, 72, y + 21, 14, '#fff', 'left')
    text(ctx, sold ? 'Sold out' : it.sub + (it.max > 1 ? '  (' + (it.max - have) + ' left)' : ''), 72, y + 40, 10, '#b9c8c0', 'left')
    button(ctx, 'evb_' + it.id, W - 118, y + 12, 94, 36, { ...(can ? GREEN : GREY), label: sold ? 'Owned' : '' + it.cost, size: 14, disabled: !can })
    if (!sold) candy(ctx, W - 106, y + 30, 0.8, e.col)
  })
  text(ctx, 'Earned this event: ' + s.earned + ' ' + e.currency.toLowerCase(), W / 2, 158 + e.shop.length * 68 + 6, 10, '#7f929a')
}
const ev = activeEvent()
if (ev) addScreen({
  tile: { id: 'event', label: ev.name, sub: () => { const e = activeEvent(); return e ? evState(e).cur + ' ' + e.currency.toLowerCase() + ', ' + daysLeft(e) + 'd left' : 'Ended' }, icon: 'star', col: ev.col, badge: evAffordable },
  section: 'rewards', first: true, unlock: 1, draw: drawEvent,
  button: k => {
    if (k === 'ev_open') { if (activeEvent()) R.screen = 'event'; return true }
    if (!k.startsWith('evb_')) return false
    const r = buy(k.slice(4))
    if (r === 'ok') { Audio_.coins(); G.banner = { text: 'Got it!', t: 1.1 } } else if (r === 'cost') G.banner = { text: 'Not enough ' + ev.currency.toLowerCase(), sub: 'Knock down more zombies', t: 1.3 }
    return true
  },
})
