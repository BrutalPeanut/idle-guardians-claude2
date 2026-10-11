/** Daily quests: three random objectives per local day, paid in gems (+ gold). Gems buy blessing rerolls. */
export interface QuestDef { id: string; text: string; target: number; gems: number }
export const QUEST_POOL: QuestDef[] = [
  { id: 'kills',  text: 'Defeat enemies',           target: 80, gems: 5 },
  { id: 'stages', text: 'Clear stages',             target: 4,  gems: 6 },
  { id: 'merges', text: 'Merge weapons',            target: 5,  gems: 5 },
  { id: 'buys',   text: 'Buy weapons',              target: 8,  gems: 4 },
  { id: 'nades',  text: 'Throw grenades',           target: 4,  gems: 5 },
  { id: 'abil',   text: 'Use Shield or Frenzy',     target: 4,  gems: 5 },
  { id: 'flank',  text: 'Land flanking hits',       target: 30, gems: 6 },
]
export interface QuestState { id: string; prog: number; claimed: boolean }
export interface Daily { day: string; q: QuestState[] }
export const dayKey = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
/** Deterministic pick of 3 quests from the day string, so everyone gets the same set on a given day. */
export function rollDaily(day: string): Daily {
  let h = 2166136261; for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const pool = QUEST_POOL.slice(), out: QuestState[] = []
  for (let i = 0; i < 3; i++) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const k = h % pool.length; out.push({ id: pool.splice(k, 1)[0].id, prog: 0, claimed: false }) }
  return { day, q: out }
}
export const questDef = (id: string) => QUEST_POOL.find(q => q.id === id)!
