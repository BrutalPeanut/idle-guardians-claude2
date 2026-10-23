// Cover, hazards and per-biome rules. Pure data + geometry: no rendering, no global state.
import { ARENA } from './data'

export type CoverKind = 'log' | 'stump' | 'boulder' | 'sandstone' | 'ruin' | 'driftwood' | 'sandcastle' | 'crate' | 'obsidian' | 'iceblock' | 'snowwall' | 'rotlog' | 'dock'
export type HazardKind = 'lava' | 'mud' | 'ice' | 'shallows'
export interface Cover { id: number; side: 'player' | 'enemy'; kind: CoverKind; x: number; y: number; w: number; h: number; hp: number; max: number; flash: number }
export interface Hazard { x: number; y: number; r: number; kind: HazardKind }
export interface Unit { x: number; y: number; kind: 'gunner' | 'mortar'; coverId: number }

export interface BiomeRules {
  tip: string
  playerCover: CoverKind[]; enemyCover: CoverKind[]
  coverCount: [number, number]; coverW: [number, number]; coverHpMul: number
  hazard?: HazardKind; hazardCount: number
  zombieMul: number; gunnerMul: number; mortarMul: number; bulletSpeed: number
}
/** One entry per biome, in circuit order (matches BIOMES). Each biome plays differently, not just looks different. */
export const RULES: BiomeRules[] = [
  { tip: 'Dense woods: plenty of cover, mostly zombies', playerCover: ['log', 'stump', 'boulder'], enemyCover: ['log', 'boulder'], coverCount: [4, 6], coverW: [56, 78], coverHpMul: 0.8, hazardCount: 0, zombieMul: 1.2, gunnerMul: 0.6, mortarMul: 0, bulletSpeed: 150 },
  { tip: 'Open sands: few sturdy rocks, lots of snipers', playerCover: ['sandstone', 'ruin'], enemyCover: ['sandstone', 'ruin'], coverCount: [2, 3], coverW: [88, 112], coverHpMul: 1.7, hazardCount: 0, zombieMul: 0.8, gunnerMul: 1.7, mortarMul: 0.5, bulletSpeed: 215 },
  { tip: 'Tide pools slow everyone. Sandcastles crumble fast', playerCover: ['sandcastle', 'crate', 'driftwood'], enemyCover: ['crate', 'driftwood'], coverCount: [4, 5], coverW: [60, 84], coverHpMul: 0.55, hazard: 'shallows', hazardCount: 3, zombieMul: 1, gunnerMul: 1, mortarMul: 0.6, bulletSpeed: 170 },
  { tip: 'Lava burns everything. Mortars rain down', playerCover: ['obsidian'], enemyCover: ['obsidian'], coverCount: [3, 4], coverW: [72, 94], coverHpMul: 2, hazard: 'lava', hazardCount: 2, zombieMul: 0.8, gunnerMul: 1, mortarMul: 1.8, bulletSpeed: 185 },
  { tip: 'Ice makes the pack slide. Ice blocks shatter', playerCover: ['iceblock', 'snowwall'], enemyCover: ['iceblock', 'snowwall'], coverCount: [3, 5], coverW: [64, 90], coverHpMul: 0.7, hazard: 'ice', hazardCount: 3, zombieMul: 1, gunnerMul: 1.1, mortarMul: 0.8, bulletSpeed: 170 },
  { tip: 'Mud slows everyone: pin zombies in it', playerCover: ['rotlog', 'dock'], enemyCover: ['rotlog', 'dock'], coverCount: [4, 5], coverW: [62, 90], coverHpMul: 1, hazard: 'mud', hazardCount: 3, zombieMul: 1.3, gunnerMul: 0.8, mortarMul: 1, bulletSpeed: 150 },
]
export const biomeIndex = (stage: number) => Math.floor((stage - 1) / 10) % RULES.length
export const rulesFor = (stage: number) => RULES[biomeIndex(stage)]
export const bulletDmg = (stage: number) => 3 + stage * 1.1
export const localStage = (stage: number) => ((stage - 1) % 10) + 1

// ---------- geometry ----------
type Box = { x: number; y: number; w: number; h: number }
/** Segment vs axis-aligned box (box x,y = centre). Liang-Barsky. */
export function segRect(x1: number, y1: number, x2: number, y2: number, c: Box): boolean {
  const minX = c.x - c.w / 2, maxX = c.x + c.w / 2, minY = c.y - c.h / 2, maxY = c.y + c.h / 2
  const dx = x2 - x1, dy = y2 - y1, p = [-dx, dx, -dy, dy], q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1]
  let t0 = 0, t1 = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false }
    else { const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r } else { if (r < t0) return false; if (r < t1) t1 = r } }
  }
  return true
}
/** Push a circle out of a box. Returns the corrected position, or null if not overlapping. */
export function pushOut(px: number, py: number, rad: number, c: Box): { x: number; y: number } | null {
  const minX = c.x - c.w / 2, maxX = c.x + c.w / 2, minY = c.y - c.h / 2, maxY = c.y + c.h / 2
  const cx = Math.max(minX, Math.min(maxX, px)), cy = Math.max(minY, Math.min(maxY, py)), dx = px - cx, dy = py - cy, d2 = dx * dx + dy * dy
  if (d2 >= rad * rad) return null
  if (d2 > 0) { const d = Math.sqrt(d2), k = (rad - d) / d; return { x: px + dx * k, y: py + dy * k } }
  const l = px - minX, r = maxX - px, t = py - minY, b = maxY - py, m = Math.min(l, r, t, b)
  if (m === l) return { x: minX - rad, y: py }
  if (m === r) return { x: maxX + rad, y: py }
  if (m === t) return { x: px, y: minY - rad }
  return { x: px, y: maxY + rad }
}
export const HAZARD_SQUASH = 0.62 // hazards are drawn as ellipses (pseudo-perspective); collision matches
export function inHazard(h: Hazard, x: number, y: number): boolean { const dx = (x - h.x) / h.r, dy = (y - h.y) / (h.r * HAZARD_SQUASH); return dx * dx + dy * dy < 1 }

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

/** Deterministic layout per stage (a retry after a wipe gets the same map). */
export function buildLayout(stage: number, enemyHp: (s: number) => number) {
  const rules = rulesFor(stage), rng = mulberry32(stage * 7919 + 13), R = (a: number, b: number) => a + rng() * (b - a)
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)]
  const local = localStage(stage)
  // Stages 2-9 always have one sniper behind a barricade, so cover matters from the first real fight (stage 1 stays zombies only).
  const gunners = Math.max(stage >= 2 && stage <= 9 ? 1 : 0, Math.min(3, Math.round(Math.max(0, (local - 2) * 0.5 + Math.floor(stage / 10)) * rules.gunnerMul)))
  let mortars = Math.min(2, Math.round(Math.max(0, (local - 4) * 0.35 + Math.floor(stage / 12)) * rules.mortarMul) + (local === 10 ? 1 : 0))
  if (gunners + mortars > 4) mortars-- // max 4 dug-in units so barricades always leave lanes to flank through
  const kinds: Unit['kind'][] = [...Array<Unit['kind']>(gunners).fill('gunner'), ...Array<Unit['kind']>(mortars).fill('mortar')]
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]] }
  const cover: Cover[] = [], units: Unit[] = [], hazards: Hazard[] = []
  let id = 1
  kinds.forEach((kind, k) => {
    const spacing = (ARENA.x1 - ARENA.x0 - 100) / Math.max(1, kinds.length), x = ARENA.x0 + 50 + (k + 0.5) * spacing + R(-6, 6), uy = R(96, 118), hp = enemyHp(stage) * 2.5 * rules.coverHpMul
    cover.push({ id, side: 'enemy', kind: pick(rules.enemyCover), x, y: uy + 70, w: Math.max(40, Math.min(R(52, 72), spacing - 34)), h: 26, hp, max: hp, flash: 0 })
    units.push({ x, y: uy, kind, coverId: id }); id++
  })
  const count = Math.round(R(rules.coverCount[0], rules.coverCount[1])), php = bulletDmg(stage) * 16 * rules.coverHpMul
  for (let i = 0; i < count; i++) for (let tries = 0; tries < 14; tries++) {
    const first = i === 0 // first piece guards the pack's starting spot so cover is learnable straight away
    const w = first ? rules.coverW[1] : R(rules.coverW[0], rules.coverW[1]), x = first ? 180 + R(-30, 30) : R(ARENA.x0 + w / 2 + 6, ARENA.x1 - w / 2 - 6), y = first ? R(352, 376) : R(296, 380)
    if (cover.some(c => c.side === 'player' && Math.abs(c.x - x) < (c.w + w) / 2 + 14 && Math.abs(c.y - y) < 44)) continue
    cover.push({ id: id++, side: 'player', kind: pick(rules.playerCover), x, y, w, h: 28, hp: php, max: php, flash: 0 }); break
  }
  if (rules.hazard) for (let i = 0; i < rules.hazardCount; i++) hazards.push({ kind: rules.hazard, x: R(46, 314), y: R(176, 330), r: R(26, 42) })
  return { cover, units, hazards }
}
