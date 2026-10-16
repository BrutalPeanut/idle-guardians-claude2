/**
 * Extension seams for feature modules (events, dog levels, pups, clubs...). Nothing here imports game code, so any module can use it
 * without import cycles. Features plug in at start-up; the core sim/render/screens call these at fixed points.
 *
 *  - Stat bonuses: `addBonus('dmg', i => 0.05)` adds +5% to guardian i's damage. Bonuses are additive fractions, like gear.
 *  - Game events: `ON.kill`, `ON.clear`, `ON.tick` run inside the sim.
 *  - Saved state: `xs('myFeature', () => defaults)` returns the feature's slice of the save (persisted under the save's `xs` key).
 *  - Drawing: `DRAW.enemy` / `DRAW.world` / `DRAW.hud` run inside the main render.
 */
import type { Ctx } from './render'

export type BonusKey = 'dmg' | 'hp' | 'rate' | 'crit' | 'gold' | 'stash' | 'coins' | 'chest'
type Bonus = (i: number) => number
const BONUS: Record<BonusKey, Bonus[]> = { dmg: [], hp: [], rate: [], crit: [], gold: [], stash: [], coins: [], chest: [] }
export const addBonus = (k: BonusKey, f: Bonus) => { BONUS[k].push(f) }
/** Sum of every registered bonus for key k (guardian index i, or -1 for pack-wide values like gold). Never throws. */
export function ext(k: BonusKey, i = -1): number {
  let v = 0
  for (const f of BONUS[k]) { try { const x = f(i); if (Number.isFinite(x)) v += x } catch { /* a broken feature must never stop the game */ } }
  return v
}

export interface KillInfo { kind: string; x: number; y: number; raid: boolean; stage: number }
export const ON = {
  kill: [] as ((e: KillInfo) => void)[],
  clear: [] as ((stage: number, boss: boolean) => void)[],
  tick: [] as ((dt: number) => void)[],
  /** every game event (merge, kill, dmg, down, boss_cast...) as the renderer drains them */
  gevent: [] as ((e: { type: string } & Record<string, unknown>) => void)[],
  /** after a successful load() (or a fresh game), and before every save */
  load: [] as (() => void)[],
  save: [] as (() => void)[],
}
export function fire<A extends unknown[]>(list: ((...a: A) => void)[], ...a: A) { for (const f of list) { try { f(...a) } catch (e) { console.error('ext hook', e) } } }

/** Feature save slices. The whole object is written to the save as `xs` and restored on load. */
export const XS: Record<string, unknown> = {}
export function xs<T extends object>(id: string, init: () => T): T {
  const cur = XS[id]
  if (!cur || typeof cur !== 'object' || Array.isArray(cur)) { const v = init(); XS[id] = v; return v }
  // fill in any fields added since the save was written
  const d = init() as Record<string, unknown>, c = cur as Record<string, unknown>
  for (const k in d) if (!(k in c)) c[k] = d[k]
  return cur as T
}
export function loadXS(v: unknown) {
  for (const k in XS) delete XS[k]
  if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(XS, v)
}

export const DRAW = {
  /** decorate one enemy (called right after it is drawn, in world space) */
  enemy: [] as ((ctx: Ctx, e: { x: number; y: number; r: number; kind: string }, t: number) => void)[],
  /** over the arena, under the HUD */
  world: [] as ((ctx: Ctx, t: number) => void)[],
  /** on top of the HUD, under banners */
  hud: [] as ((ctx: Ctx, t: number) => void)[],
}
export function drawAll<A extends unknown[]>(list: ((ctx: Ctx, ...a: A) => void)[], ctx: Ctx, ...a: A) {
  for (const f of list) { ctx.save(); try { f(ctx, ...a) } catch (e) { console.error('ext draw', e) } ctx.restore() }
}
