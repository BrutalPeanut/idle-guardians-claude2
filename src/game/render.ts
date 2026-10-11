import { W, H, ARENA, WEAPONS, GUARDIANS, ERAS, BIOMES, BENCH, ACTION_BAR, unlockedGuardians } from './data'
import type { Guardian } from './data'
import { G, rnd, buyCost, isBoss, guardianPos, sortedWeapons, idleCap, IDLE, NADE } from './sim'
import { rulesFor, biomeIndex } from './cover'
import { drawCover, drawHazard, drawEBullets, drawShells, drawStatus, drawHold, coverDust } from './coverRender'
import type { Enemy, Shot } from './sim'
import { Audio_ } from './audio'
import { drawWeaponIcon } from './weaponIcons'

interface Part { x: number; y: number; vx?: number; vy?: number; col?: string; t: number; life: number; sz?: number; ring?: boolean; r?: number }
interface Floater { x: number; y: number; v: number | string; cover?: boolean; flank?: boolean; crit?: boolean; kill?: boolean; blast?: boolean; gold?: boolean; hurt?: boolean; big?: boolean; t: number }
interface Rect { x: number; y: number; w: number; h: number }
type Ctx = CanvasRenderingContext2D
// Renderer: reads G, drains G.events into particles / floating numbers. Never invents damage.
const OUT = '#241810';
export const R = { parts: [] as Part[], floats: [] as Floater[], shake: 0, flash: 0, drag: null as { from: number; x: number; y: number } | null, btns: {} as Record<string, Rect>, hint: 1, help: false, coverT: {} as Record<number, number>, dragOver: -1, dragAnchor: null as { sx: number; sy: number; cx: number; cy: number } | null, pressed: null as string | null, popSlot: null as { slot: number; t: number } | null };

export function benchRect(i: number): Rect {
  const c = i % BENCH.cols, r = Math.floor(i / BENCH.cols);
  return { x: BENCH.x + c * (BENCH.w + BENCH.gap), y: BENCH.y + r * (BENCH.h + BENCH.gap), w: BENCH.w, h: BENCH.h };
}

export function drainEvents() {
  for (const e of G.events) {
    if (e.type === 'fire') Audio_.fire(e.kind);
    else if (e.type === 'hit') { Audio_.hit(); burst(e.x, e.y, e.col, 3, 60); }
    else if (e.type === 'dmg') {
      R.floats.push({ x: e.x + rnd(-8, 8), y: e.y, v: e.v, crit: e.crit, kill: e.kill, blast: e.blast, flank: e.flank, t: 0 });
      if (e.crit) R.shake = Math.max(R.shake, 3);
      if (e.blast) R.shake = Math.max(R.shake, 6);
    } else if (e.type === 'kill') {
      Audio_.kill(); burst(e.x, e.y, e.kind === 'robot' ? '#9fb2c4' : '#7fc06a', 10, 110);
      R.floats.push({ x: e.x, y: e.y - 22, v: '+' + e.gold, gold: true, t: 0 });
      if (e.kind === 'boss') { R.flash = 0.6; R.shake = 10; }
    } else if (e.type === 'boom') { Audio_.boom(); burst(e.x, e.y, '#ff9a3a', 22, 180); R.parts.push({ ring: true, x: e.x, y: e.y, r: e.r, t: 0, life: 0.3 }); }
    else if (e.type === 'pack_hit') R.floats.push({ x: e.x, y: e.y, v: '-' + e.v, hurt: true, t: 0 });
    else if (e.type === 'cover_hit') { Audio_.hit(); burst(e.x, e.y, coverDust(e.kind), 4, 70); if (!(G.t - (R.coverT[e.id] ?? -9) < 0.35)) { R.coverT[e.id] = G.t; R.floats.push({ x: e.x, y: e.y - 6, v: Math.ceil(e.v), cover: true, t: 0 }) } }
    else if (e.type === 'cover_break') { Audio_.boom(); burst(e.x, e.y, coverDust(e.kind), 28, 150); R.shake = Math.max(R.shake, 5); R.floats.push({ x: e.x, y: e.y - 24, v: 'COVER DOWN', hurt: e.w > 0, t: 0 }) }
    else if (e.type === 'efire') Audio_.zap()
    else if (e.type === 'mortar_fire') Audio_.whump()
    else if (e.type === 'down') { Audio_.ui(); R.floats.push({ x: e.x, y: e.y - 30, v: GUARDIANS[e.i].n + ' down!', hurt: true, big: true, t: 0 }) }
    else if (e.type === 'revive') { Audio_.merge(0); burst(e.x, e.y, '#7af09a', 14, 90); R.floats.push({ x: e.x, y: e.y - 30, v: GUARDIANS[e.i].n + ' is back', gold: true, t: 0 }) }
    else if (e.type === 'nade_throw') Audio_.whump()
    else if (e.type === 'idle_collect') {
      Audio_.coins(); burst(60, 57, '#ffd84a', 30, 150); burst(60, 57, '#fff2b0', 12, 100)
      R.floats.push({ x: 90, y: 90, v: '+' + fmt(e.gold), gold: true, big: true, t: 0 })
      G.banner = { text: 'COLLECTED', sub: '+' + fmt(e.gold) + ' gold', t: 1.8, big: true }
    }
    else if (e.type === 'hold') { Audio_.ui(); G.banner = { text: e.on ? 'SUPPORT HELD' : 'REGROUP', sub: e.on ? 'Drag now steers Rudy & Cooper' : undefined, t: 1.6 } }
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
  const bob = Math.sin(t * 6 + x) * 1.2
  y += bob
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 15, g.look === 'cooper' ? 10.5 : 12.5, 4, 0, 0, 6.283); ctx.fill()
  const look = tgt ? Math.sign(tgt.x - x) : 0
  if (g.look === 'rudy') drawRudy(ctx, g, x, y, t, look)
  else if (g.look === 'cooper') drawCooper(ctx, g, x, y, t, look)
  else drawPlainDog(ctx, g, x, y, look)
  if (firing) { ctx.fillStyle = 'rgba(255,240,150,.8)'; ctx.beginPath(); ctx.arc(x + (tgt && tgt.x < x ? -12 : 12), y + 4, 4, 0, 6.283); ctx.fill() }
}
function collar(ctx: Ctx, x: number, y: number, col: string, tag: boolean) {
  ctx.fillStyle = col; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - 8, y + 3, 16, 3.5, 1.5); ctx.fill(); ctx.stroke()
  if (tag) { ctx.fillStyle = '#f0c24a'; ctx.beginPath(); ctx.arc(x, y + 8, 1.9, 0, 6.283); ctx.fill(); ctx.stroke() }
}
function drawPlainDog(ctx: Ctx, g: Guardian, x: number, y: number, look: number) {
  blob(ctx, x, y + 6, 9, 8, g.fur, g.shade)
  blob(ctx, x - 6, y + 14, 3.5, 3, g.fur, g.shade); blob(ctx, x + 6, y + 14, 3.5, 3, g.fur, g.shade)
  blob(ctx, x - 10, y - 8, 4.5, 8, g.ear, null); blob(ctx, x + 10, y - 8, 4.5, 8, g.ear, null)
  blob(ctx, x, y - 4, 12, 11, g.fur, g.shade)
  eyes(ctx, x, y - 5, 1, look)
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.9, 0, 0, 6.283); ctx.fill()
  collar(ctx, x, y, '#d63a3a', false)
}
/** Rudy: English cream golden. Near-white fluffy coat, long floppy ears, brown nose, big open-mouth smile, dark collar with tag. */
function drawRudy(ctx: Ctx, g: Guardian, x: number, y: number, t: number, look: number) {
  const wag = Math.sin(t * 9 + x) * 3
  blob(ctx, x + 11 + wag * 0.4, y + 5 + wag * 0.2, 7, 4.6, g.fur, g.shade)                          // plume tail
  blob(ctx, x, y + 6, 10.5, 8.8, g.fur, g.shade)                                                    // body
  for (const dx of [-6, -2, 2, 6]) blob(ctx, x + dx, y + 10, 3.7, 3.2, g.fur, null)                 // chest feathering
  blob(ctx, x - 6.5, y + 14.5, 4.2, 3.3, g.fur, g.shade); blob(ctx, x + 6.5, y + 14.5, 4.2, 3.3, g.fur, g.shade) // fluffy paws
  blob(ctx, x - 11.5, y - 1, 4.8, 9.6, g.ear, g.shade); blob(ctx, x + 11.5, y - 1, 4.8, 9.6, g.ear, g.shade)       // long floppy ears
  blob(ctx, x, y - 4, 12.6, 11.6, g.fur, g.shade)                                                   // head
  blob(ctx, x, y + 0.8, 7, 4.8, '#fdf8ea', null)                                                    // light muzzle
  eyes(ctx, x, y - 6.5, 1, look)
  ctx.fillStyle = '#6a3f2e'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y - 1.2, 3.3, 2.3, 0, 0, 6.283); ctx.fill(); ctx.stroke() // brown nose
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - 1, y - 2, 1, 0.6, 0, 0, 6.283); ctx.fill()
  ctx.fillStyle = '#7a2d3a'; ctx.beginPath(); ctx.ellipse(x, y + 2.4, 4.6, 3.4, 0, 0, Math.PI); ctx.fill(); ctx.stroke() // open mouth
  ctx.fillStyle = '#ff90a8'; ctx.beginPath(); ctx.ellipse(x + 0.4, y + 4.8, 2.6, 2.2, 0, 0, Math.PI); ctx.fill()           // tongue
  collar(ctx, x, y + 1, '#3a3f46', true)
}
/** Cooper: short-coated tan mix. Dark muzzle, one perked ear + one folded, white chest patch, head tilt, wide worried eyes. */
function drawCooper(ctx: Ctx, g: Guardian, x: number, y: number, t: number, look: number) {
  const wag = Math.sin(t * 8 + x) * 3
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 7, y + 9); ctx.quadraticCurveTo(x + 15, y + 8 + wag, x + 15, y + 1 + wag); ctx.stroke() // whip tail
  ctx.strokeStyle = g.fur; ctx.lineWidth = 2.4; ctx.stroke(); ctx.lineCap = 'butt'
  blob(ctx, x, y + 6, 8.3, 8.6, g.fur, g.shade)                                                     // lean body
  blob(ctx, x, y + 9, 4, 5.2, '#f7f1e6', null)                                                      // white chest patch
  blob(ctx, x - 5.5, y + 14.5, 3.1, 3, g.fur, g.shade); blob(ctx, x + 5.5, y + 14.5, 3.1, 3, g.fur, g.shade)
  ctx.save(); ctx.translate(x, y - 4); ctx.rotate(-0.14)                                            // head tilt
  ctx.fillStyle = g.ear; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(-10.5, -12.5); ctx.quadraticCurveTo(-6, -14, -3, -8.5); ctx.closePath(); ctx.fill(); ctx.stroke() // perked rose ear
  ctx.beginPath(); ctx.moveTo(3, -9); ctx.lineTo(13, -11); ctx.lineTo(11.5, -2); ctx.closePath(); ctx.fill(); ctx.stroke()    // folded ear
  blob(ctx, 0, 0, 11.6, 10.6, g.fur, g.shade)                                                       // head
  blob(ctx, 0, 4.2, 6.8, 5, '#4a3329', null)                                                        // dark boxy muzzle
  ctx.fillStyle = '#16100d'; ctx.beginPath(); ctx.ellipse(0, 2.4, 3, 2.1, 0, 0, 6.283); ctx.fill()  // nose
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 4.4); ctx.lineTo(0, 6); ctx.moveTo(-3, 7); ctx.quadraticCurveTo(0, 8.4, 3, 7); ctx.stroke()
  for (const sx of [-1, 1]) {                                                                       // wide, slightly worried eyes
    ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(sx * 4.6, -1.8, 3.6, 4.2, 0, 0, 6.283); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(sx * 4.6 + look * 0.9, -1.4, 2, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * 4.6 + look * 0.9 + 0.7, -2.2, 0.8, 0, 6.283); ctx.fill()
    ctx.strokeStyle = g.shade; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(sx * 2.2, -7.2 + (sx < 0 ? 0.6 : 0)); ctx.lineTo(sx * 7.2, -7.4 - (sx < 0 ? 0.6 : 0)); ctx.stroke() // brow
  }
  ctx.restore()
  collar(ctx, x, y + 1, '#d63a3a', false)
}
/** Weapon held in both paws across the body, aimed at the current target, with recoil kick on fire. */
function drawHeld(ctx: Ctx, lvl: number, gx: number, gy: number, tgt: Enemy | undefined, firing: boolean, t: number, g: Guardian) {
  const bob = Math.sin(t * 6 + gx) * 1.2, cy = gy + 10 + bob
  const dx = tgt ? tgt.x - gx : 1, dy = tgt ? tgt.y - cy : 0, flip = dx < 0
  const ang = Math.max(-0.4, Math.min(0.4, Math.atan2(dy, Math.abs(dx)) * 0.5)) // keep the weapon below the face
  ctx.save(); ctx.translate(gx + (flip ? -3 : 3), cy); ctx.scale(flip ? -1 : 1, 1); ctx.rotate(ang)
  ctx.translate(firing ? 3 : 7, 0)
  drawWeaponIcon(ctx, lvl, 0, 0, 0.66)
  for (const px of [-5, 5]) { ctx.fillStyle = g.fur; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, 2.6, 3.2, 0, 6.283); ctx.fill(); ctx.stroke() }
  ctx.restore()
}

function drawEnemy(ctx: Ctx, e: Enemy, t: number) {
  const s = e.r / 11, wob = Math.sin(t * 7 + e.wob) * 1.5, x = e.x, y = e.y + wob;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 11 * s, 10 * s, 3.5 * s, 0, 0, 6.283); ctx.fill();
  const fl = e.flash > 0;
  if (e.kind === 'gunner' || e.kind === 'mortar') {
    const hot = e.kind === 'mortar' ? e.cd < 0.7 : e.cd < 0.35
    if (e.kind === 'mortar') { ctx.save(); ctx.translate(x, y - 8 * s); ctx.rotate(-0.25); ctx.fillStyle = fl ? '#fff' : '#3a414b'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-4, -20, 8, 22, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = hot ? '#ffb347' : '#ff7a2a'; ctx.fillRect(-4, -20, 8, 4); ctx.restore() }
    blob(ctx, x, y + 5 * s, 9 * s, 7 * s, fl ? '#fff' : e.kind === 'mortar' ? '#7a6a9a' : '#8fa3b8', fl ? null : e.kind === 'mortar' ? '#574a76' : '#6a7d92')
    ctx.fillStyle = fl ? '#fff' : '#a9bbcf'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 11 * s, y - 13 * s, 22 * s, 17 * s, 5 * s); ctx.fill(); ctx.stroke()
    ctx.fillStyle = hot ? '#fff36a' : '#ff5a4a'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * 5 * s, y - 6 * s, 3 * s, 0, 6.283); ctx.fill(); ctx.stroke() }
    if (e.kind === 'gunner') { ctx.fillStyle = '#3a414b'; ctx.beginPath(); ctx.roundRect(x - 3, y + 2 * s, 6, 14 * s, 2); ctx.fill(); ctx.stroke(); if (hot) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x, y + 16 * s, 3.5, 0, 6.283); ctx.fill() } }
  } else if (e.kind === 'robot') {
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

type Icon = (ctx: Ctx, cx: number, cy: number, col: string) => void
const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }
const icons: Record<string, Icon> = {
  bolt: (c, x, y, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x + 2, y - 8); c.lineTo(x - 6, y + 2); c.lineTo(x - 1, y + 2); c.lineTo(x - 3, y + 8); c.lineTo(x + 6, y - 3); c.lineTo(x + 1, y - 3); c.closePath(); c.fill() },
  speaker: (c, x, y, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - 7, y - 3); c.lineTo(x - 3, y - 3); c.lineTo(x + 2, y - 7); c.lineTo(x + 2, y + 7); c.lineTo(x - 3, y + 3); c.lineTo(x - 7, y + 3); c.closePath(); c.fill(); c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round'
    if (!Audio_.muted) { c.beginPath(); c.arc(x + 2, y, 5, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(x + 2, y, 9, -0.8, 0.8); c.stroke() }
    else { c.beginPath(); c.moveTo(x + 5, y - 4); c.lineTo(x + 11, y + 4); c.moveTo(x + 11, y - 4); c.lineTo(x + 5, y + 4); c.stroke() } },
  merge: (c, x, y, col) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round'
    c.beginPath(); c.moveTo(x - 9, y - 6); c.lineTo(x - 2, y); c.lineTo(x - 9, y + 6); c.stroke(); c.beginPath(); c.moveTo(x + 9, y - 6); c.lineTo(x + 2, y); c.lineTo(x + 9, y + 6); c.stroke() },
  coin: (c, x, y, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 6, 0, 6.283); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - 1, y - 3, 2, 6) },
  nade: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y + 2, 8, 0, 6.283); c.fill(); c.stroke(); c.fillRect(x - 3, y - 8, 6, 4); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 3, y - 7); c.lineTo(x + 8, y - 9); c.stroke() },
  plus: (c, x, y, col) => { c.strokeStyle = col; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.stroke() },
}
interface BtnOpts { top: string; bot: string; label?: string; icon?: string; disabled?: boolean; size?: number; sub?: string }
/** Modern pill button: vertical gradient, soft drop shadow, top gloss, press-down state. Registers its hit rect. */
function button(ctx: Ctx, key: string, x: number, y: number, w: number, h: number, o: BtnOpts) {
  R.btns[key] = { x, y, w, h }
  const down = R.pressed === key, dy = down ? 1.5 : 0, rad = Math.min(14, h / 2.2)
  ctx.save()
  if (!down) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3 }
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, o.disabled ? '#5a666d' : o.top); g.addColorStop(1, o.disabled ? '#39434a' : o.bot)
  ctx.fillStyle = g; rr(ctx, x, y + dy, w, h, rad); ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, x + 2, y + dy + 2, w - 4, h * 0.46, rad - 2); ctx.fill()
  ctx.strokeStyle = o.disabled ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.38)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + dy + 0.5, w - 1, h - 1, rad); ctx.stroke()
  if (down) { ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(ctx, x, y + dy, w, h, rad); ctx.fill() }
  const col = o.disabled ? 'rgba(255,255,255,.55)' : '#fff', cy = y + dy + h / 2
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 ' + (o.size || 13) + 'px system-ui,-apple-system,sans-serif'
  const tw = o.label ? ctx.measureText(o.label).width : 0, iw = o.icon ? 20 : 0, gap = o.icon && o.label ? 6 : 0, total = tw + iw + gap
  let cx = x + w / 2 - total / 2
  if (o.icon) { icons[o.icon](ctx, cx + iw / 2, cy, col); cx += iw + gap }
  if (o.label) { ctx.fillStyle = col; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1; ctx.fillText(o.label, cx + tw / 2, cy + 0.5) }
  ctx.restore()
}
function glass(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.fillStyle = 'rgba(14,22,26,.62)'; rr(ctx, x, y, w, h, r); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke()
}
const fmt = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.floor(n).toString();

export function render(ctx: Ctx, t: number) {
  ctx.save();
  if (R.shake > 0.3) ctx.translate(rnd(-R.shake, R.shake), rnd(-R.shake, R.shake));
  const biome = drawBackground(ctx, t);
  for (const h of G.hazards) drawHazard(ctx, h, t);
  if (G.hold) drawHold(ctx, G.hold.x, G.hold.y, t);
  // sort-by-y entities
  const ents: { y: number; d: () => void }[] = [];
  for (const c of G.cover) ents.push({ y: c.y + c.h / 2, d: () => drawCover(ctx, c, t) });
  for (const e of G.enemies) ents.push({ y: e.y, d: () => drawEnemy(ctx, e, t) });
  const n = unlockedGuardians(G.stage), ws = sortedWeapons();
  for (let i = 0; i < n; i++) { const gp = guardianPos(i); const firing = ws[i] !== undefined && G.cd[i] > 1 / WEAPONS[ws[i]].rate - 0.08; const tgt = G.enemies[0]; ents.push({ y: gp.y, d: () => { if (G.hp[i] <= 0) ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 5); drawDog(ctx, GUARDIANS[i], gp.x, gp.y, t, firing, tgt); const wl = ws[i]; if (wl !== undefined && G.hp[i] > 0) drawHeld(ctx, wl, gp.x, gp.y, tgt, firing, t, GUARDIANS[i]); ctx.globalAlpha = 1 } }); }
  ents.sort((a, b) => a.y - b.y).forEach(o => o.d());
  for (const s of G.shots) drawShot(ctx, s);
  for (const g of G.nades) { // lobbed grenade: target ring + arcing ball
    const f = g.t / g.dur, x = g.x + (g.tx - g.x) * f, y = g.y + (g.ty - g.y) * f, hgt = Math.sin(f * Math.PI) * 60
    ctx.strokeStyle = 'rgba(255,150,60,' + (0.35 + 0.35 * Math.sin(t * 20)) + ')'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(g.tx, g.ty, g.r, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.5, 0, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#4b5a3a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y - hgt, 5.5, 0, 6.283); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 1.5, y - hgt - 8, 3, 3)
  }
  drawShells(ctx, G.shells, t); drawEBullets(ctx, G.ebullets);
  for (let i = 0; i < n; i++) { const gp = guardianPos(i); drawStatus(ctx, gp.x, gp.y, G.status[i]) }
  for (let i = 0; i < n; i++) { // floating health bar over each guardian
    const gp = guardianPos(i), f = Math.max(0, G.hp[i] / G.mhp[i]), w = 26
    ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, gp.x - w / 2, gp.y - 28, w, 5, 2.5); ctx.fill()
    if (f > 0) { ctx.fillStyle = f > 0.35 ? '#5be07f' : '#ff6a5a'; rr(ctx, gp.x - w / 2 + 0.5, gp.y - 27.5, Math.max(2, (w - 1) * f), 4, 2); ctx.fill() }
  }
  for (const p of R.parts) {
    if (p.ring) { ctx.strokeStyle = 'rgba(255,200,90,' + (1 - p.t / p.life) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.r! * (p.t / p.life), 0, 6.283); ctx.stroke(); }
    else { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col!; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz!, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
  }
  for (const f of R.floats) {
    ctx.globalAlpha = Math.min(1, (0.9 - f.t) * 3); ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = OUT;
    const sz = f.big ? 22 : f.blast ? 20 : f.kill ? 15 : f.crit ? 17 : f.cover ? 10 : f.flank ? 14 : 12;
    ctx.font = 'bold ' + sz + 'px system-ui,sans-serif';
    ctx.fillStyle = f.cover ? '#cfd8dc' : f.gold ? '#ffd84a' : f.hurt ? '#ff6a6a' : f.flank ? '#ffab40' : f.blast ? '#ff9a3a' : f.kill ? '#ff5a5a' : f.crit ? '#ffe45a' : '#fff';
    const txt = typeof f.v === 'number' ? (f.blast ? 'BLAST ' : '') + fmt(f.v) + (f.crit ? '!' : '') : f.v;
    ctx.strokeText(txt, f.x, f.y); ctx.fillText(txt, f.x, f.y); ctx.globalAlpha = 1;
  }
  // combo
  if (G.combo >= 3) { ctx.textAlign = 'center'; ctx.font = 'bold 18px system-ui'; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.fillStyle = '#ffb84a'; ctx.strokeText('COMBO x' + G.combo, W / 2, ARENA.y1 - 8); ctx.fillText('COMBO x' + G.combo, W / 2, ARENA.y1 - 8); }
  ctx.restore();

  // ---------- HUD ----------
  const hg = ctx.createLinearGradient(0, 0, 0, 66); hg.addColorStop(0, 'rgba(8,14,16,.92)'); hg.addColorStop(1, 'rgba(8,14,16,.55)')
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 66)
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'; ctx.font = '800 18px system-ui,-apple-system,sans-serif'; ctx.fillText('Stage ' + G.stage, 12, 18)
  ctx.font = '600 11px system-ui,sans-serif'; ctx.fillStyle = isBoss(G.stage) ? '#ff9ad8' : '#9fb5aa'; ctx.fillText(biome.n, 12, 37)
  // gold chip
  const gtxt = fmt(G.gold); ctx.font = '800 14px system-ui,sans-serif'; const gw = ctx.measureText(gtxt).width + 34
  glass(ctx, 10, 45, gw, 24, 10); icons.coin(ctx, 23, 45 + 24 / 2, '#ffd84a'); ctx.fillStyle = '#ffe9a0'; ctx.textAlign = 'left'; ctx.fillText(gtxt, 34, 45 + 24 / 2 + 0.5)
  // idle stash chip (tap to collect)
  { const cx0 = 10 + gw + 6, cw = 208 - cx0, cap = idleCap(G.stage), f = Math.min(1, G.stash / cap), full = f >= 0.999, ready = f >= 0.15
    R.btns.collect = { x: cx0, y: 45, w: cw, h: 24 }
    const pulse = ready ? 0.5 + 0.5 * Math.sin(t * 5) : 0
    glass(ctx, cx0, 45, cw, 24, 10)
    ctx.save(); rr(ctx, cx0, 45, cw, 24, 10); ctx.clip(); ctx.fillStyle = full ? 'rgba(255,170,60,.55)' : 'rgba(255,216,74,.32)'; ctx.fillRect(cx0, 45, cw * f, 24); ctx.restore()
    ctx.strokeStyle = ready ? 'rgba(255,216,74,' + (0.45 + 0.5 * pulse) + ')' : 'rgba(255,255,255,.12)'; ctx.lineWidth = ready ? 1.6 : 1; rr(ctx, cx0 + 0.5, 45.5, cw - 1, 23, 10); ctx.stroke()
    icons.coin(ctx, cx0 + 13, 57, '#ffd84a'); ctx.textAlign = 'left'; ctx.font = '800 11px system-ui,sans-serif'; ctx.fillStyle = full ? '#ffcf8a' : '#fff2c2'
    ctx.fillText(full ? 'FULL ' + fmt(G.stash) : fmt(G.stash), cx0 + 24, 57.5) }
  // per-guardian health (initial + bar each; downed dogs show a revive countdown)
  const hx = 118, hw = 92
  { const nn = unlockedGuardians(G.stage), gap = 4, bw = (hw - gap * (nn - 1)) / nn
    for (let i = 0; i < nn; i++) {
      const bx = hx + i * (bw + gap), f = Math.max(0, G.hp[i] / G.mhp[i]), down = G.hp[i] <= 0, low = f <= 0.35
      ctx.textAlign = 'left'; ctx.fillStyle = down ? '#ff8a7a' : '#9fb5aa'; ctx.font = '700 9px system-ui,sans-serif'; ctx.fillText(down ? 'zZ ' + Math.ceil(G.reviveT[i]) : GUARDIANS[i].n.toUpperCase().slice(0, Math.max(3, Math.floor(bw / 6))), bx, 9)
      ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, bx, 14, bw, 12, 5); ctx.fill()
      if (f > 0) { const gr = ctx.createLinearGradient(0, 14, 0, 26); gr.addColorStop(0, low ? '#ff8a7a' : '#7af09a'); gr.addColorStop(1, low ? '#d63a3a' : '#2fb85a'); ctx.fillStyle = gr; rr(ctx, bx + 1, 15, Math.max(4, (bw - 2) * f), 10, 4); ctx.fill() }
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; rr(ctx, bx + 0.5, 14.5, bw - 1, 11, 5); ctx.stroke()
    } }
  ctx.textAlign = 'right'; ctx.fillStyle = isBoss(G.stage) ? '#ff9ad8' : '#c9d8d0'; ctx.font = '700 11px system-ui,sans-serif'; ctx.fillText((isBoss(G.stage) ? 'BOSS · ' : '') + (G.toSpawn - G.spawned + G.enemies.length) + ' left', hx + hw, 37); ctx.textAlign = 'left'
  button(ctx, 'help', 216, 8, 40, 34, { top: '#5b6c75', bot: '#3a4850', label: '?', size: 17 })
  button(ctx, 'speed', 262, 8, 44, 34, { top: G.speed > 1 ? '#ffb347' : '#5b6c75', bot: G.speed > 1 ? '#e0731a' : '#3a4850', icon: 'bolt' })
  button(ctx, 'mute', 310, 8, 42, 34, { top: '#5b6c75', bot: '#3a4850', icon: 'speaker' })
  ctx.textAlign = 'center'; ctx.font = '700 10px system-ui,sans-serif'; ctx.fillStyle = G.speed > 1 ? '#ffcf8a' : '#7f929a'; ctx.fillText(G.speed > 1 ? '2× ON' : 'SPEED 1×', 284, 54)
  ctx.fillStyle = '#7f929a'; ctx.fillText(Audio_.muted ? 'MUTED' : 'SOUND', 331, 54)

  // drag anchor: faint ring where the touch began, dot + tether at the finger
  if (R.dragAnchor) { const a = R.dragAnchor; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(a.sx, a.sy, 22, 0, 6.283); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(a.cx, a.cy); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(a.cx, a.cy, 9, 0, 6.283); ctx.fill(); ctx.restore() }

  // ---------- armory ----------
  const ag = ctx.createLinearGradient(0, BENCH.y - 24, 0, H); ag.addColorStop(0, 'rgba(10,16,19,.86)'); ag.addColorStop(1, 'rgba(10,16,19,.97)')
  ctx.fillStyle = ag; ctx.fillRect(0, BENCH.y - 24, W, H - BENCH.y + 24)
  ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(0, BENCH.y - 24, W, 1)
  ctx.textAlign = 'left'; ctx.fillStyle = '#8fa69b'; ctx.font = '700 10px system-ui,sans-serif'; ctx.fillText('ARMORY  ·  drag matching weapons together to merge', 10, BENCH.y - 11)
  const order = G.bench.map((v, i) => ({ v, i })).filter(o => o.v !== null).sort((a, b) => (b.v as number) - (a.v as number)), armed = new Map<number, number>()
  order.slice(0, n).forEach((o, k) => armed.set(o.i, k))
  for (let i = 0; i < 8; i++) {
    const rc = benchRect(i), v = G.bench[i], dragging = R.drag && R.drag.from === i
    const over = R.drag && R.dragOver === i && R.drag.from !== i
    ctx.fillStyle = over ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)'; rr(ctx, rc.x, rc.y, rc.w, rc.h, 11); ctx.fill()
    ctx.strokeStyle = over ? 'rgba(255,230,140,.8)' : 'rgba(255,255,255,.09)'; ctx.lineWidth = over ? 2 : 1; rr(ctx, rc.x + 0.5, rc.y + 0.5, rc.w - 1, rc.h - 1, 11); ctx.stroke()
    if (v !== null && !dragging) drawCard(ctx, rc.x, rc.y, rc.w, rc.h, v, R.popSlot && R.popSlot.slot === i ? 1 + 0.3 * Math.sin(R.popSlot.t / 0.25 * 3.14) : 1, armed.get(i))
  }
  if (R.drag) { const d = R.drag; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; drawCard(ctx, d.x - BENCH.w / 2, d.y - BENCH.h / 2 - 10, BENCH.w, BENCH.h, G.bench[d.from] ?? 0, 1.12, undefined); ctx.restore() }
  // action bar
  const cost = buyCost(), can = G.gold >= cost && G.bench.includes(null)
  button(ctx, 'buy', 10, ACTION_BAR.y, 142, ACTION_BAR.h, { top: '#52d273', bot: '#25994a', disabled: !can, icon: 'plus', label: 'BUY  ' + fmt(cost), size: 13 })
  button(ctx, 'merge', 158, ACTION_BAR.y, 96, ACTION_BAR.h, { top: '#5aa8ff', bot: '#2b6fd0', icon: 'merge', label: 'MERGE', size: 13 })
  button(ctx, 'hold', 260, ACTION_BAR.y, 90, ACTION_BAR.h, { top: G.hold ? '#ffb347' : '#b58cf0', bot: G.hold ? '#e0731a' : '#7a4ec0', disabled: unlockedGuardians(G.stage) <= 2, label: G.hold ? 'RECALL' : 'HOLD', size: 13 })
  { // grenade ability button (bottom-right of the arena) with cooldown sweep
    const nx = 306, ny = ARENA.y1 - 46, ns = 42, ready = G.nadeCd <= 0
    button(ctx, 'nade', nx, ny, ns, ns, { top: ready ? '#ff9a3a' : '#5a666d', bot: ready ? '#d4501a' : '#39434a', icon: 'nade', disabled: !ready })
    if (!ready) { ctx.fillStyle = 'rgba(0,0,0,.55)'; const hh = ns * (G.nadeCd / NADE.cd); rr(ctx, nx, ny, ns, ns, 14); ctx.save(); ctx.clip(); ctx.fillRect(nx, ny, ns, hh); ctx.restore()
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 13px system-ui,sans-serif'; ctx.fillText(Math.ceil(G.nadeCd) + '', nx + ns / 2, ny + ns / 2 + 1) }
  }
  if (R.hint > 0 && G.stage <= 2) { const t1 = 'Drag the arena to move the pack'; ctx.font = '700 12px system-ui,sans-serif'; const tw = ctx.measureText(t1).width + 24; glass(ctx, W / 2 - tw / 2, ARENA.y1 - 38, tw, 24, 12); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t1, W / 2, ARENA.y1 - 25) }

  // banner
  if (G.banner) {
    const b = G.banner, a = Math.min(1, b.t * 2.5); ctx.globalAlpha = a; ctx.textAlign = 'center'
    ctx.font = '800 ' + (b.big ? 28 : 22) + 'px system-ui,-apple-system,sans-serif'
    ctx.font = '600 13px system-ui,sans-serif'; const subW = b.sub ? ctx.measureText(b.sub).width : 0; ctx.font = '800 ' + (b.big ? 28 : 22) + 'px system-ui,-apple-system,sans-serif'; const bw = Math.min(W - 16, Math.max(ctx.measureText(b.text).width, subW) + 44), bh = b.sub ? 74 : 46, by = 160
    ctx.fillStyle = 'rgba(10,16,19,.72)'; rr(ctx, W / 2 - bw / 2, by, bw, bh, 18); ctx.fill()
    ctx.strokeStyle = b.big ? 'rgba(255,216,74,.7)' : 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; rr(ctx, W / 2 - bw / 2 + 0.75, by + 0.75, bw - 1.5, bh - 1.5, 18); ctx.stroke()
    ctx.fillStyle = b.big ? '#ffd84a' : '#fff'; ctx.fillText(b.text, W / 2, by + 24)
    if (b.sub) { ctx.font = '600 13px system-ui,sans-serif'; ctx.fillStyle = '#e8f1ec'; ctx.fillText(b.sub, W / 2, by + 52) }
    ctx.globalAlpha = 1
  }
  if (R.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, R.flash) + ')'; ctx.fillRect(0, 0, W, H); }
}

function drawCard(ctx: Ctx, x: number, y: number, w: number, h: number, lvl: number, sc: number, armedBy: number | undefined) {
  const wd = WEAPONS[lvl]; ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-w / 2, -h / 2)
  const eraCols: [string, string][] = [['#8a7a62', '#5a4d3a'], ['#5f9a67', '#37613f'], ['#5b87b8', '#33557d'], ['#9a6fb8', '#613d7d'], ['#c76a6a', '#7d3636'], ['#e0b24a', '#9a6a18']]
  const [c1, c2] = eraCols[wd.era], g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2)
  ctx.fillStyle = g; rr(ctx, 0, 0, w, h, 11); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.13)'; rr(ctx, 2, 2, w - 4, h * 0.42, 9); ctx.fill()
  ctx.strokeStyle = armedBy !== undefined ? 'rgba(255,226,120,.95)' : 'rgba(255,255,255,.28)'; ctx.lineWidth = armedBy !== undefined ? 2 : 1; rr(ctx, 0.5, 0.5, w - 1, h - 1, 11); ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(w / 2, 20, 22, 3, 0, 0, 6.283); ctx.fill()
  drawWeaponIcon(ctx, lvl, w / 2, 13.5, 0.82)
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 9.5px system-ui,sans-serif'
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1
  ctx.fillText(wd.n.length > 15 ? 'Mk 19 Launcher' : wd.n, w / 2, 29); ctx.fillStyle = '#fff2c2'; ctx.font = '800 10px system-ui,sans-serif'; ctx.fillText('Lv ' + (lvl + 1), w / 2, 41)
  ctx.shadowColor = 'transparent'
  if (armedBy !== undefined) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(11, 11, 8, 0, 6.283); ctx.fill(); ctx.fillStyle = '#3a2a08'; ctx.font = '800 10px system-ui,sans-serif'; ctx.fillText(GUARDIANS[armedBy].n[0], 11, 11.5) }
  ctx.restore()
}

/** Pause-style legend. Any tap closes it. */
export function drawHelp(ctx: Ctx) {
  ctx.fillStyle = 'rgba(6,10,12,.94)'; ctx.fillRect(0, 0, W, H)
  const rules = rulesFor(G.stage), bi = BIOMES[biomeIndex(G.stage)]
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = '800 20px system-ui,sans-serif'; ctx.fillText('How to win', 18, 30)
  ctx.fillStyle = '#ffd84a'; ctx.font = '700 12px system-ui,sans-serif'; ctx.fillText(bi.n, 18, 49); ctx.fillStyle = '#9fb5aa'; ctx.font = '600 12px system-ui,sans-serif'; ctx.fillText(rules.tip, 18, 66)
  const rows: [string, string, string][] = [
    ['shield', 'In cover', 'Bullets hit your cover first. It cracks, and under 35% HP it leaks half the damage.'],
    ['arrows', 'Flanking', 'A clear line round an enemy barricade: x1.35 when a guardian shuffles, x1.55 when you placed them.'],
    ['ring', 'Mortar ring', 'Shells arc OVER cover. Move or spread out before the ring fills.'],
    ['zombie', 'Zombies', 'Melee ignores cover. Kill them before they reach you.'],
    ['boom', 'Explosives', 'Mk 19 grenades arc over barricades and hit gunners behind them.'],
    ['coin', 'Idle stash', 'Your pack keeps earning gold while you are away (up to ' + IDLE.capHours + 'h). Tap the stash chip under the gold counter to collect it.'],
    ['boom', 'Grenade button', 'Bottom-right of the arena: lobs a grenade at the biggest clump of enemies. Arcs over cover. 12s cooldown.'],
    ['hold', 'HOLD', 'Plants Bruno, Luna and pups. Your drag then steers only Rudy & Cooper: send them round the barricades. RECALL regroups.'],
  ]
  let y = 92
  for (const [icon, title, body] of rows) {
    ctx.save(); ctx.translate(34, y + 12)
    if (icon === 'shield') { ctx.fillStyle = '#4aa8ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, -9); ctx.lineTo(9, 2); ctx.quadraticCurveTo(9, 9, 0, 12); ctx.quadraticCurveTo(-9, 9, -9, 2); ctx.closePath(); ctx.fill(); ctx.stroke() }
    else if (icon === 'arrows') { ctx.fillStyle = '#ffa23a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; for (const dx of [-7, 3]) { ctx.beginPath(); ctx.moveTo(dx - 3, -9); ctx.lineTo(dx + 6, 0); ctx.lineTo(dx - 3, 9); ctx.lineTo(dx, 0); ctx.closePath(); ctx.fill(); ctx.stroke() } }
    else if (icon === 'ring') { ctx.strokeStyle = '#ff5a46'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,110,90,.5)'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, 6.283); ctx.fill() }
    else if (icon === 'zombie') { ctx.fillStyle = '#8ccf6e'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3.5, -2, 3, 0, 6.283); ctx.arc(4, -2, 2.4, 0, 6.283); ctx.fill() }
    else if (icon === 'boom') { ctx.fillStyle = '#ff9a3a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, r = i % 2 ? 6 : 12; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) } ctx.closePath(); ctx.fill(); ctx.stroke() }
    else if (icon === 'coin') { ctx.scale(1.8, 1.8); icons.coin(ctx, 0, 0, '#ffd84a') }
    else { ctx.strokeStyle = '#ffc34a'; ctx.lineWidth = 2.2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.ellipse(0, 6, 13, 6, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = '#d8d0c0'; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -10); ctx.stroke(); ctx.fillStyle = '#ffc34a'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(10, -6); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill() }
    ctx.restore()
    ctx.fillStyle = '#fff'; ctx.font = '800 14px system-ui,sans-serif'; ctx.fillText(title, 62, y + 5)
    ctx.fillStyle = '#c9d8d0'; ctx.font = '500 12px system-ui,sans-serif'
    const words = body.split(' '); let line = '', ly = y + 22
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > W - 80 && line) { ctx.fillText(line, 62, ly); line = w; ly += 15 } else line = test }
    ctx.fillText(line, 62, ly); y = ly + 26
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#7f929a'; ctx.font = '600 12px system-ui,sans-serif'; ctx.fillText('Tap anywhere to resume', W / 2, H - 22)
}

/** "Welcome back" modal shown after time away; only the COLLECT button is live. */
export function drawWelcome(ctx: Ctx, t: number) {
  const a = G.away; if (!a) return
  R.btns = {}
  ctx.fillStyle = 'rgba(4,8,10,.82)'; ctx.fillRect(0, 0, W, H)
  const cw = 296, ch = 270, cx = (W - cw) / 2, cy = 150
  const g = ctx.createLinearGradient(0, cy, 0, cy + ch); g.addColorStop(0, '#2a3a42'); g.addColorStop(1, '#16222a')
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24; ctx.fillStyle = g; rr(ctx, cx, cy, cw, ch, 22); ctx.fill(); ctx.restore()
  ctx.strokeStyle = 'rgba(255,216,74,.55)'; ctx.lineWidth = 1.5; rr(ctx, cx + 0.75, cy + 0.75, cw - 1.5, ch - 1.5, 22); ctx.stroke()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'; ctx.font = '800 24px system-ui,sans-serif'; ctx.fillText('Welcome back!', W / 2, cy + 34)
  const h = Math.floor(a.minutes / 60), m = Math.floor(a.minutes % 60)
  ctx.fillStyle = '#9fb5aa'; ctx.font = '600 13px system-ui,sans-serif'; ctx.fillText('Your pack guarded the base for ' + (h ? h + 'h ' : '') + m + 'm', W / 2, cy + 62)
  const bob = Math.sin(t * 4) * 2
  ctx.save(); ctx.translate(W / 2 - 62, cy + 112 + bob); ctx.scale(3.2, 3.2); icons.coin(ctx, 0, 0, '#ffd84a'); ctx.restore()
  ctx.fillStyle = '#ffd84a'; ctx.font = '800 38px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText('+' + fmt(a.gold), W / 2 - 46, cy + 112 + bob)
  ctx.textAlign = 'center'; ctx.font = '600 12px system-ui,sans-serif'
  if (a.capped) { ctx.fillStyle = '#ffb27a'; ctx.fillText('Stash was full after ' + IDLE.capHours + 'h. Come back sooner to earn more!', W / 2, cy + 160) }
  else { ctx.fillStyle = '#7f929a'; ctx.fillText('Stash fills for up to ' + IDLE.capHours + 'h while you are away.', W / 2, cy + 160) }
  button(ctx, 'welcome', cx + 40, cy + 190, cw - 80, 54, { top: '#52d273', bot: '#25994a', label: 'COLLECT', icon: 'coin', size: 18 })
}
