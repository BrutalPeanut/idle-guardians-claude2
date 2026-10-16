/**
 * Daily Dungeons: a 40-second horde run at your current stage. Enemies pour in non-stop; every kill raises the payout.
 * The dungeon on offer rotates by weekday (Sunday: pick any):
 *   Gold Vault  — Mon/Thu: a pile of gold
 *   Gear Crypt  — Tue/Fri: a chest (Wooden / Silver / Golden by kills)
 *   Bone Yard   — Wed/Sat: Bones for Pack Training
 * 2 keys a day, +1 a day from a rewarded ad. Built on the normal stage: the stage simply never runs out of enemies until the timer ends.
 */
import { G, save, startStage, addChest, killGold, unlocked } from './sim'
import { W } from './data'
import { R, button, rr, OUT, FONT, outText } from './render'
import { addScreen, panel } from './screens'
import { xs, ON, DRAW } from './ext'
import { text, wrap, GREEN, GREY, PURPLE, GOLD, icon } from './ui'
import { showRewardedAd } from './ads'
import { addBones } from './doglevels'
import { dayKey } from './quests'
import { Audio_ } from './audio'
import { track } from './telemetry'
import type { Ctx } from './render'

export type DKind = 'gold' | 'gear' | 'bones'
export const DUNGEONS: Record<DKind, { name: string; desc: string; col: string; ic: string }> = {
  gold: { name: 'Gold Vault', desc: 'Every kill adds to a big gold payout.', col: '#ffd84a', ic: 'coin' },
  gear: { name: 'Gear Crypt', desc: '15 kills: Wooden chest. 35: Silver. 70: Golden.', col: '#b58cf0', ic: 'collar' },
  bones: { name: 'Bone Yard', desc: 'Bones for Pack Training: 4 plus 1 per 3 kills.', col: '#f4ead6', ic: 'bone' },
}
export const DUR = 40, KEYS = 2, SPAWN_EVERY = 0.42
const HORDE = 1e6 // toSpawn while a run is live: the stage can never be cleared
const ROTA: (DKind | null)[] = [null, 'gold', 'gear', 'bones', 'gold', 'gear', 'bones'] // Sunday = null = any
export const todays = (d = new Date()): DKind[] => { const k = ROTA[d.getDay()]; return k ? [k] : ['gold', 'gear', 'bones'] }

const st = () => xs('dungeon', () => ({ day: '', used: 0, ad: 0, best: {} as Record<string, number> }))
function roll() { const s = st(), d = dayKey(); if (s.day !== d) { s.day = d; s.used = 0; s.ad = 0 } return s }
export const keysLeft = () => { const s = roll(); return Math.max(0, KEYS + s.ad - s.used) }

interface Run { kind: DKind; t: number; kills: number; stage: number; fail: number; failStage: number; result: null | { kills: number; text: string } }
let run: Run | null = null
export const dungeonRun = () => run

export function reward(kind: DKind, kills: number, stage: number) {
  if (kind === 'gold') return { gold: Math.ceil(killGold(stage) * (10 + kills * 2.5)) }
  if (kind === 'gear') return { chest: kills >= 70 ? 2 : kills >= 35 ? 1 : kills >= 15 ? 0 : -1 }
  return { bones: 4 + Math.floor(kills / 3) }
}
export function start(kind: DKind): boolean {
  if (run || G.raid || G.wipe || !todays().includes(kind) || keysLeft() <= 0) return false
  roll().used++
  startStage()
  G.toSpawn = HORDE; G.spawned = 1; G.spawnT = 0.6 // spawned > 0: no stage boss
  run = { kind, t: DUR, kills: 0, stage: G.stage, fail: G.fail, failStage: G.failStage, result: null }
  G.banner = { text: DUNGEONS[kind].name.toUpperCase(), sub: 'Knock down as many as you can in ' + DUR + 's', t: 2 }
  track('dungeon_start', { k: kind }); save(); return true
}
function finish() {
  const r = run!; if (r.result) return
  const rw = reward(r.kind, r.kills, r.stage); let txt = ''
  if (rw.gold) { G.gold += rw.gold; txt = '+' + rw.gold.toLocaleString('en-US') + ' gold' }
  if (rw.chest !== undefined) { if (rw.chest >= 0) { addChest(rw.chest); txt = ['Wooden', 'Silver', 'Golden'][rw.chest] + ' chest' } else txt = 'No chest (need 15 kills)' }
  if (rw.bones) { addBones(rw.bones); txt = '+' + rw.bones + ' bones' }
  const s = st(); s.best[r.kind] = Math.max(s.best[r.kind] ?? 0, r.kills)
  r.result = { kills: r.kills, text: txt }
  // put the stage back exactly as it was (a wipe inside the dungeon must not count toward Pack Resolve)
  G.fail = r.fail; G.failStage = r.failStage; G.wipe = null; G.stage = r.stage; startStage()
  track('dungeon_end', { k: r.kind, n: r.kills }); save(); Audio_.fanfare(); R.screen = 'dungeon'
}

ON.kill.push(k => { if (run && !run.result && !k.raid) run.kills++ })
ON.tick.push(dt => {
  if (!run || run.result) return
  if (G.toSpawn !== HORDE || G.wipe) { finish(); return } // the pack fell (auto-regroup restarts the stage): end the run with what you have
  if ((run.t -= dt) <= 0) { finish(); return }
  if (G.spawnT > SPAWN_EVERY) G.spawnT = SPAWN_EVERY
})
// HUD: replace the stage progress pill with the dungeon timer
DRAW.hud.push(ctx => {
  if (!run || run.result) return
  const d = DUNGEONS[run.kind], f = Math.max(0, run.t) / DUR
  ctx.fillStyle = '#16232b'; ctx.fillRect(8, 25, 106, 18)
  ctx.fillStyle = OUT; rr(ctx, 10, 27, 100, 14, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, 12, 29, 96, 10, 5); ctx.fill()
  ctx.fillStyle = d.col; rr(ctx, 12, 29, Math.max(8, 96 * f), 10, 5); ctx.fill()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '400 9px ' + FONT; outText(ctx, Math.ceil(run.t) + 's  ·  ' + run.kills + ' kills', 60, 34.5, '#fff', 2.5)
})

function draw(ctx: Ctx, t: number) {
  panel(ctx, 'Daily Dungeons')
  const r = run
  if (r?.result) {
    const d = DUNGEONS[r.kind]
    icon(ctx, d.ic, W / 2, 150, 3, d.col)
    text(ctx, d.name + ' cleared!', W / 2, 210, 22, '#fff')
    text(ctx, r.result.kills + ' kills', W / 2, 244, 16, '#ffd84a')
    text(ctx, r.result.text, W / 2, 276, 18, d.col)
    if ((st().best[r.kind] ?? 0) === r.result.kills && r.result.kills > 0) text(ctx, 'New personal best!', W / 2, 304, 12, '#9fe8b4')
    button(ctx, 'dg_done', 80, 340, W - 160, 44, { ...GREEN, label: 'Nice!', size: 16 })
    return
  }
  const left = keysLeft(), s = roll()
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.roundRect(16, 52, W - 32, 34, 12); ctx.fill()
  text(ctx, 'Keys today: ' + left + ' / ' + (KEYS + s.ad), 30, 69, 14, left ? '#fff' : '#ff9a8a', 'left')
  text(ctx, 'Stage ' + G.stage + ' enemies', W - 30, 69, 11, '#9fb5aa', 'right')
  const open = todays()
  ;(Object.keys(DUNGEONS) as DKind[]).forEach((k, i) => {
    const d = DUNGEONS[k], y = 98 + i * 112, on = open.includes(k), best = s.best[k] ?? 0
    ctx.fillStyle = on ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 104, 14); ctx.fill()
    if (on) { ctx.strokeStyle = d.col; ctx.lineWidth = 2; ctx.stroke() }
    ctx.globalAlpha = on ? 1 : 0.4
    icon(ctx, d.ic, 48, y + 40, 2, d.col)
    text(ctx, d.name, 80, y + 24, 17, '#fff', 'left')
    wrap(ctx, d.desc, 80, y + 46, W - 120, 11, '#c9d8d0', 'left', 13)
    text(ctx, on ? (best ? 'Best: ' + best + ' kills' : 'Open today') : 'Opens ' + days(k), 80, y + 84, 10, on ? '#9fe8b4' : '#9fb5aa', 'left')
    ctx.globalAlpha = 1
    if (on) button(ctx, 'dg_go_' + k, W - 112, y + 60, 88, 34, { ...(left ? GOLD : GREY), label: 'ENTER', size: 14, disabled: !left })
  })
  const adOk = s.ad < 1
  if (!left && adOk) button(ctx, 'dg_ad', 60, 438, W - 120, 38, { ...PURPLE, label: 'Watch ad: +1 key', size: 14 })
  wrap(ctx, '40 seconds, endless enemies. If the pack falls, the run ends with what you have. Gold Vault Mon/Thu, Gear Crypt Tue/Fri, Bone Yard Wed/Sat, all three on Sunday.', W / 2, adOk && !left ? 494 : 448, W - 50, 10, '#7f929a')
  void t
}
const days = (k: DKind) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].filter((_d, i) => ROTA[i] === k).join(', ') + ', Sun'

addScreen({
  tile: { id: 'dungeon', label: 'Dungeons', sub: () => keysLeft() + ' keys · ' + todays().map(k => DUNGEONS[k].name).join(' / '), icon: 'sword', col: '#b58cf0', badge: () => keysLeft() > 0 && unlocked('dungeon') },
  section: 'battle', unlock: 6, draw,
  button: k => {
    if ((k === 'scr_close' || k === 'scr_x') && R.screen === 'dungeon' && run?.result) { run = null; return false } // leaving the result card clears it
    if (!k.startsWith('dg_')) return false
    if (k === 'dg_done') { run = null; R.screen = null }
    else if (k === 'dg_ad') { const res = showRewardedAd('dungeon_key', () => { roll().ad++; save(); G.banner = { text: '+1 Dungeon key', t: 1.3 } }); if (res === 'cap') G.banner = { text: 'No ads left today', t: 1.3 } }
    else if (k.startsWith('dg_go_')) { if (start(k.slice(6) as DKind)) R.screen = null; else if (G.raid) G.banner = { text: 'Finish the raid first', t: 1.2 } }
    return true
  },
})
