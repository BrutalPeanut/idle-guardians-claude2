import { ARENA, WEAPONS, GUARDIANS, unlockedGuardians } from './data'
import type { WeaponKind } from './data'
import { buildLayout, rulesFor, bulletDmg, localStage, segRect, pushOut, inHazard } from './cover'
import type { Cover, Hazard, HazardKind } from './cover'

export interface Enemy { x: number; y: number; hp: number; max: number; spd: number; r: number; kind: 'zombie' | 'robot' | 'boss' | 'gunner' | 'mortar'; flash: number; wob: number; dmg: number; cd: number; dug?: boolean; coverId?: number }
export interface Shot { x: number; y: number; vx: number; vy: number; w: number; dmg: number; crit: boolean; flank: 0 | 1 | 2; life: number; tgt: Enemy | null; kind: WeaponKind; col: string }
export interface EBullet { x: number; y: number; vx: number; vy: number; dmg: number; life: number; pass: number }
export interface Shell { x: number; y: number; tx: number; ty: number; t: number; dur: number; r: number; dmg: number }
export interface Status { cover: boolean; flank: 0 | 1 | 2 } // flank: 1 = auto-flank, 2 = manual (player-placed)
export interface Banner { text: string; sub?: string; t: number; big?: boolean }
export type GEvent =
  | { type: 'fire'; kind: WeaponKind; x: number; y: number; col: string }
  | { type: 'hit'; x: number; y: number; col: string }
  | { type: 'dmg'; x: number; y: number; v: number; crit: boolean; kill: boolean; blast?: boolean; flank?: boolean }
  | { type: 'kill'; x: number; y: number; kind: Enemy['kind']; gold: number }
  | { type: 'boom'; x: number; y: number; r: number }
  | { type: 'pack_hit'; x: number; y: number; v: number }
  | { type: 'merge'; slot: number; level: number }
  | { type: 'unlock'; level: number; newEra: boolean }
  | { type: 'stage_clear'; stage: number; gold: number }
  | { type: 'cover_hit'; id: number; x: number; y: number; v: number; kind: Cover['kind'] }
  | { type: 'cover_break'; x: number; y: number; w: number; kind: Cover['kind'] }
  | { type: 'efire'; x: number; y: number }
  | { type: 'mortar_fire'; x: number; y: number }
  | { type: 'hold'; on: boolean }
  | { type: 'idle_collect'; gold: number }

interface State {
  gold: number; stage: number; bought: number; bench: (number | null)[]; maxLevel: number
  pack: { x: number; y: number; tx: number; ty: number; hp: number; max: number }
  /** Support squad centre (guardians 2+). Follows the pack, or stays planted at `hold`. */
  sup: { x: number; y: number }; hold: { x: number; y: number } | null
  enemies: Enemy[]; shots: Shot[]; ebullets: EBullet[]; shells: Shell[]; cover: Cover[]; hazards: Hazard[]; events: GEvent[]; t: number
  spawned: number; toSpawn: number; spawnT: number; speed: number; cd: number[]; flankOff: number[]; status: Status[]
  banner: Banner | null; kills: number; combo: number; comboT: number
  /** Idle income: gold waiting in the kennel stash (must be collected), last time we saw the player, and the welcome-back summary. */
  stash: number; lastSeen: number; away: { minutes: number; gold: number; capped: boolean } | null
}

export const PACK_BOUNDS = { x0: ARENA.x0 + 40, x1: ARENA.x1 - 40, y0: ARENA.y0 + 40, y1: ARENA.y1 - 50 }
const PACK_R = 22, STRIKE = 2 // guardians 0..1 (Rudy, Cooper) are the strike team
export const G: State = {
  gold: 40, stage: 1, bought: 0, bench: new Array(8).fill(null), maxLevel: 0,
  pack: { x: 180, y: 425, tx: 180, ty: 425, hp: 220, max: 220 }, sup: { x: 180, y: 425 }, hold: null,
  enemies: [], shots: [], ebullets: [], shells: [], cover: [], hazards: [], events: [], t: 0,
  spawned: 0, toSpawn: 0, spawnT: 0, speed: 1, cd: [0, 0, 0, 0], flankOff: [0, 0, 0, 0],
  status: [0, 1, 2, 3].map(() => ({ cover: false, flank: 0 as const })), banner: null, kills: 0, combo: 0, comboT: 0,
  stash: 0, lastSeen: Date.now(), away: null,
}
/**
 * Idle income. Tuned against measured active play (~40 kills/min): idle pays IDLE.factor of active income, and the stash
 * stops filling after IDLE.capHours, so logging in a few times a day matters but never replaces playing.
 * Monetization levers (later): capHours, factor, a collect multiplier.
 */
export const IDLE = { killsPerMin: 40, factor: 0.1, capHours: 3, minAwayMin: 1 }
export const killGold = (s: number) => Math.ceil((2 + s * 0.9) * Math.pow(1.1, s - 1))
export const idleRate = (s: number) => IDLE.killsPerMin * killGold(s) * IDLE.factor // gold per minute
export const idleCap = (s: number) => idleRate(s) * IDLE.capHours * 60
export const rnd = (a: number, b: number) => a + Math.random() * (b - a)
export const hpScale = (s: number) => 20 * Math.pow(1.27, s - 1)
export const buyCost = () => Math.ceil(15 * Math.pow(1.11, G.bought))
export const isBoss = (s: number) => s % 10 === 0

export function save() {
  try { G.lastSeen = Date.now(); localStorage.setItem('ig_save', JSON.stringify({ gold: G.gold, stage: G.stage, bought: G.bought, bench: G.bench, maxLevel: G.maxLevel, stash: G.stash, t: G.lastSeen })) } catch { /* storage unavailable */ }
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem('ig_save') || 'null')
    if (!s) { G.bench[0] = 0; G.bench[1] = 0; return false }
    Object.assign(G, { gold: s.gold, stage: s.stage, bought: s.bought, bench: s.bench, maxLevel: s.maxLevel, stash: s.stash ?? 0, lastSeen: s.t ?? Date.now() })
    return true
  } catch { G.bench[0] = 0; G.bench[1] = 0; return false }
}

export function startStage() {
  const s = G.stage, rules = rulesFor(s), L = buildLayout(s, hpScale)
  G.enemies.length = 0; G.shots.length = 0; G.ebullets.length = 0; G.shells.length = 0
  G.cover = L.cover; G.hazards = L.hazards; G.hold = null
  Object.assign(G.pack, { x: 180, y: 425, tx: 180, ty: 425 }); G.sup.x = 180; G.sup.y = 425
  G.flankOff = [0, 0, 0, 0]; G.spawned = 0; G.spawnT = 0.5
  for (const u of L.units) G.enemies.push({
    x: u.x, y: u.y, hp: hpScale(s) * (u.kind === 'mortar' ? 1.8 : 1.5), max: hpScale(s) * (u.kind === 'mortar' ? 1.8 : 1.5),
    spd: 0, r: 12, kind: u.kind, flash: 0, wob: Math.random() * 6, dmg: 0, cd: rnd(0.8, 2.4), dug: true, coverId: u.coverId,
  })
  G.toSpawn = Math.floor((isBoss(s) ? 8 + s : 6 + Math.floor(s * 1.5)) * rules.zombieMul)
  G.pack.max = 220 + s * 14; G.pack.hp = G.pack.max
  G.banner = { text: isBoss(s) ? 'BOSS STAGE ' + s : 'STAGE ' + s, sub: localStage(s) === 1 || s === 1 ? rules.tip : undefined, t: localStage(s) === 1 || s === 1 ? 3 : 1.6, big: isBoss(s) }
}

function spawnEnemy() {
  const s = G.stage, boss = isBoss(s) && G.spawned === 0
  const robot = s >= 6 && Math.random() < 0.35
  const hp = hpScale(s) * (boss ? 14 : 1) * rnd(0.9, 1.15) * (robot ? 1.4 : 1)
  G.enemies.push({
    x: rnd(ARENA.x0 + 20, ARENA.x1 - 20), y: ARENA.y0 - 10, hp, max: hp,
    spd: (boss ? 16 : rnd(22, 34)) * (robot ? 0.8 : 1), r: boss ? 24 : robot ? 13 : 11,
    kind: boss ? 'boss' : robot ? 'robot' : 'zombie', flash: 0, wob: Math.random() * 6, dmg: (4 + s * 1.3) * (boss ? 3 : 1), cd: 0,
  })
  G.spawned++
}

export function sortedWeapons() { return (G.bench.filter(v => v !== null) as number[]).sort((a, b) => b - a) }
/** Strike team (Rudy, Cooper) moves with the pack; support guardians move with the support centre (planted when HOLD is on). */
export function baseGuardianPos(i: number) { const c = i < STRIKE ? G.pack : G.sup, o = GUARDIANS[i].off; return { x: c.x + o[0], y: c.y + o[1] } }
export function guardianPos(i: number) { const b = baseGuardianPos(i); return { x: b.x + G.flankOff[i], y: b.y } }

const hazardAt = (x: number, y: number): HazardKind | null => { for (const h of G.hazards) if (inHazard(h, x, y)) return h.kind; return null }
const blocked = (ax: number, ay: number, bx: number, by: number) => { for (const c of G.cover) if (c.side === 'enemy' && c.hp > 0 && segRect(ax, ay, bx, by, c)) return c; return null }
const barricadeAlive = (e: Enemy) => !!e.dug && G.cover.some(c => c.id === e.coverId && c.hp > 0)

function killReward(e: Enemy) {
  G.kills++; G.combo++; G.comboT = 2.5
  const mul = e.kind === 'boss' ? 12 : e.kind === 'mortar' ? 2 : e.kind === 'gunner' ? 1.5 : 1
  const gold = Math.ceil(killGold(G.stage) * mul)
  G.gold += gold; G.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, gold })
}
function damageEnemy(e: Enemy, dmg: number, crit: boolean, flank: boolean) {
  e.hp -= dmg; e.flash = 0.1
  const kill = e.hp <= 0
  G.events.push({ type: 'dmg', x: e.x, y: e.y - e.r, v: dmg, crit, kill, flank })
  if (kill) killReward(e)
}
function fireFrom(i: number, w: number, target: Enemy, flank: 0 | 1 | 2) {
  const gp = guardianPos(i), wd = WEAPONS[w]
  const crit = Math.random() < 0.1, mult = (crit ? 2 : 1) * (flank === 2 ? 1.55 : flank === 1 ? 1.35 : 1)
  const n = wd.pellets || 1
  for (let k = 0; k < n; k++) {
    const dx = target.x - gp.x, dy = target.y - gp.y
    const a = Math.atan2(dy, dx) + (n > 1 ? (k - (n - 1) / 2) * 0.12 : rnd(-0.03, 0.03))
    G.shots.push({ x: gp.x, y: gp.y - 6, vx: Math.cos(a) * wd.spd, vy: Math.sin(a) * wd.spd, w, dmg: wd.dmg * mult, crit, flank, life: 1.6, tgt: n > 1 ? null : target, kind: wd.kind, col: wd.col })
  }
  G.events.push({ type: 'fire', kind: wd.kind, x: gp.x, y: gp.y, col: wd.col })
}
function hitCover(c: Cover, dmg: number, x: number, y: number) {
  c.hp -= dmg; c.flash = 0.12
  G.events.push({ type: 'cover_hit', id: c.id, x, y, v: dmg, kind: c.kind })
  if (c.hp <= 0) G.events.push({ type: 'cover_break', x: c.x, y: c.y, w: c.w, kind: c.kind })
}

/** HOLD plants the support squad where it stands so the drag steers only Rudy and Cooper; RECALL regroups. */
export function toggleHold(): 'on' | 'off' | 'locked' {
  if (unlockedGuardians(G.stage) <= STRIKE) return 'locked'
  if (G.hold) { G.hold = null; G.events.push({ type: 'hold', on: false }); return 'off' }
  G.hold = { x: G.sup.x, y: G.sup.y }; G.events.push({ type: 'hold', on: true }); return 'on'
}

export function update(dtReal: number) {
  const dt = dtReal * G.speed; G.t += dt
  G.stash = Math.min(idleCap(G.stage), G.stash + idleRate(G.stage) * dtReal / 60)
  const p = G.pack, n = unlockedGuardians(G.stage), rules = rulesFor(G.stage)

  // ---- pack movement: eases toward the drag target; hazards change the feel ----
  const hz = hazardAt(p.x, p.y)
  let follow = Math.min(1, 22 * dtReal)
  if (hz === 'ice') follow = Math.min(1, 4.5 * dtReal); else if (hz === 'mud') follow *= 0.45; else if (hz === 'shallows') follow *= 0.75
  p.x += (p.tx - p.x) * follow; p.y += (p.ty - p.y) * follow
  p.x = Math.max(PACK_BOUNDS.x0, Math.min(PACK_BOUNDS.x1, p.x)); p.y = Math.max(PACK_BOUNDS.y0, Math.min(PACK_BOUNDS.y1, p.y))
  // support squad: planted while HOLD, otherwise trails/rejoins the pack
  if (G.hold) { G.sup.x = G.hold.x; G.sup.y = G.hold.y }
  else { const dx = p.x - G.sup.x, dy = p.y - G.sup.y, d = Math.hypot(dx, dy); if (d > 0.01) { const st = Math.min(d, Math.max(d * 14 * dtReal, 0), 320 * dtReal); G.sup.x += dx / d * st; G.sup.y += dy / d * st } }
  for (const c of G.cover) if (c.hp > 0) {
    let r = pushOut(p.x, p.y, PACK_R, c); if (r) { p.x = r.x; p.y = r.y }
    r = pushOut(G.sup.x, G.sup.y, PACK_R, c); if (r) { G.sup.x = r.x; G.sup.y = r.y }
  }
  const centers = G.hold ? [p, G.sup] : [p]
  for (const c of centers) if (hazardAt(c.x, c.y) === 'lava') { p.hp -= p.max * 0.035 * dt; if (Math.random() < dt * 4) G.events.push({ type: 'pack_hit', x: c.x + rnd(-14, 14), y: c.y - 24, v: Math.ceil(p.max * 0.035 * 0.25) }) }

  if (G.comboT > 0 && (G.comboT -= dt) <= 0) G.combo = 0
  if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null
  for (const c of G.cover) if (c.flash > 0) c.flash -= dt
  if (G.spawned < G.toSpawn && (G.spawnT -= dt) <= 0) { spawnEnemy(); G.spawnT = isBoss(G.stage) ? 0.45 : 0.7 }

  // ---- guardians: status, targeting, auto-flank, fire ----
  const ws = sortedWeapons()
  for (let i = 0; i < n; i++) {
    const st = G.status[i]; st.flank = 0; st.cover = false
    const base = baseGuardianPos(i), gp = guardianPos(i)
    for (const e of G.enemies) if (e.kind === 'gunner') { for (const c of G.cover) if (c.side === 'player' && c.hp > 0 && segRect(e.x, e.y, gp.x, gp.y, c)) { st.cover = true; break } if (st.cover) break }
    const w = ws[i]
    if (w === undefined) { G.flankOff[i] = 0; continue }
    const arcs = WEAPONS[w].kind === 'grenade' // explosives arc over cover
    let near: Enemy | null = null, nd = 1e9, clear: Enemy | null = null, cdist = 1e9
    for (const e of G.enemies) {
      const d = Math.hypot(e.x - gp.x, e.y - gp.y)
      if (d < nd) { nd = d; near = e }
      if (d < cdist && (arcs || !blocked(gp.x, gp.y - 6, e.x, e.y))) { cdist = d; clear = e }
    }
    const tgt = clear ?? near
    if (i < STRIKE) { // auto-flank: slide sideways (up to 60px) to find a clear line round a barricade
      let desired = 0
      if (tgt && !arcs && blocked(base.x, base.y - 6, tgt.x, tgt.y)) {
        for (const o of [15, -15, 30, -30, 45, -45, 60, -60]) { const px = base.x + o; if (px < ARENA.x0 + 10 || px > ARENA.x1 - 10) continue; if (!blocked(px, base.y - 6, tgt.x, tgt.y)) { desired = o; break } }
      }
      const step = 90 * dtReal, cur = G.flankOff[i]; G.flankOff[i] = cur + Math.max(-step, Math.min(step, desired - cur))
    } else G.flankOff[i] = 0
    if (tgt && barricadeAlive(tgt) && (arcs || !blocked(gp.x, gp.y - 6, tgt.x, tgt.y))) {
      // flanking = you found a line round the barricade. 2 = your own positioning already cleared it; 1 = the guardian had to shuffle sideways
      st.flank = blocked(base.x, base.y - 6, tgt.x, tgt.y) ? 1 : 2
    }
    G.cd[i] -= dt
    if (G.cd[i] > 0 || !tgt) continue
    fireFrom(i, w, tgt, st.flank); G.cd[i] = 1 / WEAPONS[w].rate
  }

  // ---- player projectiles (barricades block direct fire; explosives arc over) ----
  for (const s of G.shots) {
    const px = s.x, py = s.y
    if (s.tgt && s.tgt.hp > 0) { const a = Math.atan2(s.tgt.y - s.y, s.tgt.x - s.x), sp = Math.hypot(s.vx, s.vy); s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt
    if (s.x < 0 || s.x > 360 || s.y < ARENA.y0 - 20 || s.y > 640) s.life = 0
    if (s.life <= 0) continue
    if (s.kind !== 'grenade') for (const c of G.cover) if (c.side === 'enemy' && c.hp > 0 && segRect(px, py, s.x, s.y, c)) { s.life = 0; hitCover(c, s.dmg, s.x, s.y); break }
    if (s.life <= 0) continue
    for (const e of G.enemies) {
      if (e.hp <= 0 || Math.hypot(e.x - s.x, e.y - s.y) >= e.r + 4) continue
      s.life = 0
      if (s.kind === 'grenade') {
        const sp = WEAPONS[s.w].splash ?? 60; let total = 0
        G.events.push({ type: 'boom', x: s.x, y: s.y, r: sp })
        for (const o of G.enemies) if (o.hp > 0 && Math.hypot(o.x - s.x, o.y - s.y) < sp) { total += s.dmg; o.hp -= s.dmg; o.flash = 0.1; if (o.hp <= 0) killReward(o) }
        G.events.push({ type: 'dmg', x: s.x, y: s.y - 14, v: total, crit: s.crit, kill: false, blast: true })
      } else { damageEnemy(e, s.dmg, s.crit, s.flank > 0); G.events.push({ type: 'hit', x: s.x, y: s.y, col: s.col }) }
      break
    }
  }
  G.shots = G.shots.filter(s => s.life > 0)

  // ---- enemies ----
  const aura = 0.92 // Rudy's Good Boy Aura
  for (const e of G.enemies) {
    if (e.flash > 0) e.flash -= dt
    if (e.hp <= 0) continue
    const ehz = hazardAt(e.x, e.y)
    if (ehz === 'lava') { e.hp -= e.max * 0.07 * dt; if (e.hp <= 0) { killReward(e); continue } }
    if (e.dug) { // gunners / mortars hold position behind their barricade
      if ((e.cd -= dt) > 0) continue
      const gp = guardianPos(Math.floor(Math.random() * n))
      if (e.kind === 'gunner') {
        const a = Math.atan2(gp.y - e.y, gp.x - e.x), bs = rules.bulletSpeed
        G.ebullets.push({ x: e.x, y: e.y + 8, vx: Math.cos(a) * bs, vy: Math.sin(a) * bs, dmg: bulletDmg(G.stage), life: 3, pass: 0 })
        G.events.push({ type: 'efire', x: e.x, y: e.y }); e.cd = rnd(1.3, 2.1)
      } else {
        G.shells.push({ x: e.x, y: e.y, tx: gp.x + rnd(-12, 12), ty: gp.y + rnd(-6, 6), t: 0, dur: 1.5, r: 48, dmg: 6 + G.stage * 1.6 })
        G.events.push({ type: 'mortar_fire', x: e.x, y: e.y }); e.cd = rnd(4.2, 5.6)
      }
      continue
    }
    // melee: chase the nearest of (strike team / pack) and (planted support squad); cover does NOT stop melee damage
    let tgt = centers[0], td = Math.hypot(centers[0].x - e.x, centers[0].y - e.y)
    for (const c of centers) { const d = Math.hypot(c.x - e.x, c.y - e.y); if (d < td) { td = d; tgt = c } }
    const slow = ehz === 'mud' ? 0.45 : ehz === 'shallows' ? 0.75 : 1
    if (td > 30) { e.x += (tgt.x - e.x) / td * e.spd * slow * dt; e.y += (tgt.y - e.y) / td * e.spd * slow * dt }
    else { p.hp -= e.dmg * dt * aura; if (Math.random() < dt * 3) G.events.push({ type: 'pack_hit', x: tgt.x + rnd(-20, 20), y: tgt.y - 20, v: Math.ceil(e.dmg * aura) }) }
    for (const c of G.cover) if (c.hp > 0) { const r = pushOut(e.x, e.y, e.r * 0.9, c); if (r) { e.x = r.x + (r.x >= c.x ? 1 : -1) * 40 * dt; e.y = r.y } }
    e.x = Math.max(ARENA.x0 + e.r, Math.min(ARENA.x1 - e.r, e.x)); e.y = Math.max(ARENA.y0 - 14, Math.min(ARENA.y1, e.y))
  }
  G.enemies = G.enemies.filter(e => e.hp > 0)

  // ---- enemy bullets: your cover blocks 100% until it degrades (<35% HP), then leaks 50% ----
  for (const b of G.ebullets) {
    const px = b.x, py = b.y
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt
    if (b.x < -10 || b.x > 370 || b.y > 650) b.life = 0
    if (b.life <= 0) continue
    for (const c of G.cover) {
      if (c.side !== 'player' || c.hp <= 0 || c.id === b.pass || !segRect(px, py, b.x, b.y, c)) continue
      if (c.hp > c.max * 0.35) { b.life = 0; hitCover(c, b.dmg, b.x, b.y) } else { hitCover(c, b.dmg, b.x, b.y); b.dmg *= 0.5; b.pass = c.id }
      break
    }
    if (b.life <= 0) continue
    for (let i = 0; i < n; i++) { const gp = guardianPos(i); if (Math.hypot(b.x - gp.x, b.y - gp.y) < 12) { b.life = 0; p.hp -= b.dmg * aura; G.events.push({ type: 'pack_hit', x: gp.x, y: gp.y - 22, v: Math.ceil(b.dmg * aura) }); break } }
  }
  G.ebullets = G.ebullets.filter(b => b.life > 0)

  // ---- mortar shells: telegraphed, arc OVER cover; spread out or move to dodge ----
  for (const s of G.shells) {
    s.t += dt
    if (s.t < s.dur) continue
    G.events.push({ type: 'boom', x: s.tx, y: s.ty, r: s.r })
    for (let i = 0; i < n; i++) { const gp = guardianPos(i); if (Math.hypot(gp.x - s.tx, gp.y - s.ty) < s.r) { p.hp -= s.dmg * 0.5 * aura; G.events.push({ type: 'pack_hit', x: gp.x, y: gp.y - 22, v: Math.ceil(s.dmg * 0.5 * aura) }) } }
    for (const c of G.cover) if (c.side === 'player' && c.hp > 0 && Math.hypot(c.x - s.tx, c.y - s.ty) < s.r + c.w / 2) hitCover(c, s.dmg * 0.4, c.x, c.y)
  }
  G.shells = G.shells.filter(s => s.t < s.dur)
  G.cover = G.cover.filter(c => c.hp > 0)

  // ---- wipe / clear ----
  if (p.hp <= 0) { G.banner = { text: 'REGROUP!', t: 1.4 }; startStage(); return }
  if (G.spawned >= G.toSpawn && G.enemies.length === 0) {
    const bonus = Math.ceil((10 + G.stage * 4) * Math.pow(1.1, G.stage - 1))
    G.gold += bonus; G.events.push({ type: 'stage_clear', stage: G.stage, gold: bonus })
    G.stage++; save(); startStage()
  }
}

// ---- idle income ----
/** Credit time spent away (page closed or tab hidden) into the stash, up to the cap. Opens the welcome-back summary if it was meaningful. */
export function accrueAway(now = Date.now()) {
  const mins = Math.max(0, (now - G.lastSeen) / 60000); G.lastSeen = now
  if (mins < IDLE.minAwayMin) return
  const earned = idleRate(G.stage) * mins, before = G.stash
  G.stash = Math.min(idleCap(G.stage), G.stash + earned)
  const gained = G.stash - before
  if (gained >= 1) G.away = { minutes: mins, gold: gained, capped: gained < earned * 0.98 }
}
/** Move the whole stash into gold. Returns how much was collected. */
export function collectStash() {
  const gold = Math.floor(G.stash); G.away = null
  if (gold < 1) return 0
  G.gold += gold; G.stash -= gold
  G.events.push({ type: 'idle_collect', gold }); save(); return gold
}

// ---- bench actions ----
export function buyWeapon() {
  const slot = G.bench.indexOf(null), c = buyCost()
  if (slot < 0 || G.gold < c) return false
  G.gold -= c; G.bought++
  G.bench[slot] = Math.max(0, G.maxLevel - 3)
  save(); return true
}
export function tryMerge(a: number, b: number) {
  const va = G.bench[a], vb = G.bench[b]
  if (a === b || va === null || va !== vb || va >= WEAPONS.length - 1) return false
  const lvl = va + 1; G.bench[b] = lvl; G.bench[a] = null
  G.events.push({ type: 'merge', slot: b, level: lvl })
  if (lvl > G.maxLevel) { G.maxLevel = lvl; G.events.push({ type: 'unlock', level: lvl, newEra: WEAPONS[lvl].era !== WEAPONS[lvl - 1].era }) }
  save(); return true
}
export function mergeAll() {
  let any = false, again = true
  while (again) {
    again = false
    for (let a = 0; a < 8 && !again; a++) for (let b = a + 1; b < 8; b++) if (tryMerge(a, b)) { any = true; again = true; break }
  }
  return any
}
