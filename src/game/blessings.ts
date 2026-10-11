/** Blessings: every few stages the player picks 1 of 3. They stack and last until Rebirth (see sim.ts). */
export interface Blessing { id: string; name: string; desc: string; col: string; icon: string; max: number }
export const BLESSINGS: Blessing[] = [
  { id: 'power',   name: 'Might',        desc: '+10% damage',                 col: '#ff6a5a', icon: 'sword',  max: 8 },
  { id: 'rapid',   name: 'Quickpaws',    desc: '+8% fire rate',               col: '#ffd84a', icon: 'frenzy', max: 8 },
  { id: 'vital',   name: 'Hearty',       desc: '+15% max HP (heals now)',     col: '#5be07f', icon: 'plus',   max: 6 },
  { id: 'fortune', name: 'Fortune',      desc: '+15% gold from kills',        col: '#ffcf4a', icon: 'coin',   max: 8 },
  { id: 'crit',    name: 'Keen Eye',     desc: '+6% crit chance',             col: '#ff9ad8', icon: 'star',   max: 6 },
  { id: 'blast',   name: 'Bomb Squad',   desc: 'Grenade cooldown -15%',       col: '#ff9a3a', icon: 'nade',   max: 4 },
  { id: 'aegis',   name: 'Aegis',        desc: 'Shield lasts +1s',            col: '#5ab8ff', icon: 'shield', max: 4 },
  { id: 'fury',    name: 'Fury',         desc: 'Frenzy lasts +1.5s',          col: '#ffb347', icon: 'frenzy', max: 4 },
]
export const BLESSING_EVERY = 3 // a pick is offered after clearing every Nth stage
