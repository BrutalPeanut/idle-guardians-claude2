// Coach tips: one short nudge at a time, pointing at the button the player should press next. Each tip shows once.
import { G, buyCost, canMergeNow, rebirthGain, questReady } from './sim'
import { unlockedGuardians } from './data'

export interface Tip { id: string; target?: string; text: string; when: () => boolean }

const STATIC: Tip[] = [
  { id: 'buy' + G.bought, target: 'buy', text: 'You can afford a new gun! Tap BUY.', when: () => G.gold >= buyCost() && G.bench.includes(null) },
  { id: 'merge' + G.bought, target: 'merge', text: 'Two matching guns merge into a stronger one. Tap MERGE!', when: () => canMergeNow() },
  { id: 'abil', target: 'shield', text: 'Abilities sit under the arena. Tap Shield, Frenzy, Tank or Panic when a wave closes in.', when: () => G.stage >= 3 && (G.nadeTaught || G.stage > 5) },
  { id: 'hold', target: 'hold', text: 'HOLD plants your pack in place. Tap it again to recall.', when: () => G.stage >= 5 },
  { id: 'quest', target: 'nav_quests', text: 'A daily quest is done! Tap the quest bar to claim gems.', when: () => questReady() > 0 },
  { id: 'rebirth', target: 'stardust', text: 'Rebirth is ready. Tap the stardust chip up top to start over stronger.', when: () => rebirthGain(G.stage) > 0 },
]

// buy and merge re-arm after every purchase (keyed by purchase count), so the nudge comes back whenever the option does
// one tip per new guardian slot: the pack grows at stages 5, 10, 15 ...
const guardianTips = (): Tip[] => Array.from({ length: 4 }, (_, i) => i + 3).map(n => ({
  id: 'guard' + n, text: 'A new guardian joined your pack!', when: () => unlockedGuardians(G.stage) >= n,
}))

export function coachTips(): Tip[] { return [...guardianTips(), ...STATIC] }

/** The first tip the player has not seen yet whose moment has come, or null. */
export function nextTip(): Tip | null {
  for (const t of coachTips()) if (!G.tipsSeen[t.id] && t.when()) return t
  return null
}
