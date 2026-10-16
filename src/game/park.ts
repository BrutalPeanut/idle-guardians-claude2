/**
 * Dog Park: async pack-vs-pack battles. Your pack's snapshot (name, stage, firepower, health, squad) is uploaded; you fight
 * snapshots of other players' packs. Battles are auto-resolved (firepower vs health, with crits and swings) and played back
 * as a short duel. Only the attacker's rating moves, so being attacked never costs anything.
 * 5 battles a day. Win: 6 bones + 2 coins. Loss: 2 bones.
 * Without the server functions (supabase/park.sql) the park offers practice battles against AI packs, labelled as such.
 */
import { G, save, unlocked } from './sim'
import { ROSTER, W, unlockedGuardians } from './data'
import { R, button, drawDogPortrait, FONT } from './render'
import { addScreen, panel, XSCREENS, XBUTTONS } from './screens'
import { xs, ON } from './ext'
import { rpc, secret } from './clannet'
import { playerId, playerName } from './leaderboard'
import { dayKey } from './quests'
import { addBones } from './doglevels'
import { text, wrap, GREEN, GREY, GOLD, RED } from './ui'
import { Audio_ } from './audio'
import { track } from './telemetry'
import type { Ctx } from './render'

export const TICKETS = 5, WIN = { bones: 6, coins: 2 }, LOSS = { bones: 2 }
interface Opp { sid: number; name: string; stage: number; power: number; hp: number; dogs: number[]; rating: number; bot?: boolean }
const st = () => xs('park', () => ({ day: '', used: 0, peak: 0, rating: 1000, wins: 0, losses: 0 }))
function roll() { const s = st(); if (s.day !== dayKey()) { s.day = dayKey(); s.used = 0 } return s }
export const ticketsLeft = () => Math.max(0, TICKETS - roll().used)
export const parkWins = () => st().wins

// ---- your pack's numbers ----
ON.tick.push(() => { const s = st(); if (G.dpsEma > s.peak) s.peak = G.dpsEma })
export const myPower = () => Math.max(1, st().peak)
export const myHp = () => { let h = 0; for (let i = 0; i < unlockedGuardians(G.stage); i++) h += G.mhp[i] || 0; return Math.max(1, h) }
export const myDogs = () => [0, 1, ...G.squad.slice(0, Math.max(0, unlockedGuardians(G.stage) - 2))]

// ---- battle model (pure; seeded so a replay is identical) ----
export interface Hit { t: number; side: 0 | 1; dmg: number; crit: boolean }
export function simulate(a: { power: number; hp: number }, b: { power: number; hp: number }, seed: number) {
  let s = seed >>> 0 || 1; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  const hp = [a.hp, b.hp], pw = [a.power, b.power], hits: Hit[] = []
  // health is in "HP", firepower in "damage per second against stage enemies"; scale so an even matchup lasts ~12s
  const base = Math.sqrt(a.hp * b.hp) / 12 / Math.max(1e-9, Math.sqrt(pw[0] * pw[1])), dps = [pw[0] * base, pw[1] * base]
  let t = 0
  while (t < 30 && hp[0] > 0 && hp[1] > 0) {
    t += 0.25
    for (const side of [0, 1] as const) {
      if (hp[side] <= 0) continue
      const crit = rnd() < 0.12, dmg = dps[side] * 0.25 * (0.75 + rnd() * 0.5) * (crit ? 2 : 1)
      hp[1 - side] = Math.max(0, hp[1 - side] - dmg); hits.push({ t, side, dmg, crit })
    }
  }
  const won = hp[1] <= 0 && hp[0] > 0 ? true : hp[0] <= 0 && hp[1] > 0 ? false : hp[0] / a.hp >= hp[1] / b.hp
  return { won, hits, dur: t, end: hp }
}

// ---- server / practice ----
let online = false, opps: Opp[] = [], loading = false, lastFetch = 0
const BOT_NAMES = ['Practice Pack', 'Sparring Pups', 'Training Mutts', 'Drill Hounds', 'Rookie Pack']
function practice(): Opp[] {
  const p = myPower(), h = myHp()
  return [0.75, 0.95, 1.2].map((m, i) => ({ sid: -1 - i, name: BOT_NAMES[(i + G.best) % BOT_NAMES.length], stage: Math.max(1, Math.round(G.best * m)), power: p * m * (0.9 + Math.random() * 0.2), hp: h * m * (0.9 + Math.random() * 0.2), dogs: [2 + ((i * 3 + G.best) % 8), 2 + ((i * 3 + G.best + 2) % 8), 2 + ((i * 3 + G.best + 5) % 8)], rating: Math.round(st().rating * (0.85 + 0.15 * m)), bot: true }))
}
async function refresh(force = false) {
  if (loading || (!force && Date.now() - lastFetch < 20000 && opps.length)) return
  loading = true; lastFetch = Date.now()
  try {
    const me = await rpc<{ rating?: number; wins?: number; losses?: number; err?: string }>('park_submit', { p_id: playerId(), p_secret: secret(), p_name: playerName(), p_stage: G.best, p_power: myPower(), p_hp: myHp(), p_dogs: myDogs() })
    if (me.err) throw new Error(me.err)
    const s = st(); s.rating = me.rating ?? s.rating; s.wins = me.wins ?? s.wins; s.losses = me.losses ?? s.losses
    const list = await rpc<Opp[]>('park_opponents', { p_id: playerId() })
    online = true; opps = list.length ? list.map(o => ({ ...o, dogs: Array.isArray(o.dogs) ? o.dogs : [] })) : practice()
  } catch { online = false; opps = practice() }
  loading = false
}

// ---- fight state ----
let fight: null | { opp: Opp; res: ReturnType<typeof simulate>; t: number; at: number; delta: number; done: boolean } = null
async function startFight(i: number) {
  const o = opps[i]; if (!o || fight || ticketsLeft() <= 0) return
  roll().used++
  const me = { power: myPower(), hp: myHp() }, res = simulate(me, o, (Date.now() & 0xffffff) ^ o.sid * 7919)
  fight = { opp: o, res, t: 0, at: performance.now(), delta: 0, done: false }; R.screen = 'park_fight'; Audio_.fanfare()
  const s = st()
  if (res.won) { s.wins++; addBones(WIN.bones); G.coins += WIN.coins } else { s.losses++; addBones(LOSS.bones) }
  save(); track('park_fight', { w: res.won ? 1 : 0, bot: o.bot ? 1 : 0 })
  if (!o.bot && online) {
    try { const r = await rpc<{ rating?: number; delta?: number }>('park_result', { p_id: playerId(), p_secret: secret(), p_sid: o.sid, p_won: res.won }); if (r.rating !== undefined) { s.rating = r.rating; if (fight) fight.delta = r.delta ?? 0 } } catch { /* offline: rating syncs next time */ }
  } else { const d = res.won ? 12 : -8; s.rating = Math.max(0, s.rating + d); if (fight) fight.delta = d }
  opps.splice(i, 1); if (!opps.length) void refresh(true)
}

// ---- drawing ----
function pack(ctx: Ctx, dogs: number[], cx: number, y: number, flip: boolean, t: number, s = 1) {
  dogs.slice(0, 4).forEach((r, i) => {
    const d = ROSTER[r] ?? ROSTER[0], x = cx + (i - (Math.min(4, dogs.length) - 1) / 2) * 30 * s
    ctx.save(); ctx.translate(x, y + (i % 2) * 6 * s); ctx.scale(flip ? -s : s, s); drawDogPortrait(ctx, d, 0, 0, t); ctx.restore()
  })
}
const fmt = (n: number) => n >= 1e12 ? (n / 1e12).toFixed(1) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : '' + Math.round(n)
function draw(ctx: Ctx, t: number) {
  panel(ctx, 'Dog Park')
  void refresh()
  const s = roll()
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.roundRect(16, 52, W - 32, 50, 12); ctx.fill()
  text(ctx, 'Rating ' + s.rating, 30, 68, 16, '#ffd84a', 'left'); text(ctx, s.wins + 'W  ' + s.losses + 'L', 30, 88, 11, '#9fb5aa', 'left')
  text(ctx, 'Battles today: ' + ticketsLeft() + ' / ' + TICKETS, W - 30, 68, 13, ticketsLeft() ? '#fff' : '#ff9a8a', 'right')
  text(ctx, 'Your firepower ' + fmt(myPower()) + '  ·  health ' + fmt(myHp()), W - 30, 88, 10, '#9fb5aa', 'right')
  if (!opps.length) { text(ctx, loading ? 'Finding packs...' : 'No packs found', W / 2, 200, 14, '#c9d8d0'); return }
  opps.slice(0, 3).forEach((o, i) => {
    const y = 112 + i * 124, edge = myPower() * myHp() / Math.max(1, o.power * o.hp), odds = edge > 1.4 ? ['Easy', '#7af09a'] : edge > 0.8 ? ['Even', '#ffd84a'] : ['Tough', '#ff9a8a']
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 116, 14); ctx.fill()
    text(ctx, o.name, 28, y + 18, 15, '#fff', 'left'); text(ctx, 'Stage ' + o.stage + '  ·  rating ' + o.rating, 28, y + 36, 10, '#9fb5aa', 'left')
    text(ctx, odds[0], W - 28, y + 18, 13, odds[1], 'right')
    pack(ctx, o.dogs.length ? o.dogs : [0, 1], 96, y + 74, true, t, 0.9)
    text(ctx, 'Firepower ' + fmt(o.power), 180, y + 64, 10, '#ff9a8a', 'left'); text(ctx, 'Health ' + fmt(o.hp), 180, y + 80, 10, '#7af09a', 'left')
    button(ctx, 'pk_f' + i, W - 104, y + 70, 80, 36, { ...(ticketsLeft() ? RED : GREY), label: 'FIGHT', size: 14, disabled: !ticketsLeft() })
  })
  const bot = opps.some(o => o.bot)
  wrap(ctx, bot ? 'Practice battles against AI packs. Real players appear here once the park is online.' : 'Real players\' packs. Only your own rating changes, so being attacked never costs you.', W / 2, 494, W - 50, 10, '#7f929a')
  button(ctx, 'pk_new', W / 2 - 60, 520, 120, 28, { ...GREY, label: 'New opponents', size: 11 })
}
XSCREENS.park_fight = (ctx: Ctx, t: number) => {
  panel(ctx, 'Dog Park', false)
  const f = fight; if (!f) { R.screen = 'park'; return }
  const speed = Math.max(1, f.res.dur / 6); f.t = Math.max(f.t, Math.min(f.res.dur, (performance.now() - f.at) / 1000 * speed))
  const shown = f.res.hits.filter(h => h.t <= f.t), hp = [myHp(), f.opp.hp]
  for (const h of shown) hp[1 - h.side] = Math.max(0, hp[1 - h.side] - h.dmg)
  const bar = (x: number, y: number, w: number, frac: number, col: string) => { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect(x, y, w, 12, 6); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, Math.max(6, w * frac), 12, 6); ctx.fill() }
  text(ctx, f.opp.name, W / 2, 70, 15, '#ff9a8a'); bar(40, 82, W - 80, hp[1] / f.opp.hp, '#ff6a5a')
  pack(ctx, f.opp.dogs.length ? f.opp.dogs : [0, 1], W / 2, 150, true, t, 1.5)
  text(ctx, 'VS', W / 2, 232, 28, '#ffd84a')
  pack(ctx, myDogs(), W / 2, 310, false, t, 1.5)
  bar(40, 372, W - 80, hp[0] / myHp(), '#52d273'); text(ctx, playerName() + "'s pack", W / 2, 398, 15, '#9fe8b4')
  // last few hits as floating numbers
  ctx.font = '400 13px ' + FONT; ctx.textAlign = 'center'
  for (const h of shown.slice(-6)) { const age = f.t - h.t, a = Math.max(0, 1 - age * 1.2); if (!a) continue; ctx.globalAlpha = a; ctx.fillStyle = h.crit ? '#ffd84a' : '#fff'; ctx.fillText((h.crit ? 'CRIT ' : '') + fmt(h.dmg), W / 2 + (h.side ? -1 : 1) * (40 + (h.t * 37) % 60), (h.side ? 300 : 150) - age * 30); ctx.globalAlpha = 1 }
  if (f.t >= f.res.dur) {
    if (!f.done) { f.done = true; if (f.res.won) Audio_.fanfare() }
    text(ctx, f.res.won ? 'VICTORY!' : 'DEFEAT', W / 2, 440, 30, f.res.won ? '#ffd84a' : '#ff9a8a')
    text(ctx, (f.res.won ? '+' + WIN.bones + ' bones  +' + WIN.coins + ' coins' : '+' + LOSS.bones + ' bones') + '   ·   rating ' + (f.delta >= 0 ? '+' : '') + f.delta, W / 2, 472, 13, '#fff')
    button(ctx, 'pk_done', 90, 500, W - 180, 42, { ...(f.res.won ? GOLD : GREEN), label: 'Continue', size: 15 })
  } else button(ctx, 'pk_skip', W / 2 - 40, 520, 80, 26, { ...GREY, label: 'Skip', size: 11 })
}
XBUTTONS.push(k => {
  if (k === 'pk_done') { fight = null; R.screen = 'park'; return true }
  if ((k === 'scr_close' || k === 'scr_x') && R.screen === 'park_fight') { fight = null; return false }
  if (k === 'pk_skip') { if (fight) fight.t = fight.res.dur; return true }
  return false
})
addScreen({
  tile: { id: 'park', label: 'Dog Park', sub: () => ticketsLeft() + ' battles · rating ' + st().rating, icon: 'sword', col: '#ff6a7a', badge: () => unlocked('park') && roll().used === 0 },
  section: 'battle', unlock: 10, draw,
  button: k => {
    if (!k.startsWith('pk_')) return false
    if (k === 'pk_new') { void refresh(true); return true }
    if (k.startsWith('pk_f')) { void startFight(+k.slice(4)); return true }
    return false
  },
})
