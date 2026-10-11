import { W, H, ARENA, WEAPONS, GUARDIANS, unlockedGuardians } from './data'
import type { WeaponKind } from './data'

export interface Enemy { x: number; y: number; hp: number; max: number; spd: number; r: number; kind: 'zombie' | 'robot' | 'boss'; flash: number; wob: number; dmg: number }
export interface Shot { x: number; y: number; vx: number; vy: number; w: number; dmg: number; crit: boolean; life: number; tgt: Enemy | null; kind: WeaponKind; col: string }
export interface Banner { text: string; sub?: string; t: number; big?: boolean }
export type GEvent =
  | { type: 'fire'; kind: WeaponKind; x: number; y: number; col: string }
  | { type: 'hit'; x: number; y: number; col: string }
  | { type: 'dmg'; x: number; y: number; v: number; crit: boolean; kill: boolean; blast?: boolean }
  | { type: 'kill'; x: number; y: number; kind: Enemy['kind']; gold: number }
  | { type: 'boom'; x: number; y: number; r: number }
  | { type: 'pack_hit'; x: number; y: number; v: number }
  | { type: 'merge'; slot: number; level: number }
  | { type: 'unlock'; level: number; newEra: boolean }
  | { type: 'stage_clear'; stage: number; gold: number }

interface State {
  gold: number; stage: number; bought: number; bench: (number | null)[]; maxLevel: number
  pack: { x: number; y: number; tx: number; ty: number; hp: number; max: number }
  enemies: Enemy[]; shots: Shot[]; events: GEvent[]; t: number
  spawned: number; toSpawn: number; spawnT: number; speed: number; cd: number[]; clearT: number
  banner: Banner | null; kills: number; combo: number; comboT: number
}
// Combat simulation. Pure state + events; renderer only reads G and drains G.events.
export const G: State = {
  gold: 40, stage: 1, bought: 0, bench: new Array(8).fill(null), maxLevel: 0,
  pack: { x: 180, y: 380, tx: 180, ty: 380, hp: 220, max: 220 },
  enemies: [], shots: [], events: [], t: 0,
  spawned: 0, toSpawn: 0, spawnT: 0, speed: 1, cd: [0, 0, 0, 0], clearT: 0, banner: null, kills: 0, combo: 0, comboT: 0,
};
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const hpScale = (s: number) => 20 * Math.pow(1.27, s - 1);
export const buyCost = () => Math.ceil(15 * Math.pow(1.11, G.bought));
export const isBoss = (s: number) => s % 10 === 0;

export function save() {
  try { localStorage.setItem('ig_save', JSON.stringify({ gold: G.gold, stage: G.stage, bought: G.bought, bench: G.bench, maxLevel: G.maxLevel, t: Date.now() })); } catch { /* storage unavailable */ }
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem('ig_save') || 'null');
    if (!s) { G.bench[0] = 0; G.bench[1] = 0; return false; }
    Object.assign(G, { gold: s.gold, stage: s.stage, bought: s.bought, bench: s.bench, maxLevel: s.maxLevel });
    return true;
  } catch { G.bench[0] = 0; G.bench[1] = 0; return false; }
}

export function startStage() {
  const s = G.stage;
  G.enemies.length = 0; G.shots.length = 0; G.spawned = 0; G.spawnT = 0.5;
  G.toSpawn = isBoss(s) ? 8 + s : 6 + Math.floor(s * 1.5);
  G.pack.max = 220 + s * 14; G.pack.hp = G.pack.max;
  G.banner = { text: isBoss(s) ? 'BOSS STAGE ' + s : 'STAGE ' + s, t: 1.6, big: isBoss(s) };
}

function spawnEnemy() {
  const s = G.stage, boss = isBoss(s) && G.spawned === 0;
  const robot = s >= 6 && Math.random() < 0.35;
  const hp = hpScale(s) * (boss ? 14 : 1) * rnd(0.9, 1.15) * (robot ? 1.4 : 1);
  G.enemies.push({
    x: rnd(ARENA.x0 + 20, ARENA.x1 - 20), y: ARENA.y0 - 10, hp, max: hp,
    spd: (boss ? 16 : rnd(22, 34)) * (robot ? 0.8 : 1), r: boss ? 24 : robot ? 13 : 11,
    kind: boss ? 'boss' : robot ? 'robot' : 'zombie', flash: 0, wob: Math.random() * 6, dmg: (4 + s * 1.3) * (boss ? 3 : 1),
  });
  G.spawned++;
}

export function sortedWeapons() {
  return (G.bench.filter(v => v !== null) as number[]).sort((a, b) => b - a);
}
export function guardianPos(i: number) {
  const o = GUARDIANS[i].off, p = G.pack; return { x: p.x + o[0], y: p.y + o[1] };
}

function fireFrom(i: number, w: number, target: Enemy) {
  const gp = guardianPos(i), wd = WEAPONS[w];
  const crit = Math.random() < 0.1, mult = crit ? 2 : 1;
  const n = wd.pellets || 1;
  for (let k = 0; k < n; k++) {
    const dx = target.x - gp.x, dy = target.y - gp.y;
    const a = Math.atan2(dy, dx) + (n > 1 ? (k - (n - 1) / 2) * 0.12 : rnd(-0.03, 0.03));
    G.shots.push({
      x: gp.x, y: gp.y - 6, vx: Math.cos(a) * wd.spd, vy: Math.sin(a) * wd.spd, w, dmg: wd.dmg * mult, crit,
      life: 1.6, tgt: n > 1 ? null : target, kind: wd.kind, col: wd.col,
    });
  }
  G.events.push({ type: 'fire', kind: wd.kind, x: gp.x, y: gp.y, col: wd.col });
}

function damageEnemy(e: Enemy, dmg: number, crit: boolean) {
  e.hp -= dmg; e.flash = 0.1;
  const kill = e.hp <= 0;
  G.events.push({ type: 'dmg', x: e.x, y: e.y - e.r, v: dmg, crit, kill });
  if (kill) {
    G.kills++; G.combo++; G.comboT = 2.5;
    const gold = Math.ceil((2 + G.stage * 0.9) * Math.pow(1.1, G.stage - 1) * (e.kind === 'boss' ? 12 : 1));
    G.gold += gold;
    G.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, gold });
  }
  return kill;
}

export function update(dtReal: number) {
  const dt = dtReal * G.speed; G.t += dt;
  const p = G.pack;
  // pack movement (drag target)
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
  if (d > 1) { const st = Math.min(d, 300 * dt); p.x += dx / d * st; p.y += dy / d * st; }
  p.x = Math.max(ARENA.x0 + 40, Math.min(ARENA.x1 - 40, p.x));
  p.y = Math.max(ARENA.y0 + 40, Math.min(ARENA.y1 - 50, p.y));
  if (G.comboT > 0 && (G.comboT -= dt) <= 0) G.combo = 0;
  if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null;

  // spawning
  if (G.spawned < G.toSpawn && (G.spawnT -= dt) <= 0) { spawnEnemy(); G.spawnT = isBoss(G.stage) ? 0.45 : 0.7; }

  // guardians fire
  const ws = sortedWeapons(), n = unlockedGuardians(G.stage);
  for (let i = 0; i < n; i++) {
    if (ws[i] === undefined) continue;
    G.cd[i] -= dt;
    if (G.cd[i] > 0) continue;
    const gp = guardianPos(i); let best: Enemy | null = null, bd = 1e9;
    for (const e of G.enemies) { const dd = Math.hypot(e.x - gp.x, e.y - gp.y); if (dd < bd) { bd = dd; best = e; } }
    if (!best) continue;
    fireFrom(i, ws[i], best); G.cd[i] = 1 / WEAPONS[ws[i]].rate;
  }

  // projectiles
  for (const s of G.shots) {
    if (s.tgt && s.tgt.hp > 0) {
      const a = Math.atan2(s.tgt.y - s.y, s.tgt.x - s.x), sp = Math.hypot(s.vx, s.vy);
      s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.x < 0 || s.x > W || s.y < ARENA.y0 - 20 || s.y > H) s.life = 0;
    if (s.life <= 0) continue;
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 4) {
        s.life = 0;
        if (s.kind === 'grenade') {
          const sp = WEAPONS[s.w].splash ?? 60; let total = 0; const crit = s.crit;
          G.events.push({ type: 'boom', x: s.x, y: s.y, r: sp });
          for (const o of G.enemies) {
            if (o.hp > 0 && Math.hypot(o.x - s.x, o.y - s.y) < sp) { total += s.dmg; o.hp -= s.dmg; o.flash = 0.1; if (o.hp <= 0) { G.kills++; G.combo++; G.comboT = 2.5; const g = Math.ceil((2 + G.stage * 0.9) * Math.pow(1.1, G.stage - 1)); G.gold += g; G.events.push({ type: 'kill', x: o.x, y: o.y, kind: o.kind, gold: g }); } }
          }
          G.events.push({ type: 'dmg', x: s.x, y: s.y - 14, v: total, crit, kill: false, blast: true });
        } else {
          damageEnemy(e, s.dmg, s.crit);
          G.events.push({ type: 'hit', x: s.x, y: s.y, col: s.col });
        }
        break;
      }
    }
  }
  G.shots = G.shots.filter(s => s.life > 0);

  // enemies move + attack
  const aura = 0.92; // Rudy's Good Boy Aura
  for (const e of G.enemies) {
    if (e.flash > 0) e.flash -= dt;
    if (e.hp <= 0) continue;
    const ex = p.x - e.x, ey = p.y - e.y, ed = Math.hypot(ex, ey);
    if (ed > 30) { e.x += ex / ed * e.spd * dt; e.y += ey / ed * e.spd * dt; }
    else { const dmg = e.dmg * dt * aura; p.hp -= dmg; if (Math.random() < dt * 3) G.events.push({ type: 'pack_hit', x: p.x + rnd(-20, 20), y: p.y - 20, v: Math.ceil(e.dmg * aura) }); }
    e.x = Math.max(ARENA.x0 + e.r, Math.min(ARENA.x1 - e.r, e.x));
    e.y = Math.max(ARENA.y0 - 14, Math.min(ARENA.y1, e.y));
  }
  G.enemies = G.enemies.filter(e => e.hp > 0);

  // wipe / clear
  if (p.hp <= 0) { G.banner = { text: 'REGROUP!', t: 1.4 }; startStage(); return; }
  if (G.spawned >= G.toSpawn && G.enemies.length === 0) {
    const bonus = Math.ceil((10 + G.stage * 4) * Math.pow(1.1, G.stage - 1));
    G.gold += bonus; G.events.push({ type: 'stage_clear', stage: G.stage, gold: bonus });
    G.stage++; save(); startStage();
  }
}

// ---- bench actions ----
export function buyWeapon() {
  const slot = G.bench.indexOf(null), c = buyCost();
  if (slot < 0 || G.gold < c) return false;
  G.gold -= c; G.bought++;
  G.bench[slot] = Math.max(0, G.maxLevel - 3);
  save(); return true;
}
export function tryMerge(a: number, b: number) {
  if (a === b || G.bench[a] === null || G.bench[a] !== G.bench[b] || (G.bench[a] as number) >= WEAPONS.length - 1) return false;
  const lvl = (G.bench[b] as number) + 1; G.bench[b] = lvl; G.bench[a] = null;
  G.events.push({ type: 'merge', slot: b, level: lvl });
  if (lvl > G.maxLevel) {
    G.maxLevel = lvl;
    G.events.push({ type: 'unlock', level: lvl, newEra: lvl === 0 || WEAPONS[lvl].era !== WEAPONS[lvl - 1].era });
  }
  save(); return true;
}
export function mergeAll() {
  let any = false, again = true;
  while (again) {
    again = false;
    for (let a = 0; a < 8 && !again; a++) for (let b = a + 1; b < 8; b++) if (tryMerge(a, b)) { any = true; again = true; break; }
  }
  return any;
}
