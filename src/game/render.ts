import { W, H, ARENA, WEAPONS, GUARDIANS, ERAS, BIOMES, BENCH, ACTION_BAR, unlockedGuardians } from './data'
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
export const R = { parts: [] as Part[], floats: [] as Floater[], shake: 0, flash: 0, drag: null as { from: number; x: number; y: number } | null, btns: {} as Record<string, Rect>, hint: 1, dragOver: -1, dragTarget: false, pressed: null as string | null, popSlot: null as { slot: number; t: number } | null };

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
  const hg = ctx.createLinearGradient(0, 0, 0, 66); hg.addColorStop(0, 'rgba(8,14,16,.92)'); hg.addColorStop(1, 'rgba(8,14,16,.55)')
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 66)
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'; ctx.font = '800 18px system-ui,-apple-system,sans-serif'; ctx.fillText('Stage ' + G.stage, 12, 18)
  ctx.font = '600 11px system-ui,sans-serif'; ctx.fillStyle = isBoss(G.stage) ? '#ff9ad8' : '#9fb5aa'; ctx.fillText(biome.n + (isBoss(G.stage) ? ' · BOSS' : ''), 12, 37)
  // gold chip
  const gtxt = fmt(G.gold); ctx.font = '800 14px system-ui,sans-serif'; const gw = ctx.measureText(gtxt).width + 34
  glass(ctx, 10, 45, gw, 24, 10); icons.coin(ctx, 23, 45 + 24 / 2, '#ffd84a'); ctx.fillStyle = '#ffe9a0'; ctx.textAlign = 'left'; ctx.fillText(gtxt, 34, 45 + 24 / 2 + 0.5)
  // pack HP
  const hx = 118, hw = 128, hy = 14, hh = 12
  ctx.textAlign = 'left'; ctx.fillStyle = '#9fb5aa'; ctx.font = '700 10px system-ui,sans-serif'; ctx.fillText('PACK', hx, 8)
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, hx, hy, hw, hh, 6); ctx.fill()
  const frac = Math.max(0, G.pack.hp / G.pack.max)
  if (frac > 0) { const hgR = ctx.createLinearGradient(0, hy, 0, hy + hh); hgR.addColorStop(0, frac > 0.35 ? '#7af09a' : '#ff8a7a'); hgR.addColorStop(1, frac > 0.35 ? '#2fb85a' : '#d63a3a'); ctx.fillStyle = hgR; rr(ctx, hx + 1, hy + 1, Math.max(8, (hw - 2) * frac), hh - 2, 5); ctx.fill() }
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; rr(ctx, hx + 0.5, hy + 0.5, hw - 1, hh - 1, 6); ctx.stroke()
  ctx.fillStyle = '#c9d8d0'; ctx.font = '600 11px system-ui,sans-serif'; ctx.fillText('Enemies left  ' + (G.toSpawn - G.spawned + G.enemies.length), hx, 44)
  button(ctx, 'speed', 262, 8, 44, 34, { top: G.speed > 1 ? '#ffb347' : '#5b6c75', bot: G.speed > 1 ? '#e0731a' : '#3a4850', icon: 'bolt' })
  button(ctx, 'mute', 310, 8, 42, 34, { top: '#5b6c75', bot: '#3a4850', icon: 'speaker' })
  ctx.textAlign = 'center'; ctx.font = '700 10px system-ui,sans-serif'; ctx.fillStyle = G.speed > 1 ? '#ffcf8a' : '#7f929a'; ctx.fillText(G.speed > 1 ? '2× ON' : 'SPEED 1×', 284, 54)
  ctx.fillStyle = '#7f929a'; ctx.fillText(Audio_.muted ? 'MUTED' : 'SOUND', 331, 54)

  // drag target marker
  if (R.dragTarget) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(G.pack.tx, G.pack.ty + 20, 14, 0, 6.283); ctx.stroke(); ctx.setLineDash([]) }

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
  button(ctx, 'buy', 10, ACTION_BAR.y, 196, ACTION_BAR.h, { top: '#52d273', bot: '#25994a', disabled: !can, icon: 'plus', label: 'BUY  ' + fmt(cost), size: 14 })
  button(ctx, 'merge', 214, ACTION_BAR.y, 136, ACTION_BAR.h, { top: '#5aa8ff', bot: '#2b6fd0', icon: 'merge', label: 'MERGE', size: 14 })
  if (R.hint > 0 && G.stage <= 2) { const t1 = 'Drag the arena to move the pack'; ctx.font = '700 12px system-ui,sans-serif'; const tw = ctx.measureText(t1).width + 24; glass(ctx, W / 2 - tw / 2, ARENA.y1 - 38, tw, 24, 12); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t1, W / 2, ARENA.y1 - 25) }

  // banner
  if (G.banner) {
    const b = G.banner, a = Math.min(1, b.t * 2.5); ctx.globalAlpha = a; ctx.textAlign = 'center'
    ctx.font = '800 ' + (b.big ? 28 : 22) + 'px system-ui,-apple-system,sans-serif'
    const bw = Math.max(ctx.measureText(b.text).width, b.sub ? 180 : 0) + 44, bh = b.sub ? 74 : 46, by = 160
    ctx.fillStyle = 'rgba(10,16,19,.72)'; rr(ctx, W / 2 - bw / 2, by, bw, bh, 18); ctx.fill()
    ctx.strokeStyle = b.big ? 'rgba(255,216,74,.7)' : 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; rr(ctx, W / 2 - bw / 2 + 0.75, by + 0.75, bw - 1.5, bh - 1.5, 18); ctx.stroke()
    ctx.fillStyle = b.big ? '#ffd84a' : '#fff'; ctx.fillText(b.text, W / 2, by + 24)
    if (b.sub) { ctx.font = '600 15px system-ui,sans-serif'; ctx.fillStyle = '#e8f1ec'; ctx.fillText(b.sub, W / 2, by + 52) }
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
  // weapon glyph
  ctx.fillStyle = wd.col; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2; rr(ctx, w / 2 - 17, 7, 34, 12, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(w / 2 - 15, 11, 9, 3.5)
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 9.5px system-ui,sans-serif'
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1
  ctx.fillText(wd.n.length > 15 ? 'Mk 19 Launcher' : wd.n, w / 2, 29); ctx.fillStyle = '#fff2c2'; ctx.font = '800 10px system-ui,sans-serif'; ctx.fillText('Lv ' + (lvl + 1), w / 2, 41)
  ctx.shadowColor = 'transparent'
  if (armedBy !== undefined) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(11, 11, 8, 0, 6.283); ctx.fill(); ctx.fillStyle = '#3a2a08'; ctx.font = '800 10px system-ui,sans-serif'; ctx.fillText(GUARDIANS[armedBy].n[0], 11, 11.5) }
  ctx.restore()
}
