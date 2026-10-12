/** Meta-progression data inspired by the top live-ops games: achievements, a 28-day season pass (free track), a daily lucky spin, and staged feature unlocks. Pure data. */
export interface Reward { gems?: number; coins?: number; gold?: number; chest?: number }

// ---- achievements (lifetime stats) ----
export interface AchDef { id: string; text: string; stat: string; target: number; gems: number }
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'k1', text: 'Defeat 100 enemies', stat: 'kills', target: 100, gems: 5 },
  { id: 'k2', text: 'Defeat 1,000 enemies', stat: 'kills', target: 1000, gems: 15 },
  { id: 'k3', text: 'Defeat 10,000 enemies', stat: 'kills', target: 10000, gems: 50 },
  { id: 's1', text: 'Clear 10 stages', stat: 'stages', target: 10, gems: 5 },
  { id: 's2', text: 'Clear 50 stages', stat: 'stages', target: 50, gems: 15 },
  { id: 's3', text: 'Clear 200 stages', stat: 'stages', target: 200, gems: 50 },
  { id: 'b1', text: 'Reach stage 10', stat: 'best', target: 10, gems: 6 },
  { id: 'b2', text: 'Reach stage 25', stat: 'best', target: 25, gems: 15 },
  { id: 'b3', text: 'Reach stage 50', stat: 'best', target: 50, gems: 40 },
  { id: 'bo1', text: 'Defeat 3 bosses', stat: 'bosses', target: 3, gems: 8 },
  { id: 'bo2', text: 'Defeat 15 bosses', stat: 'bosses', target: 15, gems: 25 },
  { id: 'm1', text: 'Merge 50 weapons', stat: 'merges', target: 50, gems: 8 },
  { id: 'm2', text: 'Merge 500 weapons', stat: 'merges', target: 500, gems: 30 },
  { id: 'n1', text: 'Throw 30 grenades', stat: 'nades', target: 30, gems: 8 },
  { id: 'a1', text: 'Use abilities 50 times', stat: 'abil', target: 50, gems: 8 },
  { id: 'r1', text: 'Finish 3 Boss Raids', stat: 'raids', target: 3, gems: 10 },
  { id: 'r2', text: 'Finish 25 Boss Raids', stat: 'raids', target: 25, gems: 40 },
  { id: 'd1', text: 'Own 4 dogs', stat: 'dogs', target: 4, gems: 10 },
  { id: 'd2', text: 'Own all 8 dogs', stat: 'dogs', target: 8, gems: 30 },
  { id: 'c1', text: 'Join a clan', stat: 'clan', target: 1, gems: 10 },
  { id: 'f1', text: 'Land 300 flanking hits', stat: 'flank', target: 300, gems: 12 },
  { id: 'sp1', text: 'Use the Lucky Spin 7 times', stat: 'spins', target: 7, gems: 10 },
]
export const ACH_XP = 20

// ---- season pass (free track, 28 days) ----
export const SEASON_DAYS = 28, PASS_TIERS = 30, PASS_XP = 200
export const seasonIndex = (now = Date.now()) => Math.floor((now - new Date().getTimezoneOffset() * 60000) / 86400000 / SEASON_DAYS)
export const seasonDaysLeft = (now = Date.now()) => { const d = (now - new Date().getTimezoneOffset() * 60000) / 86400000; return Math.max(1, Math.ceil(SEASON_DAYS - (d % SEASON_DAYS))) }
export function passReward(t: number): Reward { // t = 1..30
  if (t === 30) return { gems: 50, chest: 2 }
  if (t % 10 === 0) return { gems: 20, chest: 1 }
  if (t % 5 === 0) return { chest: 0, coins: 5 }
  return t % 2 ? { coins: 3 + Math.floor(t / 4) } : { gems: 3 + Math.floor(t / 6) }
}
/** Premium season pass track (paid, gems only: never gear, so it can't change balance). */
export function passPremiumReward(t: number): { gems: number } { return { gems: t === 30 ? 60 : 4 + Math.floor(t / 3) } }
export const PASS_XP_GAIN = { stage: 4, boss: 20, raid: 25, quest: 30, ach: ACH_XP, login: 20, spin: 10 }

// ---- lucky spin ----
export interface SpinSeg { label: string; col: string; w: number; r: Reward | 'gold' }
export const SPIN_SEGS: SpinSeg[] = [
  { label: 'Gold', col: '#e8a21a', w: 22, r: 'gold' },
  { label: '3 Gems', col: '#3aa8e8', w: 16, r: { gems: 3 } },
  { label: '5 Coins', col: '#d8742a', w: 16, r: { coins: 5 } },
  { label: 'Wood Chest', col: '#9a6a3a', w: 12, r: { chest: 0 } },
  { label: '8 Gems', col: '#2f80d8', w: 8, r: { gems: 8 } },
  { label: 'Big Gold', col: '#f0c030', w: 14, r: 'gold' },
  { label: '12 Coins', col: '#c4501a', w: 8, r: { coins: 12 } },
  { label: 'Silver Chest', col: '#9fb4c4', w: 4, r: { chest: 1 } },
]

// ---- staged feature unlocks (by best stage), like the top games reveal menus gradually ----
export const UNLOCK_STAGE: Record<string, number> = { stats: 1, tour: 1, help: 1, auto: 1, login: 1, quests: 2, spin: 2, gear: 3, pass: 3, weekly: 4, ach: 4, skills: 5, kennel: 6, raid: 8, clan: 10, rebirth: 1, rank: 1, train: 3 }

/** The closest thing to look forward to: the next menu feature to unlock or the next boss, whichever is nearer. */
const UNLOCK_NAME: Record<string, string> = { quests: 'Daily Quests', spin: 'Lucky Spin', gear: 'Gear', pass: 'Season Pass', train: 'Training', weekly: 'Weekly Event', ach: 'Achievements', skills: 'Skill Tree', kennel: 'Kennel', raid: 'Boss Raid', clan: 'Clans' }
export function nextGoal(best: number): string {
  let id = '', at = 1e9
  for (const k in UNLOCK_NAME) { const u = UNLOCK_STAGE[k]; if (u !== undefined && u > best && u < at) { at = u; id = k } }
  const boss = Math.ceil((best + 1) / 10) * 10
  return id && at <= boss ? UNLOCK_NAME[id] + ' at stage ' + at : 'Boss at stage ' + boss
}
