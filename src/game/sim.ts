import { ARENA, WEAPONS, GUARDIANS, ROSTER, SLOT_OFF, unlockedGuardians } from './data'
import type { WeaponKind } from './data'
import { BLESSINGS, BLESSING_EVERY } from './blessings'
import { weekMod } from './weekly'
import { pointsEarned, RESPEC_GEMS, SKILLS } from './skills'
import { rollItem, INV_MAX, CAPS, statVal, itemScore, SLOTS } from './gear'
import type { Item, Stat } from './gear'
import { dayKey, rollDaily, questDef } from './quests'
import { ACHIEVEMENTS, PASS_TIERS, PASS_XP, PASS_XP_GAIN, SPIN_SEGS, ACH_XP, seasonIndex, passReward, UNLOCK_STAGE } from './meta'
import type { Reward } from './meta'
import { clanPerk, clanHunt, clanLevel, clanById, weekKey, weeklyPool, MILESTONES, XP_PER_LEVEL } from './clan'
import type { PlayerClan } from './clan'
import type { Daily } from './quests'
import { buildLayout, rulesFor, bulletDmg, localStage, segRect, pushOut, inHazard } from './cover'
import type { Cover, Hazard, HazardKind } from './cover'

export interface Enemy { x: number; y: number; hp: number; max: number; spd: number; r: number; kind: 'zombie' | 'robot' | 'boss' | 'gunner' | 'mortar'; flash: number; wob: number; dmg: number; cd: number; dug?: boolean; coverId?: number; drake?: number; ab?: number }
/** Boss dragons: 0 Magma Wyrm (fire barrage), 1 Frost Drake (ice nova), 2 Storm Wyvern (lightning strikes), 3 Plague Drake (spits venom, calls a brood). */
export const DRAKES = [{ name: 'MAGMA WYRM', cast: 'FIRE BARRAGE', col: '#ff7a2a' }, { name: 'FROST DRAKE', cast: 'ICE NOVA', col: '#8fe0ff' }, { name: 'STORM WYVERN', cast: 'LIGHTNING', col: '#ffe45a' }, { name: 'PLAGUE DRAKE', cast: 'BROOD CALL', col: '#9be04a' }] as const
export const drakeFor = (stage: number) => (Math.floor(stage / 10) - 1 + 400) % 4
export interface AutoCfg { on: boolean; shield: boolean; frenzy: boolean; nade: boolean; tank: boolean; panic: boolean }
export interface Shot { x: number; y: number; vx: number; vy: number; w: number; dmg: number; crit: boolean; flank: 0 | 1 | 2; life: number; tgt: Enemy | null; kind: WeaponKind; col: string; gi: number }
export interface EBullet { x: number; y: number; vx: number; vy: number; dmg: number; life: number; pass: number }
export interface Shell { x: number; y: number; tx: number; ty: number; t: number; dur: number; r: number; dmg: number; col?: string }
export interface Nade { x: number; y: number; tx: number; ty: number; t: number; dur: number; r: number; dmg: number }
export interface Stats { dealt: number[]; nade: number; flank: number; taken: number[]; shield: number; cover: number }
export const newStats = (): Stats => ({ dealt: [0, 0, 0, 0], nade: 0, flank: 0, taken: [0, 0, 0, 0], shield: 0, cover: 0 })
export interface Status { cover: boolean; flank: 0 | 1 | 2 } // flank: 1 = auto-flank, 2 = manual (player-placed)
export interface Banner { text: string; sub?: string; t: number; big?: boolean }
export type GEvent =
  | { type: 'fire'; kind: WeaponKind; w: number; x: number; y: number; col: string }
  | { type: 'hit'; x: number; y: number; col: string }
  | { type: 'dmg'; x: number; y: number; v: number; crit: boolean; kill: boolean; blast?: boolean; flank?: boolean }
  | { type: 'kill'; x: number; y: number; kind: Enemy['kind']; gold: number }
  | { type: 'boom'; x: number; y: number; r: number; col?: string }
  | { type: 'pack_hit'; x: number; y: number; v: number }
  | { type: 'merge'; slot: number; level: number }
  | { type: 'unlock'; level: number; newEra: boolean }
  | { type: 'stage_clear'; stage: number; gold: number }
  | { type: 'cover_hit'; id: number; x: number; y: number; v: number; kind: Cover['kind'] }
  | { type: 'boss_cast'; x: number; y: number; name: string; col: string }
  | { type: 'cover_break'; x: number; y: number; w: number; kind: Cover['kind'] }
  | { type: 'efire'; x: number; y: number }
  | { type: 'mortar_fire'; x: number; y: number }
  | { type: 'raid_end' }
  | { type: 'clan_level'; lv: number }
  | { type: 'hold'; on: boolean }
  | { type: 'idle_collect'; gold: number }
  | { type: 'down'; i: number; x: number; y: number }
  | { type: 'revive'; i: number; x: number; y: number }
  | { type: 'crate'; x: number; y: number; label: string; drop?: boolean }
  | { type: 'ability'; kind: 'frenzy' | 'shield' | 'tank' | 'panic'; x: number; y: number }
  | { type: 'login_claim'; day: number; label: string }
  | { type: 'chest_get'; tier: number; n: number }
  | { type: 'quest_claim'; gems: number; gold: number }
  | { type: 'rebirth'; gain: number }
  | { type: 'blessing'; id: string }
  | { type: 'nade_throw'; x: number; y: number }

interface State {
  gold: number; stage: number; bought: number; bench: (number | null)[]; maxLevel: number
  pack: { x: number; y: number; tx: number; ty: number }
  /** Per-guardian health. A downed guardian (hp 0) stops firing and revives after REVIVE_T seconds. */
  hp: number[]; mhp: number[]; reviveT: number[]
  /** Damage breakdown for the Stats screen (this run; reset on Rebirth and on reload). */
  stats: Stats
  /** Gear: every item owned (on = wearer's roster index, -1 = inventory) and unopened chests per tier. */
  gear: Item[]; chests: number[]; nextItem: number
  /** Login streak: date of the last claim and the current streak length. */
  login: { last: string; streak: number }
  /** Skill ranks (id -> rank) and the best stage ever reached (feeds Paw Points). */
  skills: Record<string, number>; best: number
  /** Support squad centre (guardians 2+). Follows the pack, or stays planted at `hold`. */
  sup: { x: number; y: number }; hold: { x: number; y: number } | null
  enemies: Enemy[]; shots: Shot[]; ebullets: EBullet[]; shells: Shell[]; cover: Cover[]; hazards: Hazard[]; events: GEvent[]; t: number
  fail: number; failStage: number; spawned: number; toSpawn: number; spawnT: number; speed: number; cd: number[]; flankOff: number[]; status: Status[]
  nades: Nade[]; nadeCd: number
  /** Blessing stacks (id -> count) and a pending 3-way pick (ids) that pauses the game until chosen. */
  blessings: Record<string, number>; pick: string[] | null
  /** Rebirth currency (permanent) and how many times the player has reborn. */
  stardust: number; rebirths: number
  /** Gems (earned from daily quests, spent on blessing rerolls) and today's quests. */
  gems: number; daily: Daily
  /** Rewarded-ad usage today (see ads.ts) and the No-Ads purchase flag. */
  ads: { day: string; used: number }; noAds: boolean
  /** Active abilities: remaining effect time (t) and cooldown (cd), in sim seconds. */
  boostT: number; frenzyT: number; frenzyCd: number; shieldT: number; shieldCd: number; tankT: number; tankCd: number; panicT: number; panicCd: number
  banner: Banner | null; kills: number; combo: number; comboT: number
  /** Idle income: gold waiting in the kennel stash (must be collected), last time we saw the player, and the welcome-back summary. */
  /** Kennel: owned roster indexes, the two support slots (roster indexes) and dungeon coins. */
  owned: number[]; squad: number[]; coins: number
  /** Boss Raid: live run (null when not raiding) and the per-day attempt ledger + all-time best score. */
  clan: PlayerClan | null
  /** Lifetime counters (achievements), claimed achievement ids, season pass progress, lucky spin ledger. */
  life: Record<string, number>; achClaimed: string[]; pass: { s: number; xp: number; claimed: number }; spin: { day: string; free: number; ad: number }
  /** Auto-abilities: master switch plus per-ability switches (all on by default). nadeTaught = the player has thrown a grenade by hand. */
  auto: AutoCfg; autoT: number; nadeTaught: boolean
  raid: RaidState | null; raidInfo: { day: string; used: number; extra: number; best: number }
  /** Training levels (gold sink), the supply crate currently in the arena (tap it!) and the countdown to the next drop. */
  train: Record<string, number>; crate: { x: number; y: number; t: number } | null; crateT: number
  stash: number; lastSeen: number; away: { minutes: number; gold: number; capped: boolean } | null
}

export const PACK_BOUNDS = { x0: ARENA.x0 + 40, x1: ARENA.x1 - 40, y0: ARENA.y0 + 40, y1: ARENA.y1 - 50 }
const REVIVE_T = 12
const reviveTime = () => Math.max(5, REVIVE_T - sk('recov'))
const PACK_R = 22, STRIKE = 2 // guardians 0..1 (Rudy, Cooper) are the strike team
export const G: State = {
  gold: 40, stage: 1, bought: 0, bench: new Array(8).fill(null), maxLevel: 0,
  pack: { x: 180, y: 425, tx: 180, ty: 425 }, stats: newStats(), gear: [], chests: [0, 0, 0], nextItem: 1, login: { last: '', streak: 0 }, skills: {}, best: 1, hp: [1, 1, 1, 1], mhp: [1, 1, 1, 1], reviveT: [0, 0, 0, 0], sup: { x: 180, y: 425 }, hold: null,
  enemies: [], shots: [], ebullets: [], shells: [], cover: [], hazards: [], events: [], t: 0,
  fail: 0, failStage: 0, spawned: 0, toSpawn: 0, spawnT: 0, speed: 1, cd: [0, 0, 0, 0], flankOff: [0, 0, 0, 0],
  boostT: 0, status: [0, 1, 2, 3].map(() => ({ cover: false, flank: 0 as const })), nades: [], nadeCd: 0, blessings: {}, pick: null, stardust: 0, rebirths: 0, gems: 0, daily: rollDaily(dayKey()), ads: { day: dayKey(), used: 0 }, noAds: false, frenzyT: 0, frenzyCd: 0, shieldT: 0, shieldCd: 0, tankT: 0, tankCd: 0, panicT: 0, panicCd: 0, banner: null, kills: 0, combo: 0, comboT: 0, train: {}, crate: null, crateT: 25,
  stash: 0, lastSeen: Date.now(), away: null, owned: [2, 3], squad: [2, 3], coins: 0, life: {}, achClaimed: [], pass: { s: 0, xp: 0, claimed: 0 }, spin: { day: '', free: 0, ad: 0 }, auto: { on: true, shield: true, frenzy: true, nade: true, tank: true, panic: true }, autoT: 0, nadeTaught: false, clan: null, raid: null, raidInfo: { day: '', used: 0, extra: 0, best: 0 },
}
/**
 * Idle income. Tuned against measured active play (~40 kills/min): idle pays IDLE.factor of active income, and the stash
 * stops filling after IDLE.capHours, so logging in a few times a day matters but never replaces playing.
 * Monetization levers (later): capHours, factor, a collect multiplier.
 */
export const IDLE = { killsPerMin: 40, factor: 0.1, capHours: 3, minAwayMin: 1 }
export const killGold = (s: number) => Math.ceil((2 + s * 0.9) * Math.pow(1.1, s - 1))
export const idleRate = (s: number) => IDLE.killsPerMin * killGold(s) * IDLE.factor // gold per minute
export const idleCap = (s: number) => idleRate(s) * IDLE.capHours * 60 * (1 + 0.1 * sk('keeper') + 0.15 * pk('lucky'))
/** Rebirth: from stage REBIRTH_MIN you may reset the run for Stardust. Each Stardust is a permanent +STAR_BONUS damage and gold. */
export const REBIRTH_MIN = 20, STAR_BONUS = 0.04
export const starMul = () => 1 + STAR_BONUS * G.stardust
export const rebirthGain = (stage: number) => stage < REBIRTH_MIN ? 0 : Math.max(1, Math.floor(Math.pow((stage - 10) / 5, 1.5)))
// ---- daily quests ----
/** Roll a fresh set when the local date changes. */
export function ensureDaily() { const d = dayKey(); if (G.daily.day !== d) G.daily = rollDaily(d) }
export function track(id: string, n = 1) {
  G.life[id] = (G.life[id] ?? 0) + n
  ensureDaily(); const q = G.daily.q.find(x => x.id === id); if (!q) return
  const tgt = questDef(id).target; q.prog = Math.min(tgt, q.prog + n)
}
export const questReady = () => G.daily.q.filter(q => !q.claimed && q.prog >= questDef(q.id).target).length
export function claimQuest(i: number, mult = 1) {
  ensureDaily(); const q = G.daily.q[i], d = q && questDef(q.id)
  if (!q || q.claimed || q.prog < d.target) return false
  q.claimed = true; addPassXp(PASS_XP_GAIN.quest); const gems = d.gems * mult; G.gems += gems; const gold = Math.ceil(idleRate(G.stage) * 8) * mult; G.gold += gold
  G.events.push({ type: 'quest_claim', gems, gold }); save(); return true
}
export const REROLL_COST = 5
export function rerollBlessings(free = false) {
  if (!G.pick || (!free && G.gems < REROLL_COST)) return false
  if (!free) G.gems -= REROLL_COST; offerBlessings(); save(); return true
}
// ---- login streak ----
export const LOGIN_DAYS = 7
export interface LoginReward { gems?: number; goldMin?: number; chest?: number; label: string }
export const LOGIN_REWARDS: LoginReward[] = [
  { gems: 3, label: '3 gems' }, { goldMin: 30, label: 'Gold' }, { gems: 5, label: '5 gems' }, { chest: 1, label: 'Silver chest' },
  { goldMin: 60, label: 'More gold' }, { gems: 8, label: '8 gems' }, { chest: 2, gems: 15, label: 'Golden chest' },
]
const yesterdayKey = () => dayKey(new Date(Date.now() - 864e5))
export const canClaimLogin = () => G.login.last !== dayKey()
/** Day index (0-6) the next claim will pay. A missed day restarts the cycle at day 1. */
export const nextLoginDay = () => canClaimLogin() ? (G.login.last === yesterdayKey() ? G.login.streak % LOGIN_DAYS : 0) : (G.login.streak - 1) % LOGIN_DAYS
export function claimLogin() {
  if (!canClaimLogin()) return false
  const day = nextLoginDay(); G.login.streak = G.login.last === yesterdayKey() ? G.login.streak + 1 : 1; G.login.last = dayKey()
  const r = LOGIN_REWARDS[day]
  if (r.gems) G.gems += r.gems
  if (r.goldMin) G.gold += Math.ceil(idleRate(Math.max(G.stage, 3)) * r.goldMin)
  if (r.chest !== undefined) addChest(r.chest)
  addPassXp(PASS_XP_GAIN.login); G.events.push({ type: 'login_claim', day, label: r.label }); save(); return true
}

// ---- weekly modifier ----
export const wm = (id: string) => weekMod().id === id

// ---- gear ----
/** Roster index of the dog standing in pack slot i (identity until the Kennel lets you swap support dogs). */
export const dogId = (i: number) => (i < 2 ? i : G.squad[i - 2] ?? i)
/** 1 if a squad dog in an unlocked support slot has this perk. */
export const pk = (id: string) => G.squad.some((r, k) => ROSTER[r].perk === id && unlockedGuardians(G.stage) > 2 + k) ? 1 : 0
export function applySquad() { for (let k = 0; k < 2; k++) GUARDIANS[2 + k] = { ...ROSTER[G.squad[k]], off: SLOT_OFF[k] } }
export function buyDog(r: number): boolean { const d = ROSTER[r]; if (!d || G.owned.includes(r) || G.coins < (d.cost ?? 0)) return false; G.coins -= d.cost ?? 0; G.owned.push(r); save(); return true }
export function setSquad(k: number, r: number): boolean {
  if (!G.owned.includes(r) || r < 2) return false
  const other = 1 - k, i = 2 + k
  if (G.squad[k] === r) return false
  const ratio = G.hp[i] > 0 ? G.hp[i] / G.mhp[i] : 0
  if (G.squad[other] === r) G.squad[other] = G.squad[k]
  G.squad[k] = r; applySquad()
  for (const j of [2, 3]) { const was = G.mhp[j]; G.mhp[j] = Math.round((110 + G.stage * 7) * GUARDIANS[j].hpMul * hpBonus(j)); if (j === i) G.hp[j] = ratio > 0 ? Math.max(1, Math.round(G.mhp[j] * ratio)) : 0; else if (G.hp[j] > 0) G.hp[j] = Math.min(G.mhp[j], Math.max(1, Math.round(G.hp[j] * G.mhp[j] / Math.max(1, was)))) }
  save(); return true
}
export const gb = (i: number, stat: Stat) => { let v = 0; const d = dogId(i); for (const it of G.gear) if (it.on === d) v += statVal(it, stat); return v }
/** Gear total for a dog after the balance cap. */
export const gbc = (i: number, stat: Stat) => Math.min(CAPS[stat] ?? Infinity, gb(i, stat))
export const goldGear = () => { let v = 0; for (let i = 0; i < unlockedGuardians(G.stage); i++) v += gb(i, 'gold'); return v }
export const invCount = () => G.gear.filter(it => it.on < 0).length
export const sellValue = (it: Item) => Math.ceil(idleRate(Math.max(G.stage, 5)) * (2 + it.rar * 3))
export function addChest(tier: number, n = 1) { G.chests[tier] += n; G.events.push({ type: 'chest_get', tier, n }) }
/** Open one chest: the item goes to the inventory (or is sold on the spot if the inventory is full). */
export function openChest(tier: number): { item: Item; sold: number } | null {
  if (G.chests[tier] <= 0) return null
  G.chests[tier]--; const it = rollItem(G.nextItem++, tier, G.stage, skillLuck())
  let sold = 0
  if (invCount() >= INV_MAX) { sold = sellValue(it); G.gold += sold } else G.gear.push(it)
  save(); return { item: it, sold }
}
export function equipItem(id: number, dog: number) {
  const it = G.gear.find(x => x.id === id); if (!it) return false
  for (const o of G.gear) if (o.on === dog && o.slot === it.slot) o.on = -1
  it.on = dog; save(); return true
}
/** Gives each slot's best items to the dogs in roster order (strike team first). Returns how many items changed hands. */
export function autoEquip(): number {
  const nd = unlockedGuardians(G.stage), dogs = Array.from({ length: nd }, (_, i) => dogId(i)), before = G.gear.map(it => it.on); let moved = 0
  for (const sl of SLOTS) {
    const pool = G.gear.filter(it => it.slot === sl && (it.on < 0 || dogs.includes(it.on))).sort((a, b) => itemScore(b) - itemScore(a))
    pool.forEach((it, k) => { it.on = k < dogs.length ? dogs[k] : -1 })
  }
  G.gear.forEach((it, k) => { if (it.on !== before[k]) moved++ })
  if (moved) save(); return moved
}
export function unequipItem(id: number) { const it = G.gear.find(x => x.id === id); if (!it || invCount() >= INV_MAX) return false; it.on = -1; save(); return true }
export function sellItem(id: number) { const k = G.gear.findIndex(x => x.id === id); if (k < 0) return 0; const g = sellValue(G.gear[k]); G.gold += g; G.gear.splice(k, 1); save(); return g }
export const skillLuck = () => 0.03 * sk('hunter')

// ---- skills ----
export const sk = (id: string) => G.skills[id] ?? 0

// ---- Training: an endless gold sink. Every level is a small permanent boost, so there is always something worth buying. ----
export interface TrainDef { id: string; name: string; text: string; icon: string; col: string; base: number; grow: number }
export const TRAIN: TrainDef[] = [
  { id: 'power',   name: 'Fang Training',   text: '+4% damage per level (stacks multiplicatively)', icon: 'sword', col: '#ff6a5a', base: 60, grow: 1.21 },
  { id: 'haste',   name: 'Quick Paws',      text: '+1.5% fire rate per level',                       icon: 'frenzy', col: '#ffb347', base: 90, grow: 1.21 },
  { id: 'vital',   name: 'Thick Fur',       text: '+5% max HP per level',                            icon: 'shield', col: '#5ab8ff', base: 50, grow: 1.17 },
  { id: 'fortune', name: 'Treat Radar',     text: '+4% gold from kills per level',                   icon: 'coin',   col: '#ffd84a', base: 70, grow: 1.22 },
]
export const tl = (id: string) => G.train[id] ?? 0
export const trainPow = () => Math.pow(1.04, tl('power'))
export const trainCost = (id: string) => { const d = TRAIN.find(x => x.id === id)!; return Math.ceil(d.base * Math.pow(d.grow, tl(id))) }
export const trainAffordable = () => unlocked('train') && TRAIN.some(d => G.gold >= trainCost(d.id))
export function buyTrain(id: string): boolean {
  const c = trainCost(id); if (!TRAIN.some(d => d.id === id) || G.gold < c) return false
  G.gold -= c; G.train[id] = tl(id) + 1; track('trains'); if (id === 'vital') for (let i = 0; i < 4; i++) { const was = G.mhp[i]; G.mhp[i] = Math.round((110 + G.stage * 7) * GUARDIANS[i].hpMul * hpBonus(i)); if (G.hp[i] > 0) G.hp[i] += G.mhp[i] - was }
  save(); return true
}

// ---- Supply crates: every minute or so one drops somewhere in the arena. Tap it before it fades for a prize. ----
export const CRATE_LIFE = 9
export function collectCrate(): string {
  const c = G.crate; if (!c) return ''
  G.crate = null; const r = Math.random(); let label: string
  if (r < 0.55) { const g = Math.ceil(killGold(G.stage) * 25 * starMul()); G.gold += g; label = '+' + fmtN(g) + ' gold' }
  else if (r < 0.72) { const n = 2 + Math.floor(G.stage / 12); G.coins += n; label = '+' + n + ' coins' }
  else if (r < 0.84) { G.gems += 2; label = '+2 gems' }
  else if (r < 0.96) { G.frenzyT = Math.max(G.frenzyT, 10); label = 'FRENZY 10s' }
  else { addChest(G.stage < 20 ? 0 : 1); label = 'Chest!' }
  track('crates'); G.events.push({ type: 'crate', x: c.x, y: c.y, label }); return label
}
const fmtN = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : '' + n
export const pointsSpent = () => Object.values(G.skills).reduce((a, b) => a + b, 0)
export const pointsLeft = () => pointsEarned(G.best, G.rebirths) - pointsSpent()
export function buySkill(id: string) {
  const d = SKILLS.find(s => s.id === id); if (!d || sk(id) >= d.max || pointsLeft() < 1) return false
  G.skills[id] = sk(id) + 1; save(); return true
}
export function respec() { if (G.gems < RESPEC_GEMS || pointsSpent() === 0) return false; G.gems -= RESPEC_GEMS; G.skills = {}; save(); return true }
const flankMul = () => (weekMod().id === 'flank' ? 1.5 : 1) * (1 + 0.08 * sk('flanker'))

export const bl = (id: string) => G.blessings[id] ?? 0
export const nadeCdMax = () => NADE.cd * (pk('bark') ? 0.85 : 1) * Math.pow(0.85, bl('blast')) * (wm('bomb') ? 0.6 : 1) * (1 - 0.03 * sk('boomS'))
export const shieldDur = () => ABIL.shield.dur + bl('aegis') + 0.4 * sk('aegisS')
export const frenzyDur = () => ABIL.frenzy.dur + 1.5 * bl('fury')
export const rnd = (a: number, b: number) => a + Math.random() * (b - a)
// early stages are a bit beefier so the opening isn't over in two minutes; the bump fades out by the mid game
export const hpScale = (s: number) => 20 * Math.pow(1.27, s - 1) * (1 + 2.2 / (1 + s / 5))
export const buyCost = () => Math.ceil(15 * Math.pow(1.11, G.bought))
export const isBoss = (s: number) => s % 10 === 0

let bakAt = 0
export function save() {
  try { if (Date.now() - bakAt > 120000) { const prev = localStorage.getItem('ig_save'); if (prev) { localStorage.setItem('ig_save_bak', prev); bakAt = Date.now() } } } catch { /* storage unavailable */ }
  try { G.lastSeen = Date.now(); localStorage.setItem('ig_save', JSON.stringify({ bt: Math.round(G.boostT), gold: G.gold, stage: G.stage, bought: G.bought, bench: G.bench, maxLevel: G.maxLevel, stash: G.stash, bl: G.blessings, pick: G.pick, lf: G.life, ac: G.achClaimed, ps: G.pass, sp: G.spin, au: G.auto, nt: G.nadeTaught, cl: G.clan, rd: G.raidInfo, kn: G.owned, sq: G.squad, co: G.coins, sd: G.stardust, rb: G.rebirths, gm: G.gems, dq: G.daily, ad: G.ads, na: G.noAds, gr: G.gear, ch: G.chests, ni: G.nextItem, lg: G.login, sk: G.skills, tr: G.train, bs: G.best, t: G.lastSeen })) } catch { /* storage unavailable */ }
}
export function load() {
  try {
    // a corrupted or wrongly shaped main save falls back to the rolling backup (kept every ~2 min)
    const rd = (k: string) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : null } catch { return null } }
    const s = rd('ig_save') ?? rd('ig_save_bak')
    if (!s) { G.bench[0] = 0; G.bench[1] = 0; return false }
    // core fields: fall back to fresh-game values if a save is missing or has the wrong shape, so a bad save can't crash the game
    const num = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d
    const arr = <T,>(v: unknown, d: T[]) => Array.isArray(v) ? v as T[] : d
    const benchOk = arr<number | null>(s.bench, []).length === 8 ? s.bench : (() => { const b: (number | null)[] = new Array(8).fill(null); arr<number | null>(s.bench, [0, 0]).slice(0, 8).forEach((v, i) => { b[i] = v }); return b })()
    Object.assign(G, { gold: num(s.gold, 40), stage: Math.max(1, num(s.stage, 1)), bought: num(s.bought, 0), bench: benchOk, maxLevel: num(s.maxLevel, 0), stash: s.stash ?? 0, blessings: s.bl ?? {}, pick: s.pick ?? null, stardust: s.sd ?? 0, rebirths: s.rb ?? 0, gems: s.gm ?? 0, daily: s.dq ?? rollDaily(dayKey()), ads: s.ad ?? { day: dayKey(), used: 0 }, noAds: !!s.na, gear: s.gr ?? [], chests: s.ch ?? [0, 0, 0], nextItem: s.ni ?? 1, login: s.lg ?? { last: '', streak: 0 }, life: s.lf ?? {}, achClaimed: s.ac ?? [], pass: s.ps ?? { s: 0, xp: 0, claimed: 0 }, spin: s.sp ?? { day: '', free: 0, ad: 0 }, auto: { on: true, shield: true, frenzy: true, nade: true, tank: true, panic: true, ...(s.au ?? {}) }, nadeTaught: !!s.nt, clan: s.cl ?? null, raidInfo: s.rd ?? { day: '', used: 0, extra: 0, best: 0 }, owned: s.kn ?? [2, 3], squad: s.sq ?? [2, 3], coins: s.co ?? 0, skills: s.sk ?? {}, train: s.tr ?? {}, boostT: Math.min(BOOST.cap, Math.max(0, num(s.bt, 0))), best: Math.max(s.bs ?? 1, s.stage ?? 1), lastSeen: s.t ?? Date.now() })
    applySquad(); return true
  } catch { G.bench[0] = 0; G.bench[1] = 0; return false }
}

export function startStage() {
  const s = G.stage, rules = rulesFor(s), L = buildLayout(s, hpScale)
  G.enemies.length = 0; G.shots.length = 0; G.ebullets.length = 0; G.shells.length = 0; G.nades.length = 0; G.frenzyT = 0; G.shieldT = 0; G.tankT = 0; G.panicT = 0
  G.cover = L.cover; G.hazards = L.hazards; G.hold = null
  for (const c of G.cover) if (c.side === 'player') { c.hp *= 1 + 0.08 * sk('bunker'); c.max *= 1 + 0.08 * sk('bunker') }
  Object.assign(G.pack, { x: 180, y: 425, tx: 180, ty: 425 }); G.sup.x = 180; G.sup.y = 425
  G.flankOff = [0, 0, 0, 0]; G.spawned = 0; G.spawnT = 0.5
  for (const u of L.units) G.enemies.push({
    x: u.x, y: u.y, hp: hpScale(s) * (u.kind === 'mortar' ? 1.8 : 1.5), max: hpScale(s) * (u.kind === 'mortar' ? 1.8 : 1.5),
    spd: 0, r: 12, kind: u.kind, flash: 0, wob: Math.random() * 6, dmg: 0, cd: rnd(0.8, 2.4), dug: true, coverId: u.coverId,
  })
  G.toSpawn = Math.floor((isBoss(s) ? 8 + s : 6 + Math.floor(s * 1.5)) * rules.zombieMul)
  for (let i = 0; i < 4; i++) { G.mhp[i] = Math.round((110 + s * 7) * GUARDIANS[i].hpMul * hpBonus(i) * (1 + resolve())); G.hp[i] = G.mhp[i]; G.reviveT[i] = 0 }
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
    ...(boss ? { drake: drakeFor(s), ab: 3.5 } : {}),
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

/** A boss dragon's signature move. Everything is telegraphed (shell rings) so it can be dodged by moving; raid bosses cast slower. Enrages under 35% HP. */
function bossCast(e: Enemy, dt: number, n: number) {
  if (e.drake === undefined || e.ab === undefined || (e.ab -= dt) > 0) return
  const live: number[] = []; for (let k = 0; k < n; k++) if (G.hp[k] > 0) live.push(k)
  if (!live.length) { e.ab = 1; return }
  const d = DRAKES[e.drake], enr = e.hp < e.max * 0.35, base = [6.5, 7.5, 6, 9][e.drake] * (enr ? 0.65 : 1) * (G.raid ? 1.4 : 1), sd = 8 + G.stage * 1.8
  const tgt = () => { const gp = guardianPos(live[Math.floor(Math.random() * live.length)]); return { x: gp.x + rnd(-12, 12), y: gp.y + rnd(-8, 8) } }
  G.events.push({ type: 'boss_cast', x: e.x, y: e.y, name: d.cast, col: d.col }); e.ab = base
  if (e.drake === 0) { for (let k = 0; k < (enr ? 5 : 3); k++) { const t = tgt(); G.shells.push({ x: e.x, y: e.y, tx: t.x, ty: t.y, t: -k * 0.2, dur: 1.3, r: 42, dmg: sd, col: d.col }) } }
  else if (e.drake === 1) { const c = guardianPos(live[0]); G.shells.push({ x: e.x, y: e.y, tx: c.x, ty: c.y, t: 0, dur: 1.9, r: enr ? 110 : 90, dmg: sd * 1.3, col: d.col }) }
  else if (e.drake === 2) { for (let k = 0; k < (enr ? 7 : 5); k++) { const t = tgt(); G.shells.push({ x: t.x, y: ARENA.y0 - 20, tx: t.x, ty: t.y, t: -k * 0.22, dur: 0.75, r: 26, dmg: sd * 0.8, col: d.col }) } }
  else {
    const t = tgt(); G.shells.push({ x: e.x, y: e.y, tx: t.x, ty: t.y, t: 0, dur: 1.4, r: 50, dmg: sd, col: d.col })
    for (let k = 0; k < (enr ? 4 : 2); k++) { const hp = hpScale(G.stage) * 0.5; G.enemies.push({ x: e.x + rnd(-24, 24), y: e.y + 10, hp, max: hp, spd: rnd(30, 40), r: 10, kind: 'zombie', flash: 0, wob: Math.random() * 6, dmg: (4 + G.stage * 1.3) * 0.7, cd: 0 }) }
  }
}

function killReward(e: Enemy) {
  track('kills'); G.kills++; G.combo++; G.comboT = 2.5
  const mul = e.kind === 'boss' ? 12 : e.kind === 'mortar' ? 2 : e.kind === 'gunner' ? 1.5 : 1
  const gold = G.raid ? 0 : Math.ceil(killGold(G.stage) * mul * (1 + 0.15 * bl('fortune') + 0.1 * pk('treats') + cp('gold') + goldGear() + 0.04 * sk('gold') + 0.04 * tl('fortune') + (wm('gold') ? 0.3 : 0) + (G.boostT > 0 ? BOOST.gold : 0)) * starMul())
  G.gold += gold; G.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, gold })
}
function damageEnemy(e: Enemy, dmg: number, crit: boolean, flank: boolean, gi = -1, fl = 0) {
  if (gi >= 0 && e.kind === 'boss') dmg *= 1 + gbc(gi, 'boss')
  if (gi >= 0 && alive(gi)) { const ls = gbc(gi, 'steal'); if (ls > 0 && G.hp[gi] < G.mhp[gi]) G.hp[gi] = Math.min(G.mhp[gi], G.hp[gi] + G.mhp[gi] * ls) } // lifesteal: a % of max HP per hit, not of damage
  if (G.raid) G.raid.dmg += Math.min(dmg, Math.max(0, e.hp))
  e.hp -= dmg; e.flash = 0.1
  if (gi >= 0) G.stats.dealt[gi] += dmg
  if (flank) { track('flank'); const fk = flankMul(), m = fl === 2 ? 1 + 0.55 * fk : 1 + 0.35 * fk; G.stats.flank += dmg * (1 - 1 / m) }
  const kill = e.hp <= 0
  G.events.push({ type: 'dmg', x: e.x, y: e.y - e.r, v: dmg, crit, kill, flank })
  if (kill) killReward(e)
}
function fireFrom(i: number, w: number, target: Enemy, flank: 0 | 1 | 2) {
  const gp = guardianPos(i), wd = WEAPONS[w]
  const crit = Math.random() < Math.min(0.75, 0.1 + 0.06 * bl('crit') + 0.06 * pk('keen') + gbc(i, 'crit') + 0.02 * sk('keen')), fk = flankMul(), mult = (crit ? 2 + gbc(i, 'cdmg') : 1) * (flank === 2 ? 1 + 0.55 * fk : flank === 1 ? 1 + 0.35 * fk : 1)
  const n = wd.pellets || 1
  for (let k = 0; k < n; k++) {
    const dx = target.x - gp.x, dy = target.y - gp.y
    const a = Math.atan2(dy, dx) + (n > 1 ? (k - (n - 1) / 2) * 0.12 : rnd(-0.03, 0.03))
    G.shots.push({ x: gp.x, y: gp.y - 6, vx: Math.cos(a) * wd.spd, vy: Math.sin(a) * wd.spd, w, dmg: wd.dmg * GUN_MUL * (1 + resolve()) * (G.boostT > 0 ? 1 + BOOST.dmg : 1) * GUARDIANS[i].dmgMul * (1 + 0.1 * bl('power')) * (1 + gb(i, 'dmg')) * (1 + 0.03 * sk('sharp')) * (1 + 0.1 * pk('night')) * (1 + cp('dmg') + clanHunt(G.clan)) * (wm('power') ? 1.2 : 1) * starMul() * trainPow() * mult * dogPower(i), crit, flank, life: 1.6, tgt: n > 1 ? null : target, kind: wd.kind, col: wd.col, gi: i })
  }
  G.events.push({ type: 'fire', kind: wd.kind, w, x: gp.x, y: gp.y, col: wd.col })
}
/** Pack Resolve: every wipe on the same stage gives the next attempt +10% power and health (max +60%), until the stage is cleared. Keeps a boss wall from being a dead end. */
export const resolve = () => !G.raid && G.failStage === G.stage ? Math.min(0.6, 0.1 * G.fail) : 0
const hpBonus = (i: number) => 1 + cp('hp') + 0.15 * bl('vital') + gb(i, 'hp') + 0.04 * sk('coat') + 0.05 * tl('vital') + (wm('iron') ? 0.3 : 0)
const alive = (i: number) => G.hp[i] > 0
/** Rudy's Tank mode (guardian 0): takes 40% damage and hits 1.5x. Cooper's Panic mode (guardian 1): hits 2.3x but takes 2.5x. */
export const MODES = { tank: { dur: 7, cd: 24, armor: 0.4, power: 1.5 }, panic: { dur: 6, cd: 26, armor: 2.5, power: 2.3 } }
const dogPower = (i: number) => (i === 0 && G.tankT > 0 ? MODES.tank.power : 1) * (i === 1 && G.panicT > 0 ? MODES.panic.power : 1)
export const cp = (k: string) => clanPerk(G.clan, k)
const dogArmor = (i: number) => (pk('guard') ? 0.92 : 1) * (i === 0 && G.tankT > 0 ? MODES.tank.armor : 1) * (i === 1 && G.panicT > 0 ? MODES.panic.armor : 1)
function hurt(i: number, dmg: number) {
  if (!alive(i)) return
  if (G.shieldT > 0) { G.stats.shield += dmg; return } // Guardian Shield: all incoming damage is blocked
  dmg *= dogArmor(i) * (1 - gbc(i, 'guard'))
  G.stats.taken[i] += Math.min(dmg, G.hp[i]); G.hp[i] -= dmg
  if (G.hp[i] <= 0) { G.hp[i] = 0; G.reviveT[i] = reviveTime(); const gp = guardianPos(i); G.events.push({ type: 'down', i, x: gp.x, y: gp.y }) }
}
function nearestAlive(x: number, y: number, n: number) {
  let b = -1, bd = 1e9
  for (let i = 0; i < n; i++) if (alive(i)) { const gp = guardianPos(i), d = Math.hypot(gp.x - x, gp.y - y); if (d < bd) { bd = d; b = i } }
  return b
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

/** Active ability: lob a grenade at the densest clump of enemies (nearest to the pack wins ties). Arcs over cover. */
export const NADE = { cd: 12, r: 64, dur: 0.75 }
/** Grenade hit as a multiple of a same-stage enemy's HP, and the global gun damage multiplier. Tuned so guns do ~70% of damage and the grenade is a strong assist, not the main weapon. */
export const NADE_DMG = 0.5
/** Pack Boost: a player-chosen rewarded-ad buff. 10 minutes of +50% gold and +25% gun damage; watching again adds time up to a 30 minute cap. */
export const BOOST = { dur: 600, cap: 1800, gold: 0.5, dmg: 0.25 }
export const startBoost = () => { G.boostT = Math.min(BOOST.cap, G.boostT + BOOST.dur); save() }
export const GUN_MUL = 3
/** Size of the biggest bunch of enemies a grenade would catch. */
export function bestClump() {
  const live = G.enemies.filter(e => e.hp > 0); let bc = 0
  for (const e of live) { let c = 0; for (const o of live) if (Math.hypot(o.x - e.x, o.y - e.y) < NADE.r) c++; if (c > bc) bc = c }
  return bc
}
export function throwGrenade(): 'ok' | 'cooldown' | 'none' {
  if (G.nadeCd > 0) return 'cooldown'
  const live = G.enemies.filter(e => e.hp > 0)
  if (!live.length) return 'none'
  let best = live[0], bc = -1, bd = 1e9
  for (const e of live) {
    let c = 0; for (const o of live) if (Math.hypot(o.x - e.x, o.y - e.y) < NADE.r) c++
    const d = Math.hypot(e.x - G.pack.x, e.y - G.pack.y)
    if (c > bc || (c === bc && d < bd)) { best = e; bc = c; bd = d }
  }
  let sx = 0, sy = 0, k = 0
  for (const o of live) if (Math.hypot(o.x - best.x, o.y - best.y) < NADE.r) { sx += o.x; sy += o.y; k++ }
  G.nades.push({ x: G.pack.x, y: G.pack.y - 10, tx: sx / k, ty: sy / k, t: 0, dur: NADE.dur, r: NADE.r, dmg: hpScale(G.stage) * NADE_DMG * starMul() * (wm('bomb') ? 1.25 : 1) * (1 + 0.08 * sk('boomS')) })
  G.nadeCd = nadeCdMax(); track('nades'); G.events.push({ type: 'nade_throw', x: G.pack.x, y: G.pack.y - 10 }); return 'ok'
}

/** Frenzy: every gun fires at double rate. Shield: the whole pack takes no damage. Both are tap-to-use with a cooldown. */
export const ABIL = { frenzy: { dur: 6, cd: 18, mul: 2 }, shield: { dur: 5, cd: 22 } }
export function useAbility(kind: 'frenzy' | 'shield' | 'tank' | 'panic'): 'ok' | 'cooldown' | 'down' {
  if (kind === 'tank' || kind === 'panic') {
    const i = kind === 'tank' ? 0 : 1, m = MODES[kind]
    if (!alive(i) || unlockedGuardians(G.stage) <= i) return 'down'
    if (kind === 'tank' ? G.tankCd > 0 : G.panicCd > 0) return 'cooldown'
    if (kind === 'tank') { G.tankT = m.dur; G.tankCd = m.cd } else { G.panicT = m.dur; G.panicCd = m.cd }
    track('abil'); const gp = guardianPos(i); G.events.push({ type: 'ability', kind, x: gp.x, y: gp.y }); return 'ok'
  }
  if (kind === 'frenzy') { if (G.frenzyCd > 0) return 'cooldown'; G.frenzyT = frenzyDur(); G.frenzyCd = ABIL.frenzy.cd }
  else { if (G.shieldCd > 0) return 'cooldown'; G.shieldT = shieldDur(); G.shieldCd = ABIL.shield.cd }
  track('abil'); G.events.push({ type: 'ability', kind, x: G.pack.x, y: G.pack.y }); return 'ok'
}

export function update(dtReal: number) {
  if (Math.floor(G.t) % 20 === 0) ensureDaily() // cheap midnight rollover check
  if (G.raid?.result) closeRaid()
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
  for (let i = 0; i < n; i++) if (alive(i)) { // lava burns whoever stands in it; downed guardians come back after a rest
    const gp = guardianPos(i)
    if (hazardAt(gp.x, gp.y) === 'lava') { hurt(i, G.mhp[i] * 0.035 * dt); if (Math.random() < dt * 4) G.events.push({ type: 'pack_hit', x: gp.x + rnd(-10, 10), y: gp.y - 24, v: Math.ceil(G.mhp[i] * 0.035 * 0.25) }) }
  } else if ((G.reviveT[i] -= dt) <= 0) { G.hp[i] = Math.ceil(G.mhp[i] * 0.4); const gp = guardianPos(i); G.events.push({ type: 'revive', i, x: gp.x, y: gp.y }) }

  if (pk('medic')) for (let i = 0; i < n; i++) if (alive(i) && G.hp[i] < G.mhp[i]) G.hp[i] = Math.min(G.mhp[i], G.hp[i] + G.mhp[i] * 0.01 * dt)
  if (G.comboT > 0 && (G.comboT -= dt) <= 0) G.combo = 0
  if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null
  for (const c of G.cover) if (c.flash > 0) c.flash -= dt
  if (G.spawned < G.toSpawn && (G.spawnT -= dt) <= 0) { spawnEnemy(); G.spawnT = isBoss(G.stage) ? 0.45 : 0.7 }
  if (!G.raid && G.best >= 3) {
    if (G.crate) { if ((G.crate.t -= dt) <= 0) G.crate = null }
    else if ((G.crateT -= dt) <= 0) {
      G.crateT = 45 + Math.random() * 40
      const x = ARENA.x0 + 30 + Math.random() * (ARENA.x1 - ARENA.x0 - 60), y = ARENA.y0 + 40 + Math.random() * (ARENA.y1 - ARENA.y0 - 120)
      G.crate = { x, y, t: CRATE_LIFE }; G.events.push({ type: 'crate', x, y, label: 'SUPPLY DROP', drop: true })
    }
  }

  // ---- guardians: status, targeting, auto-flank, fire ----
  const ws = sortedWeapons()
  for (let i = 0; i < n; i++) {
    const st = G.status[i]; st.flank = 0; st.cover = false
    if (!alive(i)) { G.flankOff[i] = 0; continue }
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
    G.cd[i] -= dt * (G.frenzyT > 0 ? ABIL.frenzy.mul : 1) * (1 + 0.08 * bl('rapid') + cp('rate') + 0.08 * pk('spotter') + gb(i, 'rate') + 0.02 * sk('quick') + 0.015 * tl('haste') + (wm('quick') ? 0.2 : 0))
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
        for (const o of G.enemies) if (o.hp > 0 && Math.hypot(o.x - s.x, o.y - s.y) < sp) { total += s.dmg; G.stats.dealt[s.gi] += s.dmg; o.hp -= s.dmg; o.flash = 0.1; if (o.hp <= 0) killReward(o) }
        G.events.push({ type: 'dmg', x: s.x, y: s.y - 14, v: total, crit: s.crit, kill: false, blast: true })
      } else { damageEnemy(e, s.dmg, s.crit, s.flank > 0, s.gi, s.flank); G.events.push({ type: 'hit', x: s.x, y: s.y, col: s.col }) }
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
    if (e.kind === 'boss') bossCast(e, dt, n)
    if (ehz === 'lava') { e.hp -= e.max * 0.07 * dt; if (e.hp <= 0) { killReward(e); continue } }
    if (e.dug) { // gunners / mortars hold position behind their barricade
      if ((e.cd -= dt) > 0) continue
      const li = []; for (let k = 0; k < n; k++) if (alive(k)) li.push(k)
      const gp = guardianPos(li.length ? li[Math.floor(Math.random() * li.length)] : 0)
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
    else { const vi = nearestAlive(e.x, e.y, n); if (vi >= 0) { hurt(vi, e.dmg * dt * aura); if (Math.random() < dt * 3) { const vp = guardianPos(vi); G.events.push({ type: 'pack_hit', x: vp.x + rnd(-10, 10), y: vp.y - 20, v: Math.ceil(e.dmg * aura) }) } } }
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
      G.stats.cover += b.dmg * (c.hp > c.max * 0.35 ? 1 : 0.5)
      if (c.hp > c.max * 0.35) { b.life = 0; hitCover(c, b.dmg, b.x, b.y) } else { hitCover(c, b.dmg, b.x, b.y); b.dmg *= 0.5; b.pass = c.id }
      break
    }
    if (b.life <= 0) continue
    for (let i = 0; i < n; i++) { const gp = guardianPos(i); if (alive(i) && Math.hypot(b.x - gp.x, b.y - gp.y) < 12) { b.life = 0; hurt(i, b.dmg * aura); G.events.push({ type: 'pack_hit', x: gp.x, y: gp.y - 22, v: Math.ceil(b.dmg * aura) }); break } }
  }
  G.ebullets = G.ebullets.filter(b => b.life > 0)

  // ---- player grenades ----
  if (G.nadeCd > 0) G.nadeCd = Math.max(0, G.nadeCd - dt)
  G.boostT = Math.max(0, G.boostT - dt); G.frenzyT = Math.max(0, G.frenzyT - dt); G.frenzyCd = Math.max(0, G.frenzyCd - dt); G.shieldT = Math.max(0, G.shieldT - dt); G.shieldCd = Math.max(0, G.shieldCd - dt); G.tankT = Math.max(0, G.tankT - dt); G.tankCd = Math.max(0, G.tankCd - dt); G.panicT = Math.max(0, G.panicT - dt); G.panicCd = Math.max(0, G.panicCd - dt)
  for (const g of G.nades) {
    g.t += dt
    if (g.t < g.dur) continue
    G.events.push({ type: 'boom', x: g.tx, y: g.ty, r: g.r }); let total = 0
    for (const o of G.enemies) if (o.hp > 0 && Math.hypot(o.x - g.tx, o.y - g.ty) < g.r + o.r * 0.5) { const d = o.kind === 'boss' ? g.dmg * 0.6 : g.dmg; total += d; G.stats.nade += d; o.hp -= d; o.flash = 0.12; if (o.hp <= 0) killReward(o) }
    for (const c of G.cover) if (c.side === 'enemy' && c.hp > 0 && Math.hypot(c.x - g.tx, c.y - g.ty) < g.r + c.w / 2) hitCover(c, g.dmg * 0.5, c.x, c.y)
    G.events.push({ type: 'dmg', x: g.tx, y: g.ty - 14, v: total, crit: false, kill: false, blast: true })
  }
  G.nades = G.nades.filter(g => g.t < g.dur)

  // ---- mortar shells: telegraphed, arc OVER cover; spread out or move to dodge ----
  for (const s of G.shells) {
    s.t += dt
    if (s.t < s.dur) continue
    G.events.push({ type: 'boom', x: s.tx, y: s.ty, r: s.r, col: s.col })
    for (let i = 0; i < n; i++) { const gp = guardianPos(i); if (alive(i) && Math.hypot(gp.x - s.tx, gp.y - s.ty) < s.r) { hurt(i, s.dmg * 0.5 * aura); G.events.push({ type: 'pack_hit', x: gp.x, y: gp.y - 22, v: Math.ceil(s.dmg * 0.5 * aura) }) } }
    for (const c of G.cover) if (c.side === 'player' && c.hp > 0 && Math.hypot(c.x - s.tx, c.y - s.ty) < s.r + c.w / 2) hitCover(c, s.dmg * 0.4, c.x, c.y)
  }
  G.shells = G.shells.filter(s => s.t < s.dur)
  G.cover = G.cover.filter(c => c.hp > 0)

  // ---- wipe / clear ----
  let anyAlive = false; for (let i = 0; i < n; i++) if (alive(i)) anyAlive = true
  if (!anyAlive && G.raid) { endRaid(); return }
  if (G.raid) raidTick(dt)
  if (G.auto.on && (G.autoT -= dt) <= 0) { G.autoT = 0.3; autoAbilities() }
  if (G.raid?.result) return
  if (!anyAlive) {
    if (G.failStage === G.stage) G.fail++; else { G.failStage = G.stage; G.fail = 1 }
    startStage(); G.banner = { text: 'REGROUP!', sub: 'Pack Resolve +' + Math.round(resolve() * 100) + '% power and health', t: 2.2 }; return
  }
  if (!G.raid && G.spawned >= G.toSpawn && G.enemies.length === 0) {
    const bonus = Math.ceil((10 + G.stage * 4) * Math.pow(1.1, G.stage - 1))
    G.gold += bonus; G.events.push({ type: 'stage_clear', stage: G.stage, gold: bonus })
    const cleared = G.stage; track('stages'); addPassXp(isBoss(cleared) ? PASS_XP_GAIN.boss : PASS_XP_GAIN.stage); if (isBoss(cleared)) track('bosses')
    if (isBoss(cleared)) { addChest(cleared < 20 ? 0 : cleared < 50 ? 1 : 2); if (Math.random() < 0.3) addChest(0); G.coins += Math.round((4 + Math.floor(cleared / 5)) * (1 + cp('coins'))); clanContribute(12) } else clanContribute(3)
    G.stage++; G.best = Math.max(G.best, G.stage); startStage()
    if (cleared % BLESSING_EVERY === 0) offerBlessings()
    save()
  }
}

// ---- rebirth ----
export function doRebirth() {
  const gain = rebirthGain(G.stage); if (!gain) return 0
  G.stardust += gain; G.rebirths++
  G.stats = newStats()
  Object.assign(G, { gold: 40, stage: 1, bought: 0, bench: new Array(8).fill(null), maxLevel: 0, stash: 0, blessings: {}, pick: null, hold: null, nadeCd: 0, frenzyCd: 0, shieldCd: 0, tankCd: 0, panicCd: 0 })
  G.bench[0] = 0; G.bench[1] = 0
  startStage(); G.events.push({ type: 'rebirth', gain }); save(); return gain
}

// ---- blessings ----
function offerBlessings() {
  const pool = BLESSINGS.filter(b => bl(b.id) < b.max).map(b => b.id)
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  if (pool.length) G.pick = pool.slice(0, 3)
}
export function chooseBlessing(i: number) {
  const id = G.pick?.[i]; if (!id) return false
  const c = bl(id); G.blessings[id] = c + 1; G.pick = null
  if (id === 'vital') { const r = (1 + 0.15 * (c + 1)) / (1 + 0.15 * c); for (let k = 0; k < 4; k++) { G.mhp[k] = Math.round(G.mhp[k] * r); G.hp[k] = Math.round(G.hp[k] * r) } }
  G.events.push({ type: 'blessing', id }); save(); return true
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
export function collectStash(mult = 1) {
  const base = Math.floor(G.stash); G.away = null
  if (base < 1) return 0
  const gold = base * mult
  G.gold += gold; G.stash -= base
  G.events.push({ type: 'idle_collect', gold }); save(); return gold
}

// ---- bench actions ----
export function buyWeapon() {
  const slot = G.bench.indexOf(null), c = buyCost()
  if (slot < 0 || G.gold < c) return false
  G.gold -= c; G.bought++; track('buys')
  // New buys normally arrive 3 rungs behind your best. But a lone weapon below that has no partner to merge with and would stay stuck, so buy a copy of that exact rank (lowest first) and it can merge up.
  const base = Math.max(0, G.maxLevel - 3), have = G.bench.filter(v => v !== null) as number[]
  const lone = have.filter(v => v < base && have.indexOf(v) === have.lastIndexOf(v))
  G.bench[slot] = lone.length ? Math.min(...lone) : base
  save(); return true
}
export function tryMerge(a: number, b: number) {
  const va = G.bench[a], vb = G.bench[b]
  if (a === b || va === null || va !== vb || va >= WEAPONS.length - 1) return false
  // every guardian keeps its own gun: only surplus weapons (beyond one per dog) can be merged away
  if (G.bench.filter(v => v !== null).length - 1 < unlockedGuardians(G.stage)) { G.banner = { text: 'EACH DOG NEEDS A GUN', sub: 'Buy a spare weapon, then merge the extra', t: 1.6 }; return false }
  const lvl = va + 1; G.bench[b] = lvl; G.bench[a] = null; track('merges')
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

// ================= Boss Raid =================
/** A 45s damage race against a towering boss. Score = total damage; tiers pay Dungeon Coins and chests. 3 attempts a day (+1 per rewarded ad). */
export interface RaidState { t: number; dmg: number; phase: number; shellT: number; addT: number; boss: Enemy | null; result: null | { tier: number; dmg: number; coins: number; chest: number; best: boolean } }
export const RAID = { dur: 45, attempts: 3, tiers: [0.6, 1.2, 2, 3.2], names: ['Bronze', 'Silver', 'Gold', 'Platinum'], cols: ['#d08a52', '#c9d3da', '#ffd84a', '#8fe8ff'], coins: [6, 12, 20, 32], chest: [-1, 0, 1, 2] }
/** Damage that counts as a baseline run: roughly one stage's worth of enemy health at your current stage. */
export const raidBase = () => hpScale(G.stage) * (6 + 1.5 * G.stage)
function rollRaid() { const d = dayKey(); if (G.raidInfo.day !== d) G.raidInfo = { day: d, used: 0, extra: 0, best: G.raidInfo.best } }
export const raidLeft = () => { rollRaid(); return Math.max(0, RAID.attempts + cp('raidAtt') + G.raidInfo.extra - G.raidInfo.used) }
export const raidTier = (dmg: number) => { let t = -1; RAID.tiers.forEach((m, k) => { if (dmg >= raidBase() * m) t = k }); return t }
function spawnRaidBoss(phase: number) {
  const hp = raidBase() * 1.2 * (1 + 0.5 * (phase - 1))
  const e: Enemy = { x: 180, y: 158, hp, max: hp, spd: 0, r: 30, kind: 'boss', flash: 0, wob: 0, dmg: 0, cd: 99, drake: (phase - 1) % 4, ab: 5 }
  G.enemies.push(e); if (G.raid) G.raid.boss = e
}
export function startRaid(): boolean {
  rollRaid(); if (G.raid || raidLeft() <= 0) return false
  G.raidInfo.used++; startStage()
  G.enemies.length = 0; G.cover = G.cover.filter(c => c.side === 'player'); G.hazards = []; G.toSpawn = 0; G.spawned = 1 // spawned>0 so spawnEnemy() never makes a stage boss
  G.raid = { t: RAID.dur, dmg: 0, phase: 1, shellT: 2.5, addT: 1.2, boss: null, result: null }
  spawnRaidBoss(1)
  G.banner = { text: 'BOSS RAID', sub: 'Deal as much damage as you can in ' + RAID.dur + 's', t: 2.2, big: true }
  save(); return true
}
function raidTick(dt: number) {
  const r = G.raid!; if (r.result) return
  if ((r.t -= dt) <= 0) { endRaid(); return }
  if (!r.boss || !G.enemies.includes(r.boss)) { r.phase++; spawnRaidBoss(r.phase); G.banner = { text: 'PHASE ' + r.phase, sub: 'The boss is back and bigger', t: 1.6 } }
  if ((r.shellT -= dt) <= 0 && r.boss) {
    const live: number[] = []; for (let i = 0; i < unlockedGuardians(G.stage); i++) if (alive(i)) live.push(i)
    if (live.length) { const gp = guardianPos(live[Math.floor(Math.random() * live.length)]); G.shells.push({ x: r.boss.x, y: r.boss.y, tx: gp.x + rnd(-14, 14), ty: gp.y + rnd(-8, 8), t: 0, dur: 1.4, r: 52, dmg: 10 + G.stage * 2 }); G.events.push({ type: 'mortar_fire', x: r.boss.x, y: r.boss.y }) }
    r.shellT = Math.max(1.5, 3.4 - 0.25 * r.phase)
  }
  if ((r.addT -= dt) <= 0 && G.enemies.length < 9) { spawnEnemy(); r.addT = 1.3 }
}
function endRaid() {
  const r = G.raid!, tier = raidTier(r.dmg), coins = Math.round((tier >= 0 ? RAID.coins[tier] : 2) * (1 + cp('coins'))), chest = tier >= 0 ? RAID.chest[tier] : -1
  G.coins += coins; if (chest >= 0) addChest(chest)
  const best = r.dmg > G.raidInfo.best; if (best) G.raidInfo.best = r.dmg
  r.result = { tier, dmg: r.dmg, coins, chest, best }; G.enemies.length = 0; G.shells.length = 0; G.ebullets.length = 0
  track('raids'); addPassXp(PASS_XP_GAIN.raid); clanContribute(Math.round(10 + 25 * Math.min(2, r.dmg / raidBase())), r.dmg)
  G.events.push({ type: 'raid_end' }); save()
}
export function closeRaid() { G.raid = null; startStage() }

// ================= Clans (simulated clanmates; see clan.ts) =================
export function ensureClanWeek() { const w = weekKey(); if (G.clan && G.clan.week !== w) G.clan = { ...G.clan, week: w, wk: 0, claimed: 0 } }
export function joinClan(id: string): boolean { const d = clanById(id); if (G.clan || G.best < d.req) return false; G.clan = { id, xp: 0, week: weekKey(), wk: 0, claimed: 0, gift: '' }; save(); return true }
export function leaveClan() { G.clan = null; save() }
export function clanContribute(xp: number, raidDmg = 0) { if (!G.clan) return; ensureClanWeek(); const was = clanLevel(G.clan); G.clan.xp += xp; G.clan.wk += raidDmg; const now = clanLevel(G.clan); if (now > was) G.events.push({ type: 'clan_level', lv: now }) }
export const clanPool = () => { ensureClanWeek(); return G.clan ? weeklyPool(G.clan, raidBase()) : null }
export const milestoneReady = (k: number) => { const p = clanPool(); return !!p && !(G.clan!.claimed & (1 << k)) && p.total >= p.goal * MILESTONES[k].at && G.clan!.wk >= raidBase() * RAID.tiers[0] }
export const clanClaimable = () => !!G.clan && (MILESTONES.some((_, k) => milestoneReady(k)) || canClanGift())
export function claimMilestone(k: number): boolean {
  if (!milestoneReady(k)) return false
  const m = MILESTONES[k]; G.clan!.claimed |= 1 << k; G.coins += m.coins; G.gems += m.gems; if (m.chest >= 0) addChest(m.chest); save(); return true
}
export const canClanGift = () => !!G.clan && G.clan.gift !== dayKey()
export function claimClanGift(): number { if (!canClanGift()) return 0; const c = 3 + Math.floor(clanLevel(G.clan) / 2); G.clan!.gift = dayKey(); G.coins += c; clanContribute(15); save(); return c }
void XP_PER_LEVEL

// ================= Auto abilities =================
/** Fires ready abilities when they are worth it. Same cooldowns as pressing the buttons by hand. */
function autoAbilities() {
  const A = G.auto, n = unlockedGuardians(G.stage), live = G.enemies.filter(e => e.hp > 0).length
  if (!live) return
  const boss = G.enemies.some(e => e.kind === 'boss' && e.hp > 0)
  let hurtCount = 0; for (let i = 0; i < n; i++) if (!alive(i) || G.hp[i] / G.mhp[i] < 0.45) hurtCount++
  if (A.shield && G.shieldCd <= 0 && G.shieldT <= 0 && hurtCount > 0) useAbility('shield')
  if (A.frenzy && G.frenzyCd <= 0 && G.frenzyT <= 0 && (live >= 4 || boss)) useAbility('frenzy')
  if (A.tank && G.tankCd <= 0 && G.tankT <= 0 && alive(0) && (live >= 4 || boss)) useAbility('tank')
  if (A.panic && G.panicCd <= 0 && G.panicT <= 0 && alive(1) && n > 1 && G.hp[1] / G.mhp[1] > 0.7 && (live >= 6 || boss)) useAbility('panic')
  // hold the grenade back early so the hint can teach it; after that (or from stage 6) it throws itself at clumps of 3+
  if (A.nade && G.nadeCd <= 0 && (G.nadeTaught || G.stage > 5) && bestClump() >= 3) throwGrenade()
}

// ================= Meta: achievements, season pass, lucky spin, unlocks =================
export function grant(r: Reward) { if (r.gems) G.gems += r.gems; if (r.coins) G.coins += r.coins; if (r.gold) G.gold += r.gold; if (r.chest !== undefined) addChest(r.chest) }
export const unlocked = (id: string) => G.best >= (UNLOCK_STAGE[id] ?? 0)
export const unlockStage = (id: string) => UNLOCK_STAGE[id] ?? 0
export function statValue(stat: string) { return stat === 'best' ? G.best : stat === 'dogs' ? G.owned.length + 2 : stat === 'clan' ? (G.clan ? 1 : 0) : (G.life[stat] ?? 0) }
export const achDone = (a: typeof ACHIEVEMENTS[number]) => statValue(a.stat) >= a.target
export const achReady = () => ACHIEVEMENTS.filter(a => achDone(a) && !G.achClaimed.includes(a.id)).length
export function claimAch(id: string): boolean {
  const a = ACHIEVEMENTS.find(x => x.id === id); if (!a || !achDone(a) || G.achClaimed.includes(id)) return false
  G.achClaimed.push(id); G.gems += a.gems; addPassXp(ACH_XP); save(); return true
}
export function ensurePass() { const s = seasonIndex(); if (G.pass.s !== s) G.pass = { s, xp: 0, claimed: 0 } }
export function addPassXp(n: number) { ensurePass(); G.pass.xp += n }
export const passLevel = () => { ensurePass(); return Math.min(PASS_TIERS, Math.floor(G.pass.xp / PASS_XP)) }
export const passReady = () => { const lv = passLevel(); let c = 0; for (let t = 1; t <= lv; t++) if (!(G.pass.claimed & (1 << t))) c++; return c }
export function claimPassTier(t: number): boolean { if (t > passLevel() || (G.pass.claimed & (1 << t))) return false; G.pass.claimed |= 1 << t; grant(passReward(t)); save(); return true }
export function spinsLeft() { const d = dayKey(); if (G.spin.day !== d) G.spin = { day: d, free: 0, ad: 0 }; return { free: G.spin.free < 1, ad: G.spin.ad < 1 } }
/** Pick a segment (weighted), pay it out now, and return its index so the screen can animate to it. */
export function doSpin(viaAd: boolean): number {
  spinsLeft(); if (viaAd) G.spin.ad++; else G.spin.free++
  let tot = 0; for (const s of SPIN_SEGS) tot += s.w
  let x = Math.random() * tot, idx = 0; for (let i = 0; i < SPIN_SEGS.length; i++) { x -= SPIN_SEGS[i].w; if (x <= 0) { idx = i; break } }
  const sg = SPIN_SEGS[idx]; grant(sg.r === 'gold' ? { gold: Math.ceil(killGold(G.stage) * (sg.label === 'Big Gold' ? 90 : 40)) } : sg.r)
  track('spins'); addPassXp(PASS_XP_GAIN.spin); save(); return idx
}
