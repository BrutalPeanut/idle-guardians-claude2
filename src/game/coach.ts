// Coach tips: one short nudge at a time, pointing at the button the player should press next. Each tip shows once.
import { G, buyCost, canMergeNow, rebirthGain, questReady } from './sim'
import { unlockedGuardians } from './data'

export interface Tip { id: string; target?: string; go?: string; text: string; when: () => boolean; persist?: boolean; sticky?: boolean }

// persistent tips keep coming back (after a short pause) until the player acts; the pause start is kept here, not saved
export const coachCool: Record<string, number> = {}
const PAUSE_MS = 8000

const STATIC: Tip[] = [
  { id: 'buy' + G.bought, target: 'buy', go: 'buy', text: 'You can afford a new gun! Tap BUY.', when: () => G.gold >= buyCost() && G.bench.includes(null), persist: true, sticky: true },
  { id: 'merge' + G.bought, target: 'merge', go: 'merge', text: 'Two matching guns merge into a stronger one. Tap MERGE!', when: () => canMergeNow(), persist: true, sticky: true },
  { id: 'abil', target: 'shield', text: 'Abilities sit under the arena. Tap Shield, Frenzy, Tank or Panic when a wave closes in.', when: () => G.stage >= 3 && (G.nadeTaught || G.stage > 5) },
  { id: 'hold', target: 'hold', text: 'HOLD plants your pack in place. Tap it again to recall.', when: () => G.stage >= 5 },
  { id: 'quest', target: 'nav_quests', go: 'nav_quests', text: 'A daily quest is done! Tap the quest bar to claim gems.', when: () => questReady() > 0 },
  // persistent and re-armed per rebirth, so it keeps nudging until the player goes
  { id: 'rebirth' + G.rebirths, target: 'stardust', go: 'stardust', text: 'Rebirth is ready! Tap the stardust chip to start over stronger.', when: () => rebirthGain(G.stage) > 0, persist: true },
]

// buy and merge re-arm after every purchase (keyed by purchase count), so the nudge comes back whenever the option does
// one tip per new guardian slot: the pack grows at stages 5, 10, 15 ...
const guardianTips = (): Tip[] => Array.from({ length: 4 }, (_, i) => i + 3).map(n => ({
  id: 'guard' + n, text: 'A new guardian joined your pack!', when: () => unlockedGuardians(G.stage) >= n,
}))

export function coachTips(): Tip[] { return [...guardianTips(), ...STATIC] }

/** The first tip the player has not seen yet whose moment has come, or null. */
export function nextTip(): Tip | null {
  const now = performance.now()
  for (const t of coachTips()) if (!G.tipsSeen[t.id] && t.when() && !(coachCool[t.id] && now - coachCool[t.id] < PAUSE_MS)) return t
  return null
}
