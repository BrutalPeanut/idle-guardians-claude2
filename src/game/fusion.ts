/**
 * Gear fusion: three unequipped items of the same slot and rarity fuse into one item of the next rarity (same slot,
 * a fresh roll at your current item level). Turns the pile of spare commons into upgrades and keeps the 16-slot bag clear.
 */
import { G, save } from './sim'
import { W } from './data'
import { R, button, icons } from './render'
import { addScreen, panel } from './screens'
import { RARITY, SLOTS, rollItem, itemName, fmtStat, itemScore } from './gear'
import type { Item, Slot } from './gear'
import { text, wrap, GREEN, GREY, PURPLE } from './ui'
import { Audio_ } from './audio'
import { track } from './telemetry'
import type { Ctx } from './render'

const SLOT_NAME: Record<Slot, string> = { collar: 'Collars', vest: 'Vests', charm: 'Charms' }
const spare = (slot: Slot, rar: number) => G.gear.filter(it => it.on < 0 && it.slot === slot && it.rar === rar)
export const groups = () => { const out: { slot: Slot; rar: number; n: number }[] = []; for (let rar = 0; rar < 3; rar++) for (const slot of SLOTS) { const n = spare(slot, rar).length; if (n >= 3) out.push({ slot, rar, n }) } return out }
export const fusable = () => groups().length > 0

/** Fuse the three weakest spare items of this slot+rarity. Returns the new item, or null. */
export function fuse(slot: Slot, rar: number): Item | null {
  if (rar >= 3) return null
  const pool = spare(slot, rar).sort((a, b) => itemScore(a) - itemScore(b)).slice(0, 3); if (pool.length < 3) return null
  const lvl = Math.max(G.stage, ...pool.map(x => x.lvl))
  for (const it of pool) G.gear.splice(G.gear.indexOf(it), 1)
  const out = rollItem(G.nextItem++, 0, lvl, 0, Math.random, { rar: rar + 1, slot })
  G.gear.push(out); G.life.fused = (G.life.fused ?? 0) + 1; save(); track('fuse', { r: rar + 1 })
  return out
}

let last: Item | null = null
function draw(ctx: Ctx, t: number) {
  panel(ctx, 'Gear Fusion')
  wrap(ctx, 'Fuse 3 spare items of the same slot and rarity into 1 of the next rarity. Equipped gear is never touched.', W / 2, 62, W - 50, 11, '#9fb5aa')
  const gs = groups()
  if (!gs.length) {
    icons.collar(ctx, W / 2, 180, 'rgba(255,255,255,.25)')
    wrap(ctx, 'Nothing to fuse yet. Collect 3 spare items of the same kind from chests.', W / 2, 220, W - 80, 13, '#c9d8d0')
  }
  gs.slice(0, 6).forEach((g, i) => {
    const y = 96 + i * 62, from = RARITY[g.rar], to = RARITY[g.rar + 1]
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 56, 12); ctx.fill()
    for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(34 + k * 16, y + 28); ctx.scale(0.95, 0.95); icons[g.slot](ctx, 0, 0, from.col); ctx.restore() }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(94, y + 22); ctx.lineTo(104, y + 28); ctx.lineTo(94, y + 34); ctx.fill()
    ctx.save(); ctx.translate(124, y + 28); ctx.scale(1.3 + 0.06 * Math.sin(t * 4 + i), 1.3 + 0.06 * Math.sin(t * 4 + i)); icons[g.slot](ctx, 0, 0, to.col); ctx.restore()
    text(ctx, to.n + ' ' + SLOT_NAME[g.slot].slice(0, -1).toLowerCase(), 146, y + 20, 13, to.col, 'left')
    text(ctx, g.n + ' spare ' + from.n.toLowerCase(), 146, y + 38, 10, '#9fb5aa', 'left')
    button(ctx, 'fu_' + g.slot + '_' + g.rar, W - 98, y + 10, 74, 34, { ...PURPLE, label: 'FUSE', size: 14 })
  })
  if (last) {
    const y = 96 + Math.min(6, gs.length) * 62 + 8
    ctx.fillStyle = 'rgba(181,140,240,.15)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 58, 12); ctx.fill()
    ctx.save(); ctx.translate(44, y + 29); ctx.scale(1.4, 1.4); icons[last.slot](ctx, 0, 0, RARITY[last.rar].col); ctx.restore()
    text(ctx, 'New: ' + itemName(last), 72, y + 20, 13, RARITY[last.rar].col, 'left')
    text(ctx, fmtStat(last) + (last.subs?.length ? '  (+' + last.subs.length + ' bonus)' : ''), 72, y + 39, 10, '#dfe9e4', 'left')
  }
  if (gs.length > 1) button(ctx, 'fu_all', 60, 506, W - 120, 36, { ...GREEN, label: 'Fuse everything', size: 14 })
  else if (!gs.length) button(ctx, 'fu_gear', 90, 506, W - 180, 34, { ...GREY, label: 'Go to Gear', size: 13 })
}
addScreen({
  tile: { id: 'fusion', label: 'Fusion', sub: () => fusable() ? groups().length + ' ready to fuse' : '3 spares into 1 better', icon: 'collar', col: '#b58cf0', badge: fusable },
  section: 'grow', minor: true, unlock: 3, draw,
  button: k => {
    if (!k.startsWith('fu_')) return false
    if (k === 'fu_gear') { R.screen = 'gear'; return true }
    if (k === 'fu_all') { let n = 0; for (let guard = 0; guard < 40 && fusable(); guard++) { const g = groups()[0]; const it = fuse(g.slot, g.rar); if (!it) break; last = it; n++ } if (n) { Audio_.fanfare(); G.banner = { text: n + ' fusion' + (n > 1 ? 's' : '') + '!', t: 1.4 } } return true }
    const [, slot, rar] = k.split('_'); const it = fuse(slot as Slot, +rar)
    if (it) { last = it; Audio_.merge(it.rar + 2); G.banner = { text: RARITY[it.rar].n + '!', sub: itemName(it), t: 1.4 } }
    return true
  },
})
