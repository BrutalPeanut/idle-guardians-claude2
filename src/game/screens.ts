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
    default: drawHub(ctx, t)
  }
}
