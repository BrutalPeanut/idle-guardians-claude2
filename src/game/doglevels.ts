/**
 * Dog progression: every dog you own levels up with Bones and earns Stars.
 *  - Level: +3% damage and +3% max HP for that dog per level above 1. Level cap = 10 x (stars + 1).
 *  - Star (max 4): needs the level cap, costs Bones + Dungeon Coins. Each star: +5% damage and +25% perk strength.
 * Bones drop from stage clears (1, bosses 6), occasionally from kills, and from Boss Raids.
 * Progress is permanent (Rebirth keeps it).
 */
import { G, save, dogId } from './sim'
import { ROSTER, W } from './data'
import { button, drawDogPortrait, icons } from './render'
import { addScreen, panel } from './screens'
import { xs, ON, HOOK, addBonus } from './ext'
import { text, GREEN, GREY, GOLD, PURPLE } from './ui'
import { Audio_ } from './audio'
import { track } from './telemetry'
import type { Ctx } from './render'

export const MAX_STARS = 4, PER_LEVEL = 0.03, PER_STAR_DMG = 0.05, PER_STAR_PERK = 0.25
export const st = () => xs('dogs', () => ({ bones: 0, lv: {} as Record<string, number>, stars: {} as Record<string, number>, total: 0 }))
export const dogLv = (r: number) => st().lv[r] ?? 1
export const dogStars = (r: number) => st().stars[r] ?? 0
export const lvCap = (r: number) => 10 * (dogStars(r) + 1)
export const lvCost = (l: number) => Math.ceil(4 * Math.pow(1.16, l - 1))
export const starCost = (s: number) => ({ bones: 30 * (s + 1), coins: 15 * (s + 1) })
export const owns = (r: number) => r < 2 || G.owned.includes(r)
export function addBones(n: number) { if (n <= 0) return; const s = st(); s.bones += n; s.total += n }

export function levelUp(r: number): 'ok' | 'cap' | 'cost' | 'no' {
  if (!owns(r)) return 'no'
  const l = dogLv(r); if (l >= lvCap(r)) return 'cap'
  const c = lvCost(l), s = st(); if (s.bones < c) return 'cost'
  s.bones -= c; s.lv[r] = l + 1; save(); track('dog_lv', { r, l: l + 1 }); return 'ok'
}
export function starUp(r: number): 'ok' | 'max' | 'level' | 'cost' | 'no' {
  if (!owns(r)) return 'no'
  const sr = dogStars(r); if (sr >= MAX_STARS) return 'max'
  if (dogLv(r) < lvCap(r)) return 'level'
  const c = starCost(sr), s = st(); if (s.bones < c.bones || G.coins < c.coins) return 'cost'
  s.bones -= c.bones; G.coins -= c.coins; s.stars[r] = sr + 1; save(); track('dog_star', { r, s: sr + 1 }); return 'ok'
}
const upgradable = (r: number) => owns(r) && (dogLv(r) < lvCap(r) ? st().bones >= lvCost(dogLv(r)) : dogStars(r) < MAX_STARS && st().bones >= starCost(dogStars(r)).bones && G.coins >= starCost(dogStars(r)).coins)
export const anyUpgrade = () => ROSTER.some((_d, r) => upgradable(r))

// ---- effects ----
const dogPow = (r: number) => (dogLv(r) - 1) * PER_LEVEL
addBonus('dmg', i => { const r = dogId(i); return dogPow(r) + dogStars(r) * PER_STAR_DMG })
addBonus('hp', i => dogPow(dogId(i)))
HOOK.perkScale = r => 1 + PER_STAR_PERK * dogStars(r)

// ---- income ----
ON.clear.push((_s, boss) => addBones(boss ? 6 : 1))
ON.kill.push(k => { if (!k.raid && Math.random() < 0.03) addBones(1) })
ON.gevent.push(e => { if (e.type === 'raid_end') addBones(8) })

// ---- screen ----
function bone(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.5); ctx.fillStyle = '#f4ead6'; ctx.strokeStyle = '#241810'; ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.roundRect(-6, -1.8, 12, 3.6, 1.5); ctx.fill(); ctx.stroke()
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 6.5, sy * 2, 2.4, 0, 6.283); ctx.fill(); ctx.stroke() }
  ctx.fillRect(-5.5, -1.2, 11, 2.4); ctx.restore()
}
export { bone as drawBone }
icons.bone = (ctx, x, y) => bone(ctx, x, y, 0.95)
function star(ctx: Ctx, x: number, y: number, on: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.scale(0.62, 0.62); icons.star(ctx, 0, 0, on ? '#ffd84a' : 'rgba(255,255,255,.18)'); ctx.restore()
}
let page = 0
const PER = 6
function draw(ctx: Ctx, t: number) {
  panel(ctx, 'Pack Training')
  const s = st(), list = ROSTER.map((_d, r) => r).filter(owns)
  // header: currencies
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.roundRect(16, 52, W - 32, 34, 12); ctx.fill()
  bone(ctx, 38, 69, 1.1); text(ctx, s.bones + ' bones', 54, 69, 15, '#fff', 'left')
  ctx.save(); ctx.translate(W - 120, 69); icons.coin(ctx, 0, 0, '#ffb347'); ctx.restore(); text(ctx, G.coins + ' coins', W - 104, 69, 15, '#fff', 'left')
  text(ctx, 'Bones drop from stage clears, bosses and raids. Levels are permanent.', W / 2, 98, 10, '#9fb5aa')
  const pages = Math.max(1, Math.ceil(list.length / PER)); page = Math.min(page, pages - 1)
  list.slice(page * PER, page * PER + PER).forEach((r, k) => {
    const d = ROSTER[r], y = 112 + k * 68, l = dogLv(r), cap = lvCap(r), sr = dogStars(r), atCap = l >= cap
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 62, 13); ctx.fill()
    ctx.save(); ctx.translate(46, y + 30); ctx.scale(1.15, 1.15); drawDogPortrait(ctx, d, 0, 0, t); ctx.restore()
    text(ctx, d.n, 78, y + 16, 14, '#fff', 'left')
    for (let i = 0; i < MAX_STARS; i++) star(ctx, 78 + ctx.measureText(d.n).width + 14 + i * 12, y + 15, i < sr)
    text(ctx, 'Lv ' + l + ' / ' + cap, 78, y + 35, 11, '#ffd84a', 'left')
    text(ctx, '+' + Math.round((dogPow(r) + sr * PER_STAR_DMG) * 100) + '% dmg  +' + Math.round(dogPow(r) * 100) + '% HP' + (d.perk ? '  perk x' + (1 + PER_STAR_PERK * sr).toFixed(2) : ''), 78, y + 51, 9, '#9fb5aa', 'left')
    if (!atCap) {
      const c = lvCost(l), ok = s.bones >= c
      button(ctx, 'dl_l' + r, W - 104, y + 13, 80, 36, { ...(ok ? GREEN : GREY), icon: 'bone', label: '' + c, size: 14, disabled: !ok })
    } else if (sr < MAX_STARS) {
      const c = starCost(sr), ok = s.bones >= c.bones && G.coins >= c.coins
      button(ctx, 'dl_s' + r, W - 104, y + 13, 80, 36, { ...(ok ? GOLD : GREY), icon: 'star', label: 'STAR', size: 13, disabled: !ok })
      text(ctx, c.bones + ' bones + ' + c.coins + ' coins', W - 64, y + 56, 8, '#ffd84a')
    } else button(ctx, 'dl_max' + r, W - 104, y + 13, 80, 36, { ...PURPLE, label: 'MAX', size: 13, disabled: true })
  })
  if (pages > 1) {
    button(ctx, 'dl_prev', 40, 524, 80, 30, { ...(page > 0 ? GREEN : GREY), label: 'Prev', size: 12, disabled: page === 0 })
    text(ctx, page + 1 + ' / ' + pages, W / 2, 539, 12, '#c9d8d0')
    button(ctx, 'dl_next', W - 120, 524, 80, 30, { ...(page < pages - 1 ? GREEN : GREY), label: 'Next', size: 12, disabled: page >= pages - 1 })
  }
}
addScreen({
  tile: { id: 'doglv', label: 'Pack Training', sub: () => st().bones + ' bones', icon: 'star', col: '#ffd84a', badge: anyUpgrade },
  section: 'grow', unlock: 4, draw,
  button: k => {
    if (!k.startsWith('dl_')) return false
    if (k === 'dl_prev') page = Math.max(0, page - 1)
    else if (k === 'dl_next') page++
    else if (k.startsWith('dl_l')) { const r = +k.slice(4), res = levelUp(r); if (res === 'ok') Audio_.merge(1); else if (res === 'cost') G.banner = { text: 'Not enough bones', sub: 'Clear stages and beat bosses for more', t: 1.3 } }
    else if (k.startsWith('dl_s')) { const r = +k.slice(4), res = starUp(r); if (res === 'ok') { Audio_.fanfare(); G.banner = { text: ROSTER[r].n + ' earned a star!', sub: 'Level cap raised to ' + lvCap(r), t: 1.8 } } else if (res === 'cost') G.banner = { text: 'Need ' + starCost(dogStars(r)).bones + ' bones and ' + starCost(dogStars(r)).coins + ' coins', t: 1.4 } }
    return true
  },
})
