/** Full-screen menu panels (hub and its sub-screens). All draw over a dimmed game and register their own buttons. */
import { W, H, GUARDIANS, ROSTER, unlockedGuardians } from './data'
import { CLANS, PERKS, MILESTONES, clanById, clanLevel, XP_PER_LEVEL, onlineCount, onlineSet, mates, clanHunt } from './clan'
import { unlocked, unlockStage, doSpin, spinsLeft, claimPassTier, claimAch, passLevel, passReady, achReady, statValue, ensurePass } from './sim'
import { ACHIEVEMENTS, PASS_TIERS, PASS_XP, SPIN_SEGS, seasonDaysLeft, passReward } from './meta'
import type { Reward } from './meta'
import { joinClan, leaveClan, clanPool, claimMilestone, claimClanGift, canClanGift, clanClaimable, milestoneReady, cp } from './sim'
import { G, questReady, dogId, buyDog, setSquad, pk, RAID, raidBase, raidLeft, raidTier, startRaid, closeRaid } from './sim'
import { R, button, rr, icons, fmt, OUT, plate, outText, FONT } from './render'
import type { Ctx } from './render'
import { BOOST } from './sim'
import { IAP } from './iap'
import { adsLeft } from './ads'
import { TRAIN, tl, trainCost, buyTrain, trainAffordable } from './sim'
import { LB, refresh, chooseName, nameChosen, nameOptions, shuffleNames, playerName, playerId } from './leaderboard'

const mix = (a: string, b: string, k: number) => { const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); return '#' + [0, 1, 2].map(i => Math.round(p(a, i) * (1 - k) + p(b, i) * k).toString(16).padStart(2, '0')).join('') }
export interface Tile { id: string; label: string; sub: () => string; icon: string; col: string; badge?: () => boolean }
/** Hub tiles. Later features append here. */
export const TILES: Tile[] = []
export const registerTile = (t: Tile) => { TILES.push(t) }

export function panel(ctx: Ctx, title: string, back = true) {
  R.btns = {}
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#13222c'); bg.addColorStop(1, '#0a1218')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 10; for (let x = -H; x < W + 40; x += 34) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke() } ctx.restore()
  const vg = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 460); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
  plate(ctx, 8, 40, W - 16, 540, 20, 'rgba(34,52,64,.55)', 'rgba(12,20,26,.65)')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = '400 22px ' + FONT; const tw = ctx.measureText(title).width + 56, tx = W / 2 - tw / 2
  const g = ctx.createLinearGradient(0, 10, 0, 46); g.addColorStop(0, '#ffd24a'); g.addColorStop(1, '#e8741a')
  ctx.fillStyle = g; rr(ctx, tx, 10, tw, 36, 12); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; rr(ctx, tx, 10, tw, 36, 12); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(ctx, tx + 4, 13, tw - 8, 12, 9); ctx.fill()
  outText(ctx, title, W / 2, 28.5, '#fff', 5)
  button(ctx, 'scr_x', W - 44, 8, 34, 34, { top: '#ff7a6a', bot: '#c42f2f', label: 'X', size: 15, round: true })
  button(ctx, 'scr_close', W / 2 - 60, H - 52, 120, 38, { top: '#6f8794', bot: '#3f525d', label: back ? 'Back' : 'Close', size: 14 })
}

/** `main` tiles are the things you reach for every session: big, bright, pulsing when there is something to do. `minor` tiles are smaller, tucked at the bottom. */
export const HUB_SECTIONS: { id: string; label: string; col: string; main: string[]; minor: string[]; tiles: string[] }[] = ([
  { id: 'battle', label: 'Battle', col: '#ff6a5a', main: ['raid', 'auto', 'weekly'], minor: ['stats'] },
  { id: 'grow', label: 'Grow', col: '#ff9a3a', main: ['gear', 'train', 'skills', 'kennel'], minor: ['rebirth'] },
  { id: 'rewards', label: 'Rewards', col: '#52d273', main: ['boost', 'quests', 'login', 'spin'], minor: ['pass', 'ach'] },
  { id: 'more', label: 'More', col: '#5ab8ff', main: ['rank', 'clan', 'help'], minor: ['noads', 'savedata', 'tour', 'privacy'] },
] as { id: string; label: string; col: string; main: string[]; minor: string[] }[]).map(x => ({ ...x, tiles: [...x.main, ...x.minor] }))
const MINOR_LABEL: Record<string, string> = { privacy: 'Privacy', savedata: 'Save Data', noads: 'No Ads', tour: 'Tour', help: 'Help', weekly: 'Weekly', stats: 'Stats', pass: 'Season Pass', ach: 'Awards', rebirth: 'Rebirth' }
const tileLive = (id: string) => { const tl = TILES.find(x => x.id === id); return !!tl && unlocked(id) && !!tl.badge?.() }
const sectionBadge = (sec: { tiles: string[] }) => sec.tiles.some(tileLive)

export function drawHub(ctx: Ctx, t: number) {
  panel(ctx, 'Menu', false)
  if (R.hubTab == null) R.hubTab = Math.max(0, HUB_SECTIONS.findIndex(sec => sectionBadge(sec)))
  const sec = HUB_SECTIONS[R.hubTab] ?? HUB_SECTIONS[0]
  // section tabs
  const n = HUB_SECTIONS.length, tg = 6, tabW = (W - 32 - tg * (n - 1)) / n
  HUB_SECTIONS.forEach((s, i) => {
    const x = 16 + i * (tabW + tg), on = i === R.hubTab
    button(ctx, 'hub_tab' + i, x, 54, tabW, 38, on ? { top: mix(s.col, '#ffffff', 0.15), bot: mix(s.col, '#101820', 0.35), label: s.label, size: 14 } : { top: '#4a5c66', bot: '#2a3840', label: s.label, size: 13 })
    if (!on && sectionBadge(s)) { ctx.fillStyle = '#ff5a46'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + tabW - 8, 62 + Math.sin(t * 5) * 0.8, 6, 0, 6.283); ctx.fill(); ctx.stroke() }
  })
  // main tiles: big and bright; minor tiles: compact pills anchored at the bottom
  const find = (ids: string[]) => ids.map(id => TILES.find(x => x.id === id)).filter((x): x is Tile => !!x)
  const mainL = find(sec.main), minorL = find(sec.minor)
  const mc = 3, mh = 44, mg = 8, mrows = Math.ceil(minorL.length / mc), minorTop = 574 - mrows * (mh + mg) + mg
  const gap = 10, tw = (W - 16 * 2 - gap) / 2, hero = mainL.length % 2 === 1, rows = Math.ceil((mainL.length + (hero ? 1 : 0)) / 2), avail = minorTop - 30 - 106
  const th = Math.min(170, (avail - (rows - 1) * 10) / rows)
  mainL.forEach((tl, i) => {
    const j = hero ? i + 1 : i, isHero = hero && i === 0, tw2 = isHero ? W - 32 : tw
    const x = isHero ? 16 : 16 + (j % 2) * (tw + gap), y = 106 + Math.floor(j / 2) * (th + 10), lock = !unlocked(tl.id), need = unlockStage(tl.id), live = !lock && !!tl.badge?.()
    if (live) { const k = 0.5 + 0.5 * Math.sin(t * 5); ctx.strokeStyle = 'rgba(255,230,120,' + (0.35 + 0.5 * k) + ')'; ctx.lineWidth = 3.5; rr(ctx, x - 3, y - 3, tw2 + 6, th + 6, 16); ctx.stroke() }
    button(ctx, 'nav_' + tl.id, x, y, tw2, th, lock ? { top: '#4a545a', bot: '#2a3238' } : { top: mix(tl.col, '#ffffff', 0.05), bot: mix(tl.col, '#101820', 0.5) })
    const cy = y + th * 0.38
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(x + tw2 / 2, cy, 29, 0, 6.283); ctx.fill()
    ctx.save(); ctx.translate(x + tw2 / 2, cy); ctx.scale(2.4, 2.4); ctx.globalAlpha = lock ? 0.35 : 1; icons[tl.icon]?.(ctx, 0, 0, lock ? '#cfd8dc' : '#ffffff'); ctx.restore()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '400 18px ' + FONT; outText(ctx, tl.label, x + tw2 / 2, y + th - 36, lock ? '#b8c4ca' : '#fff', 3.5)
    ctx.font = '400 12px ' + FONT; ctx.fillStyle = lock ? '#ffd84a' : '#f2fff6'
    let sub = lock ? 'Unlocks at stage ' + need : tl.sub(); while (sub.length > 4 && ctx.measureText(sub).width > tw2 - 12) sub = sub.slice(0, -2)
    ctx.fillText(sub, x + tw2 / 2, y + th - 16)
    if (live) { ctx.fillStyle = '#ff5a46'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + tw2 - 12, y + 14 + Math.sin(t * 5) * 0.8, 8, 0, 6.283); ctx.fill(); ctx.stroke() }
  })
  if (minorL.length) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '400 10px ' + FONT; ctx.fillStyle = '#7f929a'; ctx.fillText('MORE', 18, minorTop - 12)
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(52, minorTop - 12, W - 68, 1)
    const sw = (W - 32 - mg * (mc - 1)) / mc
    minorL.forEach((tl, i) => {
      const x = 16 + (i % mc) * (sw + mg), y = minorTop + Math.floor(i / mc) * (mh + mg), lock = !unlocked(tl.id), live = !lock && !!tl.badge?.()
      button(ctx, 'nav_' + tl.id, x, y, sw, mh, lock ? { top: '#3e484e', bot: '#262d32' } : { top: mix(tl.col, '#101820', 0.55), bot: mix(tl.col, '#101820', 0.8) })
      ctx.save(); ctx.translate(x + 17, y + mh / 2); ctx.scale(1.1, 1.1); ctx.globalAlpha = lock ? 0.35 : 0.95; icons[tl.icon]?.(ctx, 0, 0, lock ? '#cfd8dc' : mix(tl.col, '#ffffff', 0.5)); ctx.restore()
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '400 11px ' + FONT
      let lab = MINOR_LABEL[tl.id] ?? tl.label; while (lab.length > 3 && ctx.measureText(lab).width > sw - 40) lab = lab.slice(0, -1)
      ctx.fillStyle = lock ? '#8e9aa0' : '#e8f2ee'; ctx.fillText(lab, x + 32, y + mh / 2 - (lock ? 5 : 0))
      if (lock) { ctx.font = '400 9px ' + FONT; ctx.fillStyle = '#ffd84a'; ctx.fillText('Stage ' + unlockStage(tl.id), x + 32, y + mh / 2 + 8) }
      if (live) { ctx.fillStyle = '#ff5a46'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + sw - 9, y + 9, 5.5, 0, 6.283); ctx.fill(); ctx.stroke() }
    })
  }
}

/** Damage breakdown: who is carrying, what the abilities add, what the pack absorbed. */
export function drawStats(ctx: Ctx) {
  panel(ctx, 'Damage Breakdown')
  const n = unlockedGuardians(G.stage), st = G.stats
  const total = st.dealt.slice(0, n).reduce((a, b) => a + b, 0) + st.nade
  ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('This run (resets on Rebirth)', W / 2, 60)
  ctx.fillStyle = '#ffd84a'; ctx.font = '400 26px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(fmt(total) + ' total', W / 2, 90)
  const rows: { name: string; v: number; col: string; taken?: number }[] = []
  for (let i = 0; i < n; i++) rows.push({ name: GUARDIANS[i].n, v: st.dealt[i], col: i < 2 ? '#ffb347' : '#6fb8ff', taken: st.taken[i] })
  rows.push({ name: 'Grenade ability', v: st.nade, col: '#ff7a4a' })
  const mx = Math.max(1, ...rows.map(r => r.v))
  let y = 118
  ctx.textAlign = 'left'
  for (const r of rows) {
    ctx.fillStyle = '#fff'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(r.name, 20, y)
    ctx.textAlign = 'right'; ctx.fillStyle = '#d6e4dc'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(fmt(r.v) + (total ? '  ' + Math.round(r.v / total * 100) + '%' : ''), W - 20, y); ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, 20, y + 9, W - 40, 10, 5); ctx.fill()
    if (r.v > 0) { ctx.fillStyle = r.col; rr(ctx, 20, y + 9, Math.max(6, (W - 40) * r.v / mx), 10, 5); ctx.fill() }
    y += 40
  }
  y += 4
  ctx.fillStyle = '#fff'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Bonuses and defense', 20, y); y += 24
  const lines: [string, string][] = [['Flanking bonus damage', fmt(st.flank)], ['Absorbed by your cover', fmt(st.cover)], ['Blocked by Shield', fmt(st.shield)]]
  for (let i = 0; i < n; i++) lines.push(['Taken by ' + GUARDIANS[i].n, fmt(st.taken[i])])
  for (const [k, v] of lines) { ctx.fillStyle = '#c9d8d0'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(k, 20, y); ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(v, W - 20, y); y += 21 }
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
    case 'clan': drawClan(ctx); break
    case 'auto': drawAuto(ctx); break
    case 'pass': drawPass(ctx); break
    case 'ach': drawAch(ctx); break
    case 'rank': drawRank(ctx); break
    case 'train': drawTrain(ctx); break
    case 'spin': drawSpin(ctx); break
    case 'boost': drawBoost(ctx); break
    case 'noads': drawNoAds(ctx); break
    default: drawHub(ctx, t)
  }
}

// ================= Gear =================
import { SLOTS, RARITY, CHEST_NAMES, CHEST_COLS, INV_MAX, itemName, fmtStat, fmtShort, fmtSubs } from './gear'
import type { Item } from './gear'
import { autoEquip, openChest, equipItem, unequipItem, sellItem, sellValue, invCount } from './sim'
import { Audio_ } from './audio'

const itemOf = (id: number) => G.gear.find(x => x.id === id)
function itemIcon(ctx: Ctx, it: Item, x: number, y: number, s: number) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); icons[it.slot](ctx, 0, 0, RARITY[it.rar].col); ctx.restore() }
function itemCard(ctx: Ctx, x: number, y: number, w: number, h: number, it: Item | null, sel: boolean, label?: string) {
  const col = it ? RARITY[it.rar].col : 'rgba(255,255,255,.18)'
  ctx.fillStyle = it ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)'; rr(ctx, x, y, w, h, 11); ctx.fill()
  ctx.strokeStyle = col; ctx.lineWidth = sel ? 3 : 1.5; rr(ctx, x + 1, y + 1, w - 2, h - 2, 11); ctx.stroke()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  if (it) { itemIcon(ctx, it, x + w / 2, y + h * 0.36, 1.25); ctx.fillStyle = '#fff'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(fmtShort(it), x + w / 2, y + h - 11); if (it.subs) { ctx.fillStyle = RARITY[it.rar].col; for (let k = 0; k < it.subs.length; k++) { ctx.beginPath(); ctx.arc(x + w - 9 - k * 8, y + 9, 2.6, 0, 6.283); ctx.fill() } } }
  else { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(label ?? 'empty', x + w / 2, y + h / 2) }
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
    chestIcon(ctx, x + 24, 72, 0.75, k); ctx.textAlign = 'left'; ctx.fillStyle = c ? '#fff' : '#7f929a'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(CHEST_NAMES[k].split(' ')[0], x + 46, 66); ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillStyle = c ? CHEST_COLS[k] : '#7f929a'; ctx.fillText('x' + c + (c ? '  OPEN' : ''), x + 46, 82)
  }
  for (let i = 0; i < n; i++) button(ctx, 'gt_' + i, 16 + i * 84, 106, 78, 28, { top: i === R.gearDog ? '#ffb347' : '#3a4850', bot: i === R.gearDog ? '#e0731a' : '#26323a', label: GUARDIANS[i].n, size: 12 })
  const dog = dogId(R.gearDog)
  SLOTS.forEach((sl, k) => { const x = 16 + k * 112, it = G.gear.find(g => g.on === dog && g.slot === sl) ?? null; R.btns['slot_' + k] = { x, y: 142, w: 104, h: 74 }; itemCard(ctx, x, 142, 104, 74, it, false, sl.toUpperCase()) })
  ctx.textAlign = 'left'; ctx.fillStyle = '#8fa69b'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('INVENTORY  ' + invCount() + '/' + INV_MAX + '  (tap an item)', 16, 228)
  const inv = G.gear.filter(g => g.on < 0)
  for (let k = 0; k < INV_MAX; k++) { const x = 16 + (k % 4) * 84, y = 238 + Math.floor(k / 4) * 62, it = inv[k] ?? null; R.btns['inv_' + k] = { x, y, w: 76, h: 56 }; itemCard(ctx, x, y, 76, 56, it, !!it && it.id === R.sel, '') }
  const sel = itemOf(R.sel)
  const py = 490
  ctx.fillStyle = 'rgba(255,255,255,.05)'; rr(ctx, 16, py, W - 32, 88, 14); ctx.fill()
  if (sel) {
    const F = '"Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
    ctx.textAlign = 'left'; ctx.fillStyle = RARITY[sel.rar].col; ctx.font = '400 13px ' + F; ctx.fillText(itemName(sel), 28, py + 15)
    ctx.fillStyle = '#d6e4dc'; ctx.font = '400 11px ' + F; ctx.fillText(fmtStat(sel), 28, py + 31)
    ctx.fillStyle = RARITY[sel.rar].col; ctx.font = '400 10px ' + F; fmtSubs(sel).forEach((l, k) => ctx.fillText(l, 28, py + 45 + k * 13))
    const cur = G.gear.find(g => g.on === dog && g.slot === sel.slot)
    if (cur && sel.on < 0) { const d = (sel.val - cur.val) * 100; ctx.font = '400 10px ' + F; ctx.fillStyle = cur.stat === sel.stat ? (d >= 0 ? '#5be07f' : '#ff8a7a') : '#9fb5aa'; ctx.fillText(cur.stat === sel.stat ? (d >= 0 ? '+' : '') + d.toFixed(Math.abs(d) < 1 ? 2 : 1) + '% vs worn' : 'different from worn', 28, py + 78) }
    if (sel.on < 0) button(ctx, 'rv_equipsel', 150, py + 48, 94, 34, { top: '#52d273', bot: '#25994a', label: 'Equip', size: 13 })
    button(ctx, 'sellsel', sel.on < 0 ? 250 : 150, py + 48, sel.on < 0 ? 94 : 194, 34, { top: '#e0b24a', bot: '#9a6a18', label: 'Sell ' + fmt(sellValue(sel)), size: 12 })
  } else { ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Tap an item to compare, or let the pack pick:', W / 2, py + 22); button(ctx, 'gear_auto', 70, py + 36, 220, 40, { top: '#52d273', bot: '#25994a', label: 'AUTO-EQUIP BEST', size: 14 }) }
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
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '400 20px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(CHEST_NAMES[rv.tier], W / 2, 150)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Tap to open', W / 2, 400)
    R.btns.rv_tap = { x: 0, y: 0, w: W, h: H }
  } else {
    const col = it ? RARITY[it.rar].col : '#ffd84a'
    const g = ctx.createRadialGradient(W / 2, 250, 10, W / 2, 250, 170); g.addColorStop(0, col + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 60, W, 400)
    chestIcon(ctx, W / 2, 120, 1.6, rv.tier, Math.min(1, rv.t * 3))
    if (it) {
      ctx.save(); ctx.translate(W / 2, 250); ctx.scale(5, 5); icons[it.slot](ctx, 0, 0, col); ctx.restore()
      ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = '400 22px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(RARITY[it.rar].n.toUpperCase(), W / 2, 330)
      ctx.fillStyle = '#fff'; ctx.font = '400 18px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(itemName(it), W / 2, 362); ctx.fillStyle = '#d6e4dc'; ctx.font = '400 15px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(fmtStat(it), W / 2, 390); ctx.fillStyle = col; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; fmtSubs(it).forEach((l, k) => ctx.fillText(l, W / 2, 410 + k * 17))
      button(ctx, 'rv_equip', 50, 440, 260, 46, { top: '#52d273', bot: '#25994a', label: 'Equip on ' + GUARDIANS[R.gearDog].n, size: 15 })
      button(ctx, 'rv_keep', 90, 498, 180, 38, { top: '#5b6c75', bot: '#3a4850', label: 'Keep', size: 13 })
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd84a'; ctx.font = '400 18px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Inventory full: sold for ' + fmt(rv.sold) + ' gold', W / 2, 300)
      button(ctx, 'rv_keep', 90, 440, 180, 40, { top: '#5b6c75', bot: '#3a4850', label: 'OK', size: 14 })
    }
  }
}

/** Buttons owned by the gear screens. Returns true if the key was handled. */
export function screenButton(k: string): boolean {
  if (k.startsWith('cj_')) { const d = CLANS[+k.slice(3)]; if (joinClan(d.id)) { G.banner = { text: 'Joined ' + d.name, sub: 'Contribute by clearing stages and raiding', t: 1.8 }; Audio_.fanfare() } else G.banner = { text: 'Reach stage ' + d.req, sub: 'to join ' + d.name, t: 1.4 }; return true }
  if (k === 'ct_0' || k === 'ct_1') { R.clanTab = +k.slice(3); return true }
  if (k.startsWith('cm_')) { if (claimMilestone(+k.slice(3))) { G.banner = { text: 'Clan reward claimed', sub: MILESTONES[+k.slice(3)].text, t: 1.6 }; Audio_.coins() } return true }
  if (k === 'cgift') { const c = claimClanGift(); if (c) { G.banner = { text: '+' + c + ' Dungeon Coins', sub: 'Treats from your clanmates', t: 1.6 }; Audio_.coins() } return true }
  if (k === 'cleave') { if (R.leaveArm) { leaveClan(); R.leaveArm = false } else R.leaveArm = true; return true }
  if (k === 'spin_go') { if (!R.spinAnim && spinsLeft().free) startSpin(false); return true }
  if (k === 'spin_ok') { R.spinAnim = null; return true }
  if (k.startsWith('pt_')) { if (claimPassTier(+k.slice(3))) { G.banner = { text: 'Season reward', sub: rewardText(passReward(+k.slice(3))), t: 1.4 }; Audio_.coins() } return true }
  if (k === 'pass_all') { let n = 0; for (let x = 1; x <= PASS_TIERS; x++) if (claimPassTier(x)) n++; if (n) { G.banner = { text: n + ' rewards claimed', t: 1.4 }; Audio_.coins() } return true }
  if (k.startsWith('ac_')) { const a = ACHIEVEMENTS.find(x => x.id === k.slice(3)); if (a && claimAch(a.id)) { G.banner = { text: 'Achievement!', sub: a.text + '  +' + a.gems + ' gems', t: 1.6 }; Audio_.fanfare() } return true }
  if (k.startsWith('tr_')) { if (buyTrain(k.slice(3))) Audio_.merge(1); else G.banner = { text: 'Not enough gold', t: 0.9 }; return true }
  if (k === 'lb_refresh') { void refresh(); return true }
  if (k === 'lb_shuffle') { shuffleNames(); return true }
  if (k.startsWith('lb_pick')) { chooseName(+k.slice(7)); void refresh(); return true }
  if (k === 'ach_prev') { R.achPage = Math.max(0, R.achPage - 1); return true }
  if (k === 'ach_next') { R.achPage = Math.min(Math.ceil(ACHIEVEMENTS.length / 7) - 1, R.achPage + 1); return true }
  if (k.startsWith('au_')) { const key = k.slice(3) as keyof typeof G.auto; G.auto[key] = !G.auto[key]; return true }
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
  if (k === 'gear_auto') { const m = autoEquip(); G.banner = { text: m ? 'GEAR UPDATED' : 'Already the best set', t: 1.3 }; R.sel = -1; return true }
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
  ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
  ctx.fillText(G.login.streak ? 'Current streak: ' + G.login.streak + (G.login.streak === 1 ? ' day' : ' days') : 'Claim every day to build a streak', W / 2, 64)
  const next = nextLoginDay(), can = canClaimLogin(), tw = 76, th = 96
  LOGIN_REWARDS.forEach((r, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 16 + col * 84 + (row ? 42 : 0), y = 90 + row * (th + 12)
    const wide = i === 6, w = wide ? tw : tw, claimed = can ? i < next : i <= next, isNext = can && i === next
    ctx.fillStyle = claimed ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)'; rr(ctx, x, y, w, th, 13); ctx.fill()
    ctx.strokeStyle = isNext ? '#ffd84a' : wide ? '#ffb347' : 'rgba(255,255,255,.14)'; ctx.lineWidth = isNext ? 2.5 : 1.2; ctx.globalAlpha = isNext ? 0.6 + 0.4 * Math.sin(t * 5) : 1; rr(ctx, x + 1, y + 1, w - 2, th - 2, 13); ctx.stroke(); ctx.globalAlpha = 1
    ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('DAY ' + (i + 1), x + w / 2, y + 14)
    ctx.save(); ctx.translate(x + w / 2, y + 44); ctx.globalAlpha = claimed ? 0.35 : 1
    if (r.chest !== undefined) { ctx.scale(1.5, 1.5); icons.collar(ctx, 0, 0, '#ffb347') } else if (r.gems) { ctx.scale(2, 2); icons.gem(ctx, 0, 0, '#6fd6ff') } else { ctx.scale(2, 2); icons.coin(ctx, 0, 0, '#ffd84a') }
    ctx.restore()
    ctx.fillStyle = claimed ? '#7f929a' : '#fff'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(r.label, x + w / 2, y + 76)
    if (r.chest !== undefined && r.gems) ctx.fillText('+' + r.gems + ' gems', x + w / 2, y + 88)
    if (claimed) { ctx.strokeStyle = '#5be07f'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + w - 22, y + 14); ctx.lineTo(x + w - 17, y + 19); ctx.lineTo(x + w - 9, y + 9); ctx.stroke() }
  })
  void LOGIN_DAYS
  if (can) button(ctx, 'login_claim', W / 2 - 100, 330, 200, 48, { top: '#52d273', bot: '#25994a', label: 'CLAIM DAY ' + (next + 1), size: 16 })
  else { ctx.fillStyle = '#9fb5aa'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Come back tomorrow for day ' + (((nextLoginDay() + 1) % LOGIN_DAYS) + 1), W / 2, 354) }
  ctx.fillStyle = '#7f929a'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Miss a day and the streak starts over at day 1.', W / 2, 410)
}

export function drawWeekly(ctx: Ctx) {
  panel(ctx, 'This Week')
  const m = weekMod(), nx = nextMod()
  ctx.textAlign = 'center'; ctx.fillStyle = m.col; ctx.font = '400 30px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(m.name, W / 2, 130)
  ctx.fillStyle = '#e8f1ec'; ctx.font = '400 15px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(m.desc, W / 2, 168)
  ctx.fillStyle = '#9fb5aa'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(daysLeft() + (daysLeft() === 1 ? ' day' : ' days') + ' left', W / 2, 204)
  plate(ctx, 30, 250, W - 60, 90, 16)
  ctx.fillStyle = '#7f929a'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('NEXT WEEK', W / 2, 272)
  ctx.fillStyle = nx.col; ctx.font = '400 18px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(nx.name, W / 2, 298); ctx.fillStyle = '#c9d8d0'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(nx.desc, W / 2, 322)
}

registerTile({ id: 'login', label: 'Login Streak', sub: () => canClaimLogin() ? 'Reward ready!' : 'Day ' + G.login.streak, icon: 'gem', col: '#52d273', badge: () => canClaimLogin() })
registerTile({ id: 'weekly', label: 'This Week', sub: () => weekMod().name, icon: 'star', col: '#ffd84a' })

// ================= Skills =================
import { BRANCHES, SKILLS, RESPEC_GEMS, pointsEarned } from './skills'
import { sk, pointsLeft, pointsSpent, buySkill, respec } from './sim'

export function drawSkills(ctx: Ctx) {
  panel(ctx, 'Skill Tree')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffd84a'; ctx.font = '400 20px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Paw Points: ' + pointsLeft(), W / 2, 66)
  ctx.fillStyle = '#7f929a'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Earned ' + pointsEarned(G.best, G.rebirths) + '  (1 per 2 stages of your best run, 3 per Rebirth)', W / 2, 88)
  BRANCHES.forEach((b, i) => button(ctx, 'sb_' + i, 16 + i * 112, 104, 104, 32, { top: R.skillTab === i ? b.col : '#3a4850', bot: R.skillTab === i ? b.col + 'aa' : '#26323a', label: b.name, size: 13 }))
  const br = BRANCHES[R.skillTab], list = SKILLS.filter(s => s.branch === br.id)
  list.forEach((s, i) => {
    const x = 16, y = 148 + i * 86, w = W - 32, h = 78, r = sk(s.id), can = pointsLeft() > 0 && r < s.max
    plate(ctx, x, y, w, h, 14); ctx.strokeStyle = r ? br.col : 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(s.name, x + 14, y + 20)
    ctx.fillStyle = '#c9d8d0'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(s.desc, x + 14, y + 40)
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
  ctx.fillStyle = '#ffd84a'; ctx.font = '400 16px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Dungeon Coins: ' + G.coins, W / 2, 62)
  const un = unlockedGuardians(G.stage)
  for (let k = 0; k < 2; k++) {
    const x = 16 + k * 170, y = 78, w = 158, h = 62, r = G.squad[k], d = ROSTER[r], sel = R.kSlot === k
    button(ctx, 'ks_' + k, x, y, w, h, { top: sel ? '#3d5a6a' : '#2a3841', bot: sel ? '#27404d' : '#1a262d' })
    if (sel) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; rr(ctx, x + 1, y + 1, w - 2, h - 2, 14); ctx.stroke() }
    ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 2, 46, h - 4); ctx.clip(); drawPlainDog(ctx, d, x + 28, y + 36, 0); ctx.restore()
    ctx.textAlign = 'left'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 9px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('SUPPORT SLOT ' + (k + 1), x + 54, y + 14)
    ctx.fillStyle = '#fff'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(d.n, x + 54, y + 30)
    ctx.fillStyle = un > 2 + k ? '#7af09a' : '#ff9a7a'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(un > 2 + k ? d.role : 'Unlocks stage ' + (5 + 5 * k), x + 54, y + 47)
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#7f929a'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Rudy and Cooper always lead. Pick a slot, then tap a dog.', W / 2, 152)
  for (let r = 2; r < ROSTER.length; r++) {
    const d = ROSTER[r], i = r - 2, x = 16, y = 164 + i * 51, w = W - 32, h = 46, owned = G.owned.includes(r), inSlot = G.squad.indexOf(r), can = G.coins >= (d.cost ?? 0)
    button(ctx, 'kd_' + r, x, y, w, h, { top: inSlot >= 0 ? '#34513f' : owned ? '#2e3e48' : '#252f36', bot: inSlot >= 0 ? '#22382b' : owned ? '#1a2830' : '#1b2328' })
    ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 1, 44, h - 2); ctx.clip(); ctx.globalAlpha = owned ? 1 : 0.55; drawPlainDog(ctx, d, x + 24, y + 29, 0); ctx.restore()
    ctx.textAlign = 'left'; ctx.fillStyle = owned ? '#fff' : '#b8c6cc'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(d.n + '  \u00b7  ' + d.breed, x + 52, y + 15)
    ctx.fillStyle = owned ? '#ffd84a' : '#8fa0a8'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(d.perkText ?? '', x + 52, y + 32)
    ctx.textAlign = 'right'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
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
    ctx.fillStyle = col; ctx.font = '400 30px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(t >= 0 ? RAID.names[t].toUpperCase() : 'NO TIER', W / 2, 100)
    ctx.fillStyle = '#fff'; ctx.font = '400 40px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(fmt(res.dmg), W / 2, 150)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(res.best ? 'NEW PERSONAL BEST!' : 'Total damage  \u00b7  Best ' + fmt(G.raidInfo.best), W / 2, 182)
    ctx.fillStyle = '#ffd84a'; ctx.font = '400 22px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('+' + res.coins + ' Dungeon Coins', W / 2, 240)
    if (res.chest >= 0) { ctx.fillStyle = '#9fd0ff'; ctx.fillText('+1 ' + CHEST_NAMES[res.chest], W / 2, 276) }
    const nx = RAID.tiers.findIndex(m => res.dmg < base * m)
    ctx.fillStyle = '#7f929a'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
    if (nx >= 0) ctx.fillText(fmt(base * RAID.tiers[nx] - res.dmg) + ' more damage for ' + RAID.names[nx], W / 2, 330); else ctx.fillText('Top tier cleared!', W / 2, 330)
    ctx.fillText('The stage restarts when you continue.', W / 2, 352)
    button(ctx, 'raid_done', W / 2 - 100, 400, 200, 48, { top: '#52d273', bot: '#25994a', label: 'CONTINUE', size: 16 })
    return
  }
  ctx.fillStyle = '#ff9ad8'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Hit the boss as hard as you can for ' + RAID.dur + ' seconds', W / 2, 66)
  ctx.fillStyle = '#9fb5aa'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Adds and boss shells hit back. Use your abilities. Gold is off in raids.', W / 2, 86)
  // tier table
  RAID.names.forEach((n, k) => {
    const y = 112 + k * 50, hit = G.raidInfo.best >= base * RAID.tiers[k]
    plate(ctx, 16, y, W - 32, 44, 12); ctx.strokeStyle = hit ? RAID.cols[k] : 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5; rr(ctx, 16.75, y + 0.75, W - 33.5, 42.5, 12); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = RAID.cols[k]; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(n, 30, y + 16)
    ctx.fillStyle = '#c9d8d0'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(fmt(base * RAID.tiers[k]) + ' damage', 30, y + 32)
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd84a'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(RAID.coins[k] + ' coins' + (RAID.chest[k] >= 0 ? '  +  ' + CHEST_NAMES[RAID.chest[k]].split(' ')[0] + ' chest' : ''), W - 30, y + 24)
  })
  ctx.textAlign = 'center'; ctx.fillStyle = '#c9d8d0'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Best: ' + fmt(G.raidInfo.best) + (G.raidInfo.best ? '  (' + (raidTier(G.raidInfo.best) >= 0 ? RAID.names[raidTier(G.raidInfo.best)] : 'no tier') + ')' : ''), W / 2, 326)
  ctx.fillStyle = '#7f929a'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Targets scale with your current stage (' + G.stage + ').', W / 2, 346)
  const left = raidLeft()
  button(ctx, 'raid_go', W / 2 - 110, 372, 220, 54, { top: left ? '#ff7a5a' : '#4a565d', bot: left ? '#c42f2f' : '#2f3a40', label: left ? 'START RAID  (' + left + ' left today)' : 'No attempts left', size: 15, disabled: !left })
  button(ctx, 'raid_ad', W / 2 - 110, 436, 220, 38, { top: '#b58cf0', bot: '#6a3fb8', label: 'Watch an ad: +1 attempt', size: 12 })
}
registerTile({ id: 'raid', label: 'Boss Raid', sub: () => raidLeft() + ' attempts today', icon: 'sword', col: '#ff6a5a', badge: () => raidLeft() > 0 })

// ================= Clan =================
export function drawClan(ctx: Ctx) {
  panel(ctx, 'Clan')
  ctx.textBaseline = 'middle'
  const foot = (y: number) => { ctx.textAlign = 'center'; ctx.fillStyle = '#5f7078'; ctx.font = '400 9px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Clanmates are simulated for now (no online service yet).', W / 2, y) }
  if (!G.clan) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#c9d8d0'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Join a clan: bigger clans give stronger perks.', W / 2, 62)
    CLANS.forEach((d, i) => {
      const y = 82 + i * 70, ok = G.best >= d.req, p = PERKS[Math.min(9, d.base) - 1]
      button(ctx, 'cj_' + i, 16, y, W - 32, 62, { top: ok ? '#2e3e48' : '#252f36', bot: ok ? '#1a2830' : '#1b2328' })
      ctx.fillStyle = d.col; rr(ctx, 26, y + 12, 38, 38, 10); ctx.fill(); ctx.fillStyle = '#0e1a20'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.tag, 45, y + 31)
      ctx.textAlign = 'left'; ctx.fillStyle = ok ? '#fff' : '#9fb0b8'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(d.name, 76, y + 18)
      ctx.fillStyle = '#9fb5aa'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Level ' + d.base + '  \u00b7  12 members  \u00b7  ' + onlineCount(d) + ' online', 76, y + 35)
      ctx.fillStyle = '#ffd84a'; ctx.fillText('Starts with: ' + p.text, 76, y + 50)
      ctx.textAlign = 'right'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillStyle = ok ? '#7af09a' : '#ff9a7a'; ctx.fillText(ok ? 'JOIN' : 'Stage ' + d.req, W - 28, y + 18)
    })
    foot(520); return
  }
  const d = clanById(G.clan.id), lv = clanLevel(G.clan), pool = clanPool()!
  ctx.fillStyle = d.col; rr(ctx, 16, 54, 46, 46, 12); ctx.fill(); ctx.fillStyle = '#0e1a20'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.tag, 39, 77)
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '400 17px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(d.name, 72, 66)
  ctx.fillStyle = '#ffd84a'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Clan level ' + lv + (lv >= 10 ? '  (MAX)' : ''), 72, 84)
  const into = lv >= 10 ? XP_PER_LEVEL : G.clan.xp % XP_PER_LEVEL
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, 160, 78, 184, 12, 6); ctx.fill(); ctx.fillStyle = '#ffd84a'; rr(ctx, 160, 78, Math.max(8, 184 * into / XP_PER_LEVEL), 12, 6); ctx.fill()
  ;['Overview', 'Members'].forEach((n, i) => button(ctx, 'ct_' + i, 16 + i * 170, 108, 158, 30, { top: R.clanTab === i ? '#ffb347' : '#3a4850', bot: R.clanTab === i ? '#e0731a' : '#26323a', label: n, size: 13 }))
  if (R.clanTab === 1) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('THIS WEEK: CLAN RAID DAMAGE', W / 2, 152)
    const on = onlineSet(d), ms = mates(d)
    pool.rows.forEach((r, i) => {
      const y = 164 + i * 33, on1 = r.you || on[ms.findIndex(m => m.name === r.name)]
      ctx.fillStyle = r.you ? 'rgba(255,216,74,.16)' : 'rgba(255,255,255,.05)'; rr(ctx, 16, y, W - 32, 29, 9); ctx.fill()
      ctx.fillStyle = on1 ? '#7af09a' : '#46545b'; ctx.beginPath(); ctx.arc(30, y + 14.5, 4, 0, 6.283); ctx.fill()
      ctx.textAlign = 'left'; ctx.fillStyle = r.you ? '#ffd84a' : '#fff'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText((i + 1) + '.  ' + r.name, 42, y + 15)
      ctx.textAlign = 'right'; ctx.fillStyle = '#c9d8d0'; ctx.fillText(fmt(r.dmg), W - 28, y + 15)
    })
    foot(574); return
  }
  // overview: weekly goal with 3 milestones
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Weekly Clan Raid Goal', 18, 156)
  ctx.textAlign = 'right'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(fmt(pool.total) + ' / ' + fmt(pool.goal), W - 18, 156)
  const f = Math.min(1, pool.total / pool.goal)
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, 18, 168, W - 36, 14, 7); ctx.fill(); const gr = ctx.createLinearGradient(18, 0, W - 18, 0); gr.addColorStop(0, '#ff9a3a'); gr.addColorStop(1, '#ff4a6a'); ctx.fillStyle = gr; rr(ctx, 18, 168, Math.max(8, (W - 36) * f), 14, 7); ctx.fill()
  MILESTONES.forEach((m, k) => {
    const x = 18 + (W - 36) * m.at, got = !!(G.clan!.claimed & (1 << k)), ready = milestoneReady(k)
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, 166, 2, 18)
    const bw = 104, bx = 16 + k * 110
    button(ctx, 'cm_' + k, bx, 190, bw, 40, { top: got ? '#2f3a40' : ready ? '#52d273' : '#34444e', bot: got ? '#232c31' : ready ? '#25994a' : '#1d2a31', disabled: !ready })
    ctx.textAlign = 'center'; ctx.fillStyle = got ? '#7f929a' : '#fff'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(got ? 'CLAIMED' : ready ? 'CLAIM' : Math.round(m.at * 100) + '%', bx + bw / 2, 203); ctx.font = '400 8px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillStyle = got ? '#5f7078' : '#d8e4de'; ctx.fillText(m.text, bx + bw / 2, 219)
  })
  const hunt = Math.round(clanHunt(G.clan) * 100), nOn = onlineCount(d)
  ctx.textAlign = 'left'; ctx.fillStyle = '#7af09a'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Clan Hunt: ' + nOn + ' clanmates online  =  +' + hunt + '% damage', 18, 252)
  ctx.fillStyle = '#7f929a'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(G.clan!.wk >= raidBase() * RAID.tiers[0] ? 'Your raids add to the pool. Stages and bosses earn clan XP.' : 'Do a Boss Raid (Bronze or better) this week to unlock rewards.', 18, 270)
  const gift = canClanGift()
  button(ctx, 'cgift', 16, 284, W - 32, 40, { top: gift ? '#ffb347' : '#3a4850', bot: gift ? '#e0731a' : '#26323a', label: gift ? 'Daily clan treats: collect ' + (3 + Math.floor(lv / 2)) + ' coins' : 'Treats collected. Back tomorrow', size: 13, disabled: !gift })
  ctx.textAlign = 'left'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('CLAN PERKS', 18, 346)
  PERKS.forEach((p, i) => {
    const y = 358 + i * 19, on = p.lv <= lv
    ctx.fillStyle = on ? '#7af09a' : '#46545b'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Lv ' + p.lv, 22, y + 9)
    ctx.fillStyle = on ? '#fff' : '#6d7d85'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(p.text, 70, y + 9)
  })
  button(ctx, 'cleave', W - 134, 552, 118, 24, { top: R.leaveArm ? '#ff6a5a' : '#4a565d', bot: R.leaveArm ? '#c42f2f' : '#2f3a40', label: R.leaveArm ? 'Tap again to leave' : 'Leave clan', size: 10 })
  ctx.textAlign = 'left'; ctx.fillStyle = '#5f7078'; ctx.font = '400 9px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Clanmates are simulated for now.', 18, 564)
}
registerTile({ id: 'clan', label: 'Clan', sub: () => G.clan ? clanById(G.clan.id).name + '  Lv' + clanLevel(G.clan) : 'Join a clan', icon: 'gem', col: '#9fd0ff', badge: () => !G.clan ? G.best >= 8 : clanClaimable() })
void cp

// ================= Auto abilities =================
const AUTO_ROWS: { key: 'shield' | 'frenzy' | 'nade' | 'tank' | 'panic'; name: string; icon: string; col: string; when: string }[] = [
  { key: 'shield', name: 'Shield', icon: 'shield', col: '#5ab8ff', when: 'When a dog is hurt (under 45%) or down' },
  { key: 'frenzy', name: 'Frenzy', icon: 'frenzy', col: '#ffd84a', when: 'When 4+ enemies are out, or a boss' },
  { key: 'tank',   name: 'Tank (Rudy)', icon: 'tank', col: '#7fcf86', when: 'When 4+ enemies are out, or a boss' },
  { key: 'panic',  name: 'Panic (Cooper)', icon: 'panic', col: '#ff7a6a', when: 'Only when Cooper is healthy and 6+ enemies / a boss' },
  { key: 'nade',   name: 'Grenade', icon: 'nade', col: '#ff9a3a', when: 'When it would catch 3+ enemies (after you throw your first by hand, or from stage 6)' },
]
export function drawAuto(ctx: Ctx) {
  panel(ctx, 'Auto Abilities')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#9fb5aa'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Abilities fire themselves when they are worth it. Cooldowns still apply.', W / 2, 62)
  button(ctx, 'auto', 16, 78, W - 32, 44, { top: G.auto.on ? '#52d273' : '#5a666d', bot: G.auto.on ? '#25994a' : '#39434a', label: G.auto.on ? 'AUTO IS ON' : 'AUTO IS OFF  (tap to enable)', size: 15 })
  AUTO_ROWS.forEach((r, i) => {
    const y = 134 + i * 68, on = G.auto[r.key] && G.auto.on
    plate(ctx, 16, y, W - 32, 60, 14)
    ctx.save(); ctx.translate(44, y + 30); ctx.scale(1.5, 1.5); icons[r.icon]?.(ctx, 0, 0, r.col); ctx.restore()
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(r.name, 74, y + 20)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
    const words = r.when.split(' '); let line = '', ly = y + 38; for (const w of words) { if (ctx.measureText(line + w).width > 170) { ctx.fillText(line, 74, ly); line = ''; ly += 12 } line += w + ' ' } ctx.fillText(line, 74, ly)
    button(ctx, 'au_' + r.key, W - 86, y + 14, 60, 32, { top: on ? '#52d273' : '#5a666d', bot: on ? '#25994a' : '#39434a', label: G.auto[r.key] ? 'ON' : 'OFF', size: 13 })
  })
}
registerTile({ id: 'auto', label: 'Auto Mode', sub: () => G.auto.on ? 'On' : 'Off', icon: 'frenzy', col: '#52d273' })

// ================= Season pass, achievements, lucky spin =================
export const rewardText = (r: Reward) => [r.gems ? r.gems + ' gems' : '', r.coins ? r.coins + ' coins' : '', r.chest !== undefined ? ['Wooden', 'Silver', 'Golden'][r.chest] + ' chest' : ''].filter(Boolean).join(' + ')
export function drawPass(ctx: Ctx) {
  panel(ctx, 'Season Pass'); ensurePass()
  const lv = passLevel(), into = lv >= PASS_TIERS ? PASS_XP : G.pass.xp % PASS_XP
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = '400 15px ' + FONT; outText(ctx, 'Tier ' + lv + ' / ' + PASS_TIERS + '   \u00b7   ' + seasonDaysLeft() + ' days left', W / 2, 66, '#ffd84a', 3)
  ctx.fillStyle = OUT; rr(ctx, 20, 80, W - 40, 16, 8); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, 22, 82, W - 44, 12, 6); ctx.fill()
  const g = ctx.createLinearGradient(0, 82, 0, 94); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#e8841a'); ctx.fillStyle = g; rr(ctx, 22, 82, Math.max(10, (W - 44) * into / PASS_XP), 12, 6); ctx.fill()
  ctx.font = '400 9px ' + FONT; ctx.fillStyle = '#9fb5aa'; ctx.fillText(into + ' / ' + PASS_XP + ' XP to next tier  (stages, bosses, raids, quests, spins)', W / 2, 108)
  const cols = 5, cw = (W - 32 - 4 * 6) / cols, ch = 62
  for (let tr = 1; tr <= PASS_TIERS; tr++) {
    const i = tr - 1, x = 16 + (i % cols) * (cw + 6), y = 122 + Math.floor(i / cols) * (ch + 5), got = !!(G.pass.claimed & (1 << tr)), ready = tr <= lv && !got, rw = passReward(tr)
    button(ctx, 'pt_' + tr, x, y, cw, ch, { top: got ? '#2f3a40' : ready ? '#52d273' : '#34444e', bot: got ? '#232c31' : ready ? '#25994a' : '#1d2a31', disabled: !ready })
    ctx.fillStyle = got ? '#7f929a' : '#fff'; ctx.font = '400 10px ' + FONT; ctx.fillText('' + tr, x + cw / 2, y + 11)
    ctx.save(); ctx.translate(x + cw / 2, y + 30); ctx.scale(1.0, 1.0); ctx.globalAlpha = got ? 0.4 : 1
    if (rw.chest !== undefined) chestIcon(ctx, 0, 0, 0.5, rw.chest); else if (rw.gems) icons.gem(ctx, 0, 0, '#6fd6ff'); else icons.coin(ctx, 0, 0, '#ffd84a')
    ctx.restore()
    ctx.font = '400 9px ' + FONT; ctx.fillStyle = got ? '#7f929a' : '#fff'; ctx.fillText(got ? 'DONE' : rw.gems ? '+' + rw.gems : rw.coins ? '+' + rw.coins : 'Chest', x + cw / 2, y + 52)
  }
  button(ctx, 'pass_all', W / 2 - 80, 540, 160, 34, { top: passReady() ? '#ffb347' : '#4a565d', bot: passReady() ? '#e0731a' : '#2f3a40', label: passReady() ? 'Claim all (' + passReady() + ')' : 'Nothing to claim', size: 13, disabled: !passReady() })
}
export function drawAch(ctx: Ctx) {
  panel(ctx, 'Achievements')
  const list = ACHIEVEMENTS.slice().sort((a, b) => {
    const rank = (x: typeof a) => G.achClaimed.includes(x.id) ? 2 : statValue(x.stat) >= x.target ? 0 : 1
    return rank(a) - rank(b) || statValue(b.stat) / b.target - statValue(a.stat) / a.target
  })
  const per = 7, pages = Math.ceil(list.length / per); R.achPage = Math.min(R.achPage, pages - 1)
  list.slice(R.achPage * per, R.achPage * per + per).forEach((a, i) => {
    const y = 58 + i * 63, v = Math.min(a.target, statValue(a.stat)), done = statValue(a.stat) >= a.target, got = G.achClaimed.includes(a.id)
    plate(ctx, 16, y, W - 32, 57, 14, got ? '#26343c' : '#2d4252', got ? '#182229' : '#17252f')
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '400 13px ' + FONT; outText(ctx, a.text, 28, y + 16, got ? '#8fa0a8' : '#fff', 3)
    ctx.fillStyle = OUT; rr(ctx, 28, y + 31, 160, 12, 6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, 29.5, y + 32.5, 157, 9, 4.5); ctx.fill()
    if (v > 0) { ctx.fillStyle = got ? '#7f929a' : done ? '#52d273' : '#ffd84a'; rr(ctx, 29.5, y + 32.5, Math.max(8, 157 * v / a.target), 9, 4.5); ctx.fill() }
    ctx.font = '400 9px ' + FONT; ctx.fillStyle = '#c9dcd2'; ctx.fillText(fmt(v) + ' / ' + fmt(a.target), 196, y + 37)
    button(ctx, 'ac_' + a.id, W - 100, y + 10, 76, 36, { top: got ? '#3a4850' : done ? '#52d273' : '#3a4850', bot: got ? '#26323a' : done ? '#25994a' : '#26323a', label: got ? 'DONE' : done ? '+' + a.gems + ' gems' : a.gems + ' gems', size: 11, disabled: !done || got })
  })
  button(ctx, 'ach_prev', 16, 506, 80, 30, { top: '#5b6c75', bot: '#3a4850', label: '< Prev', size: 12, disabled: R.achPage === 0 })
  ctx.textAlign = 'center'; ctx.font = '400 12px ' + FONT; outText(ctx, 'Page ' + (R.achPage + 1) + ' / ' + pages, W / 2, 521, '#fff', 3)
  button(ctx, 'ach_next', W - 96, 506, 80, 30, { top: '#5b6c75', bot: '#3a4850', label: 'Next >', size: 12, disabled: R.achPage >= pages - 1 })
}
export function startSpin(viaAd: boolean) {
  const idx = doSpin(viaAd), n = SPIN_SEGS.length, seg = 6.283 / n
  // pointer is at the top; segment i is centred at angle i*seg - PI/2. Rotate the wheel so segment idx ends under the pointer, after 4 full turns.
  R.spinAnim = { t: 0, from: 0, to: 4 * 6.283 - (idx + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6, idx, done: false, last: performance.now() }
}
export function drawSpin(ctx: Ctx) {
  panel(ctx, 'Lucky Spin')
  const a = R.spinAnim, n = SPIN_SEGS.length, seg = 6.283 / n, cx = W / 2, cy = 236, r = 120
  if (a && !a.done) { const now = performance.now(), dt = Math.min(0.1, (now - (a.last ?? now)) / 1000); a.last = now; const t0 = a.t; a.t += dt; const k = Math.min(1, a.t / 3.2); if (k >= 1) { a.done = true; Audio_.fanfare() } else if (Math.floor(a.t * 14) !== Math.floor(t0 * 14) && k < 0.9) Audio_.ui() }
  const k = a ? Math.min(1, a.t / 3.2) : 0, rot = a ? a.from + (a.to - a.from) * (1 - Math.pow(1 - k, 3)) : 0
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, 6.283); ctx.fill(); ctx.restore()
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
  SPIN_SEGS.forEach((s, i) => {
    const a0 = i * seg - 1.5708 - seg / 2 + seg / 2 - seg / 2
    ctx.fillStyle = s.col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a0 + seg); ctx.closePath(); ctx.fill()
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke()
    ctx.save(); ctx.rotate(a0 + seg / 2); ctx.translate(r * 0.62, 0); ctx.rotate(Math.PI / 2)
    const rw = s.r
    if (rw === 'gold' || (rw as Reward).coins) icons.coin(ctx, 0, -8, '#ffd84a'); else if ((rw as Reward).gems) icons.gem(ctx, 0, -8, '#6fd6ff'); else chestIcon(ctx, 0, -8, 0.45, (rw as Reward).chest ?? 0)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '400 11px ' + FONT; outText(ctx, s.label, 0, 12, '#fff', 3); ctx.restore()
  })
  ctx.restore()
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 6.283); ctx.fill(); const hg = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 18); hg.addColorStop(0, '#fff2a0'); hg.addColorStop(1, '#e8841a'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 6.283); ctx.fill()
  ctx.fillStyle = '#ff5a46'; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - r + 6); ctx.lineTo(cx - 13, cy - r - 18); ctx.lineTo(cx + 13, cy - r - 18); ctx.closePath(); ctx.fill(); ctx.stroke()
  const sl = spinsLeft(), busy = !!a && !a.done
  if (a && a.done) {
    const sg = SPIN_SEGS[a.idx]; ctx.textAlign = 'center'; ctx.font = '400 24px ' + FONT; outText(ctx, 'You won: ' + sg.label + '!', W / 2, 400, '#ffd84a', 5)
    button(ctx, 'spin_ok', W / 2 - 90, 424, 180, 46, { top: '#52d273', bot: '#25994a', label: 'NICE!', size: 16 })
  } else {
    button(ctx, 'spin_go', W / 2 - 100, 408, 200, 52, { top: sl.free && !busy ? '#ff7a5a' : '#4a565d', bot: sl.free && !busy ? '#c42f2f' : '#2f3a40', label: sl.free ? 'FREE SPIN' : 'Come back tomorrow', size: 16, disabled: !sl.free || busy, shine: sl.free && !busy })
    button(ctx, 'spin_ad', W / 2 - 100, 470, 200, 38, { top: sl.ad && !busy ? '#b58cf0' : '#4a565d', bot: sl.ad && !busy ? '#6a3fb8' : '#2f3a40', label: sl.ad ? 'Watch an ad: bonus spin' : 'Bonus spin used', size: 12, disabled: !sl.ad || busy })
  }
}
registerTile({ id: 'spin', label: 'Lucky Spin', sub: () => spinsLeft().free ? 'Free spin ready' : 'Daily', icon: 'star', col: '#ff6a8a', badge: () => spinsLeft().free })
registerTile({ id: 'pass', label: 'Season Pass', sub: () => 'Tier ' + passLevel() + ' / ' + PASS_TIERS, icon: 'gem', col: '#ffb347', badge: () => passReady() > 0 })
registerTile({ id: 'ach', label: 'Achievements', sub: () => achReady() ? achReady() + ' to claim' : 'Goals', icon: 'sword', col: '#c9a6ff', badge: () => achReady() > 0 })

/** Global leaderboard: top players by best stage (rebirths break ties), with our own row pinned at the bottom. */
export function drawRank(ctx: Ctx) {
  panel(ctx, 'Leaderboard')
  if (LB.status !== 'off' && !nameChosen()) { // first visit: pick a name once; it can never be changed afterwards
    if (!nameOptions.length) shuffleNames()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '400 17px ' + FONT; outText(ctx, 'Choose your name', W / 2, 90, '#fff', 4)
    ctx.font = '400 11px ' + FONT; ctx.fillStyle = '#ffb4a8'; ctx.fillText('This is permanent. You cannot change it later.', W / 2, 114)
    nameOptions.forEach((n, i) => button(ctx, 'lb_pick' + i, 40, 140 + i * 64, W - 80, 52, { top: '#52d273', bot: '#25994a', label: n, size: 17 }))
    button(ctx, 'lb_shuffle', W / 2 - 80, 410, 160, 36, { top: '#5b6c75', bot: '#3a4850', label: 'Show other names', size: 12 })
    return
  }
  if (LB.status === 'idle' || (LB.status === 'ok' && Date.now() - LB.at > 60000)) void refresh()
  const me = playerId()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  if (LB.status === 'off' || LB.status === 'err' || (LB.status === 'loading' && !LB.rows.length)) {
    ctx.font = '400 15px ' + FONT
    outText(ctx, LB.status === 'off' ? 'Leaderboard launching soon' : LB.status === 'err' ? "Can't reach the leaderboard" : 'Loading...', W / 2, 250, '#fff', 3)
    ctx.font = '400 11px ' + FONT; ctx.fillStyle = '#9fb5aa'
    ctx.fillText(LB.status === 'off' ? 'Your best stage: ' + G.best : LB.status === 'err' ? 'Check your connection and try again' : '', W / 2, 276)
    if (LB.status === 'err') button(ctx, 'lb_refresh', W / 2 - 60, 300, 120, 38, { top: '#52d273', bot: '#25994a', label: 'Retry', size: 14 })
    return
  }
  const medal = ['#ffd84a', '#d5dde3', '#e0954a']
  LB.rows.slice(0, 10).forEach((r, i) => {
    const y = 56 + i * 42, mine = r.id === me
    plate(ctx, 16, y, W - 32, 38, 12, mine ? '#4a6a3a' : '#2d4252', mine ? '#26421f' : '#17252f')
    ctx.textAlign = 'center'; ctx.font = '400 15px ' + FONT; outText(ctx, '' + (i + 1), 38, y + 19.5, medal[i] ?? '#c9dcd2', 3)
    ctx.textAlign = 'left'; ctx.font = '400 13px ' + FONT; outText(ctx, r.name, 60, y + 14, '#fff', 3)
    ctx.font = '400 9px ' + FONT; ctx.fillStyle = '#9fb5aa'; ctx.fillText(r.rebirths ? r.rebirths + ' rebirth' + (r.rebirths > 1 ? 's' : '') : 'no rebirths', 60, y + 28)
    ctx.textAlign = 'right'; ctx.font = '400 16px ' + FONT; outText(ctx, 'Stage ' + r.stage, W - 28, y + 19.5, '#ffd84a', 3)
  })
  const y = 484
  plate(ctx, 16, y, W - 32, 44, 12, '#4a6a3a', '#26421f')
  ctx.textAlign = 'left'; ctx.font = '400 13px ' + FONT; outText(ctx, 'You: ' + playerName(), 28, y + 15, '#fff', 3)
  ctx.font = '400 10px ' + FONT; ctx.fillStyle = '#c9dcd2'; ctx.fillText(LB.rank ? 'Rank #' + LB.rank + ' of ' + LB.total : 'Ranking you...', 28, y + 31)
  ctx.textAlign = 'right'; ctx.font = '400 16px ' + FONT; outText(ctx, 'Stage ' + G.best, W - 28, y + 22, '#ffd84a', 3)
  button(ctx, 'lb_refresh', W / 2 - 75, 534, 150, 34, { top: '#5ab8ff', bot: '#2a73c4', label: LB.status === 'loading' ? 'Updating...' : 'Refresh', size: 12, disabled: LB.status === 'loading' })
}
registerTile({ id: 'rank', label: 'Leaderboard', sub: () => LB.rank ? 'Rank #' + LB.rank : 'Global top players', icon: 'star', col: '#ffd84a' })

/** Training: the endless gold sink. Four stats, each level a little pricier than the last. */
export function drawTrain(ctx: Ctx) {
  panel(ctx, 'Training')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = '400 11px ' + FONT; ctx.fillStyle = '#9fb5aa'; ctx.fillText('Spend gold on permanent upgrades. There is no cap.', W / 2, 62)
  TRAIN.forEach((d, i) => {
    const y = 78 + i * 98, c = trainCost(d.id), can = G.gold >= c
    plate(ctx, 16, y, W - 32, 90, 14, '#2d4252', '#17252f')
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(46, y + 45, 22, 0, 6.283); ctx.fill(); ctx.fillStyle = mix(d.col, '#101820', 0.35); ctx.beginPath(); ctx.arc(46, y + 45, 19, 0, 6.283); ctx.fill()
    icons[d.icon](ctx, 46, y + 45, '#fff')
    ctx.textAlign = 'left'; ctx.font = '400 15px ' + FONT; outText(ctx, d.name, 78, y + 18, '#fff', 3)
    ctx.textAlign = 'right'; ctx.font = '400 12px ' + FONT; outText(ctx, 'Lv ' + tl(d.id), W - 28, y + 18, '#ffd84a', 3); ctx.textAlign = 'left'
    ctx.font = '400 10px ' + FONT; ctx.fillStyle = '#c9dcd2'; ctx.fillText(d.text, 78, y + 38)
    button(ctx, 'tr_' + d.id, 78, y + 50, W - 110, 34, { top: can ? '#52d273' : '#4a545a', bot: can ? '#25994a' : '#2a3238', label: fmt(c) + ' gold', icon: 'coin', size: 14, disabled: !can })
  })
  ctx.textAlign = 'center'; ctx.font = '400 12px ' + FONT; outText(ctx, 'You have ' + fmt(G.gold) + ' gold', W / 2, 482, '#ffd84a', 3)
}
registerTile({ id: 'train', label: 'Training', sub: () => trainAffordable() ? 'Upgrade ready!' : 'Spend your gold', icon: 'bolt', col: '#ff9a3a', badge: () => trainAffordable() })

// ================= Pack Boost (rewarded ad buff) =================
const mmss = (sec: number) => Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0')
function drawBoost(ctx: Ctx) {
  panel(ctx, 'Pack Boost')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = '400 15px ' + FONT; ctx.fillStyle = '#ffd84a'; ctx.fillText(G.boostT > 0 ? 'ACTIVE  ' + mmss(G.boostT) : 'Not active', W / 2, 90)
  const rows: [string, string, string][] = [['+' + Math.round(BOOST.gold * 100) + '% gold', 'from every kill', '#ffd84a'], ['+' + Math.round(BOOST.dmg * 100) + '% gun damage', 'for the whole pack', '#ff9a3a']]
  rows.forEach(([a, b, c], i) => { const y = 130 + i * 64; plate(ctx, 24, y, W - 48, 54, 14, 'rgba(34,52,64,.7)', 'rgba(12,20,26,.7)'); ctx.textAlign = 'left'; ctx.font = '400 20px ' + FONT; ctx.fillStyle = c; ctx.fillText(a, 40, y + 22); ctx.font = '400 12px ' + FONT; ctx.fillStyle = '#c9d8d0'; ctx.fillText(b, 40, y + 42) })
  ctx.textAlign = 'center'; ctx.font = '400 12px ' + FONT; ctx.fillStyle = '#9fb5aa'
  ctx.fillText('Each ad adds ' + mmss(BOOST.dur) + ', up to ' + mmss(BOOST.cap) + ' stored.', W / 2, 282)
  ctx.fillText('It counts down while you play.', W / 2, 300)
  const ok = adsLeft() > 0 && G.boostT < BOOST.cap
  button(ctx, 'boost_ad', W / 2 - 110, 330, 220, 48, { top: ok ? '#b58cf0' : '#5a666d', bot: ok ? '#6a3fb8' : '#39434a', label: G.boostT >= BOOST.cap ? 'Boost is full' : adsLeft() > 0 ? 'Watch an ad: +' + (BOOST.dur / 60) + ' min' : 'No ads left today', size: 14, disabled: !ok })
  ctx.font = '400 11px ' + FONT; ctx.fillStyle = '#7f929a'; ctx.fillText('Optional. Ads only ever run when you tap this.', W / 2, 394)
}
registerTile({ id: 'boost', label: 'Pack Boost', sub: () => G.boostT > 0 ? mmss(G.boostT) + ' left' : '+50% gold, +25% damage', icon: 'bolt', col: '#b58cf0', badge: () => G.boostT <= 0 && adsLeft() > 0 })
registerTile({ id: 'privacy', label: 'Privacy & Support', sub: () => 'Policy, contact', icon: 'shield', col: '#7f929a' })

// ================= Remove Ads (in-app purchase, phone app only) =================
function drawNoAds(ctx: Ctx) {
  panel(ctx, 'Remove Ads')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = '400 15px ' + FONT; ctx.fillStyle = G.noAds ? '#52d273' : '#ffd84a'; ctx.fillText(G.noAds ? 'Ads are off. Thank you!' : 'Keep every reward, skip every ad', W / 2, 90)
  const lines = ['Pack Boost, Lucky Spin, double rewards:', 'you still get them, with no ad to watch.', 'One purchase, yours for good on this account.']
  ctx.font = '400 13px ' + FONT; ctx.fillStyle = '#c9d8d0'; lines.forEach((l, i) => ctx.fillText(l, W / 2, 140 + i * 22))
  const can = IAP.status === 'ready' && !G.noAds, busy = IAP.status === 'busy' || IAP.status === 'loading'
  const label = G.noAds ? 'Purchased' : IAP.status === 'unavailable' ? 'Available in the app' : busy ? 'Please wait...' : 'Remove ads' + (IAP.price ? '  ' + IAP.price : '')
  button(ctx, 'iap_buy', W / 2 - 110, 240, 220, 52, { top: can ? '#ffcf4a' : '#5a666d', bot: can ? '#e8841a' : '#39434a', label, size: 15, disabled: !can })
  button(ctx, 'iap_restore', W / 2 - 90, 308, 180, 40, { top: '#5ab8ff', bot: '#2a73c4', label: 'Restore purchase', size: 13, disabled: IAP.status !== 'ready' })
  ctx.font = '400 12px ' + FONT; ctx.fillStyle = '#9fb5aa'; if (IAP.msg) ctx.fillText(IAP.msg, W / 2, 374)
  if (IAP.status === 'unavailable') { ctx.fillStyle = '#7f929a'; ctx.fillText('Purchases work in the Android and iPhone app.', W / 2, 400) }
}
registerTile({ id: 'noads', label: 'Remove Ads', sub: () => G.noAds ? 'Active' : 'Keep rewards, skip ads', icon: 'shield', col: '#ffb347' })
registerTile({ id: 'savedata', label: 'Save Data', sub: () => 'Backup and restore', icon: 'gem', col: '#52d2c9' })
