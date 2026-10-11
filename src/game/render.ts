import { W, H, ARENA, WEAPONS, GUARDIANS, ERAS, BIOMES, BENCH, unlockedGuardians } from './data'
import type { Guardian } from './data'
import { G, rnd, buyCost, isBoss, guardianPos, sortedWeapons } from './sim'
import type { Enemy, Shot } from './sim'
import { Audio_ } from './audio'

interface Part { x: number; y: number; vx?: number; vy?: number; col?: string; t: number; life: number; sz?: number; ring?: boolean; r?: number }
interface Floater { x: number; y: number; v: number | string; crit?: boolean; kill?: boolean; blast?: boolean; gold?: boolean; hurt?: boolean; big?: boolean; t: number }
interface Rect { x: number; y: number; w: number; h: number }
type Ctx = CanvasRenderingContext2D
// Renderer: reads G, drains G.events into particles / floating numbers. Never invents damage.
const OUT = '#241810';
export const R = { parts: [] as Part[], floats: [] as Floater[], shake: 0, flash: 0, drag: null as { from: number; x: number; y: number } | null, btns: {} as Record<string, Rect>, hint: 1, popSlot: null as { slot: number; t: number } | null };

export function benchRect(i: number): Rect {
  const c = i % BENCH.cols, r = Math.floor(i / BENCH.cols);
  return { x: BENCH.x + c * (BENCH.w + BENCH.gap), y: BENCH.y + r * (BENCH.h + BENCH.gap), w: BENCH.w, h: BENCH.h };
}

export function drainEvents() {
  for (const e of G.events) {
    if (e.type === 'fire') Audio_.fire(e.kind);
    else if (e.type === 'hit') { Audio_.hit(); burst(e.x, e.y, e.col, 3, 60); }
    else if (e.type === 'dmg') {
      R.floats.push({ x: e.x + rnd(-8, 8), y: e.y, v: e.v, crit: e.crit, kill: e.kill, blast: e.blast, t: 0 });
      if (e.crit) R.shake = Math.max(R.shake, 3);
      if (e.blast) R.shake = Math.max(R.shake, 6);
    } else if (e.type === 'kill') {
      Audio_.kill(); burst(e.x, e.y, e.kind === 'robot' ? '#9fb2c4' : '#7fc06a', 10, 110);
      R.floats.push({ x: e.x, y: e.y - 22, v: '+' + e.gold, gold: true, t: 0 });
      if (e.kind === 'boss') { R.flash = 0.6; R.shake = 10; }
    } else if (e.type === 'boom') { Audio_.boom(); burst(e.x, e.y, '#ff9a3a', 22, 180); R.parts.push({ ring: true, x: e.x, y: e.y, r: e.r, t: 0, life: 0.3 }); }
    else if (e.type === 'pack_hit') R.floats.push({ x: e.x, y: e.y, v: '-' + e.v, hurt: true, t: 0 });
    else if (e.type === 'merge') {
      Audio_.merge(e.level); const rc = benchRect(e.slot);
      burst(rc.x + rc.w / 2, rc.y + rc.h / 2, WEAPONS[e.level].col, 26, 170); R.flash = 0.25; R.shake = 5;
      R.popSlot = { slot: e.slot, t: 0 };
    } else if (e.type === 'unlock') {
      if (e.newEra) { Audio_.fanfare(); G.banner = { text: 'ERA: ' + ERAS[WEAPONS[e.level].era].toUpperCase(), sub: WEAPONS[e.level].n + ' unlocked', t: 2.4, big: true }; R.flash = 0.7; }
      else G.banner = { text: WEAPONS[e.level].n + '!', t: 1.4 };
    } else if (e.type === 'stage_clear') {
      R.floats.push({ x: W / 2, y: ARENA.y0 + 60, v: 'CLEAR +' + e.gold, gold: true, big: true, t: 0 });
    }
  }
  G.events.length = 0;
}
function burst(x: number, y: number, col: string, n: number, sp: number) {
  for (let i = 0; i < n && R.parts.length < 300; i++) {
    const a = Math.random() * 6.283, s = rnd(sp * 0.3, sp);
    R.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, t: 0, life: rnd(0.25, 0.6), sz: rnd(1.5, 3.5) });
  }
}

export function updateFx(dt: number) {
  for (const p of R.parts) { p.t += dt; if (!p.ring) { p.x += p.vx! * dt; p.y += p.vy! * dt; p.vx! *= 0.92; p.vy! *= 0.92; } }
  R.parts = R.parts.filter(p => p.t < p.life);
  for (const f of R.floats) { f.t += dt; f.y -= 28 * dt; }
  R.floats = R.floats.filter(f => f.t < 0.9);
  R.shake *= 0.86; R.flash = Math.max(0, R.flash - dt * 1.5);
  if (R.popSlot && (R.popSlot.t += dt) > 0.25) R.popSlot = null;
}

// ---------- drawing helpers (shared chibi recipe: big head, bold outline, 2-tone cel shade) ----------
function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, shade: string | null) {
  ctx.fillStyle = fill; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  if (shade) { ctx.save(); ctx.clip(); ctx.fillStyle = shade; ctx.beginPath(); ctx.ellipse(x + rx * 0.25, y + ry * 0.35, rx * 1.1, ry * 0.8, 0, 0, 6.283); ctx.fill(); ctx.restore(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.stroke(); }
}
function eyes(ctx: Ctx, x: number, y: number, s: number, look: number) {
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + sx * 4.5 * s, y, 3.2 * s, 3.8 * s, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x + sx * 4.5 * s + (look || 0), y + 0.6, 2 * s, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + sx * 4.5 * s + 0.8, y - 0.8, 0.8 * s, 0, 6.283); ctx.fill();
  }
}
function drawDog(ctx: Ctx, g: Guardian, x: number, y: number, t: number, firing: boolean, tgt: Enemy | undefined) {
  const bob = Math.sin(t * 6 + x) * 1.2;
  y += bob;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 15, 12, 4, 0, 0, 6.283); ctx.fill();
  blob(ctx, x, y + 6, 9, 8, g.fur, g.shade);                         // body
  blob(ctx, x - 6, y + 14, 3.5, 3, g.fur, g.shade); blob(ctx, x + 6, y + 14, 3.5, 3, g.fur, g.shade); // paws
  blob(ctx, x - 10, y - 8, 4.5, 8, g.ear, null); blob(ctx, x + 10, y - 8, 4.5, 8, g.ear, null);        // ears
  blob(ctx, x, y - 4, 12, 11, g.fur, g.shade);                       // head
  eyes(ctx, x, y - 5, 1, tgt ? Math.sign(tgt.x - x) : 0);
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.9, 0, 0, 6.283); ctx.fill();          // nose
  // collar
  ctx.fillStyle = '#d63a3a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - 8, y + 3, 16, 3.5, 1.5); ctx.fill(); ctx.stroke();
  if (firing) { ctx.fillStyle = 'rgba(255,240,150,.8)'; ctx.beginPath(); ctx.arc(x + (tgt && tgt.x < x ? -12 : 12), y + 4, 4, 0, 6.283); ctx.fill(); }
}
function drawEnemy(ctx: Ctx, e: Enemy, t: number) {
  const s = e.r / 11, wob = Math.sin(t * 7 + e.wob) * 1.5, x = e.x, y = e.y + wob;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 11 * s, 10 * s, 3.5 * s, 0, 0, 6.283); ctx.fill();
  const fl = e.flash > 0;
  if (e.kind === 'robot') {
    blob(ctx, x, y + 5 * s, 9 * s, 7 * s, fl ? '#fff' : '#8fa3b8', fl ? null : '#6a7d92');
    ctx.fillStyle = fl ? '#fff' : '#a9bbcf'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 11 * s, y - 14 * s, 22 * s, 18 * s, 5 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5a4a'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * 5 * s, y - 6 * s, 3 * s, 0, 6.283); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x, y - 14 * s); ctx.lineTo(x, y - 19 * s); ctx.stroke(); ctx.fillStyle = '#ffd04a'; ctx.beginPath(); ctx.arc(x, y - 20 * s, 2 * s, 0, 6.283); ctx.fill(); ctx.stroke();
  } else {
    const skin = e.kind === 'boss' ? '#8f6bbf' : '#8ccf6e', sh = e.kind === 'boss' ? '#6f4f9a' : '#64a84c';
    blob(ctx, x, y + 5 * s, 8 * s, 7 * s, fl ? '#fff' : '#5a6f9a', null);
    blob(ctx, x - 9 * s, y + 3 * s, 3 * s, 6 * s, fl ? '#fff' : skin, null); blob(ctx, x + 9 * s, y + 3 * s, 3 * s, 6 * s, fl ? '#fff' : skin, null); // reaching arms
    blob(ctx, x, y - 4 * s, 11 * s, 10 * s, fl ? '#fff' : skin, fl ? null : sh);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(x - 4 * s, y - 5 * s, 3.4 * s, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 4.5 * s, y - 5 * s, 2.6 * s, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x - 4 * s, y - 4.5 * s, 1.4 * s, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.arc(x + 4.5 * s, y - 4.5 * s, 1.2 * s, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4 * s, y + 1 * s); ctx.lineTo(x + 4 * s, y + 1.5 * s); ctx.stroke();
  }
  if (e.hp < e.max || e.kind === 'boss') {
    const bw = e.r * 2.2; ctx.fillStyle = OUT; ctx.fillRect(x - bw / 2 - 1, y - e.r - 15, bw + 2, 5);
    ctx.fillStyle = e.kind === 'boss' ? '#c04aff' : '#ff4a4a'; ctx.fillRect(x - bw / 2, y - e.r - 14, bw * Math.max(0, e.hp / e.max), 3);
  }
}
function drawShot(ctx: Ctx, s: Shot) {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.fillStyle = s.col; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  if (s.kind === 'rock' || s.kind === 'sling') { ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 6.283); ctx.fill(); ctx.stroke(); }
  else if (s.kind === 'arrow') { ctx.fillRect(-8, -1, 14, 2); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.fill(); }
  else if (s.kind === 'grenade') { ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 6.283); ctx.fillStyle = '#566'; ctx.fill(); ctx.stroke(); }
  else { ctx.fillRect(-7, -1.2, s.kind === 'heavy' ? 14 : 9, s.kind === 'heavy' ? 3 : 2.2); }
  ctx.restore();
}

function drawBackground(ctx: Ctx, t: number) {
  const b = BIOMES[Math.floor((G.stage - 1) / 10) % BIOMES.length];
  const g = ctx.createLinearGradient(0, 0, 0, ARENA.y1 + 20); g.addColorStop(0, b.top); g.addColorStop(1, b.bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // parallax silhouettes
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.10)';
    const sp = 4 + layer * 8, base = 150 + layer * 40;
    for (let i = -1; i < 8; i++) {
      const x = ((i * 70 - t * sp) % 560 + 560) % 560 - 100;
      ctx.beginPath(); ctx.moveTo(x, base + 30); ctx.lineTo(x + 28, base - 30 - (i % 3) * 12 - layer * 10); ctx.lineTo(x + 56, base + 30); ctx.fill();
    }
  }
  ctx.fillStyle = b.ground; ctx.fillRect(0, ARENA.y0 - 10, W, ARENA.y1 - ARENA.y0 + 30);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse((i * 97) % W, ARENA.y0 + 20 + (i * 53) % (ARENA.y1 - ARENA.y0 - 30), 14, 4, 0, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, 4); // vignette top hint
  return b;
}

function pill(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, label: string, size?: number, col?: string) {
  ctx.fillStyle = fill; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col || '#fff'; ctx.font = 'bold ' + (size || 13) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}
const fmt = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.floor(n).toString();

export function render(ctx: Ctx, t: number) {
  ctx.save();
  if (R.shake > 0.3) ctx.translate(rnd(-R.shake, R.shake), rnd(-R.shake, R.shake));
  const biome = drawBackground(ctx, t);
  // sort-by-y entities
  const ents: { y: number; d: () => void }[] = [];
  for (const e of G.enemies) ents.push({ y: e.y, d: () => drawEnemy(ctx, e, t) });
  const n = unlockedGuardians(G.stage), ws = sortedWeapons();
  for (let i = 0; i < n; i++) { const gp = guardianPos(i); const firing = ws[i] !== undefined && G.cd[i] > 1 / WEAPONS[ws[i]].rate - 0.08; const tgt = G.enemies[0]; ents.push({ y: gp.y, d: () => { drawDog(ctx, GUARDIANS[i], gp.x, gp.y, t, firing, tgt); if (ws[i] !== undefined) { ctx.fillStyle = WEAPONS[ws[i]].col; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(gp.x + 6, gp.y + 5, 10, 5, 2); ctx.fill(); ctx.stroke(); } } }); }
  ents.sort((a, b) => a.y - b.y).forEach(o => o.d());
  for (const s of G.shots) drawShot(ctx, s);
  for (const p of R.parts) {
    if (p.ring) { ctx.strokeStyle = 'rgba(255,200,90,' + (1 - p.t / p.life) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.r! * (p.t / p.life), 0, 6.283); ctx.stroke(); }
    else { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col!; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz!, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
  }
  for (const f of R.floats) {
    ctx.globalAlpha = Math.min(1, (0.9 - f.t) * 3); ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = OUT;
    const sz = f.big ? 22 : f.blast ? 20 : f.kill ? 15 : f.crit ? 17 : 12;
    ctx.font = 'bold ' + sz + 'px system-ui,sans-serif';
    ctx.fillStyle = f.gold ? '#ffd84a' : f.hurt ? '#ff6a6a' : f.blast ? '#ff9a3a' : f.kill ? '#ff5a5a' : f.crit ? '#ffe45a' : '#fff';
    const txt = typeof f.v === 'number' ? (f.blast ? 'BLAST ' : '') + fmt(f.v) + (f.crit ? '!' : '') : f.v;
    ctx.strokeText(txt, f.x, f.y); ctx.fillText(txt, f.x, f.y); ctx.globalAlpha = 1;
  }
  // combo
  if (G.combo >= 3) { ctx.textAlign = 'center'; ctx.font = 'bold 18px system-ui'; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.fillStyle = '#ffb84a'; ctx.strokeText('COMBO x' + G.combo, W / 2, ARENA.y1 - 8); ctx.fillText('COMBO x' + G.combo, W / 2, ARENA.y1 - 8); }
  ctx.restore();

  // ---------- HUD ----------
  ctx.fillStyle = 'rgba(16,24,26,.88)'; ctx.fillRect(0, 0, W, 62);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui';
  ctx.fillText('Stage ' + G.stage, 10, 16);
  ctx.font = '11px system-ui'; ctx.fillStyle = '#9fb5aa'; ctx.fillText(biome.n + (isBoss(G.stage) ? ' · BOSS' : ''), 10, 34);
  ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 15px system-ui'; ctx.fillText('● ' + fmt(G.gold), 10, 52);
  // pack hp
  const hw = 90, hx = 112; ctx.fillStyle = OUT; ctx.fillRect(hx - 1, 11, hw + 2, 9); ctx.fillStyle = '#4ad66a'; ctx.fillRect(hx, 12, hw * Math.max(0, G.pack.hp / G.pack.max), 7);
  ctx.fillStyle = '#9fb5aa'; ctx.font = '10px system-ui'; ctx.fillText('PACK HP', hx, 30);
  ctx.fillText('Enemies ' + (G.toSpawn - G.spawned + G.enemies.length), hx, 44);
  R.btns.speed = { x: 214, y: 8, w: 46, h: 22 }; pill(ctx, 214, 8, 46, 22, G.speed > 1 ? '#e08a2a' : '#3c4a4f', G.speed > 1 ? '2x ON' : '2x', 12);
  R.btns.mute = { x: 266, y: 8, w: 40, h: 22 }; pill(ctx, 266, 8, 40, 22, '#3c4a4f', Audio_.muted ? 'MUTE' : 'SFX', 11);
  R.btns.merge = { x: 214, y: 34, w: 92, h: 22 }; pill(ctx, 214, 34, 92, 22, '#3a7a5a', 'MERGE ALL', 11);
  const cost = buyCost(), can = G.gold >= cost && G.bench.includes(null);
  R.btns.buy = { x: 310, y: 6, w: 46, h: 50 }; pill(ctx, 310, 6, 46, 50, can ? '#3a8f4a' : '#4a4f52', 'BUY', 12);
  ctx.font = 'bold 9px system-ui'; ctx.fillStyle = can ? '#ffe9a0' : '#8a9094'; ctx.textAlign = 'center'; ctx.fillText(fmt(cost), 333, 46);

  // ---------- bench ----------
  ctx.fillStyle = 'rgba(16,24,26,.92)'; ctx.fillRect(0, BENCH.y - 18, W, H - BENCH.y + 18);
  ctx.textAlign = 'left'; ctx.fillStyle = '#9fb5aa'; ctx.font = '10px system-ui'; ctx.fillText('ARMORY · drag matching weapons together to merge', 8, BENCH.y - 8);
  for (let i = 0; i < 8; i++) {
    const rc = benchRect(i), v = G.bench[i], dragging = R.drag && R.drag.from === i;
    ctx.fillStyle = '#26343a'; ctx.strokeStyle = '#0c1214'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(rc.x, rc.y, rc.w, rc.h, 8); ctx.fill(); ctx.stroke();
    if (v !== null && !dragging) drawCard(ctx, rc.x, rc.y, rc.w, rc.h, v, R.popSlot && R.popSlot.slot === i ? 1 + 0.3 * Math.sin(R.popSlot.t / 0.25 * 3.14) : 1);
    if (v !== null && i >= 0 && !dragging && sortedWeapons().indexOf(v) >= 0 && sortedWeapons().indexOf(v) < n) { /* armed marker */ }
  }
  if (R.drag) { const d = R.drag; drawCard(ctx, d.x - BENCH.w / 2, d.y - BENCH.h / 2, BENCH.w, BENCH.h, G.bench[d.from] ?? 0, 1.1); }
  if (R.hint > 0 && G.stage <= 2) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeText('Drag to move pack · merge matching weapons below', W / 2, ARENA.y1 - 24); ctx.fillText('Drag to move pack · merge matching weapons below', W / 2, ARENA.y1 - 24); }

  // banner + flash
  if (G.banner) {
    const b = G.banner, a = Math.min(1, b.t * 2); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = OUT;
    ctx.font = 'bold ' + (b.big ? 30 : 24) + 'px system-ui'; ctx.fillStyle = b.big ? '#ffd84a' : '#fff';
    ctx.strokeText(b.text, W / 2, 190); ctx.fillText(b.text, W / 2, 190);
    if (b.sub) { ctx.font = 'bold 16px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeText(b.sub, W / 2, 218); ctx.fillText(b.sub, W / 2, 218); }
    ctx.globalAlpha = 1;
  }
  if (R.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, R.flash) + ')'; ctx.fillRect(0, 0, W, H); }
}

function drawCard(ctx: Ctx, x: number, y: number, w: number, h: number, lvl: number, sc: number) {
  const wd = WEAPONS[lvl]; ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-w / 2, -h / 2);
  const eraCols = ['#6b5d4a', '#4a6b4f', '#4a5f7a', '#6b4a7a', '#7a4a4a', '#7a6a2a'];
  ctx.fillStyle = eraCols[wd.era]; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = wd.col; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(w / 2 - 20, 12, 40, 16, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = OUT; ctx.fillRect(w / 2 - 18, 18, 10, 4);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(wd.n.length > 15 ? 'Mk 19 Launcher' : wd.n, w / 2, 40); ctx.fillStyle = '#ffe9a0'; ctx.fillText('Lv ' + (lvl + 1), w / 2, 53);
  ctx.restore();
}
