/** Weekly modifier: one rule twist per calendar week, picked by date so every player sees the same one. No server needed. */
export interface WeekMod { id: string; name: string; desc: string; col: string }
export const MODS: WeekMod[] = [
  { id: 'flank', name: 'Flank Fever',  desc: 'Flanking bonus damage is +50% bigger.', col: '#ffa23a' },
  { id: 'gold',  name: 'Gold Rush',    desc: '+30% gold from every kill.',             col: '#ffd84a' },
  { id: 'iron',  name: 'Iron Paws',    desc: '+30% max HP for every dog.',             col: '#5be07f' },
  { id: 'quick', name: 'Quick Draw',   desc: '+20% fire rate for every gun.',          col: '#6fd6ff' },
  { id: 'bomb',  name: 'Bomb Week',    desc: 'Grenade: +25% damage, 40% shorter cooldown.', col: '#ff7a4a' },
  { id: 'power', name: 'Big Bark',     desc: '+20% damage for every dog.',             col: '#ff6a5a' },
]
const DAY = 864e5
/** Local-time day number so the week rolls at the player's own midnight. */
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / DAY)
export const weekIndex = (d = new Date()) => Math.floor((dayNum(d) + 3) / 7) // weeks start Monday-ish (epoch was a Thursday)
export const weekMod = (d = new Date()): WeekMod => MODS[weekIndex(d) % MODS.length]
export const nextMod = (d = new Date()): WeekMod => MODS[(weekIndex(d) + 1) % MODS.length]
export const daysLeft = (d = new Date()) => 7 - ((dayNum(d) + 3) % 7)
