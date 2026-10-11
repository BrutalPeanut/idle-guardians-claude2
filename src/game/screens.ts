/** Full-screen menu panels (hub and its sub-screens). All draw over a dimmed game and register their own buttons. */
import { W, H, GUARDIANS, unlockedGuardians } from './data'
import { G, questReady } from './sim'
import { R, button, rr, icons, fmt, OUT } from './render'
import type { Ctx } from './render'

export interface Tile { id: string; label: string; sub: () => string; icon: string; col: string; badge?: () => boolean }
/** Hub tiles. Later features append here. */
export const TILES: Tile[] = []
export const registerTile = (t: Tile) => { TILES.push(t) }

export function panel(ctx: Ctx, title: string, back = true) {
  R.btns = {}
  ctx.fillStyle = 'rgba(4,8,10,.96)'; ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'; ctx.font = '800 22px system-ui,sans-serif'; ctx.fillText(title, W / 2, 34)
  button(ctx, 'scr_close', W / 2 - 60, H - 52, 120, 38, { top: '#5b6c75', bot: '#3a4850', label: back ? 'Back' : 'Close', size: 14 })
}

export function drawHub(ctx: Ctx, t: number) {
  panel(ctx, 'Menu', false)
  const cols = 2, tw = (W - 16 * 2 - 12) / cols, th = 86
  TILES.forEach((tl, i) => {
    const x = 16 + (i % cols) * (tw + 12), y = 64 + Math.floor(i / cols) * (th + 12)
    button(ctx, 'nav_' + tl.id, x, y, tw, th, { top: '#2e3e48', bot: '#1a2830' })
    ctx.save(); ctx.translate(x + 30, y + th / 2); ctx.scale(2, 2); icons[tl.icon]?.(ctx, 0, 0, tl.col); ctx.restore()
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = '800 15px system-ui,sans-serif'; ctx.fillText(tl.label, x + 58, y + 32)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText(tl.sub(), x + 58, y + 54)
    if (tl.badge?.()) { ctx.fillStyle = '#ff5a46'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + tw - 12, y + 12 + Math.sin(t * 5) * 0.8, 6, 0, 6.283); ctx.fill(); ctx.stroke() }
  })
}

/** Damage breakdown: who is carrying, what the abilities add, what the pack absorbed. */
export function drawStats(ctx: Ctx) {
  panel(ctx, 'Damage Breakdown')
  const n = unlockedGuardians(G.stage), st = G.stats
  const total = st.dealt.slice(0, n).reduce((a, b) => a + b, 0) + st.nade
  ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '600 12px system-ui,sans-serif'; ctx.fillText('This run (resets on Rebirth)', W / 2, 60)
  ctx.fillStyle = '#ffd84a'; ctx.font = '800 26px system-ui,sans-serif'; ctx.fillText(fmt(total) + ' total', W / 2, 90)
  const rows: { name: string; v: number; col: string; taken?: number }[] = []
  for (let i = 0; i < n; i++) rows.push({ name: GUARDIANS[i].n, v: st.dealt[i], col: i < 2 ? '#ffb347' : '#6fb8ff', taken: st.taken[i] })
  rows.push({ name: 'Grenade ability', v: st.nade, col: '#ff7a4a' })
  const mx = Math.max(1, ...rows.map(r => r.v))
  let y = 118
  ctx.textAlign = 'left'
  for (const r of rows) {
    ctx.fillStyle = '#fff'; ctx.font = '800 13px system-ui,sans-serif'; ctx.fillText(r.name, 20, y)
    ctx.textAlign = 'right'; ctx.fillStyle = '#d6e4dc'; ctx.font = '700 12px system-ui,sans-serif'; ctx.fillText(fmt(r.v) + (total ? '  ' + Math.round(r.v / total * 100) + '%' : ''), W - 20, y); ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, 20, y + 9, W - 40, 10, 5); ctx.fill()
    if (r.v > 0) { ctx.fillStyle = r.col; rr(ctx, 20, y + 9, Math.max(6, (W - 40) * r.v / mx), 10, 5); ctx.fill() }
    y += 40
  }
  y += 4
  ctx.fillStyle = '#fff'; ctx.font = '800 14px system-ui,sans-serif'; ctx.fillText('Bonuses and defense', 20, y); y += 24
  const lines: [string, string][] = [['Flanking bonus damage', fmt(st.flank)], ['Absorbed by your cover', fmt(st.cover)], ['Blocked by Shield', fmt(st.shield)]]
  for (let i = 0; i < n; i++) lines.push(['Taken by ' + GUARDIANS[i].n, fmt(st.taken[i])])
  for (const [k, v] of lines) { ctx.fillStyle = '#c9d8d0'; ctx.font = '600 12px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(k, 20, y); ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '800 12px system-ui,sans-serif'; ctx.fillText(v, W - 20, y); y += 21 }
  void OUT
}

registerTile({ id: 'quests', label: 'Daily Quests', sub: () => questReady() ? questReady() + ' ready to claim' : '3 objectives', icon: 'gem', col: '#6fd6ff', badge: () => questReady() > 0 })
registerTile({ id: 'stats', label: 'Damage Stats', sub: () => 'Who is carrying?', icon: 'sword', col: '#ff6a5a' })
registerTile({ id: 'rebirth', label: 'Rebirth', sub: () => 'Stardust ' + G.stardust, icon: 'star', col: '#c9a6ff' })
registerTile({ id: 'help', label: 'How to Play', sub: () => 'Rules and tips', icon: 'shield', col: '#5ab8ff' })

export function drawScreen(ctx: Ctx, t: number) {
  switch (R.screen) {
    case 'hub': drawHub(ctx, t); break
    case 'stats': drawStats(ctx); break
    case 'gear': drawGear(ctx, t); break
    default: drawHub(ctx, t)
  }
}

// ================= Gear =================
import { SLOTS, RARITY, CHEST_NAMES, CHEST_COLS, INV_MAX, itemName, fmtStat } from './gear'
import type { Item } from './gear'
import { openChest, equipItem, unequipItem, sellItem, sellValue, invCount } from './sim'
import { Audio_ } from './audio'

const itemOf = (id: number) => G.gear.find(x => x.id === id)
function itemIcon(ctx: Ctx, it: Item, x: number, y: number, s: number) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); icons[it.slot](ctx, 0, 0, RARITY[it.rar].col); ctx.restore() }
function itemCard(ctx: Ctx, x: number, y: number, w: number, h: number, it: Item | null, sel: boolean, label?: string) {
  const col = it ? RARITY[it.rar].col : 'rgba(255,255,255,.18)'
  ctx.fillStyle = it ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)'; rr(ctx, x, y, w, h, 11); ctx.fill()
  ctx.strokeStyle = col; ctx.lineWidth = sel ? 3 : 1.5; rr(ctx, x + 1, y + 1, w - 2, h - 2, 11); ctx.stroke()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  if (it) { itemIcon(ctx, it, x + w / 2, y + h * 0.36, 1.25); ctx.fillStyle = '#fff'; ctx.font = '800 10px system-ui,sans-serif'; ctx.fillText(fmtStat(it).replace(/ (damage|max HP|crit chance|fire rate|kill gold)/, m => ({ ' damage': ' dmg', ' max HP': ' HP', ' crit chance': ' crit', ' fire rate': ' rate', ' kill gold': ' gold' } as Record<string, string>)[m]), x + w / 2, y + h - 11) }
  else { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '700 11px system-ui,sans-serif'; ctx.fillText(label ?? 'empty', x + w / 2, y + h / 2) }
}
function chestIcon(ctx: Ctx, x: number, y: number, s: number, tier: number, open = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const col = CHEST_COLS[tier]
  ctx.fillStyle = col; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, -16, -4, 32, 20, 4); ctx.fill(); ctx.stroke()
  ctx.save(); ctx.translate(-16, -4); ctx.rotate(-open * 0.9); ctx.fillStyle = col; rr(ctx, 0, -12, 32, 12, 5); ctx.fill(); ctx.stroke(); ctx.restore()
  ctx.fillStyle = '#3a2a14'; ctx.fillRect(-3, 1, 6, 8); ctx.restore()
}

export function drawGear(ctx: Ctx, t: number) {
  panel(ctx, 'Gear')
  const n = unlockedGuardians(G.stage)
  if (R.gearDog >= n) R.gearDog = 0
  for (let k = 0; k < 3; k++) {
    const x = 16 + k * 112, c = G.chests[k]
    button(ctx, 'chest_' + k, x, 52, 104, 44, { top: c ? '#34444e' : '#252f36', bot: c ? '#1d2a31' : '#1b2328' })
    chestIcon(ctx, x + 24, 72, 0.75, k); ctx.textAlign = 'left'; ctx.fillStyle = c ? '#fff' : '#7f929a'; ctx.font = '800 12px system-ui,sans-serif'; ctx.fillText(CHEST_NAMES[k].split(' ')[0], x + 46, 66); ctx.font = '700 11px system-ui,sans-serif'; ctx.fillStyle = c ? CHEST_COLS[k] : '#7f929a'; ctx.fillText('x' + c + (c ? '  OPEN' : ''), x + 46, 82)
  }
  for (let i = 0; i < n; i++) button(ctx, 'gt_' + i, 16 + i * 84, 106, 78, 28, { top: i === R.gearDog ? '#ffb347' : '#3a4850', bot: i === R.gearDog ? '#e0731a' : '#26323a', label: GUARDIANS[i].n, size: 12 })
  const dog = R.gearDog
  SLOTS.forEach((sl, k) => { const x = 16 + k * 112, it = G.gear.find(g => g.on === dog && g.slot === sl) ?? null; R.btns['slot_' + k] = { x, y: 142, w: 104, h: 74 }; itemCard(ctx, x, 142, 104, 74, it, false, sl.toUpperCase()) })
  ctx.textAlign = 'left'; ctx.fillStyle = '#8fa69b'; ctx.font = '700 10px system-ui,sans-serif'; ctx.fillText('INVENTORY  ' + invCount() + '/' + INV_MAX + '  (tap an item)', 16, 228)
  const inv = G.gear.filter(g => g.on < 0)
  for (let k = 0; k < INV_MAX; k++) { const x = 16 + (k % 4) * 84, y = 238 + Math.floor(k / 4) * 62, it = inv[k] ?? null; R.btns['inv_' + k] = { x, y, w: 76, h: 56 }; itemCard(ctx, x, y, 76, 56, it, !!it && it.id === R.sel, '') }
  const sel = itemOf(R.sel)
  const py = 490
  ctx.fillStyle = 'rgba(255,255,255,.05)'; rr(ctx, 16, py, W - 32, 88, 14); ctx.fill()
  if (sel) {
    ctx.textAlign = 'left'; ctx.fillStyle = RARITY[sel.rar].col; ctx.font = '800 14px system-ui,sans-serif'; ctx.fillText(itemName(sel), 28, py + 20)
    ctx.fillStyle = '#d6e4dc'; ctx.font = '600 12px system-ui,sans-serif'; ctx.fillText(fmtStat(sel) + '  (found at stage ' + sel.lvl + ')', 28, py + 40)
    const cur = G.gear.find(g => g.on === dog && g.slot === sel.slot)
    if (cur && sel.on < 0) { const d = (sel.val - cur.val) * 100; ctx.fillStyle = d >= 0 ? '#5be07f' : '#ff8a7a'; ctx.fillText((cur.stat === sel.stat ? (d >= 0 ? '+' : '') + d.toFixed(1) + '% vs worn' : 'different stat than worn'), 28, py + 58) }
    if (sel.on < 0) button(ctx, 'rv_equipsel', 150, py + 48, 94, 34, { top: '#52d273', bot: '#25994a', label: 'Equip', size: 13 })
    button(ctx, 'sellsel', sel.on < 0 ? 250 : 150, py + 48, sel.on < 0 ? 94 : 194, 34, { top: '#e0b24a', bot: '#9a6a18', label: 'Sell ' + fmt(sellValue(sel)), size: 12 })
  } else { ctx.textAlign = 'center'; ctx.fillStyle = '#7f929a'; ctx.font = '600 12px system-ui,sans-serif'; ctx.fillText('Open chests for gear. Equip it on ' + GUARDIANS[dog].n + '.', W / 2, py + 44) }
  if (R.reveal) drawReveal(ctx, t)
}

function drawReveal(ctx: Ctx, t: number) {
  const rv = R.reveal; if (!rv) return
  R.btns = {}; rv.t += 1 / 60
  ctx.fillStyle = 'rgba(2,4,6,.93)'; ctx.fillRect(0, 0, W, H)
  const it = itemOf(rv.id)
  if (rv.phase === 0) {
    const sh = Math.sin(t * 30) * 3
    chestIcon(ctx, W / 2 + sh, 250, 4.2, rv.tier, 0)
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 20px system-ui,sans-serif'; ctx.fillText(CHEST_NAMES[rv.tier], W / 2, 150)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '600 14px system-ui,sans-serif'; ctx.fillText('Tap to open', W / 2, 400)
    R.btns.rv_tap = { x: 0, y: 0, w: W, h: H }
  } else {
    const col = it ? RARITY[it.rar].col : '#ffd84a'
    const g = ctx.createRadialGradient(W / 2, 250, 10, W / 2, 250, 170); g.addColorStop(0, col + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 60, W, 400)
    chestIcon(ctx, W / 2, 120, 1.6, rv.tier, Math.min(1, rv.t * 3))
    if (it) {
      ctx.save(); ctx.translate(W / 2, 250); ctx.scale(5, 5); icons[it.slot](ctx, 0, 0, col); ctx.restore()
      ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = '800 22px system-ui,sans-serif'; ctx.fillText(RARITY[it.rar].n.toUpperCase(), W / 2, 330)
      ctx.fillStyle = '#fff'; ctx.font = '800 18px system-ui,sans-serif'; ctx.fillText(itemName(it), W / 2, 362); ctx.fillStyle = '#d6e4dc'; ctx.font = '700 15px system-ui,sans-serif'; ctx.fillText(fmtStat(it), W / 2, 390)
      button(ctx, 'rv_equip', 50, 440, 260, 46, { top: '#52d273', bot: '#25994a', label: 'Equip on ' + GUARDIANS[R.gearDog].n, size: 15 })
      button(ctx, 'rv_keep', 90, 498, 180, 38, { top: '#5b6c75', bot: '#3a4850', label: 'Keep', size: 13 })
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd84a'; ctx.font = '800 18px system-ui,sans-serif'; ctx.fillText('Inventory full: sold for ' + fmt(rv.sold) + ' gold', W / 2, 300)
      button(ctx, 'rv_keep', 90, 440, 180, 40, { top: '#5b6c75', bot: '#3a4850', label: 'OK', size: 14 })
    }
  }
}

/** Buttons owned by the gear screens. Returns true if the key was handled. */
export function screenButton(k: string): boolean {
  if (k.startsWith('chest_')) {
    const r = openChest(+k.slice(6)); if (r) { R.reveal = { id: r.sold ? -1 : r.item.id, tier: +k.slice(6), sold: r.sold, phase: 0, t: 0 }; if (r.item.rar >= 2) R.reveal.t = 0; Audio_.ui() } else G.banner = { text: 'No chests', sub: 'Chests drop from bosses, login streaks and raids', t: 1.4 }
    return true
  }
  if (k === 'rv_tap') { if (R.reveal) { R.reveal.phase = 1; R.reveal.t = 0; const it = itemOf(R.reveal.id); if (it && it.rar >= 2) Audio_.fanfare(); else Audio_.coins() } return true }
  if (k === 'rv_equip') { if (R.reveal) { equipItem(R.reveal.id, R.gearDog); R.sel = -1 } R.reveal = null; return true }
  if (k === 'rv_keep') { R.reveal = null; return true }
  if (k.startsWith('gt_')) { R.gearDog = +k.slice(3); return true }
  if (k.startsWith('slot_')) { const sl = SLOTS[+k.slice(5)], it = G.gear.find(g => g.on === R.gearDog && g.slot === sl); if (it && !unequipItem(it.id)) G.banner = { text: 'Inventory full', t: 1 }; return true }
  if (k.startsWith('inv_')) { const it = G.gear.filter(g => g.on < 0)[+k.slice(4)]; R.sel = it ? it.id : -1; return true }
  if (k === 'rv_equipsel') { if (R.sel >= 0) equipItem(R.sel, R.gearDog); R.sel = -1; return true }
  if (k === 'sellsel') { if (R.sel >= 0) { const g = sellItem(R.sel); G.banner = { text: '+' + fmt(g) + ' gold', t: 1 } } R.sel = -1; return true }
  return false
}
registerTile({ id: 'gear', label: 'Gear', sub: () => { const c = G.chests[0] + G.chests[1] + G.chests[2]; return c ? c + ' chest' + (c > 1 ? 's' : '') + ' to open' : 'Collars, vests, charms' }, icon: 'collar', col: '#ffb347', badge: () => G.chests[0] + G.chests[1] + G.chests[2] > 0 })
