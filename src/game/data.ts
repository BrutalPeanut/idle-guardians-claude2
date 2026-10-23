// Static game data. No logic here.
export const W = 360, H = 640;
export const ARENA = { x0: 8, y0: 74, x1: 352, y1: 404 };
export const ERAS = ['Stone Age', 'Archery', 'Sidearms', 'Longarms', 'Automatics', 'Heavy Ordnance'];
// 13-rung ladder (locked). dmg = per projectile, rate = shots/sec
export interface Weapon { n: string; era: number; dmg: number; rate: number; spd: number; kind: WeaponKind; col: string; pellets?: number; splash?: number }
export type WeaponKind = 'rock' | 'sling' | 'arrow' | 'bullet' | 'pellet' | 'heavy' | 'grenade'
export const WEAPONS: Weapon[] = [
  { n: 'Thrown Rock',            era: 0, dmg: 5,   rate: 1.1, spd: 240, kind: 'rock',    col: '#a89b88' },
  { n: 'Slingshot',              era: 0, dmg: 9,   rate: 1.3, spd: 300, kind: 'sling',   col: '#c9a36a' },
  { n: 'Recurve Bow',            era: 1, dmg: 16,  rate: 1.2, spd: 360, kind: 'arrow',   col: '#e8d9a8' },
  { n: 'Compound Bow',           era: 1, dmg: 28,  rate: 1.5, spd: 420, kind: 'arrow',   col: '#d9e8a8' },
  { n: 'Pistol',                 era: 2, dmg: 42,  rate: 2.2, spd: 520, kind: 'bullet',  col: '#ffe27a' },
  { n: 'Revolver',               era: 2, dmg: 75,  rate: 1.6, spd: 540, kind: 'bullet',  col: '#ffd04a' },
  { n: 'Hunting Rifle',          era: 3, dmg: 150, rate: 1.0, spd: 700, kind: 'bullet',  col: '#fff1a8' },
  { n: 'Shotgun',                era: 3, dmg: 28,  rate: 1.1, spd: 500, kind: 'pellet',  col: '#ffb04a', pellets: 6 },
  { n: 'SMG',                    era: 4, dmg: 55,  rate: 7,   spd: 560, kind: 'bullet',  col: '#ffe27a' },
  { n: 'Assault Rifle',          era: 4, dmg: 95,  rate: 6,   spd: 620, kind: 'bullet',  col: '#ffeaa0' },
  { n: 'Minigun',                era: 5, dmg: 70,  rate: 14,  spd: 600, kind: 'bullet',  col: '#ffcf5a' },
  { n: 'M2 Browning',            era: 5, dmg: 380, rate: 5,   spd: 680, kind: 'heavy',   col: '#ffa24a' },
  { n: 'Mk 19 Grenade Launcher', era: 5, dmg: 900, rate: 1.8, spd: 300, kind: 'grenade', col: '#ff7a4a', splash: 70 },
];
// Pack formation order = guardian unlock order. Breed/role are data for the later guardian pass.
export interface Guardian { n: string; breed: string; role: string; fur: string; shade: string; ear: string; off: [number, number]; look: 'rudy' | 'cooper' | 'plain'; hpMul: number; dmgMul: number; tag: string; perk?: string; perkText?: string; cost?: number }
export const ROSTER: Guardian[] = [
  { n: 'Rudy',   breed: 'English Cream Golden', role: 'Leader',  fur: '#fcf3da', shade: '#ecdcb0', ear: '#e6cd92', off: [0, -10], look: 'rudy', hpMul: 1.3, dmgMul: 1.1, tag: 'R' },
  { n: 'Cooper', breed: 'Mutt',                 role: 'Support', fur: '#dc9248', shade: '#b86f31', ear: '#b86f31', off: [-42, 12], look: 'cooper', hpMul: 1.2, dmgMul: 1.1, tag: 'C' },
  { n: 'Bruno',  breed: 'Bulldog',              role: 'Tank',    fur: '#e9e4dc', shade: '#c3baa9', ear: '#b0743f', off: [42, 16], look: 'plain', hpMul: 0.9, dmgMul: 0.88, tag: 'B', perk: 'guard', perkText: 'Guard: whole pack takes 8% less damage', cost: 0 },
  { n: 'Luna',   breed: 'Husky',                role: 'DPS',     fur: '#cfd6de', shade: '#9aa6b5', ear: '#4b5666', off: [0, 48], look: 'plain', hpMul: 0.7, dmgMul: 0.92, tag: 'L', perk: 'keen', perkText: 'Keen Eyes: +6% crit chance for everyone', cost: 0 },
  { n: 'Waffles', breed: 'Beagle',        role: 'Scout',   fur: '#ecd3a6', shade: '#c49a5c', ear: '#8a5a2a', off: [0, 0], look: 'plain', hpMul: 0.85, dmgMul: 0.9,  tag: 'W', perk: 'treats',  perkText: 'Treat Finder: +10% gold from kills', cost: 40 },
  { n: 'Pepper',  breed: 'Dalmatian',     role: 'Spotter', fur: '#f4f1ec', shade: '#cfc8bd', ear: '#3a3a3a', off: [0, 0], look: 'plain', hpMul: 0.8,  dmgMul: 0.95, tag: 'P', perk: 'spotter', perkText: 'Spotter: +8% fire rate for everyone', cost: 60 },
  { n: 'Honey',   breed: 'Corgi',         role: 'Medic',   fur: '#efb066', shade: '#c47a2c', ear: '#c47a2c', off: [0, 0], look: 'plain', hpMul: 1.0,  dmgMul: 0.8,  tag: 'H', perk: 'medic',   perkText: 'Medic: heals the pack 1% max HP per second', cost: 80 },
  { n: 'Ziggy',   breed: 'Dachshund',     role: 'Bomber',  fur: '#9a6a46', shade: '#6a4228', ear: '#4a2e1a', off: [0, 0], look: 'plain', hpMul: 0.75, dmgMul: 0.92, tag: 'Z', perk: 'bark',    perkText: 'Big Bark: grenade cooldown 15% shorter', cost: 100 },
  { n: 'Shadow',  breed: 'Black Lab',     role: 'Striker', fur: '#5a5662', shade: '#2e2b33', ear: '#2e2b33', off: [0, 0], look: 'plain', hpMul: 0.85, dmgMul: 1.0,  tag: 'S', perk: 'night',   perkText: 'Night Watch: +10% damage for everyone', cost: 140 },
  { n: 'Mochi',   breed: 'Shiba Inu',     role: 'Lucky',   fur: '#f0b468', shade: '#c47f35', ear: '#c47f35', off: [0, 0], look: 'plain', hpMul: 0.9,  dmgMul: 0.9,  tag: 'M', perk: 'lucky',   perkText: 'Lucky Paws: idle stash holds 15% more', cost: 180 },
];
/** Slots 0-1 are always Rudy and Cooper; slots 2-3 hold whichever roster dogs are in the squad (see sim.applySquad). */
export const SLOT_OFF: [number, number][] = [[42, 16], [0, 48]]
export const GUARDIANS: Guardian[] = [ROSTER[0], ROSTER[1], { ...ROSTER[2], off: SLOT_OFF[0] }, { ...ROSTER[3], off: SLOT_OFF[1] }]
export const unlockedGuardians = (stage: number) => Math.min(GUARDIANS.length, 2 + Math.floor(stage / 5));
export const BIOMES = [
  { n: 'Whispering Forest', top: '#2f5a43', bot: '#1d3a2c', ground: '#2d4a33' },
  { n: 'Sunscorched Desert', top: '#e0a867', bot: '#b87a3d', ground: '#c99556' },
  { n: 'Tideline Beach', top: '#6fb8c8', bot: '#d9c28b', ground: '#d6bf86' },
  { n: 'Volcanic Badlands', top: '#4a2a2a', bot: '#2a1618', ground: '#3b2422' },
  { n: 'Frostbound Snowfield', top: '#9db8d6', bot: '#dfeaf5', ground: '#cfdcea' },
  { n: 'Lantern Swamp', top: '#2b3d3a', bot: '#1a2926', ground: '#25382f' },
];
export const BENCH = { x: 8, y: 488, cols: 4, rows: 2, w: 82, h: 50, gap: 6 };
export const ACTION_BAR = { y: 598, h: 36 };
