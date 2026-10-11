/** Full-screen menu panels (hub and its sub-screens). All draw over a dimmed game and register their own buttons. */
import { W, H, GUARDIANS, ROSTER, unlockedGuardians } from './data'
import { G, questReady, dogId, buyDog, setSquad, pk, RAID, raidBase, raidLeft, raidTier, startRaid, closeRaid } from './sim'
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
  const cols = 2, tw = (W - 16 * 2 - 12) / cols, th = 72
  TILES.forEach((tl, i) => {
    const x = 16 + (i % cols) * (tw + 12), y = 60 + Math.floor(i / cols) * (th + 10)
    button(ctx, 'nav_' + tl.id, x, y, tw, th, { top: '#2e3e48', bot: '#1a2830' })
    ctx.save(); ctx.translate(x + 30, y + th / 2); ctx.scale(1.8, 1.8); icons[tl.icon]?.(ctx, 0, 0, tl.col); ctx.restore()
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = '800 15px system-ui,sans-serif'; ctx.fillText(tl.label, x + 58, y + 27)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText(tl.sub(), x + 58, y + 47)
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
registerTile({ id: 'tour', label: 'Quick Tour', sub: () => 'One-minute walkthrough', icon: 'plus', col: '#52d273' })
registerTile({ id: 'help', label: 'How to Play', sub: () => 'Rules and tips', icon: 'shield', col: '#5ab8ff' })

export function drawScreen(ctx: Ctx, t: number) {
  switch (R.screen) {
    case 'hub': drawHub(ctx, t); break
    case 'stats': drawStats(ctx); break
    case 'gear': drawGear(ctx, t); break
    case 'login': drawLogin(ctx, t); break
    case 'skills': drawSkills(ctx); break
    case 'weekly': drawWeekly(ctx); break
    case 'kennel': drawKennel(ctx); break
    case 'raid': drawRaid(ctx); break
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
  const dog = dogId(R.gearDog)
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
  if (k === 'raid_go') { if (startRaid()) { R.screen = null; Audio_.fanfare() } else G.banner = { text: 'No raid attempts left', sub: 'Back tomorrow, or watch an ad for one more', t: 1.6 }; return true }
  if (k === 'raid_done') { closeRaid(); R.screen = null; return true }
  if (k.startsWith('ks_')) { R.kSlot = +k.slice(3); return true }
  if (k.startsWith('kd_')) {
    const r = +k.slice(3)
    if (!G.owned.includes(r)) { if (buyDog(r)) { G.banner = { text: ROSTER[r].n + ' joined the kennel!', sub: ROSTER[r].perkText, t: 1.8 }; Audio_.fanfare() } else G.banner = { text: 'Need ' + ROSTER[r].cost + ' coins', sub: 'Coins drop from bosses and Raids', t: 1.4 } }
    else if (G.squad.includes(r)) { if (G.squad[R.kSlot] !== r) setSquad(R.kSlot, r) }
    else setSquad(R.kSlot, r)
    return true
  }
  if (k === 'login_claim') { claimLogin(); return true }
  if (k.startsWith('sb_')) { R.skillTab = +k.slice(3); return true }
  if (k.startsWith('sk_')) { if (!buySkill(k.slice(3))) G.banner = { text: pointsLeft() < 1 ? 'No Paw Points left' : 'Maxed', sub: pointsLeft() < 1 ? 'Reach new stages or Rebirth to earn more' : undefined, t: 1.2 }; else Audio_.ui(); return true }
  if (k === 'respec') { if (respec()) G.banner = { text: 'Skills reset', t: 1.2 }; else G.banner = { text: 'Need ' + RESPEC_GEMS + ' gems', t: 1.2 }; return true }
  if (k.startsWith('chest_')) {
    const r = openChest(+k.slice(6)); if (r) { R.reveal = { id: r.sold ? -1 : r.item.id, tier: +k.slice(6), sold: r.sold, phase: 0, t: 0 }; if (r.item.rar >= 2) R.reveal.t = 0; Audio_.ui() } else G.banner = { text: 'No chests', sub: 'Chests drop from bosses, login streaks and raids', t: 1.4 }
    return true
  }
  if (k === 'rv_tap') { if (R.reveal) { R.reveal.phase = 1; R.reveal.t = 0; const it = itemOf(R.reveal.id); if (it && it.rar >= 2) Audio_.fanfare(); else Audio_.coins() } return true }
  if (k === 'rv_equip') { if (R.reveal) { equipItem(R.reveal.id, dogId(R.gearDog)); R.sel = -1 } R.reveal = null; return true }
  if (k === 'rv_keep') { R.reveal = null; return true }
  if (k.startsWith('gt_')) { R.gearDog = +k.slice(3); return true }
  if (k.startsWith('slot_')) { const sl = SLOTS[+k.slice(5)], it = G.gear.find(g => g.on === dogId(R.gearDog) && g.slot === sl); if (it && !unequipItem(it.id)) G.banner = { text: 'Inventory full', t: 1 }; return true }
  if (k.startsWith('inv_')) { const it = G.gear.filter(g => g.on < 0)[+k.slice(4)]; R.sel = it ? it.id : -1; return true }
  if (k === 'rv_equipsel') { if (R.sel >= 0) equipItem(R.sel, dogId(R.gearDog)); R.sel = -1; return true }
  if (k === 'sellsel') { if (R.sel >= 0) { const g = sellItem(R.sel); G.banner = { text: '+' + fmt(g) + ' gold', t: 1 } } R.sel = -1; return true }
  return false
}
registerTile({ id: 'gear', label: 'Gear', sub: () => { const c = G.chests[0] + G.chests[1] + G.chests[2]; return c ? c + ' chest' + (c > 1 ? 's' : '') + ' to open' : 'Collars, vests, charms' }, icon: 'collar', col: '#ffb347', badge: () => G.chests[0] + G.chests[1] + G.chests[2] > 0 })

// ================= Login streak + weekly modifier =================
import { LOGIN_REWARDS, LOGIN_DAYS, canClaimLogin, nextLoginDay, claimLogin } from './sim'
import { weekMod, nextMod, daysLeft } from './weekly'

export function drawLogin(ctx: Ctx, t: number) {
  panel(ctx, 'Login Streak')
  ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '600 13px system-ui,sans-serif'
  ctx.fillText(G.login.streak ? 'Current streak: ' + G.login.streak + (G.login.streak === 1 ? ' day' : ' days') : 'Claim every day to build a streak', W / 2, 64)
  const next = nextLoginDay(), can = canClaimLogin(), tw = 76, th = 96
  LOGIN_REWARDS.forEach((r, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 16 + col * 84 + (row ? 42 : 0), y = 90 + row * (th + 12)
    const wide = i === 6, w = wide ? tw : tw, claimed = can ? i < next : i <= next, isNext = can && i === next
    ctx.fillStyle = claimed ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)'; rr(ctx, x, y, w, th, 13); ctx.fill()
    ctx.strokeStyle = isNext ? '#ffd84a' : wide ? '#ffb347' : 'rgba(255,255,255,.14)'; ctx.lineWidth = isNext ? 2.5 : 1.2; ctx.globalAlpha = isNext ? 0.6 + 0.4 * Math.sin(t * 5) : 1; rr(ctx, x + 1, y + 1, w - 2, th - 2, 13); ctx.stroke(); ctx.globalAlpha = 1
    ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '800 10px system-ui,sans-serif'; ctx.fillText('DAY ' + (i + 1), x + w / 2, y + 14)
    ctx.save(); ctx.translate(x + w / 2, y + 44); ctx.globalAlpha = claimed ? 0.35 : 1
    if (r.chest !== undefined) { ctx.scale(1.5, 1.5); icons.collar(ctx, 0, 0, '#ffb347') } else if (r.gems) { ctx.scale(2, 2); icons.gem(ctx, 0, 0, '#6fd6ff') } else { ctx.scale(2, 2); icons.coin(ctx, 0, 0, '#ffd84a') }
    ctx.restore()
    ctx.fillStyle = claimed ? '#7f929a' : '#fff'; ctx.font = '700 10px system-ui,sans-serif'; ctx.fillText(r.label, x + w / 2, y + 76)
    if (r.chest !== undefined && r.gems) ctx.fillText('+' + r.gems + ' gems', x + w / 2, y + 88)
    if (claimed) { ctx.strokeStyle = '#5be07f'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + w - 22, y + 14); ctx.lineTo(x + w - 17, y + 19); ctx.lineTo(x + w - 9, y + 9); ctx.stroke() }
  })
  void LOGIN_DAYS
  if (can) button(ctx, 'login_claim', W / 2 - 100, 330, 200, 48, { top: '#52d273', bot: '#25994a', label: 'CLAIM DAY ' + (next + 1), size: 16 })
  else { ctx.fillStyle = '#9fb5aa'; ctx.font = '700 14px system-ui,sans-serif'; ctx.fillText('Come back tomorrow for day ' + (((nextLoginDay() + 1) % LOGIN_DAYS) + 1), W / 2, 354) }
  ctx.fillStyle = '#7f929a'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText('Miss a day and the streak starts over at day 1.', W / 2, 410)
}

export function drawWeekly(ctx: Ctx) {
  panel(ctx, 'This Week')
  const m = weekMod(), nx = nextMod()
  ctx.textAlign = 'center'; ctx.fillStyle = m.col; ctx.font = '800 30px system-ui,sans-serif'; ctx.fillText(m.name, W / 2, 130)
  ctx.fillStyle = '#e8f1ec'; ctx.font = '600 15px system-ui,sans-serif'; ctx.fillText(m.desc, W / 2, 168)
  ctx.fillStyle = '#9fb5aa'; ctx.font = '600 13px system-ui,sans-serif'; ctx.fillText(daysLeft() + (daysLeft() === 1 ? ' day' : ' days') + ' left', W / 2, 204)
  ctx.fillStyle = 'rgba(255,255,255,.06)'; rr(ctx, 30, 250, W - 60, 90, 16); ctx.fill()
  ctx.fillStyle = '#7f929a'; ctx.font = '700 11px system-ui,sans-serif'; ctx.fillText('NEXT WEEK', W / 2, 272)
  ctx.fillStyle = nx.col; ctx.font = '800 18px system-ui,sans-serif'; ctx.fillText(nx.name, W / 2, 298); ctx.fillStyle = '#c9d8d0'; ctx.font = '600 12px system-ui,sans-serif'; ctx.fillText(nx.desc, W / 2, 322)
}

registerTile({ id: 'login', label: 'Login Streak', sub: () => canClaimLogin() ? 'Reward ready!' : 'Day ' + G.login.streak, icon: 'gem', col: '#52d273', badge: () => canClaimLogin() })
registerTile({ id: 'weekly', label: 'This Week', sub: () => weekMod().name, icon: 'star', col: '#ffd84a' })

// ================= Skills =================
import { BRANCHES, SKILLS, RESPEC_GEMS, pointsEarned } from './skills'
import { sk, pointsLeft, pointsSpent, buySkill, respec } from './sim'

export function drawSkills(ctx: Ctx) {
  panel(ctx, 'Skill Tree')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffd84a'; ctx.font = '800 20px system-ui,sans-serif'; ctx.fillText('Paw Points: ' + pointsLeft(), W / 2, 66)
  ctx.fillStyle = '#7f929a'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText('Earned ' + pointsEarned(G.best, G.rebirths) + '  (1 per 2 stages of your best run, 3 per Rebirth)', W / 2, 88)
  BRANCHES.forEach((b, i) => button(ctx, 'sb_' + i, 16 + i * 112, 104, 104, 32, { top: R.skillTab === i ? b.col : '#3a4850', bot: R.skillTab === i ? b.col + 'aa' : '#26323a', label: b.name, size: 13 }))
  const br = BRANCHES[R.skillTab], list = SKILLS.filter(s => s.branch === br.id)
  list.forEach((s, i) => {
    const x = 16, y = 148 + i * 86, w = W - 32, h = 78, r = sk(s.id), can = pointsLeft() > 0 && r < s.max
    ctx.fillStyle = 'rgba(255,255,255,.06)'; rr(ctx, x, y, w, h, 14); ctx.fill(); ctx.strokeStyle = r ? br.col : 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '800 14px system-ui,sans-serif'; ctx.fillText(s.name, x + 14, y + 20)
    ctx.fillStyle = '#c9d8d0'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText(s.desc, x + 14, y + 40)
    for (let p = 0; p < s.max; p++) { ctx.fillStyle = p < r ? br.col : 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(x + 20 + p * 18, y + 60, 6, 0, 6.283); ctx.fill() }
    button(ctx, 'sk_' + s.id, x + w - 66, y + 20, 52, 38, { top: can ? '#52d273' : '#4a565d', bot: can ? '#25994a' : '#2f3a40', label: r >= s.max ? 'MAX' : '+', size: r >= s.max ? 11 : 20, disabled: !can })
  })
  button(ctx, 'respec', W / 2 - 90, 504, 180, 34, { top: '#b58cf0', bot: '#6a3fb8', label: 'Respec  (' + RESPEC_GEMS + ' gems)', size: 12, disabled: pointsSpent() === 0 })
}
registerTile({ id: 'skills', label: 'Skill Tree', sub: () => pointsLeft() > 0 ? pointsLeft() + ' points to spend' : 'Fang, Fur, Nose', icon: 'star', col: '#ff9ad8', badge: () => pointsLeft() > 0 })

// ================= Kennel =================
import { drawPlainDog } from './render'
export function drawKennel(ctx: Ctx) {
  panel(ctx, 'Kennel')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffd84a'; ctx.font = '800 16px system-ui,sans-serif'; ctx.fillText('Dungeon Coins: ' + G.coins, W / 2, 62)
  const un = unlockedGuardians(G.stage)
  for (let k = 0; k < 2; k++) {
    const x = 16 + k * 170, y = 78, w = 158, h = 62, r = G.squad[k], d = ROSTER[r], sel = R.kSlot === k
    button(ctx, 'ks_' + k, x, y, w, h, { top: sel ? '#3d5a6a' : '#2a3841', bot: sel ? '#27404d' : '#1a262d' })
    if (sel) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; rr(ctx, x + 1, y + 1, w - 2, h - 2, 14); ctx.stroke() }
    ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 2, 46, h - 4); ctx.clip(); drawPlainDog(ctx, d, x + 28, y + 36, 0); ctx.restore()
    ctx.textAlign = 'left'; ctx.fillStyle = '#9fb5aa'; ctx.font = '700 9px system-ui,sans-serif'; ctx.fillText('SUPPORT SLOT ' + (k + 1), x + 54, y + 14)
    ctx.fillStyle = '#fff'; ctx.font = '800 14px system-ui,sans-serif'; ctx.fillText(d.n, x + 54, y + 30)
    ctx.fillStyle = un > 2 + k ? '#7af09a' : '#ff9a7a'; ctx.font = '700 10px system-ui,sans-serif'; ctx.fillText(un > 2 + k ? d.role : 'Unlocks stage ' + (5 + 5 * k), x + 54, y + 47)
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#7f929a'; ctx.font = '600 10px system-ui,sans-serif'; ctx.fillText('Rudy and Cooper always lead. Pick a slot, then tap a dog.', W / 2, 152)
  for (let r = 2; r < ROSTER.length; r++) {
    const d = ROSTER[r], i = r - 2, x = 16, y = 164 + i * 51, w = W - 32, h = 46, owned = G.owned.includes(r), inSlot = G.squad.indexOf(r), can = G.coins >= (d.cost ?? 0)
    button(ctx, 'kd_' + r, x, y, w, h, { top: inSlot >= 0 ? '#34513f' : owned ? '#2e3e48' : '#252f36', bot: inSlot >= 0 ? '#22382b' : owned ? '#1a2830' : '#1b2328' })
    ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 1, 44, h - 2); ctx.clip(); ctx.globalAlpha = owned ? 1 : 0.55; drawPlainDog(ctx, d, x + 24, y + 29, 0); ctx.restore()
    ctx.textAlign = 'left'; ctx.fillStyle = owned ? '#fff' : '#b8c6cc'; ctx.font = '800 13px system-ui,sans-serif'; ctx.fillText(d.n + '  \u00b7  ' + d.breed, x + 52, y + 15)
    ctx.fillStyle = owned ? '#ffd84a' : '#8fa0a8'; ctx.font = '600 10px system-ui,sans-serif'; ctx.fillText(d.perkText ?? '', x + 52, y + 32)
    ctx.textAlign = 'right'; ctx.font = '800 11px system-ui,sans-serif'
    if (inSlot >= 0) { ctx.fillStyle = '#7af09a'; ctx.fillText('SLOT ' + (inSlot + 1), x + w - 10, y + 15) }
    else if (owned) { ctx.fillStyle = '#9fd0ff'; ctx.fillText('SELECT', x + w - 10, y + 15) }
    else { ctx.fillStyle = can ? '#ffd84a' : '#ff8a7a'; ctx.fillText((d.cost ?? 0) + ' coins', x + w - 10, y + 15) }
  }
  void pk
}
registerTile({ id: 'kennel', label: 'Kennel', sub: () => G.coins + ' coins', icon: 'coin', col: '#ffb347', badge: () => ROSTER.some((d, r) => r >= 2 && !G.owned.includes(r) && G.coins >= (d.cost ?? 1e9)) })

// ================= Boss Raid =================
export function drawRaid(ctx: Ctx) {
  const res = G.raid?.result
  panel(ctx, 'Boss Raid', !res)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const base = raidBase()
  if (res) {
    const t = res.tier, col = t >= 0 ? RAID.cols[t] : '#7f929a'
    ctx.fillStyle = col; ctx.font = '800 30px system-ui,sans-serif'; ctx.fillText(t >= 0 ? RAID.names[t].toUpperCase() : 'NO TIER', W / 2, 100)
    ctx.fillStyle = '#fff'; ctx.font = '800 40px system-ui,sans-serif'; ctx.fillText(fmt(res.dmg), W / 2, 150)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '700 12px system-ui,sans-serif'; ctx.fillText(res.best ? 'NEW PERSONAL BEST!' : 'Total damage  \u00b7  Best ' + fmt(G.raidInfo.best), W / 2, 182)
    ctx.fillStyle = '#ffd84a'; ctx.font = '800 22px system-ui,sans-serif'; ctx.fillText('+' + res.coins + ' Dungeon Coins', W / 2, 240)
    if (res.chest >= 0) { ctx.fillStyle = '#9fd0ff'; ctx.fillText('+1 ' + CHEST_NAMES[res.chest], W / 2, 276) }
    const nx = RAID.tiers.findIndex(m => res.dmg < base * m)
    ctx.fillStyle = '#7f929a'; ctx.font = '600 12px system-ui,sans-serif'
    if (nx >= 0) ctx.fillText(fmt(base * RAID.tiers[nx] - res.dmg) + ' more damage for ' + RAID.names[nx], W / 2, 330); else ctx.fillText('Top tier cleared!', W / 2, 330)
    ctx.fillText('The stage restarts when you continue.', W / 2, 352)
    button(ctx, 'raid_done', W / 2 - 100, 400, 200, 48, { top: '#52d273', bot: '#25994a', label: 'CONTINUE', size: 16 })
    return
  }
  ctx.fillStyle = '#ff9ad8'; ctx.font = '800 14px system-ui,sans-serif'; ctx.fillText('Hit the boss as hard as you can for ' + RAID.dur + ' seconds', W / 2, 66)
  ctx.fillStyle = '#9fb5aa'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText('Adds and boss shells hit back. Use your abilities. Gold is off in raids.', W / 2, 86)
  // tier table
  RAID.names.forEach((n, k) => {
    const y = 112 + k * 50, hit = G.raidInfo.best >= base * RAID.tiers[k]
    ctx.fillStyle = 'rgba(255,255,255,.06)'; rr(ctx, 16, y, W - 32, 44, 12); ctx.fill(); ctx.strokeStyle = hit ? RAID.cols[k] : 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5; rr(ctx, 16.75, y + 0.75, W - 33.5, 42.5, 12); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = RAID.cols[k]; ctx.font = '800 14px system-ui,sans-serif'; ctx.fillText(n, 30, y + 16)
    ctx.fillStyle = '#c9d8d0'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText(fmt(base * RAID.tiers[k]) + ' damage', 30, y + 32)
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd84a'; ctx.font = '800 12px system-ui,sans-serif'; ctx.fillText(RAID.coins[k] + ' coins' + (RAID.chest[k] >= 0 ? '  +  ' + CHEST_NAMES[RAID.chest[k]].split(' ')[0] + ' chest' : ''), W - 30, y + 24)
  })
  ctx.textAlign = 'center'; ctx.fillStyle = '#c9d8d0'; ctx.font = '700 12px system-ui,sans-serif'; ctx.fillText('Best: ' + fmt(G.raidInfo.best) + (G.raidInfo.best ? '  (' + (raidTier(G.raidInfo.best) >= 0 ? RAID.names[raidTier(G.raidInfo.best)] : 'no tier') + ')' : ''), W / 2, 326)
  ctx.fillStyle = '#7f929a'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText('Targets scale with your current stage (' + G.stage + ').', W / 2, 346)
  const left = raidLeft()
  button(ctx, 'raid_go', W / 2 - 110, 372, 220, 54, { top: left ? '#ff7a5a' : '#4a565d', bot: left ? '#c42f2f' : '#2f3a40', label: left ? 'START RAID  (' + left + ' left today)' : 'No attempts left', size: 15, disabled: !left })
  button(ctx, 'raid_ad', W / 2 - 110, 436, 220, 38, { top: '#b58cf0', bot: '#6a3fb8', label: 'Watch an ad: +1 attempt', size: 12 })
}
registerTile({ id: 'raid', label: 'Boss Raid', sub: () => raidLeft() + ' attempts today', icon: 'sword', col: '#ff6a5a', badge: () => raidLeft() > 0 })
