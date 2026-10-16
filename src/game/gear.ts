/** Gear: each dog wears a collar, a vest and a charm. Items come from chests (bosses, login streak, raids). */
export type Slot = 'collar' | 'vest' | 'charm'
export type Stat = 'dmg' | 'hp' | 'crit' | 'rate' | 'gold' | 'cdmg' | 'steal' | 'guard' | 'boss'
export interface Item { id: number; slot: Slot; rar: 0 | 1 | 2 | 3; lvl: number; stat: Stat; val: number; subs?: { stat: Stat; val: number }[]; on: number /* roster index of the wearer, -1 = inventory */ }
export const SLOTS: Slot[] = ['collar', 'vest', 'charm']
export const RARITY = [
  { n: 'Common', col: '#b8c2c8', mul: 1 }, { n: 'Rare', col: '#5ab8ff', mul: 1.7 },
  { n: 'Epic', col: '#b58cf0', mul: 2.6 }, { n: 'Legendary', col: '#ffb347', mul: 4 },
]
export const BASE: Record<Stat, number> = { dmg: 0.04, hp: 0.06, crit: 0.02, rate: 0.03, gold: 0.05, cdmg: 0.1, steal: 0.0015, guard: 0.02, boss: 0.05 }
export const STAT_LABEL: Record<Stat, string> = { dmg: 'damage', hp: 'max HP', crit: 'crit chance', rate: 'fire rate', gold: 'kill gold', cdmg: 'crit damage', steal: 'max HP per hit', guard: 'damage reduction', boss: 'boss damage' }
const SHORT: Record<Stat, string> = { dmg: 'dmg', hp: 'HP', crit: 'crit', rate: 'rate', gold: 'gold', cdmg: 'crit dmg', steal: 'HP/hit', guard: 'armor', boss: 'vs boss' }
/** Per-dog ceilings on gear totals, so stacking three of the same stat can never break the game. Lifesteal heals this fraction of max HP per hit. */
export const CAPS: Partial<Record<Stat, number>> = { crit: 0.6, cdmg: 2, steal: 0.015, guard: 0.35, boss: 1 }
const LVL_DIV: Record<Stat, number> = { dmg: 25, hp: 25, crit: 25, rate: 25, gold: 25, cdmg: 40, steal: 40, guard: 40, boss: 40 }
const SUB_MUL = 0.45
const SLOT_STATS: Record<Slot, Stat[]> = { collar: ['dmg', 'crit', 'cdmg', 'boss'], vest: ['hp', 'guard', 'steal'], charm: ['rate', 'gold', 'crit', 'boss', 'steal'] }
const NAMES: Record<Slot, Record<string, string>> = {
  collar: { dmg: 'Spiked Collar', crit: 'Eagle-Eye Collar', cdmg: 'Fang Collar', boss: 'Slayer Collar' },
  vest: { hp: 'Padded Vest', guard: 'Plated Vest', steal: 'Bloodthirst Vest' },
  charm: { rate: 'Swift Bone Charm', gold: 'Lucky Bone Charm', crit: 'Sharp Bone Charm', boss: 'Hunter Bone Charm', steal: 'Vampire Bone Charm' },
}
export const CHEST_NAMES = ['Wooden Chest', 'Silver Chest', 'Golden Chest']
export const CHEST_COLS = ['#a8794a', '#b8c6d2', '#ffcf4a']
/** Rarity odds (%) per chest tier. `bonus` shifts weight from Common toward higher rarities (Treasure Hunter skill). */
const ODDS = [[70, 25, 5, 0], [35, 40, 20, 5], [10, 35, 40, 15]]
export const INV_MAX = 16
export const itemName = (it: Item) => RARITY[it.rar].n + ' ' + NAMES[it.slot][it.stat]
const num = (stat: Stat, v: number) => stat === 'steal' ? (v * 100).toFixed(2) : (v * 100).toFixed(v * 100 < 10 ? 1 : 0)
export const fmtLine = (stat: Stat, v: number) => '+' + num(stat, v) + '% ' + STAT_LABEL[stat]
export const fmtStat = (it: Item) => fmtLine(it.stat, it.val)
export const fmtShort = (it: Item) => '+' + num(it.stat, it.val) + '% ' + SHORT[it.stat]
export const fmtSubs = (it: Item) => (it.subs ?? []).map(b => fmtLine(b.stat, b.val))
export const statVal = (it: Item, stat: Stat) => (it.stat === stat ? it.val : 0) + (it.subs ?? []).reduce((a, b) => a + (b.stat === stat ? b.val : 0), 0)
/** `force` pins the rarity and/or slot (gear fusion). */
export function rollItem(id: number, tier: number, lvl: number, bonus = 0, rand: () => number = Math.random, force?: { rar?: number; slot?: Slot }): Item {
  const o = ODDS[tier].slice(); const shift = Math.min(o[0], bonus * 100); o[0] -= shift; o[1] += shift * 0.6; o[2] += shift * 0.3; o[3] += shift * 0.1
  let r = rand() * 100, rar = 0; for (let i = 0; i < 4; i++) { if (r < o[i]) { rar = i; break } r -= o[i]; rar = i }
  if (force?.rar !== undefined) rar = force.rar
  const slot = force?.slot ?? SLOTS[Math.floor(rand() * 3)], stats = SLOT_STATS[slot], stat = stats[Math.floor(rand() * stats.length)]
  const roll = (st: Stat, k: number) => BASE[st] * RARITY[rar].mul * (1 + lvl / LVL_DIV[st]) * k
  const pool = stats.filter(x => x !== stat); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  const subs = pool.slice(0, rar === 2 ? 1 : rar === 3 ? 2 : 0).map(st => ({ stat: st, val: roll(st, SUB_MUL) }))
  return { id, slot, rar: rar as Item['rar'], lvl, stat, val: roll(stat, 1), ...(subs.length ? { subs } : {}), on: -1 }
}

/** Rough worth of an item for auto-equip: each stat weighted by how much it moves a fight. */
const W: Record<Stat, number> = { dmg: 1, crit: 1.4, rate: 1, hp: 0.5, gold: 0.25, cdmg: 0.45, steal: 60, guard: 1.1, boss: 0.5 }
export const itemScore = (it: Item) => Object.keys(W).reduce((a, k) => a + statVal(it, k as Stat) * W[k as Stat], 0)
