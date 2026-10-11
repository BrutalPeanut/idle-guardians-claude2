/** Gear: each dog wears a collar, a vest and a charm. Items come from chests (bosses, login streak, raids). */
export type Slot = 'collar' | 'vest' | 'charm'
export type Stat = 'dmg' | 'hp' | 'crit' | 'rate' | 'gold'
export interface Item { id: number; slot: Slot; rar: 0 | 1 | 2 | 3; lvl: number; stat: Stat; val: number; on: number /* roster index of the wearer, -1 = inventory */ }
export const SLOTS: Slot[] = ['collar', 'vest', 'charm']
export const RARITY = [
  { n: 'Common', col: '#b8c2c8', mul: 1 }, { n: 'Rare', col: '#5ab8ff', mul: 1.7 },
  { n: 'Epic', col: '#b58cf0', mul: 2.6 }, { n: 'Legendary', col: '#ffb347', mul: 4 },
]
export const BASE: Record<Stat, number> = { dmg: 0.04, hp: 0.06, crit: 0.02, rate: 0.03, gold: 0.05 }
export const STAT_LABEL: Record<Stat, string> = { dmg: 'damage', hp: 'max HP', crit: 'crit chance', rate: 'fire rate', gold: 'kill gold' }
const SLOT_STATS: Record<Slot, Stat[]> = { collar: ['dmg', 'crit'], vest: ['hp'], charm: ['rate', 'gold', 'crit'] }
const NAMES: Record<Slot, Record<string, string>> = {
  collar: { dmg: 'Spiked Collar', crit: 'Eagle-Eye Collar' },
  vest: { hp: 'Padded Vest' },
  charm: { rate: 'Swift Bone Charm', gold: 'Lucky Bone Charm', crit: 'Sharp Bone Charm' },
}
export const CHEST_NAMES = ['Wooden Chest', 'Silver Chest', 'Golden Chest']
export const CHEST_COLS = ['#a8794a', '#b8c6d2', '#ffcf4a']
/** Rarity odds (%) per chest tier. `bonus` shifts weight from Common toward higher rarities (Treasure Hunter skill). */
const ODDS = [[70, 25, 5, 0], [35, 40, 20, 5], [10, 35, 40, 15]]
export const INV_MAX = 16
export const itemName = (it: Item) => RARITY[it.rar].n + ' ' + NAMES[it.slot][it.stat]
export const fmtStat = (it: Item) => '+' + (it.val * 100).toFixed(it.val * 100 < 10 ? 1 : 0) + '% ' + STAT_LABEL[it.stat]
export function rollItem(id: number, tier: number, lvl: number, bonus = 0, rand: () => number = Math.random): Item {
  const o = ODDS[tier].slice(); const shift = Math.min(o[0], bonus * 100); o[0] -= shift; o[1] += shift * 0.6; o[2] += shift * 0.3; o[3] += shift * 0.1
  let r = rand() * 100, rar = 0; for (let i = 0; i < 4; i++) { if (r < o[i]) { rar = i; break } r -= o[i]; rar = i }
  const slot = SLOTS[Math.floor(rand() * 3)], stats = SLOT_STATS[slot], stat = stats[Math.floor(rand() * stats.length)]
  return { id, slot, rar: rar as Item['rar'], lvl, stat, val: BASE[stat] * RARITY[rar].mul * (1 + lvl / 25), on: -1 }
}
