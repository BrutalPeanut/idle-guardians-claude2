/**
 * Clans. There is no server behind this game yet, so clanmates are SIMULATED: deterministic from the clan id, the date and the hour, so
 * they behave consistently between sessions. Everything here is pure (no import of sim) and sits behind the same shapes a real backend
 * would return (members, weekly pool, online count), so a network service can replace these functions later.
 */
export interface ClanDef { id: string; name: string; tag: string; base: number; req: number; col: string }
export const CLANS: ClanDef[] = [
  { id: 'sit',  name: 'Sit Happens',     tag: 'SIT',  base: 1, req: 1,  col: '#7fd6a0' },
  { id: 'gbc',  name: 'Good Boys Club',  tag: 'GBC',  base: 2, req: 8,  col: '#6fb8ff' },
  { id: 'twg',  name: 'Tail Waggers',    tag: 'TWG',  base: 3, req: 16, col: '#ffd84a' },
  { id: 'snk',  name: 'Snack Pack',      tag: 'SNK',  base: 4, req: 26, col: '#ff9a6a' },
  { id: 'zmy',  name: 'Zoomies Unlimited', tag: 'ZMY', base: 5, req: 38, col: '#c9a6ff' },
  { id: 'app',  name: 'Alpha Pups',      tag: 'APP',  base: 6, req: 52, col: '#ff6a7a' },
]
export interface PlayerClan { id: string; xp: number; week: string; wk: number; claimed: number; gift: string }
export const clanById = (id: string) => CLANS.find(c => c.id === id) ?? CLANS[0]

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const NAMES = ['Maya', 'Jax', 'Priya', 'Tomas', 'Ren', 'Olu', 'Sasha', 'Kiko', 'Bea', 'Dante', 'Mina', 'Hugo', 'Zoe', 'Arlo', 'Nia', 'Felix', 'Lena', 'Omar', 'Tess', 'Ivan', 'Juno', 'Cal', 'Rhea', 'Milo']
export interface Mate { name: string; lvl: number; rate: number }
export const MEMBERS = 12 // 11 simulated mates + you
export function mates(def: ClanDef): Mate[] {
  const r = rng(hash(def.id)), pool = NAMES.slice().sort(() => r() - 0.5)
  return pool.slice(0, MEMBERS - 1).map(name => ({ name, lvl: 4 + def.base * 3 + Math.floor(r() * 10), rate: (2 + r() * 7) * (0.7 + def.base * 0.12) }))
}

export const PERKS: { lv: number; kind: string; val: number; text: string }[] = [
  { lv: 1, kind: 'gold', val: 0.02, text: '+2% gold' }, { lv: 2, kind: 'dmg', val: 0.03, text: '+3% damage' },
  { lv: 3, kind: 'hp', val: 0.04, text: '+4% pack HP' }, { lv: 4, kind: 'raidAtt', val: 1, text: '+1 Raid attempt a day' },
  { lv: 5, kind: 'rate', val: 0.03, text: '+3% fire rate' }, { lv: 6, kind: 'coins', val: 0.1, text: '+10% Dungeon Coins' },
  { lv: 7, kind: 'gold', val: 0.03, text: '+3% gold' }, { lv: 8, kind: 'dmg', val: 0.04, text: '+4% damage' },
  { lv: 9, kind: 'hp', val: 0.05, text: '+5% pack HP' }, { lv: 10, kind: 'rate', val: 0.04, text: '+4% fire rate' },
]
export const XP_PER_LEVEL = 400
export const clanLevel = (pc: PlayerClan | null) => pc ? Math.min(10, clanById(pc.id).base + Math.floor(pc.xp / XP_PER_LEVEL)) : 0
export const clanPerk = (pc: PlayerClan | null, kind: string) => { if (!pc) return 0; const lv = clanLevel(pc); let v = 0; for (const p of PERKS) if (p.kind === kind && p.lv <= lv) v += p.val; return v }

/** Local calendar week number (weeks start Monday). */
export function weekKey(now = Date.now()) { const local = now - new Date().getTimezoneOffset() * 60000; return '' + Math.floor((local / 86400000 + 3) / 7) }
/** 0..1 through the current week. */
export function weekFrac(now = Date.now()) { const local = now - new Date().getTimezoneOffset() * 60000; return (((local / 86400000 + 3) % 7) + 7) % 7 / 7 }
/** Clanmates online right now (changes hourly) and "Clan Hunt": +1% damage per clanmate online, max 8%. */
export const onlineSet = (def: ClanDef, now = Date.now()) => { const hr = Math.floor(now / 3600000); return mates(def).map((_m, i) => hash(def.id + ':' + hr + ':' + i) % 100 < 38) }
export const onlineCount = (def: ClanDef, now = Date.now()) => onlineSet(def, now).filter(Boolean).length
export const clanHunt = (pc: PlayerClan | null, now = Date.now()) => pc ? Math.min(8, onlineCount(clanById(pc.id), now)) * 0.01 : 0

/** Weekly clan raid pool. `scale` is the player's raid baseline so numbers track their progress. */
export function weeklyPool(pc: PlayerClan, scale: number, now = Date.now()) {
  const def = clanById(pc.id), ms = mates(def), f = weekFrac(now)
  const rows = ms.map(m => ({ name: m.name, lvl: m.lvl, dmg: scale * m.rate * f, you: false }))
  rows.push({ name: 'You', lvl: 0, dmg: pc.wk, you: true })
  rows.sort((a, b) => b.dmg - a.dmg)
  const total = rows.reduce((s, r) => s + r.dmg, 0), goal = scale * (ms.reduce((s, m) => s + m.rate, 0) + 15)
  return { rows, total, goal }
}
export const MILESTONES = [
  { at: 1 / 3, coins: 10, gems: 0, chest: -1, text: '10 coins' },
  { at: 2 / 3, coins: 0, gems: 5, chest: 0, text: '5 gems + Wooden chest' },
  { at: 1, coins: 25, gems: 0, chest: 1, text: '25 coins + Silver chest' },
]
