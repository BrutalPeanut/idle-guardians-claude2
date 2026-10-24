import { DRAW, drawAll, ON, fire } from './ext'
import { nextGoal } from './meta'
import { coachTips, nextTip, coachCool } from './coach'
import { notes, noteBox, noteHoldS } from './notes'
import { W, H, ARENA, WEAPONS, GUARDIANS, ERAS, BIOMES, BENCH, ACTION_BAR, unlockedGuardians } from './data'
import type { Guardian } from './data'
import { PERKS } from './clan'
import { track, trackError } from './telemetry'
import { IAP } from './iap'
import { collarOf } from './cosmetics'
import { WALL_WIPES, REINFORCE_GEMS, canMergeNow, baseSpeed, G, RAID, raidBase, rnd, buyCost, isBoss, guardianPos, sortedWeapons, idleCap, IDLE, questReady, REROLL_COST, REBIRTH_MIN, STAR_BONUS, STAR_CAP, starBonus, rebirthGain, nadeCdMax, shieldDur, frenzyDur, bl, MODES, unlocked, dogId } from './sim'
import { rulesFor, biomeIndex } from './cover'
import { drawCover, drawHazard, drawEBullets, drawShells, drawMissiles, drawStatus, drawHold, coverDust } from './coverRender'
import type { Enemy, Shot } from './sim'
import { Audio_ } from './audio'
import { BLESSINGS } from './blessings'
import { CHEST_NAMES } from './gear'
import { QUEST_POOL, questDef } from './quests'
import { weekMod } from './weekly'
import { canClaimLogin, pointsLeft } from './sim'
import { adState, adsLeft, adCooldown, ADS } from './ads'
import { drawWeaponIcon } from './weaponIcons'

interface Part { x: number; y: number; vx?: number; vy?: number; col?: string; t: number; life: number; sz?: number; ring?: boolean; r?: number }
interface Floater { x: number; y: number; v: number | string; cover?: boolean; flank?: boolean; crit?: boolean; kill?: boolean; blast?: boolean; gold?: boolean; hurt?: boolean; big?: boolean; t: number }
interface Blast { x: number; y: number; r: number; t: number; life: number; col?: string; seed: number }
interface Rect { x: number; y: number; w: number; h: number }
export type Ctx = CanvasRenderingContext2D
// Renderer: reads G, drains G.events into particles / floating numbers. Never invents damage.
export const OUT = '#241810';
let bannerRef: unknown = null, bannerAt = 0, pstage = 0, pmax = 1
export const FONT = '"Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
export const R = { freshAsk: false, freshChecked: false, freshStage: 1, chestMoment: null as null | { tier: number }, gearIntro: false, lastChests: -1, coach: null as null | { id: string; text: string; target?: string; start: number }, coachBox: null as Rect | null, coachX: null as Rect | null, rbAnnounced: -1, nudge: { on: false, t0: 0, lastSim: -999 }, blasts: [] as Blast[], scorch: [] as { x: number; y: number; r: number; t: number }[], parts: [] as Part[], floats: [] as Floater[], shake: 0, flash: 0, drag: null as { from: number; x: number; y: number } | null, btns: {} as Record<string, Rect>, hint: 1, spinAnim: null as null | { t: number; from: number; to: number; idx: number; done: boolean; last?: number }, passPage: 0, achPage: 0, coinsFly: [] as { x: number; y: number; sx: number; sy: number; t: number; dur: number }[], goldBump: 0, errLogged: false, help: false, skillTab: 0, tour: null as number | null, tourAsk: false, screen: null as string | null, hubTab: null as number | null, shopTab: 0, gearDog: 0, summary: null as null | { ids: number[]; sold: number; chests: number }, kSlot: 0, clanTab: 0, leaveArm: false, sel: -1, reveal: null as null | { id: number; tier: number; sold: number; phase: number; t: number }, rebirth: false, quests: false, coverT: {} as Record<number, number>, dragOver: -1, dragAnchor: null as { sx: number; sy: number; cx: number; cy: number } | null, pressed: null as string | null, popSlot: null as { slot: number; t: number } | null };

export function benchRect(i: number): Rect {
  const c = i % BENCH.cols, r = Math.floor(i / BENCH.cols);
  return { x: BENCH.x + c * (BENCH.w + BENCH.gap), y: BENCH.y + r * (BENCH.h + BENCH.gap), w: BENCH.w, h: BENCH.h };
}

export function drainEvents() {
  for (const e of G.events) {
    if (e.type === 'fire') Audio_.fire(e.kind, e.w);
    else if (e.type === 'hit') { Audio_.hit(); burst(e.x, e.y, e.col, 3, 60); }
    else if (e.type === 'dmg') {
      R.floats.push({ x: e.x + rnd(-8, 8), y: e.y, v: e.v, crit: e.crit, kill: e.kill, blast: e.blast, flank: e.flank, t: 0 });
      if (e.crit) R.shake = Math.max(R.shake, 3);
      if (e.blast) R.shake = Math.max(R.shake, 6);
    } else if (e.type === 'kill') {
      Audio_.kill(); burst(e.x, e.y, e.kind === 'robot' ? '#9fb2c4' : '#7fc06a', 10, 110);
      R.floats.push({ x: e.x, y: e.y - 22, v: '+' + e.gold, gold: true, t: 0 });
      if (e.gold > 0) for (let k = 0, n = e.kind === 'boss' ? 9 : 2; k < n && R.coinsFly.length < 60; k++) R.coinsFly.push({ x: e.x + rnd(-8, 8), y: e.y + rnd(-8, 8), sx: e.x, sy: e.y, t: -k * 0.04, dur: rnd(0.55, 0.8) });
      if (e.kind === 'boss') { R.flash = 0.6; R.shake = 10; }
    } else if (e.type === 'boom') { Audio_.boom(); burst(e.x, e.y, e.col ?? '#ff9a3a', 22, 180); R.parts.push({ ring: true, x: e.x, y: e.y, r: e.r, t: 0, life: 0.3 }); R.blasts.push({ x: e.x, y: e.y, r: Math.max(34, e.r), t: 0, life: 0.75, col: e.col, seed: Math.random() * 100 }); R.scorch.push({ x: e.x, y: e.y, r: e.r, t: 0 }); if (R.scorch.length > 14) R.scorch.shift(); R.shake = Math.max(R.shake, Math.min(9, e.r / 9)); R.flash = Math.max(R.flash, 0.12); }
    else if (e.type === 'pack_hit') R.floats.push({ x: e.x, y: e.y, v: '-' + e.v, hurt: true, t: 0 });
    else if (e.type === 'cover_hit') { Audio_.hit(); burst(e.x, e.y, coverDust(e.kind), 4, 70); if (!(G.t - (R.coverT[e.id] ?? -9) < 0.35)) { R.coverT[e.id] = G.t; R.floats.push({ x: e.x, y: e.y - 6, v: Math.ceil(e.v), cover: true, t: 0 }) } }
    else if (e.type === 'boss_cast') { R.shake = Math.max(R.shake, 4); R.floats.push({ x: e.x, y: e.y - 44, v: e.name, hurt: true, t: 0 }); burst(e.x, e.y - 10, e.col, 12, 120) }
    else if (e.type === 'cover_break') { Audio_.boom(); burst(e.x, e.y, coverDust(e.kind), 28, 150); R.shake = Math.max(R.shake, 5); R.floats.push({ x: e.x, y: e.y - 24, v: 'COVER DOWN', hurt: e.w > 0, t: 0 }) }
    else if (e.type === 'crate') {
      if (e.drop) { Audio_.merge(2); burst(e.x, e.y, '#ffd84a', 14, 120); R.parts.push({ ring: true, x: e.x, y: e.y, r: 34, t: 0, life: 0.4 }) }
      else { Audio_.coins(); burst(e.x, e.y, '#ffd84a', 22, 170); R.floats.push({ x: e.x, y: e.y - 24, v: e.label, gold: true, big: true, t: 0 }); for (let k = 0; k < 7; k++) R.coinsFly.push({ x: e.x + rnd(-10, 10), y: e.y + rnd(-10, 10), sx: e.x, sy: e.y, t: -k * 0.05, dur: rnd(0.55, 0.8) }) }
    }
    else if (e.type === 'clan_level') { Audio_.fanfare(); G.banner = { text: 'CLAN LEVEL ' + e.lv, sub: PERKS[e.lv - 1].text, t: 2, big: true } }
    else if (e.type === 'raid_end') { Audio_.fanfare(); R.screen = 'raid' }
    else if (e.type === 'efire') Audio_.zap()
    else if (e.type === 'mortar_fire') Audio_.whump()
    else if (e.type === 'down') { Audio_.ui(); R.floats.push({ x: e.x, y: e.y - 30, v: GUARDIANS[e.i].n + ' down!', hurt: true, big: true, t: 0 }) }
    else if (e.type === 'revive') { Audio_.merge(0); burst(e.x, e.y, '#7af09a', 14, 90); R.floats.push({ x: e.x, y: e.y - 30, v: GUARDIANS[e.i].n + ' is back', gold: true, t: 0 }) }
    else if (e.type === 'ability') {
      if (e.kind === 'shield') { Audio_.merge(3); }
      else if (e.kind === 'tank') { Audio_.merge(2); burst(e.x, e.y, '#9fd6a0', 16, 110); }
      else if (e.kind === 'panic') { Audio_.zap(); burst(e.x, e.y, '#ff6a5a', 16, 110); }
      else { Audio_.zap(); }
      R.flash = 0.15
    }
    else if (e.type === 'blessing') { Audio_.fanfare(); const b = BLESSINGS.find(x => x.id === e.id)!; G.banner = { text: b.name.toUpperCase() + ' x' + bl(e.id), sub: b.desc, t: 1.8, big: true }; R.flash = 0.25 }
    else if (e.type === 'rebirth') { track('rebirth', { n: e.gain }); Audio_.fanfare(); G.banner = { text: 'REBORN', sub: G.rebirths <= 2 ? '+' + e.gain + ' Stardust: permanent damage & gold up, replayed stages run 2x' : '+' + e.gain + ' Stardust', t: G.rebirths <= 2 ? 4.2 : 2.4, big: true }; R.flash = 0.8 }
    else if (e.type === 'quest_claim') { Audio_.coins(); G.banner = { text: 'QUEST DONE', sub: '+' + e.gems + ' gems  +' + fmt(e.gold) + ' gold', t: 1.6 } }
    else if (e.type === 'chest_get') { Audio_.fanfare(); G.banner = { text: 'CHEST EARNED', sub: CHEST_NAMES[e.tier] + (e.n > 1 ? ' x' + e.n : '') + ' (tap GEAR)', t: 2.2, big: true } }
    else if (e.type === 'login_claim') { Audio_.coins(); G.banner = { text: 'DAY ' + (e.day + 1) + ' REWARD', sub: e.label, t: 1.8 } }
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
  if (ON.gevent.length) for (const e of G.events) fire(ON.gevent, e as unknown as { type: string } & Record<string, unknown>)
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
  R.parts = R.parts.filter(p => p.t < p.life)
  for (const b of R.blasts) b.t += dt
  R.blasts = R.blasts.filter(b => b.t < b.life); for (const c of R.scorch) c.t += dt; R.scorch = R.scorch.filter(c => c.t < 6)
  for (const c of R.coinsFly) { c.t += dt; if (c.t >= c.dur) R.goldBump = 0.18 }
  R.coinsFly = R.coinsFly.filter(c => c.t < c.dur); R.goldBump = Math.max(0, R.goldBump - dt)
  for (const f of R.floats) { f.t += dt; f.y -= 28 * dt; }
  R.floats = R.floats.filter(f => f.t < 0.9);
  R.shake *= 0.86; R.flash = Math.max(0, R.flash - dt * 1.5);
  if (R.popSlot && (R.popSlot.t += dt) > 0.25) R.popSlot = null;
}

// ---------- drawing helpers (shared chibi recipe: big head, bold outline, 2-tone cel shade) ----------
const mix2 = (a: string, b: string, k: number) => { const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); return '#' + [0, 1, 2].map(i => Math.round(p(a, i) * (1 - k) + p(b, i) * k).toString(16).padStart(2, '0')).join('') }
const shadeHex = (c: string, k: number) => c[0] === '#' && c.length === 7 ? (k >= 0 ? mix2(c, '#ffffff', k) : mix2(c, '#000000', -k)) : c
/** A shaded volume: light from the upper left, a darker core and a softer outline tinted by the fill. `fuzz` pokes hair ticks past the edge so fur reads as fur. */
function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, shade: string | null, fuzz = 0) {
  const hex = fill[0] === '#' && fill.length === 7 && fill !== '#fff' && fill !== '#ffffff'
  if (fuzz > 0 && hex) { ctx.strokeStyle = shadeHex(fill, -0.12); ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.beginPath(); for (let k = 0; k < fuzz; k++) { const a = (k / fuzz) * 6.283 + Math.sin(k * 12.9 + rx) * 0.2, d = 0.9 + 0.5 * Math.abs(Math.sin(k * 7.3 + ry)), ca = Math.cos(a), sa = Math.sin(a); ctx.moveTo(x + ca * rx * 0.94, y + sa * ry * 0.94); ctx.lineTo(x + ca * (rx + 1.4 * d) + sa * 0.5, y + sa * (ry + 1.4 * d) - ca * 0.5) } ctx.stroke(); ctx.lineCap = 'butt' }
  let f: string | CanvasGradient = fill
  if (hex) { const gr = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.5, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry) * 1.08); gr.addColorStop(0, shadeHex(fill, 0.3)); gr.addColorStop(0.5, fill); gr.addColorStop(1, shadeHex(fill, -0.24)); f = gr }
  ctx.fillStyle = f; ctx.strokeStyle = hex ? mix2(shadeHex(fill, -0.6), OUT, 0.5) : OUT; ctx.lineWidth = 1.7
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fill(); ctx.stroke()
  if (shade) { ctx.save(); ctx.clip(); ctx.globalAlpha = 0.5; ctx.fillStyle = shade; ctx.beginPath(); ctx.ellipse(x + rx * 0.25, y + ry * 0.35, rx * 1.1, ry * 0.8, 0, 0, 6.283); ctx.fill(); ctx.restore() }
  if (hex && Math.min(rx, ry) > 3.5) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x - rx * 0.32, y - ry * 0.52, rx * 0.34, ry * 0.16, -0.5, 0, 6.283); ctx.fill() }   // sky light
}
/** Per-dog motion memory: speed (for the run cycle and lean), hit flinch and a gait phase. */
const DS: Record<string, { x: number; y: number; t: number; hp: number; run: number; step: number; fl: number; lean: number; rec: number }> = {}
const DYN = { run: 0, step: 0 }
const pawX = (sd: number) => DYN.run * Math.cos(DYN.step + (sd < 0 ? 0 : Math.PI)) * 2.4
const pawY = (sd: number) => DYN.run * Math.max(0, Math.sin(DYN.step + (sd < 0 ? 0 : Math.PI))) * 3.4
/** Rudy and Cooper are drawn larger so the strike team reads at a glance. Feet stay anchored. */
const dogScale = (i: number) => i === 0 ? 1.45 : i === 1 ? 1.32 : 1
/** A dog standing still, facing the viewer (codex, share card). Same art as in battle. */
export function drawDogPortrait(ctx: Ctx, g: Guardian, x: number, y: number, t: number) {
  DYN.run = 0; DYN.step = 0
  ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(x, y + 15, g.look === 'cooper' ? 10.5 : 12.5, 4, 0, 0, 6.283); ctx.fill()
  if (g.look === 'rudy') drawRudy(ctx, g, x, y, t, 0)
  else if (g.look === 'cooper') drawCooper(ctx, g, x, y, t, 0)
  else drawPlainDog(ctx, g, x, y, 0, t)
}
function drawDog(ctx: Ctx, g: Guardian, x: number, y: number, t: number, firing: boolean, tgt: Enemy | undefined) {
  const gi = GUARDIANS.indexOf(g), st = DS[g.n] ?? (DS[g.n] = { x, y, t, hp: G.hp[gi] ?? 1, run: 0, step: 0, fl: 0, lean: 0, rec: 0 })
  const dt = Math.min(0.1, Math.max(0.001, t - st.t)), vx = (x - st.x) / dt, vy = (y - st.y) / dt, sp = t - st.t > 0.25 ? 0 : Math.hypot(vx, vy)
  st.run += (Math.min(1, sp / 70) - st.run) * 0.25; st.step += dt * (6 + st.run * 8); st.x = x; st.y = y; st.t = t
  if (gi >= 0 && G.hp[gi] < st.hp - 0.01) st.fl = 0.28; st.hp = G.hp[gi] ?? st.hp; st.fl = Math.max(0, st.fl - dt)
  DYN.run = st.run; DYN.step = st.step
  const breath = Math.sin(t * 2.6 + x) * 0.014, hop = Math.abs(Math.sin(st.step)) * st.run * 2.2, flinch = st.fl > 0 ? Math.sin(st.fl * 50) * 0.8 * (st.fl / 0.28) : 0
  const look = tgt ? Math.sign(tgt.x - x) : 0, rawLean = sp < 10 ? 0 : Math.max(-0.16, Math.min(0.16, vx * 0.0024)); st.lean += (rawLean - st.lean) * 0.1
  const lean = st.lean + Math.sin(st.step) * 0.02 * st.run
  y += Math.sin(t * 6 + x) * 0.5 * (1 - st.run) - hop
  ctx.fillStyle = 'rgba(0,0,0,' + (0.26 - hop * 0.03) + ')'; ctx.beginPath(); ctx.ellipse(x, y + 15 + hop, (g.look === 'cooper' ? 10.5 : 12.5) * (1 - hop * 0.04), 4, 0, 0, 6.283); ctx.fill()
  ctx.save(); ctx.translate(x + flinch, y + 15); ctx.rotate(lean); ctx.scale(1 - breath * 0.6 + (st.fl > 0 ? 0.05 : 0), 1 + breath + hop * 0.01 - (st.fl > 0 ? 0.04 : 0)); ctx.translate(-x, -(y + 15))
  if (g.look === 'rudy') drawRudy(ctx, g, x, y, t, look)
  else if (g.look === 'cooper') drawCooper(ctx, g, x, y, t, look)
  else drawPlainDog(ctx, g, x, y, look, t)
  ctx.restore()
  if (firing) { ctx.fillStyle = 'rgba(255,240,150,.8)'; ctx.beginPath(); ctx.arc(x + (tgt && tgt.x < x ? -12 : 12), y + 4, 4, 0, 6.283); ctx.fill() }
}
function collar(ctx: Ctx, x: number, y: number, col: string, tag: boolean) {
  if (G.collar !== 'red') col = collarOf(G.collar).col // worn colourway (cosmetic, no stat effect); 'red' keeps each dog's own colour
  ctx.fillStyle = col; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - 8, y + 3, 16, 3.5, 1.5); ctx.fill(); ctx.stroke()
  if (tag) { ctx.fillStyle = '#f0c24a'; ctx.beginPath(); ctx.arc(x, y + 8, 1.9, 0, 6.283); ctx.fill(); ctx.stroke() }
}
/** Support dogs: one shared chibi body with breed-specific ears, face markings, muzzle and tail so each of the ten reads as its own character. */
export function drawPlainDog(ctx: Ctx, g: Guardian, x: number, y: number, look: number, t = 0) {
  const b = g.breed, wag = Math.sin(t * 9 + x) * 2.5
  const dark = b === 'Black Lab', pale = (c: string) => mix2(c, '#ffffff', 0.45)
  const stroke = (w = 1.2) => { ctx.strokeStyle = OUT; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round' }
  // ---- tail ----
  ctx.save(); stroke(4); ctx.beginPath()
  if (b === 'Husky' || b === 'Shiba Inu') { ctx.moveTo(x + 7, y + 7); ctx.bezierCurveTo(x + 17, y + 5, x + 17 + wag * 0.3, y - 6, x + 9, y - 2) }      // curled over the back
  else if (b === 'Beagle') { ctx.moveTo(x + 7, y + 8); ctx.quadraticCurveTo(x + 15, y + 5 + wag, x + 14, y - 5 + wag) }                                  // up like a flag
  else if (b === 'Dachshund' || b === 'Dalmatian') { ctx.moveTo(x + 7, y + 9); ctx.quadraticCurveTo(x + 17, y + 9 + wag, x + 19, y + 3 + wag) }          // long saber
  else if (b === 'Corgi') { ctx.moveTo(x + 7, y + 9); ctx.quadraticCurveTo(x + 10, y + 9, x + 9, y + 6) }                                                // stubby
  else { ctx.moveTo(x + 7, y + 9); ctx.quadraticCurveTo(x + 14, y + 10 + wag, x + 14, y + 3 + wag) }
  ctx.stroke(); ctx.strokeStyle = b === 'Corgi' ? g.fur : g.shade; ctx.lineWidth = 2.2; ctx.stroke()
  if (b === 'Beagle') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x + 14.2, y - 1 + wag); ctx.lineTo(x + 14, y - 5 + wag); ctx.stroke() } // white tip
  ctx.restore()
  // ---- body + legs ----
  blob(ctx, x, y + 6, b === 'Dachshund' ? 12.5 : 9, b === 'Dachshund' ? 6.8 : 8, g.fur, g.shade, b === 'Husky' || b === 'Corgi' ? 14 : 6)
  if (b === 'Dalmatian') { ctx.fillStyle = '#2a2a2e'; for (const [dx, dy, r] of [[-4, 4, 1.6], [3, 7, 1.9], [5, 2, 1.2], [-1, 10, 1.3]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 6.283); ctx.fill() } }
  if (b === 'Husky' || b === 'Beagle' || b === 'Corgi' || b === 'Shiba Inu' || b === 'Bulldog') blob(ctx, x, y + 9.5, 4.2, 5, '#f7f1e6', null)           // white chest
  const legCol = b === 'Beagle' || b === 'Husky' ? '#f7f1e6' : g.fur
  blob(ctx, x - 6 + pawX(-1), y + 14 - pawY(-1), b === 'Corgi' || b === 'Dachshund' ? 3 : 3.5, 3, legCol, g.shade); blob(ctx, x + 6 + pawX(+1), y + 14 - pawY(+1), b === 'Corgi' || b === 'Dachshund' ? 3 : 3.5, 3, legCol, g.shade)
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.9; for (const sx of [-1, 1]) for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sx * 6 + k * 1.2, y + 14.4); ctx.lineTo(x + sx * 6 + k * 1.2, y + 16.2); ctx.stroke() } // toe lines
  // ---- back ears (drop ears sit behind the head) ----
  const earFloppy = b === 'Beagle' || b === 'Dalmatian' || b === 'Black Lab' || b === 'Dachshund'
  if (earFloppy) {
    const len = b === 'Dachshund' ? 17 : b === 'Beagle' ? 12 : 9
    for (const sx of [-1, 1]) { ctx.fillStyle = g.ear; stroke(1.8); ctx.beginPath(); ctx.moveTo(x + sx * 7, y - 12); ctx.quadraticCurveTo(x + sx * 16, y - 10, x + sx * 14.5, y - 11 + len); ctx.quadraticCurveTo(x + sx * 9, y - 6 + len * 0.6, x + sx * 8, y - 3); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x + sx * 12.2, y - 4, 1.8, 4.6, sx * -0.2, 0, 6.283); ctx.fill() }
  }
  // ---- head ----
  const wide = b === 'Bulldog' ? 13.2 : 12
  blob(ctx, x, y - 4, wide, 11, g.fur, g.shade, b === 'Husky' || b === 'Corgi' || b === 'Shiba Inu' ? 14 : 5)
  // erect / folded ears sit on top of the head
  if (b === 'Husky' || b === 'Shiba Inu' || b === 'Corgi') {
    const big = b === 'Corgi' ? 1.25 : 1, tipDark = b === 'Husky'
    for (const sx of [-1, 1]) { ctx.fillStyle = tipDark ? g.ear : g.fur; stroke(1.8); ctx.beginPath(); ctx.moveTo(x + sx * 4, y - 12); ctx.lineTo(x + sx * 7.5 * big, y - 22 * (b === 'Shiba Inu' ? 0.88 : big * 0.93)); ctx.lineTo(x + sx * 12, y - 9); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = b === 'Husky' ? '#e8b4b4' : '#f2a9a0'; ctx.beginPath(); ctx.moveTo(x + sx * 6, y - 12); ctx.lineTo(x + sx * 7.8 * big, y - 18 * (b === 'Shiba Inu' ? 0.9 : big * 0.93)); ctx.lineTo(x + sx * 10, y - 10.5); ctx.closePath(); ctx.fill() }
  } else if (b === 'Bulldog') {
    for (const sx of [-1, 1]) { ctx.fillStyle = g.ear; stroke(1.8); ctx.beginPath(); ctx.moveTo(x + sx * 5, y - 13); ctx.quadraticCurveTo(x + sx * 12, y - 18, x + sx * 14, y - 9); ctx.quadraticCurveTo(x + sx * 10, y - 9, x + sx * 5, y - 10); ctx.closePath(); ctx.fill(); ctx.stroke() }   // small rose ears
  }
  // ---- face markings ----
  if (b === 'Husky') { ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - 4, 12, 11, 0, 0, 6.283); ctx.clip(); ctx.fillStyle = g.ear; ctx.beginPath(); ctx.ellipse(x, y - 11, 13, 6.5, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x - 3, y - 4); ctx.lineTo(x - 7.5, y + 8); ctx.lineTo(x + 7.5, y + 8); ctx.lineTo(x + 3, y - 4); ctx.closePath(); ctx.fill(); ctx.restore() }  // dark cap, white face
  if (b === 'Beagle') { ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - 4, 12, 11, 0, 0, 6.283); ctx.clip(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 2, y - 15); ctx.lineTo(x + 2, y - 15); ctx.lineTo(x + 4.5, y + 8); ctx.lineTo(x - 4.5, y + 8); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#9a6a38'; ctx.beginPath(); ctx.ellipse(x, y - 10.5, 8, 4, 0, 0, 6.283); ctx.fill(); ctx.restore() }
  if (b === 'Corgi') { ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - 4, 12, 11, 0, 0, 6.283); ctx.clip(); ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.moveTo(x - 1.5, y - 13); ctx.lineTo(x + 1.5, y - 13); ctx.lineTo(x + 8, y + 8); ctx.lineTo(x - 8, y + 8); ctx.closePath(); ctx.fill(); ctx.restore() }
  if (b === 'Shiba Inu') { ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - 4, 12, 11, 0, 0, 6.283); ctx.clip(); ctx.fillStyle = '#fff3dc'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * 7, y + 2, 5.5, 5, 0, 0, 6.283); ctx.fill() } ctx.beginPath(); ctx.ellipse(x, y + 3, 5, 4, 0, 0, 6.283); ctx.fill(); ctx.restore() }   // cream cheeks
  if (b === 'Dalmatian') { ctx.fillStyle = '#2a2a2e'; for (const [dx, dy, r] of [[-7, -7, 2.2], [6.5, -9, 1.7], [8, -2, 1.3]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 6.283); ctx.fill() } }
  if (b === 'Bulldog') { ctx.strokeStyle = g.shade; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sx * 2, y - 12); ctx.quadraticCurveTo(x + sx * 3.4, y - 10.5, x + sx * 2.4, y - 9); ctx.stroke() } ctx.beginPath(); ctx.moveTo(x - 6.2, y - 11); ctx.quadraticCurveTo(x, y - 8.6, x + 6.2, y - 11); ctx.stroke() }   // forehead wrinkles
  // ---- muzzle ----
  const mz = b === 'Bulldog' ? { rx: 8.4, ry: 5.2, y: 2.4 } : b === 'Dachshund' ? { rx: 6.2, ry: 5.4, y: 3.2 } : { rx: 6.6, ry: 4.6, y: 2.6 }
  const mzCol = dark ? '#57525f' : b === 'Husky' || b === 'Beagle' ? '#fffaf0' : b === 'Dalmatian' ? '#fbf9f5' : b === 'Shiba Inu' ? '#fff3dc' : b === 'Corgi' ? '#fff6e6' : mix2(g.fur, '#ffffff', 0.55)
  blob(ctx, x, y + mz.y, mz.rx, mz.ry, mzCol, null)
  ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(x, y + mz.y - 2.1, b === 'Bulldog' ? 3.4 : 2.7, 1.9, 0, 0, 6.283); ctx.fill()                              // nose
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - 0.9, y + mz.y - 2.8, 0.9, 0.5, 0, 0, 6.283); ctx.fill()                              // nose shine
  stroke(1.1); ctx.beginPath(); ctx.moveTo(x, y + mz.y - 0.4); ctx.lineTo(x, y + mz.y + 1.4); ctx.moveTo(x - 3, y + mz.y + 2.6); ctx.quadraticCurveTo(x - 1.5, y + mz.y + 3.4, x, y + mz.y + 1.4); ctx.quadraticCurveTo(x + 1.5, y + mz.y + 3.4, x + 3, y + mz.y + 2.6); ctx.stroke()  // mouth
  if (b === 'Bulldog') { ctx.fillStyle = '#fff'; stroke(0.9); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sx * 3.4, y + 4.4); ctx.lineTo(x + sx * 4.6, y + 1.8); ctx.lineTo(x + sx * 5.6, y + 4.6); ctx.closePath(); ctx.fill(); ctx.stroke() } }   // underbite tusks
  else if (b === 'Husky' || b === 'Corgi' || b === 'Shiba Inu' || b === 'Black Lab') { ctx.fillStyle = '#ff8fa8'; stroke(1); ctx.beginPath(); ctx.ellipse(x + 0.6, y + mz.y + 4.7, 1.8, 2.4, 0, 0, Math.PI); ctx.fill(); ctx.stroke() }          // tongue
  ctx.fillStyle = 'rgba(255,130,120,.45)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * 8.8, y - 0.8, 2.4, 1.6, 0, 0, 6.283); ctx.fill() }       // cheeks
  // ---- eyes ----
  const blue = b === 'Husky', eyeY = y - 5.4
  for (const sx of [-1, 1]) {
    const ex = x + sx * 4.8
    ctx.fillStyle = '#fff'; stroke(1.2); ctx.beginPath(); ctx.ellipse(ex, eyeY, 3.3, 3.8, 0, 0, 6.283); ctx.fill(); ctx.stroke()
    ctx.fillStyle = blue ? '#5ab4ec' : '#3a2214'; ctx.beginPath(); ctx.arc(ex + look * 0.8, eyeY + 0.5, 2.3, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#120a06'; ctx.beginPath(); ctx.arc(ex + look * 0.8, eyeY + 0.5, 1.1, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + look * 0.8 + 0.8, eyeY - 0.6, 0.85, 0, 6.283); ctx.fill()
    ctx.strokeStyle = b === 'Dalmatian' || b === 'Husky' ? OUT : g.shade; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + sx * 2, eyeY - 4.8 - (sx < 0 ? 0.4 : 0)); ctx.lineTo(x + sx * 7.6, eyeY - 5 + (sx < 0 ? 0.4 : 0)); ctx.stroke()  // brows
  }
  if (b === 'Shiba Inu') { ctx.fillStyle = '#fff3dc'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * 4.8, eyeY - 6, 1.1, 0, 6.283); ctx.fill() } }       // shiba eyebrow dots
  // ---- tuft + shine ----
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x - 5.5, y - 11, 3.2, 1.4, -0.5, 0, 6.283); ctx.fill()
  // ---- collar + role accent ----
  const col = g.role === 'Medic' ? '#ffffff' : g.role === 'Tank' ? '#5a8a3e' : g.role === 'Striker' ? '#c0392b' : '#d63a3a'
  collar(ctx, x, y, col, true)
  if (g.role === 'Medic') { ctx.fillStyle = '#e03a3a'; ctx.fillRect(x - 1, y + 7.2, 2, 4); ctx.fillRect(x - 2, y + 8.2, 4, 2) }          // red cross
  if (g.role === 'Tank') { ctx.fillStyle = '#6a9a3e'; stroke(1.4); ctx.beginPath(); ctx.moveTo(x - 9, y - 11.5); ctx.bezierCurveTo(x - 9, y - 20, x + 9, y - 20, x + 9, y - 11.5); ctx.quadraticCurveTo(x, y - 9.5, x - 9, y - 11.5); ctx.closePath(); ctx.fill(); ctx.stroke() }    // helmet
  void pale
}
/** Small fur spike: a triangle poking out of an outline at (x,y) pointing along `ang`. Used for scruffiness. */
/** Green army-style helmet sitting on top of a head centred at (x,y). strap = chin strap fastened; otherwise loose straps dangle. */
function helmet(ctx: Ctx, x: number, y: number, hw: number, strapped: boolean, t: number, tilt = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt)
  ctx.fillStyle = '#6a9a3e'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.bezierCurveTo(-hw, -hw * 1.02, hw, -hw * 1.02, hw, 0); ctx.quadraticCurveTo(0, hw * 0.3, -hw, 0); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.save(); ctx.clip(); ctx.fillStyle = '#4b7429'; ctx.beginPath(); ctx.ellipse(hw * 0.35, -hw * 0.1, hw * 1.05, hw * 0.75, 0, 0, 6.283); ctx.fill(); ctx.restore()   // cel shade
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-hw * 0.38, -hw * 0.62, hw * 0.26, hw * 0.12, -0.5, 0, 6.283); ctx.fill()                       // highlight
  ctx.strokeStyle = '#3a5a22'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-hw * 0.96, -hw * 0.08); ctx.quadraticCurveTo(0, hw * 0.34, hw * 0.96, -hw * 0.08); ctx.stroke() // rim band
  ctx.restore()
  if (!strapped) { // loose chin straps swinging free
    const sw = Math.sin(t * 7) * 1.2
    for (const sx of [-1, 1]) {
      const bx = x + sx * (hw - 1), by = y + 1
      ctx.strokeStyle = OUT; ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sx * 2.5 + sw, by + 5, bx + sx * 1.5 + sw * 1.4, by + 10); ctx.stroke()
      ctx.strokeStyle = '#7a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sx * 2.5 + sw, by + 5, bx + sx * 1.5 + sw * 1.4, by + 10); ctx.stroke()
      ctx.fillStyle = '#c9b37a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(bx + sx * 1.5 + sw * 1.4 - 1.6, by + 9, 3.2, 3.2); ctx.fill(); ctx.stroke()
    }
    ctx.lineCap = 'butt'
  }
}
/** Rudy: cute golden retriever. Warm cream-gold coat, darker golden floppy ears, big sparkly eyes, rosy cheeks, feathered tail and chest, tongue out. */
function drawRudy(ctx: Ctx, g: Guardian, x: number, y: number, t: number, look: number) {
  const wag = Math.sin(t * 9 + x) * 3
  blob(ctx, x + 12 + wag * 0.4, y + 3 + wag * 0.3, 7.5, 4.4, g.shade, g.ear)                         // feathered tail plume
  blob(ctx, x, y + 6, 12, 10, g.fur, g.shade, 16)                                                       // body (heavier build)
  blob(ctx, x, y + 9.5, 7, 5.2, '#fbeccb', null)                                                    // fluffy chest ruff
  for (const dx of [-5, 0, 5]) blob(ctx, x + dx, y + 12, 2.6, 2.2, '#fbeccb', null)                 // feathering tufts
  blob(ctx, x - 6.5 + pawX(-1), y + 14.5 - pawY(-1), 4.2, 3.3, g.fur, g.shade); blob(ctx, x + 6.5 + pawX(+1), y + 14.5 - pawY(+1), 4.2, 3.3, g.fur, g.shade) // paws
  for (const sx of [-1, 1]) {                                                                       // soft droopy golden ears
    ctx.fillStyle = g.ear; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(x + sx * 8, y - 12); ctx.quadraticCurveTo(x + sx * 18, y - 11, x + sx * 15.5, y + 3); ctx.quadraticCurveTo(x + sx * 12, y + 5, x + sx * 9.5, y - 1); ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  blob(ctx, x, y - 4.5, 16.2, 14.6, g.fur, g.shade, 18)                                                   // big broad head
  for (const a of [3.05, 0.1, 2.4, 0.75]) blob(ctx, x + Math.cos(a) * 12.9, y - 4.5 + Math.sin(a) * 11.6, 3.4, 2.8, g.fur, null)   // soft fluffy cheek tufts (scruffy but friendly)
  blob(ctx, x, y + 1.8, 6, 4.2, '#fffaf0', null)                                                  // light muzzle
  ctx.fillStyle = 'rgba(255,130,120,.55)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * 9.6, y - 0.2, 3.2, 2.1, 0, 0, 6.283); ctx.fill() } // rosy cheeks
  for (const sx of [-1, 1]) {                                                                       // big shiny eyes
    const ex = x + sx * 5.8, ey = y - 5.2
    ctx.fillStyle = '#2a1608'; ctx.beginPath(); ctx.ellipse(ex, ey, 3, 3.5, 0, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.ellipse(ex + look * 0.5, ey + 1.1, 2, 1.7, 0, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + look * 0.4 + 0.8, ey - 1.1, 1.2, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.arc(ex - 1.1 + look * 0.4, ey + 1.4, 0.6, 0, 6.283); ctx.fill()
  }
  ctx.fillStyle = '#3a2418'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(x, y - 0.4, 2.5, 1.9, 0, 0, 6.283); ctx.fill(); ctx.stroke() // nose
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - 1, y - 1.4, 0.9, 0.55, 0, 0, 6.283); ctx.fill()
  ctx.fillStyle = '#8a2f45'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(x, y + 2.6, 5.2, 4.6, 0, 0, Math.PI); ctx.fill(); ctx.stroke()   // big open happy mouth
  ctx.fillStyle = '#ff8fa8'; ctx.beginPath(); ctx.ellipse(x + 0.6, y + 6.6, 2.9, 2, 0, Math.PI, 0, true); ctx.fill()   // tongue
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sx * 5.2, y + 2.6); ctx.quadraticCurveTo(x + sx * 6.6, y + 1.6, x + sx * 6.9, y + 0.2); ctx.stroke() } ctx.lineCap = 'butt'   // smile cheeks
  for (const dx of [-6, 0, 6]) blob(ctx, x + dx, y + 13.2, 3.6, 2.6, '#fbeccb', null)   // fluffy chest ruff
  for (const sx of [-1, 1]) blob(ctx, x + sx * 7.5, y + 13.2, 3.4, 2.5, '#fbeccb', null)            // feathered legs
  collar(ctx, x, y + 4.2, '#c0392b', true)
  helmet(ctx, x + 0.3, y - 12.4, 12, false, t, -0.1)   // green helmet pushed back, straps hanging loose
}
/** Cooper: short-coated tan mix. Dark muzzle, one perked ear + one folded, white chest patch, head tilt, wide worried eyes. */
function drawCooper(ctx: Ctx, g: Guardian, x: number, y: number, t: number, look: number) {
  const wag = Math.sin(t * 8 + x) * 3
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 7, y + 9); ctx.quadraticCurveTo(x + 15, y + 8 + wag, x + 15, y + 1 + wag); ctx.stroke() // whip tail
  ctx.strokeStyle = g.fur; ctx.lineWidth = 2.4; ctx.stroke(); ctx.lineCap = 'butt'
  blob(ctx, x, y + 6, 8.3, 8.6, g.fur, g.shade, 8)                                                     // lean body
  blob(ctx, x, y + 9, 4, 5.2, '#f7f1e6', null)                                                      // white chest patch
  blob(ctx, x - 5.5 + pawX(-1), y + 14.5 - pawY(-1), 3.1, 3, g.fur, g.shade); blob(ctx, x + 5.5 + pawX(+1), y + 14.5 - pawY(+1), 3.1, 3, g.fur, g.shade)
  ctx.save(); ctx.translate(x, y - 4); ctx.rotate(-0.14)                                            // head tilt
  ctx.fillStyle = g.ear; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(-10.5, -12.5); ctx.quadraticCurveTo(-6, -14, -3, -8.5); ctx.closePath(); ctx.fill(); ctx.stroke() // perked rose ear
  ctx.beginPath(); ctx.moveTo(3, -9); ctx.lineTo(13, -11); ctx.lineTo(11.5, -2); ctx.closePath(); ctx.fill(); ctx.stroke()    // folded ear
  blob(ctx, 0, 0, 11.6, 10.6, g.fur, g.shade, 10)                                                       // head
  blob(ctx, 0, 4.2, 6.8, 5, '#4a3329', null)                                                        // dark boxy muzzle
  ctx.fillStyle = '#16100d'; ctx.beginPath(); ctx.ellipse(0, 2.4, 3, 2.1, 0, 0, 6.283); ctx.fill()  // nose
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 4.4); ctx.lineTo(0, 6); ctx.moveTo(-3, 7); ctx.quadraticCurveTo(0, 8.4, 3, 7); ctx.stroke()
  const pk = G.panicT > 0 ? 1.55 : 1 // Panic mode: eyes bulge, pupils shrink and shake
  for (const sx of [-1, 1]) {                                                                       // wide, slightly worried eyes
    ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(sx * 4.6 * (1 + 0.1 * (pk - 1)), -1.8 + (pk - 1) * 1.2, 3.6 * pk, 4.2 * pk, 0, 0, 6.283); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(sx * 4.6 + look * 0.9 + (pk > 1 ? Math.sin(t * 50 + sx) * 0.5 : 0), -1.4 + (pk - 1) * 1.2, pk > 1 ? 1.5 : 2, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * 4.6 + look * 0.9 + 0.7, -2.2 + (pk - 1) * 1.2, 0.8, 0, 6.283); ctx.fill()
    ctx.strokeStyle = g.shade; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(sx * 2.2, -7.2 + (sx < 0 ? 0.6 : 0)); ctx.lineTo(sx * 7.2, -7.4 - (sx < 0 ? 0.6 : 0)); ctx.stroke() // brow
  }
  helmet(ctx, 0, -7.4, 10.8, true, t)                                                               // green helmet, strap fastened
  ctx.strokeStyle = OUT; ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-10.2, -7); ctx.quadraticCurveTo(-11, 6, -4.5, 9.6); ctx.quadraticCurveTo(0, 11.6, 4.5, 9.6); ctx.quadraticCurveTo(11, 6, 10.2, -7); ctx.stroke()
  ctx.strokeStyle = '#7a6a3a'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineCap = 'butt'
  ctx.fillStyle = '#c9b37a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.rect(-2, 8.8, 4, 4); ctx.fill(); ctx.stroke()  // buckle
  ctx.restore()
  collar(ctx, x, y + 1, '#d63a3a', false)
}
/** Weapon held in both paws across the body, aimed at the current target, with recoil kick on fire. */
function drawHeld(ctx: Ctx, lvl: number, gx: number, gy: number, tgt: Enemy | undefined, firing: boolean, t: number, g: Guardian) {
  const bob = Math.sin(t * 6 + gx) * 1.2, cy = gy + 10 + bob
  const dx = tgt ? tgt.x - gx : 1, dy = tgt ? tgt.y - cy : 0, flip = dx < 0
  const ang = Math.max(-0.4, Math.min(0.4, Math.atan2(dy, Math.abs(dx)) * 0.5)) // keep the weapon below the face
  ctx.save(); ctx.translate(gx + (flip ? -3 : 3), cy); ctx.scale(flip ? -1 : 1, 1); ctx.rotate(ang)
  const ds = DS[g.n]; if (ds) ds.rec += ((firing ? 1 : 0) - ds.rec) * 0.12
  ctx.translate(7 - 2 * (ds ? ds.rec : 0), 0)
  drawWeaponIcon(ctx, lvl, 0, 0, 0.66)
  for (const px of [-5, 5]) { ctx.fillStyle = g.fur; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, 2.6, 3.2, 0, 6.283); ctx.fill(); ctx.stroke() }
  ctx.restore()
}

const DRAKE_PAL = [
  { body: '#c8402a', shade: '#8a2418', belly: '#f2b14a', wing: '#7a1f2a', glow: '#ff9a3a', horn: '#2c1a14' },
  { body: '#7fc4e6', shade: '#4b8fb8', belly: '#eaf7ff', wing: '#4a7aa8', glow: '#bff0ff', horn: '#e8f8ff' },
  { body: '#5a52c8', shade: '#38328f', belly: '#cfcdf7', wing: '#2e2a78', glow: '#ffe45a', horn: '#ffe45a' },
  { body: '#6fae3a', shade: '#3f7a22', belly: '#d6e07a', wing: '#6a3a8a', glow: '#b6ff4a', horn: '#d9cfa0' },
]
/** Boss dragons, drawn in a 24-unit hitbox space. Four elements, each with its own wings, crest and breath tell. */
function drawDragon(ctx: Ctx, e: Enemy, t: number, x: number, y: number, fl: boolean) {
  const d = e.drake ?? 0, P = DRAKE_PAL[d], k = e.r / 24, flap = Math.sin(t * 4.5 + e.wob) * 5, charge = e.ab !== undefined && e.ab < 0.9
  const F = (c: string) => fl ? '#fff' : c
  const enr = e.hp < e.max * 0.35
  ctx.save(); ctx.translate(x, y - 2); ctx.scale(k * 1.3, k * 1.3); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 2
  const poly = (pts: number[][], fill: string) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = F(fill); ctx.fill(); ctx.stroke() }
  if (!fl) { const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 46); g.addColorStop(0, P.glow + (charge ? '88' : '38')); g.addColorStop(1, P.glow + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, 6.283); ctx.fill() }
  if (!fl) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 30, 26, 7, 0, 0, 6.283); ctx.fill() } // ground shadow: it has weight
  if (enr && !fl) for (let i = 0; i < 6; i++) { const a = t * 2 + i * 1.05; ctx.fillStyle = 'rgba(255,' + (120 + i * 18) + ',40,' + (0.5 + 0.4 * Math.sin(t * 8 + i)) + ')'; ctx.beginPath(); ctx.arc(Math.cos(a) * 32, Math.sin(a) * 24 - 4, 2.4, 0, 6.283); ctx.fill() } // enraged: embers circle it
  // tail with spikes
  const sw = Math.sin(t * 3 + e.wob) * 4
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.quadraticCurveTo(24 + sw, 34, 36, 22 + sw * 0.5); ctx.lineWidth = 11; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 7.5; ctx.strokeStyle = F(P.body); ctx.stroke()
  ctx.lineWidth = 2; ctx.strokeStyle = OUT; poly([[33, 22 + sw * 0.5], [44, 12 + sw * 0.5], [42, 26 + sw * 0.5], [37, 28 + sw * 0.5]], P.horn)
  // wings
  for (const sx of [-1, 1]) {
    const f = flap * (sx < 0 ? 1 : 1)
    const sh = [sx * 9, -7], tip = [sx * 44, -30 + f], t2 = [sx * 50, -8 + f * 0.6], t3 = [sx * 42, 12 + f * 0.3], t4 = [sx * 25, 8]
    ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(tip[0], tip[1]); ctx.quadraticCurveTo(sx * 40, -22 + f, t2[0], t2[1]); ctx.quadraticCurveTo(sx * 42, 0 + f * 0.5, t3[0], t3[1]); ctx.quadraticCurveTo(sx * 32, 6, t4[0], t4[1]); ctx.quadraticCurveTo(sx * 16, 8, sx * 9, 6); ctx.closePath()
    ctx.fillStyle = F(P.wing); ctx.fill(); ctx.stroke()
    if (!fl) { ctx.strokeStyle = P.shade; ctx.lineWidth = 2; for (const q of [tip, t2, t3]) { ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(q[0], q[1]); ctx.stroke() } ctx.strokeStyle = OUT; ctx.lineWidth = 2
      if (d === 3) { ctx.fillStyle = P.glow; for (const [bx, by] of [[30, -8], [38, 2]]) { ctx.beginPath(); ctx.arc(sx * bx, by + f * 0.4, 2.4, 0, 6.283); ctx.fill() } }     // venom sacs
      if (d === 1) { ctx.fillStyle = 'rgba(255,255,255,.5)'; poly([[sx * 30, -14 + f * 0.6], [sx * 34, -22 + f * 0.8], [sx * 36, -12 + f * 0.6]], '#dff6ff') } }                  // ice shards
  }
  for (let i = 0; i < 4; i++) poly([[-4.5, -6 + i * 6], [0.5, -17 + i * 5], [4.5, -6 + i * 6]], P.horn) // dorsal spikes, drawn under the body
  // body and belly
  ctx.beginPath(); ctx.ellipse(0, 6, 15, 18, 0, 0, 6.283); ctx.fillStyle = F(P.body); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(0, 9, 8.5, 13, 0, 0, 6.283); ctx.fillStyle = F(P.belly); ctx.fill()
  if (!fl) { ctx.strokeStyle = P.shade; ctx.lineWidth = 1.2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-7 + Math.abs(i - 2) * 0.8, -1 + i * 5); ctx.lineTo(7 - Math.abs(i - 2) * 0.8, -1 + i * 5); ctx.stroke() }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(sx * (11 - i * 0.6), 2 + i * 5, 2.2, 0, 6.283); ctx.fill() } }   // scales
  ctx.strokeStyle = OUT; ctx.lineWidth = 2
  // shoulder spikes and claws
  for (const sx of [-1, 1]) { poly([[sx * 12, -4], [sx * 20, -10], [sx * 15, 2]], P.horn); ctx.beginPath(); ctx.ellipse(sx * 11, 22, 5, 4, 0, 0, 6.283); ctx.fillStyle = F(P.body); ctx.fill(); ctx.stroke()
    ctx.fillStyle = F('#f4efe0'); for (const c of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(sx * 11 + c - 1, 24); ctx.lineTo(sx * 11 + c, 29); ctx.lineTo(sx * 11 + c + 1.2, 24); ctx.fill() } }
  // head: crest, horns, frills
  const hy = -13
  if (d === 0) { for (let i = -2; i <= 2; i++) { const h = 12 - Math.abs(i) * 2.2 + Math.sin(t * 9 + i) * 1.6; poly([[i * 3.2 - 2, hy - 8], [i * 3.2, hy - 8 - h], [i * 3.2 + 2, hy - 8]], i % 2 ? '#ffb347' : '#ff6a2a') } }
  else if (d === 1) { for (const [i, h] of [[-2, 9], [-1, 14], [0, 18], [1, 14], [2, 9]]) poly([[i * 3.4 - 1.8, hy - 7], [i * 3.4, hy - 7 - h], [i * 3.4 + 1.8, hy - 7]], '#e8f8ff') }
  else if (d === 2) { poly([[-2, hy - 8], [4, hy - 14], [0, hy - 15], [6, hy - 24], [-5, hy - 14], [0, hy - 13]], '#ffe45a') }
  else { for (let i = -2; i <= 2; i++) poly([[i * 3.4 - 1.6, hy - 8], [i * 3.4 + (i > 0 ? 1.5 : -1.5), hy - 15 + Math.abs(i)], [i * 3.4 + 1.6, hy - 8]], '#c04aa0') }
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 7, hy - 6); ctx.quadraticCurveTo(sx * 18, hy - 8, sx * 17, hy - 24); ctx.quadraticCurveTo(sx * 11, hy - 14, sx * 4, hy - 4); ctx.closePath(); ctx.fillStyle = F(P.horn); ctx.fill(); ctx.stroke()      // swept horns
    poly([[sx * 11, hy + 1], [sx * 21, hy - 3], [sx * 19, hy + 3], [sx * 23, hy + 8], [sx * 11, hy + 8]], P.wing) }                                                                                              // ear frills
  ctx.beginPath(); ctx.ellipse(0, hy, 13, 11, 0, 0, 6.283); ctx.fillStyle = F(P.body); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(0, hy + 6, 8.5, 6.5, 0, 0, 6.283); ctx.fillStyle = F(P.shade); ctx.fill(); ctx.stroke()                                                                                           // snout
  // eyes: slanted, glowing, slit pupils
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * 2.5, hy - 6); ctx.lineTo(sx * 10, hy - 8.5); ctx.lineTo(sx * 9, hy - 1.5); ctx.quadraticCurveTo(sx * 5, hy - 2, sx * 2.5, hy - 6); ctx.closePath(); ctx.fillStyle = F(charge ? '#fff6c0' : P.glow); ctx.fill(); ctx.stroke()
    if (!fl) { ctx.fillStyle = '#16100c'; ctx.beginPath(); ctx.ellipse(sx * 6.4, hy - 5, 1, 2.8, 0, 0, 6.283); ctx.fill() }
    ctx.fillStyle = F(P.shade); ctx.beginPath(); ctx.moveTo(sx * 1, hy - 8); ctx.lineTo(sx * 11, hy - 11.5); ctx.lineTo(sx * 10.5, hy - 7.2); ctx.closePath(); ctx.fill(); ctx.stroke()                                      // angry brow
  }
  // nostrils, fangs, breath tell
  ctx.fillStyle = '#16100c'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 3, hy + 4, 1.2, 0, 6.283); ctx.fill() }
  ctx.beginPath(); ctx.moveTo(-8, hy + 9); ctx.quadraticCurveTo(0, hy + 13, 8, hy + 9); ctx.stroke()
  ctx.fillStyle = F('#fffbe8'); ctx.lineWidth = 1.2; for (const fx of [-6, -3, 3, 6]) { ctx.beginPath(); ctx.moveTo(fx - 1.4, hy + 10); ctx.lineTo(fx, hy + 14.5); ctx.lineTo(fx + 1.4, hy + 10); ctx.fill(); ctx.stroke() }
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 7.5 - 1.8, hy + 8); ctx.lineTo(sx * 8.5, hy + 17); ctx.lineTo(sx * 7.5 + 1.8, hy + 8); ctx.fill(); ctx.stroke() }
  if (!fl) {
    if (charge) { ctx.fillStyle = P.glow + 'cc'; ctx.beginPath(); ctx.arc(0, hy + 11, 5 + Math.sin(t * 30) * 1.5, 0, 6.283); ctx.fill() }
    if (d === 0 || d === 3) { ctx.fillStyle = d === 0 ? 'rgba(80,60,60,.4)' : 'rgba(150,230,60,.4)'; for (let i = 0; i < 3; i++) { const q = (t * 1.2 + i / 3) % 1; ctx.beginPath(); ctx.arc((i - 1) * 3 + Math.sin(t * 5 + i) * 2, hy + 3 - q * 12, 1.5 + q * 2.5, 0, 6.283); ctx.fill() } }
    if (d === 3) { ctx.fillStyle = P.glow; for (const fx of [-3, 4]) { const q = (t * 1.6 + fx) % 1; ctx.beginPath(); ctx.ellipse(fx, hy + 15 + q * 9, 1.1, 1.8, 0, 0, 6.283); ctx.fill() } }
    if (d === 1) { ctx.fillStyle = 'rgba(220,245,255,.7)'; for (let i = 0; i < 4; i++) { const q = (t * 0.9 + i / 4) % 1; ctx.fillRect(-26 + i * 17 + Math.sin(i) * 4, -30 + q * 70, 2, 2) } }
    if (d === 2 && Math.sin(t * 17) > -0.2) { ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1, r0 = 24, r1 = 36; ctx.beginPath(); let px = Math.cos(a) * r0, py = Math.sin(a) * r0; ctx.moveTo(px, py); for (let j = 1; j <= 3; j++) { const r = r0 + (r1 - r0) * j / 3; px = Math.cos(a + (j % 2 ? 0.12 : -0.1)) * r; py = Math.sin(a + (j % 2 ? 0.12 : -0.1)) * r; ctx.lineTo(px, py) } ctx.stroke() } }
  }
  ctx.restore()
}

const ZSKIN = [['#8ccf6e', '#64a84c'], ['#a3b8a0', '#74897a'], ['#8fb4bd', '#628a96'], ['#b2c46e', '#8a9a48']]
const ZSHIRT = ['#44557a', '#7a4a3a', '#5a5f66', '#8a3a3a']
/** Shambling zombie: hunched, forward-reaching arms that swing out of step, stepping legs, one cloudy eye, hanging jaw, torn clothes. Variant per enemy. */
function drawZombie(ctx: Ctx, e: Enemy, t: number, x: number, y: number, s: number, fl: boolean) {
  const v = Math.floor(e.wob * 977) % 4, [sk, sh] = ZSKIN[v], cl = ZSHIRT[Math.floor(e.wob * 31) % 4], ph = GAIT.ph, mv = GAIT.mv
  const F = (c: string) => fl ? '#fff' : c, sw = Math.sin(ph), k = s
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // legs
  for (const sd of [-1, 1]) { const q = Math.sin(ph + (sd < 0 ? 0 : Math.PI)) * mv, hx = x + sd * 3.4 * k, fx = hx + q * 2.2 * k, fy = y + (12 - Math.max(0, q) * 2.4) * k
    ctx.strokeStyle = OUT; ctx.lineWidth = 5.2 * k; ctx.beginPath(); ctx.moveTo(hx, y + 5.5 * k); ctx.lineTo(hx + sd * 0.8 * k + q * 1.2 * k, y + 9 * k); ctx.lineTo(fx, fy); ctx.stroke()
    ctx.strokeStyle = F('#3b4252'); ctx.lineWidth = 3.4 * k; ctx.stroke()
    ctx.fillStyle = F('#2b2420'); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(fx + sd * 0.6 * k, fy + 0.6 * k, 3.1 * k, 1.7 * k, 0, 0, 6.283); ctx.fill(); ctx.stroke() }
  // back arm
  const arm = (sd: number, front: boolean) => { const q = Math.sin(ph * 0.9 + (sd < 0 ? 0 : 2.4) + e.wob), sx = x + sd * 8.2 * k, sy = y - 0.5 * k, ex = x + sd * (10.5 + q) * k, ey = y + (3.5 - q * 1.5) * k, hx = x + sd * (7.5 - q * 1.2) * k, hy = y + (-5.5 - q * 2 - (mv > 0.5 ? 1 : 0)) * k
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.6 * k; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke()
    ctx.strokeStyle = F(front ? sk : sh); ctx.lineWidth = 3 * k; ctx.stroke()
    ctx.fillStyle = F(front ? sk : sh); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx, hy, 2.2 * k, 0, 6.283); ctx.fill(); ctx.stroke()
    if (!fl) { ctx.strokeStyle = '#2a2a1a'; ctx.lineWidth = 0.9; for (const f of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(hx + f * 1, hy - 1.6 * k); ctx.lineTo(hx + f * 1.7, hy - 3.4 * k); ctx.stroke() } } }
  arm(-1, false)
  // torso with torn shirt and exposed ribs
  blob(ctx, x, y + 2.6 * k, 8.6 * k, 8 * k, F(cl), null)
  if (!fl) {
    ctx.fillStyle = shadeHex(cl, -0.35); ctx.beginPath(); ctx.moveTo(x - 8 * k, y + 8 * k); for (let q = 0; q <= 5; q++) ctx.lineTo(x - 8 * k + q * 3.2 * k, y + (q % 2 ? 11.6 : 9.4) * k); ctx.lineTo(x + 8 * k, y + 8 * k); ctx.closePath(); ctx.fill()
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y + 2.6 * k, 8.6 * k, 8 * k, 0, 0, 6.283); ctx.clip()
    ctx.fillStyle = '#5a1618'; ctx.beginPath(); ctx.ellipse(x + 2.6 * k, y + 3.2 * k, 3.3 * k, 4 * k, 0.3, 0, 6.283); ctx.fill()
    ctx.strokeStyle = '#d9d2b8'; ctx.lineWidth = 1 * k; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.moveTo(x + 0.2 * k, y + (1.4 + q * 1.7) * k); ctx.quadraticCurveTo(x + 2.6 * k, y + (0.6 + q * 1.7) * k, x + 5 * k, y + (1.6 + q * 1.7) * k); ctx.stroke() }
    ctx.fillStyle = 'rgba(120,20,20,.5)'; ctx.beginPath(); ctx.ellipse(x - 4 * k, y + 6 * k, 2.4 * k, 1.6 * k, 0.3, 0, 6.283); ctx.fill(); ctx.restore()
  }
  // head: forward-hung, slow bob and tilt
  const hb = Math.sin(ph * 0.5 + e.wob) * 0.6 * k, tilt = Math.sin(t * 1.3 + e.wob) * 0.12 + (sw * 0.06 * mv), hx = x + 1.2 * k, hy = y - 7.6 * k + hb
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt)
  blob(ctx, 0, 0, 8.4 * k, 8 * k, F(sk), null)
  if (!fl) {
    ctx.fillStyle = ['#3d5a2a', '#2e2a26', '#6b5a3a', '#241f24'][v]; ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; for (const [px, py, w, h] of [[-5.5, -6.6, 3, 4.6], [-1.5, -8, 3, 5], [3, -7.6, 3.2, 4.4], [6, -4.5, 2, 3.4]]) { ctx.beginPath(); ctx.moveTo(px * k - w * k * 0.5, py * k + 1.4 * k); ctx.lineTo(px * k + 0.3 * k, py * k - h * k); ctx.lineTo(px * k + w * k * 0.5, py * k + 1.4 * k); ctx.fill() }   // patchy hair
    ctx.fillStyle = '#d6cdb0'; ctx.beginPath(); ctx.ellipse(-5.2 * k, -3.6 * k, 2.4 * k, 2 * k, 0.4, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#6a2020'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(-5.2 * k, -3.6 * k, 2.4 * k, 2 * k, 0.4, 0, 6.283); ctx.stroke()      // exposed skull patch
    ctx.fillStyle = 'rgba(80,40,90,.35)'; ctx.beginPath(); ctx.ellipse(4.6 * k, 1.6 * k, 3 * k, 2.2 * k, 0, 0, 6.283); ctx.fill()                                                                                     // bruise
    for (const [ex, er, big] of [[-3.1, 2.3, 1], [3.4, 1.8, 0]]) { ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(ex * k, -1.6 * k, (er + 1.1) * k, (er + 1.3) * k, 0, 0, 6.283); ctx.fill()                       // sunken sockets
      ctx.fillStyle = big ? '#e9e8d0' : '#f4f0dc'; ctx.beginPath(); ctx.arc(ex * k, -1.4 * k, er * k, 0, 6.283); ctx.fill()
      ctx.strokeStyle = '#b02a2a'; ctx.lineWidth = 0.6; for (const a of [0.5, 2.1, 3.8, 5.2]) { ctx.beginPath(); ctx.moveTo(ex * k + Math.cos(a) * er * k, -1.4 * k + Math.sin(a) * er * k); ctx.lineTo(ex * k + Math.cos(a) * er * 0.45 * k, -1.4 * k + Math.sin(a) * er * 0.45 * k); ctx.stroke() }
      ctx.fillStyle = big ? '#8a8f58' : '#1a1210'; ctx.beginPath(); ctx.arc((ex + Math.sin(t * 2 + ex) * 0.4) * k, -1.2 * k, (big ? 0.9 : 1.1) * k, 0, 6.283); ctx.fill() }
    ctx.strokeStyle = shadeHex(sh, -0.3); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-5.6 * k, -4.8 * k); ctx.lineTo(-1.6 * k, -4.4 * k); ctx.moveTo(1.8 * k, -4.2 * k); ctx.lineTo(5.6 * k, -5 * k); ctx.stroke()      // heavy brows
    ctx.fillStyle = '#1a1210'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 0.7 * k, 1.8 * k, 0.5 * k, 0.9 * k, 0, 0, 6.283); ctx.fill() }                                                       // missing-nose slits
    const jaw = 1.6 + (Math.sin(t * 3 + e.wob) + 1) * 0.9 + mv * 0.6
    ctx.fillStyle = '#2a0c0c'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-4 * k, 4.2 * k); ctx.quadraticCurveTo(0, (4.6 + jaw * 2.2) * k, 4.2 * k, 4 * k); ctx.quadraticCurveTo(0, 3.2 * k, -4 * k, 4.2 * k); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#e1d9b4'; for (const [tx, th] of [[-3, 1.4], [-1.4, 1.9], [0.6, 1.5], [2.4, 1.9], [3.6, 1.2]]) { ctx.beginPath(); ctx.moveTo((tx - 0.7) * k, 3.8 * k); ctx.lineTo(tx * k, (3.8 + th) * k); ctx.lineTo((tx + 0.7) * k, 3.8 * k); ctx.fill() }
    ctx.fillStyle = 'rgba(150,200,90,.7)'; ctx.beginPath(); ctx.ellipse(2.4 * k, (5.4 + jaw * 1.6 + Math.sin(t * 4) * 0.5) * k, 0.55 * k, (1 + Math.sin(t * 4) * 0.4) * k, 0, 0, 6.283); ctx.fill()                         // drool
  }
  ctx.restore()
  arm(1, true)
  ctx.lineCap = 'butt'
}
/** Combat robot: plated body with a scanning visor, hydraulic legs and swinging pistons, venting steam, and sparks when badly damaged. */
function drawRobot(ctx: Ctx, e: Enemy, t: number, x: number, y: number, s: number, fl: boolean) {
  const F = (c: string) => fl ? '#fff' : c, k = s, ph = GAIT.ph, mv = GAIT.mv, hurt = e.hp < e.max * 0.4
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // legs: thigh piston + shin + flat foot
  for (const sd of [-1, 1]) { const q = Math.sin(ph + (sd < 0 ? 0 : Math.PI)) * mv, hx = x + sd * 4 * k, kx = hx + q * 1.4 * k, fx = hx + q * 2.6 * k, fy = y + (12.4 - Math.max(0, q) * 2.2) * k
    ctx.strokeStyle = OUT; ctx.lineWidth = 5 * k; ctx.beginPath(); ctx.moveTo(hx, y + 5 * k); ctx.lineTo(kx, y + 9 * k); ctx.lineTo(fx, fy); ctx.stroke()
    ctx.strokeStyle = F('#5b6b7c'); ctx.lineWidth = 3.2 * k; ctx.stroke(); ctx.strokeStyle = F('#aebdcb'); ctx.lineWidth = 1 * k; ctx.beginPath(); ctx.moveTo(hx, y + 5 * k); ctx.lineTo(kx, y + 9 * k); ctx.stroke()
    ctx.fillStyle = F('#3a4551'); ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(fx - 3.6 * k, fy - 0.4 * k, 7.2 * k, 2.8 * k, 1 * k); ctx.fill(); ctx.stroke() }
  // arms swing opposite the legs
  const arm = (sd: number) => { const q = Math.sin(ph + (sd < 0 ? Math.PI : 0)) * mv, sx = x + sd * 11.6 * k, sy = y - 1 * k, hx = x + sd * (13.4 + q * 0.6) * k, hy = y + (7 + q * 3) * k
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.6 * k; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = F('#8394a5'); ctx.lineWidth = 2.8 * k; ctx.stroke()
    ctx.fillStyle = F('#4a5663'); ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.roundRect(hx - 2.6 * k, hy - 1.4 * k, 5.2 * k, 4.4 * k, 1.2 * k); ctx.fill(); ctx.stroke() }
  arm(-1); arm(1)
  // torso plate + chest vents
  const tg = ctx.createLinearGradient(x - 9 * k, y - 4 * k, x + 9 * k, y + 8 * k); tg.addColorStop(0, fl ? '#fff' : '#c4d1de'); tg.addColorStop(0.5, fl ? '#fff' : '#8fa3b8'); tg.addColorStop(1, fl ? '#fff' : '#5b6d80')
  ctx.fillStyle = tg; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(x - 9.4 * k, y - 4.4 * k, 18.8 * k, 14 * k, 3.4 * k); ctx.fill(); ctx.stroke()
  if (!fl) {
    ctx.fillStyle = '#2d3640'; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.roundRect(x - 5.4 * k, y + (0.6 + q * 2.6) * k, 10.8 * k, 1.4 * k, 0.5 * k); ctx.fill() }
    ctx.fillStyle = hurt ? '#ff5a3a' : '#5be0ff'; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * (hurt ? 14 : 5) + e.wob); ctx.beginPath(); ctx.arc(x - 6.6 * k, y + 7.4 * k, 1.2 * k, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x - 9 * k, y + 5.2 * k); ctx.lineTo(x + 9 * k, y + 5.2 * k); ctx.stroke()
    ctx.fillStyle = '#7a8a9a'; for (const [rx, ry] of [[-7.4, -2.6], [7.4, -2.6], [-7.4, 8], [7.4, 8]]) { ctx.beginPath(); ctx.arc(x + rx * k, y + ry * k, 0.8 * k, 0, 6.283); ctx.fill() }
    if (hurt) { ctx.strokeStyle = '#1a1f26'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2 * k, y - 4 * k); ctx.lineTo(x + 4 * k, y + 0 * k); ctx.lineTo(x + 2.4 * k, y + 3 * k); ctx.stroke() }
  }
  // head: visor with scanning eye, antenna
  const hb = Math.sin(ph) * 0.5 * k * mv
  ctx.save(); ctx.translate(0, hb)
  const hg = ctx.createLinearGradient(x - 8 * k, y - 16 * k, x + 8 * k, y - 4 * k); hg.addColorStop(0, fl ? '#fff' : '#d3dde8'); hg.addColorStop(1, fl ? '#fff' : '#7c8ea1')
  ctx.fillStyle = hg; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(x - 8 * k, y - 15.4 * k, 16 * k, 12 * k, 4 * k); ctx.fill(); ctx.stroke()
  ctx.fillStyle = F('#14181d'); ctx.beginPath(); ctx.roundRect(x - 6.4 * k, y - 11.8 * k, 12.8 * k, 4.6 * k, 2.2 * k); ctx.fill()
  if (!fl) { const ex = Math.sin(t * 2.4 + e.wob) * 3.6 * k; const eg = ctx.createRadialGradient(x + ex, y - 9.5 * k, 0, x + ex, y - 9.5 * k, 5 * k); eg.addColorStop(0, '#ffeeee'); eg.addColorStop(0.3, hurt ? '#ffb02a' : '#ff4a3a'); eg.addColorStop(1, 'rgba(255,60,40,0)'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x + ex, y - 9.5 * k, 5 * k, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#4a5663'; ctx.beginPath(); ctx.roundRect(x - 4 * k, y - 6.4 * k, 8 * k, 2.2 * k, 0.8 * k); ctx.fill(); ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 0.8; for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(x + q * 1.5 * k, y - 6.3 * k); ctx.lineTo(x + q * 1.5 * k, y - 4.3 * k); ctx.stroke() }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - 4 * k, y - 14 * k, 3.2 * k, 0.9 * k, -0.2, 0, 6.283); ctx.fill() }
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + 3 * k, y - 15.4 * k); ctx.lineTo(x + 4.6 * k + Math.sin(t * 6 + e.wob) * 0.8 * k, y - 19.4 * k); ctx.stroke()
  ctx.fillStyle = F('#ffd04a'); ctx.beginPath(); ctx.arc(x + 4.6 * k + Math.sin(t * 6 + e.wob) * 0.8 * k, y - 20 * k, 1.8 * k, 0, 6.283); ctx.fill(); ctx.stroke()
  ctx.restore()
  if (!fl) {
    for (let q = 0; q < 2; q++) { const u = (t * 0.9 + q * 0.5 + e.wob) % 1; ctx.fillStyle = 'rgba(220,230,240,' + (0.35 * (1 - u)) + ')'; ctx.beginPath(); ctx.arc(x - 7 * k + q * 2 * k, y - 4 * k - u * 9 * k, (1.2 + u * 2.2) * k, 0, 6.283); ctx.fill() }
    if (hurt && Math.sin(t * 23 + e.wob) > 0.6) { ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 1.2; ctx.beginPath(); const sx = x + Math.sin(t * 40) * 6 * k, sy = y - 2 * k; ctx.moveTo(sx, sy); ctx.lineTo(sx + 3 * k, sy - 3 * k); ctx.lineTo(sx + 1 * k, sy - 2 * k); ctx.lineTo(sx + 4 * k, sy - 6 * k); ctx.stroke() }
  }
  ctx.lineCap = 'butt'
}
/** Cooper's Panic mode: he is literally on fire. Flame tongues lick up his body with a few drifting embers; blinks out as the effect ends. */
function fireAura(ctx: Ctx, x: number, y: number, sc: number, t: number, fade: number) {
  ctx.save(); ctx.globalAlpha = fade
  for (let i = 0; i < 11; i++) {
    // flames start at his belly and stay low, so his head and big eyes stay clear
    const d = (i - 5) / 5, bx = x + d * 13 * sc, by = y + (18 - Math.abs(d) * 3 - Math.sin(i) * 1.5) * sc
    const h = (9 + 6 * Math.abs(Math.sin(t * 12 + i * 1.9)) + (i === 5 ? 4 : 0)) * sc * (1 - Math.abs(d) * 0.2), w = (4.2 - Math.abs(d) * 1.2) * sc, sway = Math.sin(t * 9 + i * 2.3) * 2.4 * sc
    const g = ctx.createLinearGradient(bx, by, bx, by - h); g.addColorStop(0, 'rgba(255,230,120,0.95)'); g.addColorStop(0.45, 'rgba(255,140,30,0.9)'); g.addColorStop(1, 'rgba(210,40,20,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.quadraticCurveTo(bx - w * 0.8 + sway * 0.4, by - h * 0.55, bx + sway, by - h); ctx.quadraticCurveTo(bx + w * 0.8 + sway * 0.4, by - h * 0.55, bx + w, by); ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(255,250,200,0.7)'; ctx.beginPath(); ctx.moveTo(bx - w * 0.4, by); ctx.quadraticCurveTo(bx + sway * 0.4, by - h * 0.45, bx + sway * 0.6, by - h * 0.62); ctx.quadraticCurveTo(bx + w * 0.4, by - h * 0.3, bx + w * 0.4, by); ctx.closePath(); ctx.fill()
  }
  for (let i = 0; i < 6; i++) { const u = (t * 1.3 + i / 6) % 1, ex = x + Math.sin(i * 5.1 + t * 3) * 12 * sc, ey = y + (16 - u * 22) * sc; ctx.fillStyle = 'rgba(255,' + (150 + i * 15) + ',60,' + (1 - u) + ')'; ctx.beginPath(); ctx.arc(ex, ey, (1.8 - u) * sc, 0, 6.283); ctx.fill() }
  ctx.restore()
}

/** Feral Hound: a gaunt, fast zombie dog. Rapid four-leg sprint, red eyes, bared fangs, speed streaks behind it. */
function drawHound(ctx: Ctx, e: Enemy, t: number, x: number, y: number, fl: boolean) {
  const k = e.r / 8.5, ph = GAIT.ph * 1.8, F = (c: string) => fl ? '#fff' : c
  ctx.save(); ctx.translate(x, y + 2); ctx.scale(k, k); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (!fl) { ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; for (const sx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(sx, -12 - ((t * 9 + sx) % 3)); ctx.lineTo(sx, -19 - ((t * 9 + sx) % 3)); ctx.stroke() } }
  for (const [lx, ly, off] of [[-5, 7, 0], [5, 7, Math.PI], [-4.2, 2.5, Math.PI], [4.2, 2.5, 0]] as [number, number, number][]) { const q = Math.sin(ph + off) * 3; ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(lx, ly - 2); ctx.lineTo(lx + (lx < 0 ? -1 : 1) * 1.2, ly + 2 + q); ctx.stroke(); ctx.strokeStyle = F('#6d6a5e'); ctx.lineWidth = 2; ctx.stroke() }
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(7 + Math.sin(t * 14) * 3, 13, 5, 17); ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = F('#6d6a5e'); ctx.lineWidth = 1.8; ctx.stroke()
  blob(ctx, 0, 2.5, 6.4, 8.4, F('#85826f'), null)
  if (!fl) { ctx.strokeStyle = 'rgba(30,20,16,.5)'; ctx.lineWidth = 0.9; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-4.4, 0 + i * 2.2); ctx.quadraticCurveTo(0, 1 + i * 2.2, 4.4, 0 + i * 2.2); ctx.stroke() }
    ctx.fillStyle = 'rgba(120,20,20,.55)'; ctx.beginPath(); ctx.ellipse(2.6, 5.4, 1.8, 1.3, 0.4, 0, 6.283); ctx.fill() }
  for (const sx of [-1, 1]) { ctx.fillStyle = F('#4c493f'); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx * 3.4, -8.4); ctx.lineTo(sx * 7.6, -13.2); ctx.lineTo(sx * 6.2, -6.4); ctx.closePath(); ctx.fill(); ctx.stroke() }
  blob(ctx, 0, -5.6, 5.8, 5.2, F('#8f8c78'), null)
  blob(ctx, 0, -2.2, 3.6, 3, F('#a7a48d'), null)
  if (!fl) {
    ctx.fillStyle = '#2a0a0a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -0.4 + Math.sin(t * 16) * 0.5, 3, 1.7 + Math.abs(Math.sin(t * 16)) * 0.6, 0, 0, 6.283); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#f2ecd0'; for (const fx of [-2.2, 2.2]) { ctx.beginPath(); ctx.moveTo(fx - 0.7, -1.2); ctx.lineTo(fx, 1.2); ctx.lineTo(fx + 0.7, -1.2); ctx.fill() }
    for (const sx of [-1, 1]) { ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.moveTo(sx * 1.4, -6.4); ctx.lineTo(sx * 4.6, -7.6); ctx.lineTo(sx * 4, -4.8); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,60,40,.35)'; ctx.beginPath(); ctx.arc(sx * 3.2, -6, 3.4, 0, 6.283); ctx.fill() }
  }
  ctx.restore(); ctx.lineCap = 'butt'
}
/** Missile Bot: slow, armoured, tracked. Two shoulder pods glow before a launch, so you have a moment to get out of the way. */
function drawLauncher(ctx: Ctx, e: Enemy, t: number, x: number, y: number, fl: boolean) {
  const k = e.r / 14, charge = e.cd < 0.9 && e.cd > 0, F = (c: string) => fl ? '#fff' : c, roll = GAIT.ph * 2
  ctx.save(); ctx.translate(x, y + 4); ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  for (const sx of [-1, 1]) { ctx.fillStyle = F('#3b4048'); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(sx * 9 - 5, 4, 10, 15, 4); ctx.fill(); ctx.stroke()
    if (!fl) { ctx.strokeStyle = '#1f2328'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const yy = 6 + ((i * 3.6 + roll * 3) % 12); ctx.beginPath(); ctx.moveTo(sx * 9 - 4, yy); ctx.lineTo(sx * 9 + 4, yy); ctx.stroke() } } }
  const bg = ctx.createLinearGradient(-13, -8, 13, 12); bg.addColorStop(0, fl ? '#fff' : '#9aa77a'); bg.addColorStop(0.55, fl ? '#fff' : '#6b7a52'); bg.addColorStop(1, fl ? '#fff' : '#454f36')
  ctx.fillStyle = bg; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-12.5, -7, 25, 21, 5); ctx.fill(); ctx.stroke()
  if (!fl) { ctx.fillStyle = '#e0b02a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-9 + i * 4.2, 9); ctx.lineTo(-6.6 + i * 4.2, 9); ctx.lineTo(-8.4 + i * 4.2, 13); ctx.lineTo(-10.8 + i * 4.2, 13); ctx.fill() }   // hazard stripes
    ctx.fillStyle = '#7a8a9a'; for (const [rx, ry] of [[-10, -5], [10, -5], [-10, 11], [10, 11]]) { ctx.beginPath(); ctx.arc(rx, ry, 1, 0, 6.283); ctx.fill() } }
  for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * 11, -7); ctx.rotate(sx * 0.35)
    ctx.fillStyle = F('#4a525c'); ctx.beginPath(); ctx.roundRect(-5, -15, 10, 17, 3); ctx.fill(); ctx.stroke()
    ctx.fillStyle = fl ? '#fff' : charge ? '#ffe45a' : '#ff7a2a'; for (const q of [-2, 2]) { ctx.beginPath(); ctx.arc(q, -13, 2.1, 0, 6.283); ctx.fill(); ctx.stroke() }
    if (charge && !fl) { ctx.fillStyle = 'rgba(255,200,60,' + (0.3 + 0.3 * Math.sin(t * 40)) + ')'; ctx.beginPath(); ctx.arc(0, -13, 7, 0, 6.283); ctx.fill() }
    ctx.restore() }
  ctx.fillStyle = F('#aab4a0'); ctx.beginPath(); ctx.roundRect(-7, -15, 14, 10, 4); ctx.fill(); ctx.stroke()
  if (!fl) { const ex = Math.sin(t * 1.8 + e.wob) * 2.4; ctx.fillStyle = '#14181d'; ctx.beginPath(); ctx.roundRect(-5.4, -12.6, 10.8, 4.4, 2); ctx.fill()
    const eg = ctx.createRadialGradient(ex, -10.4, 0, ex, -10.4, 4); eg.addColorStop(0, '#fff2d0'); eg.addColorStop(0.35, charge ? '#ffd84a' : '#ff5a3a'); eg.addColorStop(1, 'rgba(255,80,40,0)'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, -10.4, 4, 0, 6.283); ctx.fill()
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(5, -15); ctx.lineTo(7, -20); ctx.stroke(); ctx.fillStyle = '#c9d0c0'; ctx.beginPath(); ctx.ellipse(7, -21, 3.2, 1.4, Math.sin(t * 3) * 0.6, 0, 6.283); ctx.fill() }
  ctx.restore(); ctx.lineCap = 'butt'
}
const ES = new WeakMap<Enemy, { x: number; y: number; t: number; vx: number; ph: number }>()
const GAIT = { ph: 0, mv: 0 }
/** One enemy standing still, for the codex. `drake` picks the boss dragon. */
export function drawEnemyPortrait(ctx: Ctx, kind: Enemy['kind'], x: number, y: number, t: number, drake = 0) {
  const r = kind === 'boss' ? 24 : kind === 'launcher' ? 14 : kind === 'runner' ? 8 : kind === 'robot' ? 13 : kind === 'zombie' ? 11 : 12
  const e = { x, y, hp: 1, max: 1, spd: 0, r, kind, flash: 0, wob: 1.3, dmg: 0, cd: 1, ...(kind === 'boss' ? { drake } : {}) } as Enemy
  ES.delete(e); GAIT.ph = t * 2; GAIT.mv = 0.25
  if (kind === 'boss') { drawDragon(ctx, e, t, x, y, false); return }
  drawEnemy(ctx, e, t)
}
/** Biome skin: each enemy picks up its stage's look (moss, sand, seaweed and salt, embers, frost, swamp mud). Drawn over the body, same transform. */
function drawBiomeSkin(ctx: Ctx, e: Enemy, x: number, y: number, s: number, fl: boolean) {
  if (fl) return
  const b = biomeIndex(G.stage), seed = e.wob || 0
  const dots = (col: string, n: number, rx: number, ry: number, cy: number, r: number) => {
    ctx.fillStyle = col
    for (let i = 0; i < n; i++) { const a = seed * 7 + i * 2.399; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rx * s, y + cy * s + Math.sin(a * 1.7) * ry * s, r * s, 0, 6.283); ctx.fill() }
  }
  ctx.save()
  switch (b) {
    case 0: ctx.globalAlpha = 0.85; dots('#5c9a4a', 4, 6, 6, -4, 1.6); break // forest: moss
    case 1: ctx.globalAlpha = 0.35; ctx.fillStyle = '#e8c98a'; ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 11 * s, 12 * s, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 0.8; dots('#f3dfb0', 4, 8, 9, 0, 1); break // desert: sand dust
    case 2: ctx.globalAlpha = 0.85; ctx.strokeStyle = '#2f9a8c'; ctx.lineWidth = 1.6 * s; for (let i = 0; i < 3; i++) { const ox = x + (i - 1) * 5 * s; ctx.beginPath(); ctx.moveTo(ox, y + 4 * s); ctx.quadraticCurveTo(ox + 2 * s, y + 10 * s, ox - s, y + 14 * s); ctx.stroke() } dots('#ffffff', 3, 7, 6, -2, 0.8); break // tideline: seaweed and salt
    case 3: ctx.globalAlpha = 0.9; dots('#ff9a3a', 4, 8, 9, 0, 1.1); ctx.strokeStyle = '#ff6a2a'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.arc(x, y, 10 * s, 0, 6.283); ctx.stroke(); break // badlands: embers
    case 4: ctx.globalAlpha = 0.5; ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.ellipse(x, y - 2 * s, 9 * s, 10 * s, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 0.9; dots('#ffffff', 5, 9, 10, 0, 1); break // snowfield: frost
    case 5: ctx.globalAlpha = 0.8; dots('#6b8a3a', 4, 7, 8, 2, 1.8); ctx.fillStyle = '#4f3d28'; ctx.beginPath(); ctx.ellipse(x, y + 8 * s, 9 * s, 3 * s, 0, 0, 6.283); ctx.fill(); break // swamp: mud
  }
  ctx.restore()
}

function drawEnemy(ctx: Ctx, e: Enemy, t: number) {
  const st = ES.get(e) ?? { x: e.x, y: e.y, t, vx: 0, ph: e.wob }, dtE = Math.max(0.001, Math.min(0.1, t - st.t))
  st.vx += (((e.x - st.x) / dtE) - st.vx) * 0.2; const mv = Math.min(1, Math.hypot(e.x - st.x, e.y - st.y) / dtE / 30)
  st.ph += dtE * (4 + mv * 5); st.x = e.x; st.y = e.y; st.t = t; ES.set(e, st); GAIT.ph = st.ph; GAIT.mv = e.dug ? 0 : Math.max(0.25, mv)
  const s = e.r / 11, wob = e.dug ? Math.sin(t * 2 + e.wob) * 0.6 : Math.abs(Math.sin(st.ph)) * -1.8 * GAIT.mv, x = e.x, y = e.y + wob;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, e.y + 11 * s, 10 * s, 3.5 * s, 0, 0, 6.283); ctx.fill();
  const fl = e.flash > 0;
  const lean = e.dug ? 0 : Math.max(-0.22, Math.min(0.22, st.vx * 0.008)) + Math.sin(st.ph) * 0.07 * GAIT.mv + (fl ? -0.12 : 0)
  ctx.save(); ctx.translate(x, e.y + 11 * s); ctx.rotate(lean); ctx.scale(fl ? 1.06 : 1, fl ? 0.94 : 1); ctx.translate(-x, -(e.y + 11 * s))
  if (e.kind === 'boss' && e.drake !== undefined) { drawDragon(ctx, e, t, x, y, fl) }
  else if (e.kind === 'gunner' || e.kind === 'mortar') {
    const hot = e.kind === 'mortar' ? e.cd < 0.7 : e.cd < 0.35
    if (e.kind === 'mortar') { ctx.save(); ctx.translate(x, y - 8 * s); ctx.rotate(-0.25); ctx.fillStyle = fl ? '#fff' : '#3a414b'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-4, -20, 8, 22, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = hot ? '#ffb347' : '#ff7a2a'; ctx.fillRect(-4, -20, 8, 4); ctx.restore() }
    blob(ctx, x, y + 5 * s, 9 * s, 7 * s, fl ? '#fff' : e.kind === 'mortar' ? '#7a6a9a' : '#8fa3b8', fl ? null : e.kind === 'mortar' ? '#574a76' : '#6a7d92')
    ctx.fillStyle = fl ? '#fff' : '#a9bbcf'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 11 * s, y - 13 * s, 22 * s, 17 * s, 5 * s); ctx.fill(); ctx.stroke()
    ctx.fillStyle = hot ? '#fff36a' : '#ff5a4a'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * 5 * s, y - 6 * s, 3 * s, 0, 6.283); ctx.fill(); ctx.stroke() }
    if (!fl) {
      ctx.fillStyle = e.kind === 'mortar' ? '#5a4a7a' : '#5b6b7c'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x - 11.5 * s, y - 12 * s); ctx.quadraticCurveTo(x, y - 21 * s, x + 11.5 * s, y - 12 * s); ctx.lineTo(x + 9 * s, y - 10 * s); ctx.lineTo(x - 9 * s, y - 10 * s); ctx.closePath(); ctx.fill(); ctx.stroke()   // helmet
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(x - 4 * s, y - 16 * s, 3.4 * s, 1.1 * s, -0.3, 0, 6.283); ctx.fill()
      ctx.fillStyle = '#7a8a9a'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * 9 * s, y + 0 * s, 0.9 * s, 0, 6.283); ctx.fill() }                                          // rivets
      ctx.fillStyle = '#4a5663'; ctx.beginPath(); ctx.roundRect(x - 6 * s, y - 0.5 * s, 12 * s, 3 * s, 1 * s); ctx.fill()                                                                // mouth guard
      ctx.fillStyle = '#c9a63a'; ctx.strokeStyle = OUT; ctx.lineWidth = 0.9; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.roundRect(x + k * 3.6 * s - 1.2 * s, y + 6 * s, 2.4 * s, 4 * s, 0.6 * s); ctx.fill(); ctx.stroke() }   // ammo belt
    }
    if (e.kind === 'gunner') { ctx.fillStyle = '#3a414b'; ctx.beginPath(); ctx.roundRect(x - 3, y + 2 * s, 6, 14 * s, 2); ctx.fill(); ctx.stroke(); if (hot) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x, y + 16 * s, 3.5, 0, 6.283); ctx.fill() } }
  } else if (e.kind === 'runner') { drawHound(ctx, e, t, x, y, fl)
  } else if (e.kind === 'launcher') { drawLauncher(ctx, e, t, x, y, fl)
  } else if (e.kind === 'robot') { drawRobot(ctx, e, t, x, y, s, fl)
  } else { drawZombie(ctx, e, t, x, y, s, fl) }
  if (e.kind !== 'boss') drawBiomeSkin(ctx, e, x, e.y + 0, s, fl)
  ctx.restore()
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
export const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }
export const icons: Record<string, Icon> = {
  bolt: (c, x, y, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x + 2, y - 8); c.lineTo(x - 6, y + 2); c.lineTo(x - 1, y + 2); c.lineTo(x - 3, y + 8); c.lineTo(x + 6, y - 3); c.lineTo(x + 1, y - 3); c.closePath(); c.fill() },
  speaker: (c, x, y, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - 7, y - 3); c.lineTo(x - 3, y - 3); c.lineTo(x + 2, y - 7); c.lineTo(x + 2, y + 7); c.lineTo(x - 3, y + 3); c.lineTo(x - 7, y + 3); c.closePath(); c.fill(); c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round'
    if (!Audio_.muted) { c.beginPath(); c.arc(x + 2, y, 5, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(x + 2, y, 9, -0.8, 0.8); c.stroke() }
    else { c.beginPath(); c.moveTo(x + 5, y - 4); c.lineTo(x + 11, y + 4); c.moveTo(x + 11, y - 4); c.lineTo(x + 5, y + 4); c.stroke() } },
  merge: (c, x, y, col) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round'
    c.beginPath(); c.moveTo(x - 9, y - 6); c.lineTo(x - 2, y); c.lineTo(x - 9, y + 6); c.stroke(); c.beginPath(); c.moveTo(x + 9, y - 6); c.lineTo(x + 2, y); c.lineTo(x + 9, y + 6); c.stroke() },
  coin: (c, x, y, col) => { const g = c.createRadialGradient(x - 2, y - 2, 1, x, y, 7); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.45, col); g.addColorStop(1, '#c47a10'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 6.5, 0, 6.283); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); c.strokeStyle = 'rgba(160,90,10,.7)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 4, 0, 6.283); c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(x - 2.4, y - 2.6, 1.2, 0, 6.283); c.fill() },
  tank: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 9, y - 7); c.lineTo(x + 9, y - 7); c.lineTo(x + 9, y + 3); c.lineTo(x, y + 10); c.lineTo(x - 9, y + 3); c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x - 6, y - 4, 12, 2.5); c.fillRect(x - 6, y, 12, 2.5) },
  panic: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 4, y - 10); c.lineTo(x + 4, y - 10); c.lineTo(x + 2, y + 2); c.lineTo(x - 2, y + 2); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(x, y + 7, 2.8, 0, 6.283); c.fill(); c.stroke() },
  nade: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y + 2, 8, 0, 6.283); c.fill(); c.stroke(); c.fillRect(x - 3, y - 8, 6, 4); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 3, y - 7); c.lineTo(x + 8, y - 9); c.stroke() },
  shield: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 8, y - 8); c.lineTo(x + 8, y - 8); c.lineTo(x + 8, y + 1); c.quadraticCurveTo(x + 8, y + 8, x, y + 10); c.quadraticCurveTo(x - 8, y + 8, x - 8, y + 1); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x, y + 7); c.stroke() },
  frenzy: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; for (const dx of [-5, 3]) { c.beginPath(); c.moveTo(x + dx - 4, y - 8); c.lineTo(x + dx + 5, y); c.lineTo(x + dx - 4, y + 8); c.lineTo(x + dx - 1, y); c.closePath(); c.fill(); c.stroke() } },
  collar: (c, x, y, col) => { c.strokeStyle = col; c.lineWidth = 3.4; c.beginPath(); c.ellipse(x, y, 8, 5.5, 0, 0, 6.283); c.stroke(); c.fillStyle = '#ffd84a'; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y + 6.5, 3, 0, 6.283); c.fill(); c.stroke() },
  vest: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 7, y - 8); c.lineTo(x - 3, y - 8); c.lineTo(x, y - 4); c.lineTo(x + 3, y - 8); c.lineTo(x + 7, y - 8); c.lineTo(x + 8, y + 8); c.lineTo(x - 8, y + 8); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x, y + 8); c.stroke() },
  charm: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x - 6, y - 3, 3, 0, 6.283); c.arc(x - 6, y + 3, 3, 0, 6.283); c.arc(x + 6, y - 3, 3, 0, 6.283); c.arc(x + 6, y + 3, 3, 0, 6.283); c.fill(); c.fillRect(x - 6, y - 2.5, 12, 5); c.stroke() },
  sword: (c, x, y, col) => { c.save(); c.translate(x, y); c.rotate(0.785); c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -11); c.lineTo(3, -7); c.lineTo(3, 4); c.lineTo(-3, 4); c.lineTo(-3, -7); c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-1.2, -7, 1.6, 10); c.fillStyle = col; c.fillRect(-6, 4, 12, 3); c.strokeRect(-6, 4, 12, 3); c.fillRect(-1.8, 7, 3.6, 5); c.beginPath(); c.arc(0, 13, 2.4, 0, 6.283); c.fill(); c.stroke(); c.restore() },
  gem: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 7, y - 3); c.lineTo(x - 3, y - 8); c.lineTo(x + 3, y - 8); c.lineTo(x + 7, y - 3); c.lineTo(x, y + 8); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(x - 7, y - 3); c.lineTo(x + 7, y - 3); c.stroke() },
  star: (c, x, y, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 4 : 9; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) } c.closePath(); c.fill(); c.stroke() },
  plus: (c, x, y, col) => { c.strokeStyle = col; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.stroke() },
}
interface BtnOpts { top: string; bot: string; label?: string; icon?: string; disabled?: boolean; size?: number; sub?: string; round?: boolean; shine?: boolean; glow?: boolean }
/** Modern pill button: vertical gradient, soft drop shadow, top gloss, press-down state. Registers its hit rect. */
/** Outlined cartoon text: dark stroke under the fill so it reads on any background. */
export function outText(ctx: Ctx, txt: string, x: number, y: number, fill: string, lw = 3, stroke = OUT) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y); ctx.fillStyle = fill; ctx.fillText(txt, x, y); ctx.restore()
}
/** Chunky panel: dark fill, thick outline, soft inner highlight. */
export function plate(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, top = '#2d4252', bot = '#17252f') {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 3
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bot)
  ctx.fillStyle = g; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.restore()
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; rr(ctx, x, y, w, h, r); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; rr(ctx, x + 2.2, y + 2.2, w - 4.4, h - 4.4, Math.max(2, r - 2)); ctx.stroke()
}
// coach tip: one bubble at a time, pointing at the next button to press. Waits while a menu is open.
function drawCoachTip(ctx: Ctx, t: number) {
  const now = performance.now(), busy = !!(R.screen || R.quests || R.rebirth || G.pick || G.wipe || G.away || R.tour !== null || R.tourAsk || G.raid)
  R.coachBox = null; R.coachX = null
  if (busy) { R.coach = null; return }
  if (R.coach && !(coachTips().find(x => x.id === R.coach!.id)?.when() ?? false)) { G.tipsSeen[R.coach.id] = 1; R.coach = null } // the player acted: done
  // buy and merge (sticky) stay until the player acts
  else if (R.coach && now - R.coach.start > 7000 && !coachTips().find(x => x.id === R.coach!.id)?.sticky) { const pt = coachTips().find(x => x.id === R.coach!.id); if (pt?.persist) coachCool[R.coach.id] = now; else G.tipsSeen[R.coach.id] = 1; R.coach = null }
  if (!R.coach) { const nx = nextTip(); if (nx) R.coach = { id: nx.id, text: nx.text, target: nx.target, start: now } }
  if (!R.coach) return
  const c = R.coach, hot = !!coachTips().find(x => x.id === c.id)?.persist // buy and merge: big, gold, hard to miss
  const fs = hot ? 15 : 12, lh = hot ? 20 : 16, pad = hot ? 9 : 7
  const font = '400 ' + fs + 'px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
  ctx.font = font; const maxW = hot ? 300 : 290, words = c.text.split(' '), lines: string[] = []
  let cur = ''; for (const w of words) { const tryS = cur ? cur + ' ' + w : w; if (ctx.measureText(tryS).width > maxW && cur) { lines.push(cur); cur = w } else cur = tryS }
  if (cur) lines.push(cur)
  const bw = Math.min(W - 24, Math.max(...lines.map(l => ctx.measureText(l).width)) + (hot ? 36 : 28)), bh = lines.length * lh + (hot ? 18 : 14)
  const tg = c.target ? R.btns[c.target] : undefined
  let x = tg ? tg.x + tg.w / 2 - bw / 2 : W / 2 - bw / 2, y = tg ? tg.y - bh - 12 : ACTION_BAR.y - bh - 10
  if (tg && y < ARENA.y0) y = tg.y + tg.h + 10
  x = Math.max(12, Math.min(W - 12 - bw, x))
  if (tg) { const k = 0.5 + 0.5 * Math.sin(t * 5); ctx.strokeStyle = 'rgba(255,216,74,' + (0.45 + 0.5 * k) + ')'; ctx.lineWidth = hot ? 4 : 3; ctx.beginPath(); ctx.roundRect(tg.x - 4, tg.y - 4, tg.w + 8, tg.h + 8, 12); ctx.stroke()
    if (hot) { ctx.strokeStyle = 'rgba(255,216,74,' + (0.25 + 0.35 * k) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(tg.x - 11, tg.y - 11, tg.w + 22, tg.h + 22, 16); ctx.stroke() } }
  if (hot) plate(ctx, x, y, bw, bh, 12, '#ffe27a', '#e8961a'); else glass(ctx, x, y, bw, bh, 12)
  ctx.fillStyle = hot ? '#2a1400' : '#ffd9a0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  lines.forEach((l, i) => ctx.fillText(l, x + bw / 2, y + pad + lh / 2 + i * lh))
  ctx.textBaseline = 'alphabetic'
  R.coachBox = { x, y, w: bw, h: bh }
  // small X in the top-right corner: dismisses the tip without acting on it
  const xc = { x: x + bw - 11, y: y + 11 }
  ctx.fillStyle = 'rgba(40,20,0,.8)'; ctx.beginPath(); ctx.arc(xc.x, xc.y, 8, 0, 6.283); ctx.fill()
  ctx.strokeStyle = hot ? '#fff3c4' : '#ffd9a0'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(xc.x - 3.5, xc.y - 3.5); ctx.lineTo(xc.x + 3.5, xc.y + 3.5); ctx.moveTo(xc.x + 3.5, xc.y - 3.5); ctx.lineTo(xc.x - 3.5, xc.y + 3.5); ctx.stroke()
  R.coachX = { x: xc.x - 12, y: xc.y - 12, w: 24, h: 24 }
}

/** Explainer card at the top of the arena. Stays until tapped or read long enough; the queue shows one at a time. */
function drawNote(ctx: Ctx, _t: number) {
  const n = notes[0], now = performance.now()
  const busy = !!(R.screen || R.quests || R.rebirth || G.pick || G.wipe || G.away || R.tour !== null || R.tourAsk || G.raid || R.chestMoment || R.gearIntro || R.freshAsk)
  noteBox.r = null
  if (!n) return
  if (busy) { n.at = undefined; return }                  // paused while a menu is open, so it's not missed
  if (n.at === undefined) n.at = now
  if ((now - n.at) / 1000 > noteHoldS(n)) { notes.shift(); return }
  ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
  const bw = 290, x = 12, y = ARENA.y0 + 30               // left of the flank and stash chips on the right
  const maxW = bw - 28, words = n.text.split(' '), lines: string[] = []
  let cur = ''; for (const w of words) { const tryS = cur ? cur + ' ' + w : w; if (ctx.measureText(tryS).width > maxW && cur) { lines.push(cur); cur = w } else cur = tryS }
  if (cur) lines.push(cur)
  const lh = 17, bh = 26 + lines.length * lh + 16
  glass(ctx, x, y, bw, bh, 12)
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.font = '400 11px ' + FONT; ctx.fillStyle = '#ffd84a'; ctx.fillText(n.title.toUpperCase(), x + 14, y + 13)
  ctx.font = '400 13px ' + FONT; ctx.fillStyle = '#fff6d8'; lines.forEach((l, i) => ctx.fillText(l, x + 14, y + 27 + i * lh))
  ctx.textAlign = 'right'; ctx.font = '400 9.5px ' + FONT; ctx.fillStyle = '#9fb8aa'; ctx.fillText(notes.length > 1 ? 'TAP TO CONTINUE (' + (notes.length - 1) + ' more)' : 'TAP TO CLOSE', x + bw - 12, y + bh - 10)
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  noteBox.r = { x, y, w: bw, h: bh }
}

export function button(ctx: Ctx, key: string, x: number, y: number, w: number, h: number, o: BtnOpts) {
  R.btns[key] = { x, y, w, h }
  const down = R.pressed === key, dy = down ? 2.5 : 0, rad = o.round ? h / 2 : Math.min(14, h / 2.2), lip = down ? 1 : 4, fh = h - 4
  const top = o.disabled ? '#6a767d' : o.top, bot = o.disabled ? '#434d54' : o.bot
  ctx.save()
  // drop shadow + dark bottom lip gives the button depth
  if (!down) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 3 }
  ctx.fillStyle = OUT; rr(ctx, x, y + lip + dy, w, fh, rad); ctx.fill(); ctx.shadowColor = 'transparent'
  ctx.fillStyle = o.disabled ? '#2c353b' : bot; rr(ctx, x + 1.5, y + 1.5 + lip + dy, w - 3, fh - 3, rad - 1); ctx.fill()
  const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + fh - 3); g.addColorStop(0, top); g.addColorStop(1, bot)
  ctx.fillStyle = g; rr(ctx, x + 1.5, y + 1.5 + dy, w - 3, fh - 3, rad - 1); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.17)'; rr(ctx, x + 4, y + 3.5 + dy, w - 8, fh * 0.32, rad - 3); ctx.fill()
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; rr(ctx, x + 1.2, y + 1.2 + dy, w - 2.4, fh - 2.4, rad); ctx.stroke()
  if (down) { ctx.fillStyle = 'rgba(0,0,0,.16)'; rr(ctx, x + 1.5, y + 1.5 + dy, w - 3, fh - 3, rad - 1); ctx.fill() }
  if (o.shine && !o.disabled) { // idle shine sweep: a soft diagonal glint crosses the button every ~2.5s
    const ph = (performance.now() / 1000 % 2.6) / 0.7
    if (ph < 1) { ctx.save(); rr(ctx, x + 1.5, y + 1.5 + dy, w - 3, fh - 3, rad - 1); ctx.clip(); const sx = x - 30 + (w + 60) * ph; ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + 14, y); ctx.lineTo(sx - 6, y + h); ctx.lineTo(sx - 20, y + h); ctx.closePath(); ctx.fill(); ctx.restore() }
  }
  if (o.glow && !o.disabled) { // actionable: a soft pulsing rim in the button's own colour
    const p = 0.5 + 0.5 * Math.sin(performance.now() / 450)
    ctx.save(); ctx.shadowColor = o.top; ctx.shadowBlur = 10 + 10 * p; ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.4 * p).toFixed(2) + ')'; ctx.lineWidth = 3; rr(ctx, x + 1.5, y + 1.5 + dy, w - 3, fh - 3, rad); ctx.stroke(); ctx.restore()
  }
  const col = o.disabled ? 'rgba(255,255,255,.6)' : '#fff', cy = y + dy + fh / 2 + 0.5
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '400 ' + (o.size || 13) + 'px ' + FONT
  const tw = o.label ? ctx.measureText(o.label).width : 0, iw = o.icon ? 20 : 0, gap = o.icon && o.label ? 6 : 0, total = tw + iw + gap
  let cx = x + w / 2 - total / 2
  if (o.icon) { icons[o.icon](ctx, cx + iw / 2, cy, col); cx += iw + gap }
  if (o.label) outText(ctx, o.label, cx + tw / 2, cy + 0.5, col, 3)
  ctx.restore()
}
export function glass(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) { plate(ctx, x, y, w, h, r, '#2a3d4b', '#142029') }
export const fmt = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.floor(n).toString();

export function render(ctx: Ctx, t: number) {
  R.btns = {} // rebuilt every frame: a button from a closed modal must never stay tappable
  ctx.save();
  if (R.shake > 0.3) ctx.translate(rnd(-R.shake, R.shake), rnd(-R.shake, R.shake));
  drawBackground(ctx, t);
  { const vg = ctx.createRadialGradient(W / 2, (ARENA.y0 + ARENA.y1) / 2, 140, W / 2, (ARENA.y0 + ARENA.y1) / 2, 330); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.38)'); ctx.fillStyle = vg; ctx.fillRect(0, ARENA.y0 - 4, W, ARENA.y1 - ARENA.y0 + 8) }
  for (const h of G.hazards) drawHazard(ctx, h, t);
  if (G.hold) drawHold(ctx, G.hold.x, G.hold.y, t);
  // sort-by-y entities
  for (const c of R.scorch) { const a = Math.min(0.4, (6 - c.t) / 6 * 0.45); const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r * 0.6); g.addColorStop(0, 'rgba(15,10,8,' + a + ')'); g.addColorStop(1, 'rgba(15,10,8,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * 0.6, c.r * 0.42, 0, 0, 6.283); ctx.fill() }
  const ents: { y: number; d: () => void }[] = [];
  for (const c of G.cover) ents.push({ y: c.y + c.h / 2, d: () => drawCover(ctx, c, t) });
  for (const e of G.enemies) ents.push({ y: e.y, d: () => { drawEnemy(ctx, e, t); if (DRAW.enemy.length) drawAll(DRAW.enemy, ctx, e, t) } });
  const n = unlockedGuardians(G.stage), ws = sortedWeapons();
  for (let i = 0; i < n; i++) { const gp = guardianPos(i); const firing = ws[i] !== undefined && G.cd[i] > 1 / WEAPONS[ws[i]].rate - 0.08; const tgt = G.enemies[0]; ents.push({ y: gp.y, d: () => { if (G.hp[i] <= 0) ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 5); const sc = dogScale(i); ctx.save(); ctx.translate(gp.x, gp.y + 15); ctx.scale(sc, sc); ctx.translate(-gp.x, -(gp.y + 15)); drawDog(ctx, GUARDIANS[i], gp.x, gp.y, t, firing, tgt); const wl = ws[i]; if (wl !== undefined && G.hp[i] > 0) drawHeld(ctx, wl, gp.x, gp.y, tgt, firing, t, GUARDIANS[i]); ctx.restore(); ctx.globalAlpha = 1
    if (G.hp[i] > 0 && G.shieldT > 0) { const k = G.shieldT < 1.2 ? 0.5 + 0.5 * Math.sin(t * 24) : 1, rr0 = 22 * dogScale(i); ctx.fillStyle = 'rgba(110,190,255,' + 0.18 * k + ')'; ctx.strokeStyle = 'rgba(170,225,255,' + 0.9 * k + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gp.x, gp.y + 2, rr0, 0, 6.283); ctx.fill(); ctx.stroke() }
    if (G.hp[i] > 0 && i === 0 && G.tankT > 0) { const k = G.tankT < 1.2 ? 0.5 + 0.5 * Math.sin(t * 24) : 1; ctx.strokeStyle = 'rgba(150,235,160,' + 0.95 * k + ')'; ctx.fillStyle = 'rgba(90,200,110,' + 0.16 * k + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(gp.x, gp.y + 2, 26 * dogScale(i), 0, 6.283); ctx.fill(); ctx.stroke() }
    if (G.hp[i] > 0 && i === 1 && G.panicT > 0) fireAura(ctx, gp.x, gp.y, dogScale(i), t, G.panicT < 1.2 ? 0.5 + 0.5 * Math.sin(t * 24) : 1)
    if (G.hp[i] > 0 && G.frenzyT > 0) { ctx.fillStyle = 'rgba(255,190,60,' + (0.25 + 0.15 * Math.sin(t * 18)) + ')'; ctx.beginPath(); ctx.ellipse(gp.x, gp.y + 15, 16 * dogScale(i), 6, 0, 0, 6.283); ctx.fill() } } }); }
  ents.sort((a, b) => a.y - b.y).forEach(o => { ctx.save(); try { o.d() } catch (e) { if (!R.errLogged) { R.errLogged = true; console.error("entity draw", e); trackError(String(e), "entity draw") } } ctx.restore() });
  if (G.crate) { // supply crate: bobbing chest with a shrinking timer ring; tap it
    const c = G.crate, bob = Math.sin(t * 5) * 3, f = c.t / 9, blink = c.t < 2.5 && Math.sin(t * 22) > 0
    if (!blink) {
      ctx.save(); ctx.translate(c.x, c.y + bob)
      ctx.strokeStyle = 'rgba(255,216,74,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + f * 6.283); ctx.stroke()
      ctx.fillStyle = 'rgba(255,216,74,' + (0.18 + 0.1 * Math.sin(t * 6)) + ')'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, 6.283); ctx.fill()
      ctx.fillStyle = OUT; rr(ctx, -15, -11, 30, 24, 5); ctx.fill()
      const g = ctx.createLinearGradient(0, -9, 0, 11); g.addColorStop(0, '#ffcf5a'); g.addColorStop(1, '#c4761c'); ctx.fillStyle = g; rr(ctx, -13, -9, 26, 20, 4); ctx.fill()
      ctx.fillStyle = '#7a4412'; ctx.fillRect(-13, -1, 26, 3); ctx.fillStyle = '#ffe9a0'; rr(ctx, -3, -3, 6, 7, 2); ctx.fill()
      ctx.font = '400 9px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; outText(ctx, 'TAP', 0, -20, '#fff', 3)
      ctx.restore()
    }
  }
  for (const s of G.shots) drawShot(ctx, s);
  if (DRAW.world.length) drawAll(DRAW.world, ctx, t);
  for (const g of G.nades) { // lobbed grenade: target ring + arcing ball
    const f = g.t / g.dur, x = g.x + (g.tx - g.x) * f, y = g.y + (g.ty - g.y) * f, hgt = Math.sin(f * Math.PI) * 60
    ctx.strokeStyle = 'rgba(255,150,60,' + (0.35 + 0.35 * Math.sin(t * 20)) + ')'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(g.tx, g.ty, g.r, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.5, 0, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#4b5a3a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y - hgt, 5.5, 0, 6.283); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 1.5, y - hgt - 8, 3, 3)
  }
  drawShells(ctx, G.shells, t); drawMissiles(ctx, G.missiles, t); drawEBullets(ctx, G.ebullets);
  for (let i = 0; i < n; i++) { const gp = guardianPos(i); drawStatus(ctx, gp.x, gp.y - (dogScale(i) - 1) * 30, G.status[i]) }
  for (let i = 0; i < n; i++) { // floating health bar over each guardian
    const gp = guardianPos(i), f = Math.max(0, G.hp[i] / G.mhp[i]), w = 26 + (dogScale(i) - 1) * 24, yo = 28 + (dogScale(i) - 1) * 30
    ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, gp.x - w / 2, gp.y - yo, w, 5, 2.5); ctx.fill()
    if (f > 0) { ctx.fillStyle = f > 0.35 ? '#5be07f' : '#ff6a5a'; rr(ctx, gp.x - w / 2 + 0.5, gp.y - yo + 0.5, Math.max(2, (w - 1) * f), 4, 2); ctx.fill() }
  }
  for (const b of R.blasts) { // explosion: flash, expanding fireball, shockwave, rising smoke, flying sparks
    const k = b.t / b.life, eo = 1 - Math.pow(1 - Math.min(1, k * 2.4), 3), r = b.r, hue = b.col
    ctx.save()
    for (let i = 0; i < 7; i++) { const a = b.seed + i * 0.9, d = 0.25 + 0.5 * ((i * 37) % 10) / 10, sk = Math.max(0, k - 0.28 - i * 0.015); if (sk <= 0) continue
      const px = b.x + Math.cos(a) * r * d * (0.4 + sk), py = b.y + Math.sin(a) * r * d * 0.6 * (0.4 + sk) - sk * r * 0.7, pr = r * (0.16 + 0.22 * sk)
      ctx.fillStyle = 'rgba(' + (hue ? '70,60,70' : '58,48,42') + ',' + 0.38 * (1 - k) * Math.min(1, sk * 6) + ')'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.283); ctx.fill() }
    if (k < 0.7) { const fr = r * (0.4 + 0.8 * eo), a = 1 - k / 0.7, g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, fr)
      g.addColorStop(0, 'rgba(255,255,235,' + a + ')'); g.addColorStop(0.35, hue ? hue + 'ee' : 'rgba(255,200,70,' + a * 0.95 + ')'); g.addColorStop(0.75, hue ? hue + '88' : 'rgba(255,100,30,' + a * 0.7 + ')'); g.addColorStop(1, 'rgba(120,30,10,0)')
      ctx.globalAlpha = hue ? a : 1; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.x, b.y, fr, fr * 0.9, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1 }
    if (k < 0.14) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - k / 0.14) * 0.9 + ')'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.42, 0, 6.283); ctx.fill() }
    ctx.strokeStyle = 'rgba(255,235,190,' + (1 - k) * 0.85 + ')'; ctx.lineWidth = 1 + 5 * (1 - k); ctx.beginPath(); ctx.ellipse(b.x, b.y, r * (0.25 + 0.95 * eo), r * (0.25 + 0.95 * eo) * 0.7, 0, 0, 6.283); ctx.stroke()
    ctx.lineCap = 'round'; ctx.lineWidth = 2
    for (let i = 0; i < 14; i++) { const a = b.seed * 3 + i * 0.449, sp = r * (0.8 + ((i * 53) % 10) / 10 * 0.7), d = sp * eo, g2 = k * k * r * 0.5, len = 7 * (1 - k)
      const x1 = b.x + Math.cos(a) * d, y1 = b.y + Math.sin(a) * d * 0.7 + g2; ctx.strokeStyle = 'rgba(' + (i % 3 ? '255,210,100' : '255,140,50') + ',' + (1 - k) + ')'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a) * len, y1 - Math.sin(a) * len * 0.7); ctx.stroke() }
    ctx.restore()
  }
  for (const p of R.parts) {
    if (p.ring) { ctx.strokeStyle = 'rgba(255,200,90,' + (1 - p.t / p.life) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.r! * (p.t / p.life), 0, 6.283); ctx.stroke(); }
    else { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col!; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz!, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
  }
  for (const f of R.floats) {
    ctx.globalAlpha = Math.min(1, (0.9 - f.t) * 3); ctx.textAlign = 'center'; ctx.lineWidth = f.crit || f.big || f.blast ? 4.5 : 3.5; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT;
    const sz0 = f.big ? 22 : f.blast ? 20 : f.kill ? 15 : f.crit ? 17 : f.cover ? 10 : f.flank ? 14 : 12, sz = Math.round(sz0 * (f.t < 0.12 ? 1 + 0.6 * (1 - f.t / 0.12) : 1));
    ctx.font = '400 ' + sz + 'px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
    ctx.fillStyle = f.cover ? '#cfd8dc' : f.gold ? '#ffd84a' : f.hurt ? '#ff6a6a' : f.flank ? '#ffab40' : f.blast ? '#ff9a3a' : f.kill ? '#ff5a5a' : f.crit ? '#ffe45a' : '#fff';
    const txt = typeof f.v === 'number' ? (f.blast ? 'BLAST ' : '') + fmt(f.v) + (f.crit ? '!' : '') : f.v;
    ctx.strokeText(txt, f.x, f.y); ctx.fillText(txt, f.x, f.y); ctx.globalAlpha = 1;
  }
  // combo
  if (G.combo >= 3) { ctx.textAlign = 'center'; ctx.font = '400 18px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.fillStyle = '#ffb84a'; ctx.strokeText('COMBO x' + G.combo, 90, ARENA.y1 - 8); ctx.fillText('COMBO x' + G.combo, 90, ARENA.y1 - 8); }
  ctx.restore();

  // ---------- HUD ----------
  const hg = ctx.createLinearGradient(0, 0, 0, 72); hg.addColorStop(0, '#22333f'); hg.addColorStop(1, '#101b22')
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 72); ctx.fillStyle = OUT; ctx.fillRect(0, 72, W, 2.5); ctx.fillStyle = '#ffd84a'; ctx.globalAlpha = 0.85; ctx.fillRect(0, 70, W, 1.5); ctx.globalAlpha = 1
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.font = '400 20px ' + FONT; outText(ctx, 'Stage ' + G.stage, 12, 18, '#fff', 4)
  ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillStyle = '#9fb5aa'
  { const rem = G.toSpawn - G.spawned + G.enemies.length; if (pstage !== G.stage || rem > pmax) { pstage = G.stage; pmax = rem }
    const raid = !!G.raid && !G.raid.result, f = raid ? Math.max(0, G.raid!.t) / RAID.dur : pmax > 0 ? 1 - rem / pmax : 1, boss = isBoss(G.stage) || raid
    ctx.fillStyle = OUT; rr(ctx, 10, 27, 100, 14, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, 12, 29, 96, 10, 5); ctx.fill()
    if (f > 0.01) { const gb2 = ctx.createLinearGradient(0, 29, 0, 39); gb2.addColorStop(0, boss ? '#ff9ad8' : '#ffe27a'); gb2.addColorStop(1, boss ? '#c4378f' : '#e8841a'); ctx.fillStyle = gb2; rr(ctx, 12, 29, Math.max(8, 96 * Math.min(1, f)), 10, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, 14, 30, Math.max(4, 96 * Math.min(1, f) - 4), 3, 2); ctx.fill() }
    ctx.textAlign = 'center'; ctx.font = '400 9px ' + FONT; outText(ctx, raid ? 'RAID  ' + Math.ceil(Math.max(0, G.raid!.t)) + 's' : (boss ? 'BOSS  ' : '') + rem + ' left', 60, 34.5, '#fff', 2.5); ctx.textAlign = 'left' }
  // gold chip
  const gtxt = fmt(G.gold); ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; const gw = ctx.measureText(gtxt).width + 34
  glass(ctx, 14, 47, gw - 4, 20, 10); ctx.save(); ctx.translate(18, 57); ctx.scale(1.55, 1.55); icons.coin(ctx, 0, 0, '#ffd84a'); ctx.restore(); ctx.textAlign = 'left'; ctx.font = '400 ' + (15 + Math.round(R.goldBump * 30)) + 'px ' + FONT; outText(ctx, gtxt, 34, 57.5, R.goldBump > 0 ? '#fff' : '#fff0b0', 3)
  if (G.boostT > 0) { const bt = Math.ceil(G.boostT), txt = 'BOOST ' + Math.floor(bt / 60) + ':' + String(bt % 60).padStart(2, '0'); ctx.font = '400 10px ' + FONT; const bw = ctx.measureText(txt).width + 22; glass(ctx, 14, 70, bw, 17, 8); ctx.save(); ctx.translate(23, 78.5); ctx.scale(1.1, 1.1); icons.bolt(ctx, 0, 0, '#d9b8ff'); ctx.restore(); ctx.textAlign = 'left'; outText(ctx, txt, 32, 78.5, '#e8d4ff', 2.5) }
  // idle stash chip (tap to collect)
  { const cx0 = 10 + gw + 6, cw = 208 - cx0, cap = idleCap(G.stage), f = Math.min(1, G.stash / cap), full = f >= 0.999, ready = f >= 0.15
    R.btns.collect = { x: cx0, y: 45, w: cw, h: 24 }
    const pulse = ready ? 0.5 + 0.5 * Math.sin(t * 5) : 0
    glass(ctx, cx0, 45, cw, 24, 10)
    ctx.save(); rr(ctx, cx0, 45, cw, 24, 10); ctx.clip(); ctx.fillStyle = full ? 'rgba(255,170,60,.55)' : 'rgba(255,216,74,.32)'; ctx.fillRect(cx0, 45, cw * f, 24); ctx.restore()
    ctx.strokeStyle = ready ? 'rgba(255,216,74,' + (0.45 + 0.5 * pulse) + ')' : 'rgba(255,255,255,.12)'; ctx.lineWidth = ready ? 1.6 : 1; rr(ctx, cx0 + 0.5, 45.5, cw - 1, 23, 10); ctx.stroke()
    icons.coin(ctx, cx0 + 13, 57, '#ffd84a'); ctx.textAlign = 'left'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillStyle = full ? '#ffcf8a' : '#fff2c2'
    ctx.fillText(full ? 'FULL ' + fmt(G.stash) : fmt(G.stash), cx0 + 24, 57.5) }
  // per-guardian health (initial + bar each; downed dogs show a revive countdown)
  const hx = 118, hw = 92
  { const nn = unlockedGuardians(G.stage), gap = 4, bw = (hw - gap * (nn - 1)) / nn
    for (let i = 0; i < nn; i++) {
      const bx = hx + i * (bw + gap), f = Math.max(0, G.hp[i] / G.mhp[i]), down = G.hp[i] <= 0, low = f <= 0.35
      ctx.textAlign = 'left'; ctx.fillStyle = down ? '#ff8a7a' : '#9fb5aa'; ctx.font = '400 9px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(down ? 'zZ ' + Math.ceil(G.reviveT[i]) : GUARDIANS[i].n.toUpperCase().slice(0, Math.max(3, Math.floor(bw / 6))), bx, 9)
      ctx.fillStyle = OUT; rr(ctx, bx - 1, 13, bw + 2, 14, 6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, bx + 1, 15, bw - 2, 10, 4); ctx.fill()
      if (f > 0) { const gr = ctx.createLinearGradient(0, 15, 0, 25); gr.addColorStop(0, low ? '#ff9a8a' : f < 0.65 ? '#ffe27a' : '#9af5ae'); gr.addColorStop(1, low ? '#d63a3a' : f < 0.65 ? '#e8a21a' : '#2fb85a'); ctx.fillStyle = gr; rr(ctx, bx + 1, 15, Math.max(4, (bw - 2) * f), 10, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, bx + 2.5, 16, Math.max(2, (bw - 5) * f), 3, 2); ctx.fill() }
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; rr(ctx, bx + 0.5, 14.5, bw - 1, 11, 5); ctx.stroke()
    } }

  if (!G.raid) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '400 9px ' + FONT; outText(ctx, 'Next: ' + nextGoal(G.best), 16, 96, '#ffe9a0', 2.5) }
  button(ctx, 'help', 214, 8, 34, 34, { top: '#5b6c75', bot: '#3a4850', label: '?', size: 17 })
  button(ctx, 'speed', 252, 8, 62, 34, { label: (G.speed * baseSpeed()) + 'x', size: 15, top: G.speed > 1 ? '#ffb347' : '#5b6c75', bot: G.speed > 1 ? '#e0731a' : '#3a4850', icon: 'bolt' })
  button(ctx, 'mute', 318, 8, 34, 34, { top: '#5b6c75', bot: '#3a4850', icon: 'speaker' })
  { // stardust chip: permanent currency; tap to open Rebirth (glows when a rebirth would pay out)
    const sx = 216, sw = 134, can = rebirthGain(G.stage) > 0, glow = can && G.rebirths >= 2, pulse = glow ? 0.5 + 0.5 * Math.sin(t * 2) : 0
    // once per rebirth cycle, the moment it becomes available: a big banner so it can't be missed
    if (can && R.rbAnnounced !== G.rebirths) { R.rbAnnounced = G.rebirths; Audio_.fanfare(); G.banner = { text: 'REBIRTH READY', sub: '+' + rebirthGain(G.stage) + ' Stardust. Tap the stardust chip', t: 3, big: true }; R.flash = 0.4 }
    R.btns.stardust = { x: sx, y: 45, w: sw, h: 24 }
    glass(ctx, sx, 45, sw, 24, 10)
    ctx.strokeStyle = glow ? 'rgba(190,150,255,' + (0.22 + 0.28 * pulse) + ')' : can ? 'rgba(190,150,255,.35)' : 'rgba(255,255,255,.12)'; ctx.lineWidth = glow ? 1.4 : 1; rr(ctx, sx + 0.5, 45.5, sw - 1, 23, 10); ctx.stroke()
    icons.star(ctx, sx + 13, 57, '#c9a6ff'); ctx.textAlign = 'left'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillStyle = '#e4d3ff'
    ctx.fillText(fmt(G.stardust) + (G.stardust ? '  +' + Math.round(starBonus(G.stardust) * 100) + '%' : ''), sx + 25, 57.5)
    if (can) { ctx.textAlign = 'right'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillStyle = '#c9a6ff'; ctx.fillText('REBIRTH', sx + sw - 8, 57.5) } }

  { let bx = 10 // owned blessings as small coloured chips under the HUD
    for (const b of BLESSINGS) { const c = bl(b.id); if (!c) continue
      glass(ctx, bx, 70, 30, 16, 8); ctx.save(); ctx.translate(bx + 8, 78); ctx.scale(0.7, 0.7); icons[b.icon](ctx, 0, 0, b.col); ctx.restore()
      ctx.fillStyle = '#fff'; ctx.font = '400 9px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText('' + c, bx + 17, 78.5); bx += 33 } }
  { const wmod = weekMod(); ctx.font = '400 9px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; const tw = ctx.measureText(wmod.name.toUpperCase()).width + 16
    glass(ctx, W - 10 - tw, 70, tw, 16, 8); ctx.fillStyle = wmod.col; ctx.textAlign = 'center'; ctx.fillText(wmod.name.toUpperCase(), W - 10 - tw / 2, 78.5) }
  // drag anchor: faint ring where the touch began, dot + tether at the finger
  if (R.dragAnchor) { const a = R.dragAnchor; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(a.sx, a.sy, 22, 0, 6.283); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(a.cx, a.cy); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(a.cx, a.cy, 9, 0, 6.283); ctx.fill(); ctx.restore() }

  // ---------- armory ----------
  const ag = ctx.createLinearGradient(0, BENCH.y - 24, 0, H); ag.addColorStop(0, '#1c2c37'); ag.addColorStop(1, '#0d171d')
  ctx.fillStyle = ag; ctx.fillRect(0, BENCH.y - 24, W, H - BENCH.y + 24)
  ctx.fillStyle = OUT; ctx.fillRect(0, BENCH.y - 26, W, 2.5); ctx.fillStyle = '#ffd84a'; ctx.globalAlpha = 0.85; ctx.fillRect(0, BENCH.y - 23.5, W, 1.5); ctx.globalAlpha = 1
  ctx.textAlign = 'left'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; outText(ctx, 'ARMORY', 8, BENCH.y - 11, '#c9dcd2', 3)
  { const gy = BENCH.y - 21, rdy = questReady(), pl = rdy ? 0.5 + 0.5 * Math.sin(t * 5) : 0
    button(ctx, 'nav_shop', 66, gy, 54, 18, { top: '#2a3d4b', bot: '#142029' }); ctx.save(); ctx.translate(78, gy + 9); ctx.scale(0.8, 0.8); icons.gem(ctx, 0, 0, '#6fd6ff'); ctx.restore()
    ctx.fillStyle = '#52d273'; ctx.beginPath(); ctx.arc(118, gy + 9, 6, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(115, gy + 8.2, 6, 1.6); ctx.fillRect(117.2, gy + 6, 1.6, 6)
    ctx.textAlign = 'left'; ctx.fillStyle = '#d6f2ff'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('' + G.gems, 89, gy + 9.5)
    { const gOn = unlocked('gear'), ch = G.chests[0] + G.chests[1] + G.chests[2], nd = Math.min(4, 2 + Math.floor(G.stage / 5))
      const spare = G.gear.some(it => it.on < 0 && Array.from({ length: nd }, (_, i) => i).some(i => !G.gear.some(w => w.on === dogId(i) && w.slot === it.slot)))
      button(ctx, 'nav_gear', 124, gy - 4, 84, 26, { top: gOn ? (ch ? '#e0a02a' : '#5a7a98') : '#3a444a', bot: gOn ? (ch ? '#a8680f' : '#34506a') : '#262e33', glow: gOn && ch > 0, label: gOn ? 'GEAR' : 'LOCKED', size: 14 })
      if (gOn && (ch || spare)) { ctx.fillStyle = ch ? '#ff5a46' : '#5be07f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(203, gy - 1, ch ? 6.5 : 5, 0, 6.283); ctx.fill(); ctx.stroke(); if (ch) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '400 9px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('' + Math.min(ch, 9), 203, gy + 1.5); ctx.textAlign = 'left' } } }
    button(ctx, 'menu', 214, gy - 8, 138, 30, { top: '#ffcf4a', bot: '#e8741a', label: 'MENU', size: 17 })
    ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { rr(ctx, 224, gy - 1 + k * 5.5, 16, 3.2, 1.6); ctx.fill(); ctx.stroke() }
    if (rdy || pointsLeft() > 0 || canClaimLogin() || G.chests[0] + G.chests[1] + G.chests[2] > 0) { ctx.fillStyle = '#ff5a46'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(346, gy - 6, 6, 0, 6.283); ctx.fill(); ctx.stroke(); void pl } }
  const order = G.bench.map((v, i) => ({ v, i })).filter(o => o.v !== null).sort((a, b) => (b.v as number) - (a.v as number)), armed = new Map<number, number>()
  order.slice(0, n).forEach((o, k) => armed.set(o.i, k))
  for (let i = 0; i < 8; i++) {
    const rc = benchRect(i), v = G.bench[i], dragging = R.drag && R.drag.from === i
    const over = R.drag && R.dragOver === i && R.drag.from !== i
    ctx.fillStyle = over ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.4)'; rr(ctx, rc.x, rc.y, rc.w, rc.h, 11); ctx.fill()
    ctx.strokeStyle = over ? 'rgba(255,230,140,.95)' : OUT; ctx.lineWidth = 2.4; rr(ctx, rc.x, rc.y, rc.w, rc.h, 11); ctx.stroke(); if (!over) { ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; rr(ctx, rc.x + 2.4, rc.y + 2.6, rc.w - 4.8, rc.h - 4.4, 9); ctx.stroke() }
    if (v !== null && !dragging) drawCard(ctx, rc.x, rc.y, rc.w, rc.h, v, R.popSlot && R.popSlot.slot === i ? 1 + 0.3 * Math.sin(R.popSlot.t / 0.25 * 3.14) : 1, armed.get(i))
  }
  if (R.drag) { const d = R.drag; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; drawCard(ctx, d.x - BENCH.w / 2, d.y - BENCH.h / 2 - 10, BENCH.w, BENCH.h, G.bench[d.from] ?? 0, 1.12, undefined); ctx.restore() }
  // action bar
  const cost = buyCost(), can = G.gold >= cost && G.bench.includes(null)
  button(ctx, 'buy', 10, ACTION_BAR.y, 180, ACTION_BAR.h, { top: '#52d273', bot: '#25994a', disabled: !can, shine: can, glow: can, icon: 'plus', label: 'BUY  ' + fmt(cost), size: 13 })
  button(ctx, 'merge', 198, ACTION_BAR.y, 152, ACTION_BAR.h, { top: '#5aa8ff', bot: '#2b6fd0', glow: canMergeNow(), icon: 'merge', label: 'MERGE', size: 13 })
  { // active ability row under the arena: shield, frenzy, grenade. Each shows its cooldown sweep, or a drain bar while active.
    const ns = 40, ny = ARENA.y1 + 14
    const abil = (key: string, x: number, icon: string, top: string, bot: string, cd: number, cdMax: number, act: number, actMax: number, size = ns, dy = 0) => {
      const sz = size, yy = ny + dy
      const ready = cd <= 0 && act <= 0
      if (ready) { const k = 0.5 + 0.5 * Math.sin(performance.now() / 260); ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + 0.3 * k) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + sz / 2, yy + sz / 2, sz / 2 + 3 + k * 2, 0, 6.283); ctx.stroke() }
      button(ctx, key, x, yy, sz, sz, { top: act > 0 ? top : ready ? top : '#5a666d', bot: act > 0 ? bot : ready ? bot : '#39434a', icon, disabled: !ready && act <= 0, round: true })
      if (act > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + sz / 2, yy + sz / 2, sz / 2 + 2, -Math.PI / 2, -Math.PI / 2 + 6.283 * act / actMax); ctx.stroke() }
      else if (cd > 0) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(x + sz / 2, yy + sz / 2); ctx.arc(x + sz / 2, yy + sz / 2, sz / 2 - 2, -Math.PI / 2, -Math.PI / 2 + 6.283 * (cd / cdMax)); ctx.closePath(); ctx.fill(); ctx.restore()
        ctx.textAlign = 'center'; ctx.font = '400 16px ' + FONT; outText(ctx, Math.ceil(cd) + '', x + sz / 2, yy + sz / 2 + 1, '#fff', 3.5) }
    }
    { const hs = 48, hx = 12, hy = ny - 4, lock = unlockedGuardians(G.stage) <= 2, held = !!G.hold
      if (held) { const k = 0.5 + 0.5 * Math.sin(t * 6); ctx.strokeStyle = 'rgba(255,179,71,' + (0.4 + 0.5 * k) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx + hs / 2, hy + hs / 2, hs / 2 + 3 + k * 2, 0, 6.283); ctx.stroke() }
      button(ctx, 'hold', hx, hy, hs, hs, { top: lock ? '#5a666d' : held ? '#ffb347' : '#b58cf0', bot: lock ? '#39434a' : held ? '#e0731a' : '#7a4ec0', disabled: lock, label: held ? 'RECALL' : 'HOLD', size: held ? 10 : 12, round: true })
      ctx.fillStyle = '#fff'; ctx.font = '400 8px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lock ? 'STAGE 5' : held ? 'PLANTED' : 'FOLLOW', hx + hs / 2, hy + hs - 8) }
    button(ctx, 'auto', 70, ny, 40, 40, { top: G.auto.on ? '#52d273' : '#5a666d', bot: G.auto.on ? '#25994a' : '#39434a', label: 'AUTO', size: 11, round: true })
    ctx.fillStyle = '#fff'; ctx.font = '400 8px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(G.auto.on ? 'ON' : 'OFF', 90, ny + 36)
    abil('tank', 118, 'tank', '#7fcf86', '#2f8a45', G.tankCd, MODES.tank.cd, G.tankT, MODES.tank.dur)
    abil('panic', 165, 'panic', '#ff7a6a', '#c42f2f', G.panicCd, MODES.panic.cd, G.panicT, MODES.panic.dur)
    abil('shield', 212, 'shield', '#5ab8ff', '#2b6fd0', G.shieldCd, 22, G.shieldT, shieldDur())
    abil('frenzy', 259, 'frenzy', '#ffd84a', '#e08a1a', G.frenzyCd, 18, G.frenzyT, frenzyDur())
    abil('nade', 297, 'nade', '#ff9a3a', '#d4501a', G.nadeCd, nadeCdMax(), 0, 1, 50, -5)
  }
  if (G.stage <= 5 && !G.nadeTaught && G.nadeCd <= 0 && !G.raid && G.enemies.length >= 1) { // grenade teaching hint: pulsing ring + bubble over the button
    const k = 0.5 + 0.5 * Math.sin(t * 6), cx = 322, cy = ARENA.y1 + 34
    ctx.strokeStyle = 'rgba(255,170,60,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 34 + 3 * k, 0, 6.283); ctx.stroke()
    const t2 = 'Tap the grenade to blast a bunch!'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; const tw = ctx.measureText(t2).width + 22; glass(ctx, W - 10 - tw, ARENA.y1 - 80, tw, 24, 12); ctx.fillStyle = '#ffd9a0'; ctx.textAlign = 'center'; ctx.fillText(t2, W - 10 - tw / 2, ARENA.y1 - 67.5)
  }
  { // grenade reminder: auto never throws it, so after 40s of game time without one, pulse the button for 6s (then wait another 40s)
    const idle = G.nadeCd <= 0 && !G.raid && G.enemies.length >= 1 && G.t - (G.lastNade ?? 0) > 40 && !(G.stage <= 5 && !G.nadeTaught) && !R.screen && !R.quests && !R.rebirth
    if (idle && !R.nudge.on && G.t - R.nudge.lastSim > 40) R.nudge = { on: true, t0: t, lastSim: G.t }
    if (R.nudge.on && (!idle || t - R.nudge.t0 > 6)) R.nudge.on = false
    if (R.nudge.on) {
      const k = 0.5 + 0.5 * Math.sin(t * 6), cx = 322, cy = ARENA.y1 + 34
      ctx.strokeStyle = 'rgba(255,170,60,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 34 + 3 * k, 0, 6.283); ctx.stroke()
      const t3 = 'Grenade ready. Auto never throws it. Tap it!'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; const tw3 = ctx.measureText(t3).width + 22; glass(ctx, W - 10 - tw3, ARENA.y1 - 80, tw3, 24, 12); ctx.fillStyle = '#ffd9a0'; ctx.textAlign = 'center'; ctx.fillText(t3, W - 10 - tw3 / 2, ARENA.y1 - 67.5)
    }
  }
  drawCoachTip(ctx, t)
  drawNote(ctx, t)
  if (R.hint > 0 && G.stage <= 2) { const t1 = 'Drag the arena to move the pack'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; const tw = ctx.measureText(t1).width + 24; glass(ctx, 14, ARENA.y1 - 80, tw, 24, 12); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t1, 14 + tw / 2, ARENA.y1 - 67) }

  if (G.raid && !G.raid.result) { // raid scoreboard: damage bar with tier ticks
    const bx = 62, by = 92, bw = 236, top = raidBase() * RAID.tiers[3], f = Math.min(1, G.raid.dmg / top)
    glass(ctx, bx - 4, by - 3, bw + 8, 22, 11)
    ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, bx, by, bw, 16, 8); ctx.fill()
    const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#ff9a3a'); gr.addColorStop(1, '#ff4a6a'); ctx.fillStyle = gr; if (f > 0.02) { rr(ctx, bx, by, Math.max(10, bw * f), 16, 8); ctx.fill() }
    RAID.tiers.forEach((m, k) => { const x = bx + bw * (m / RAID.tiers[3]); ctx.fillStyle = G.raid!.dmg >= raidBase() * m ? RAID.cols[k] : 'rgba(255,255,255,.55)'; ctx.fillRect(x - 1, by - 1, 2, 18) })
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(fmt(G.raid.dmg) + ' dmg', bx + bw / 2, by + 8.5)
  }
  for (const c of R.coinsFly) { // loot coins arc up to the gold counter
    if (c.t < 0) continue
    const k = c.t / c.dur, e = k * k * (3 - 2 * k), px = c.sx + (22 - c.sx) * e, py = c.sy + (57 - c.sy) * e - Math.sin(k * Math.PI) * 38
    ctx.save(); ctx.translate(px, py); ctx.scale(0.9 - 0.25 * k, 0.9 - 0.25 * k); icons.coin(ctx, 0, 0, '#ffd84a'); ctx.restore()
  }
  if (DRAW.hud.length) drawAll(DRAW.hud, ctx, t);
  // banner: ribbon with tails, outlined text, pop-in
  if (G.banner) {
    const b = G.banner
    if (bannerRef !== b) { bannerRef = b; bannerAt = performance.now() }
    const age = (performance.now() - bannerAt) / 1000, pop = age < 0.28 ? 1 + 0.35 * Math.pow(1 - age / 0.28, 2) * Math.cos(age * 22) : 1
    const a = Math.min(1, b.t * 2.5); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const big = !!b.big, tsz = big ? 30 : 23
    ctx.font = '400 ' + tsz + 'px ' + FONT; const tw = ctx.measureText(b.text).width
    ctx.font = '400 12.5px ' + FONT; const sw = b.sub ? ctx.measureText(b.sub).width : 0
    const bw = Math.min(W - 40, Math.max(tw, sw) + 56), bh = b.sub ? 72 : 48, bx = W / 2 - bw / 2, by = 150, cy = by + bh / 2
    const c1 = big ? '#ffd24a' : '#4d9bff', c2 = big ? '#e8741a' : '#2a56c4'
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(pop, pop); ctx.translate(-W / 2, -cy)
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5
    for (const sx of [-1, 1]) { const ex = sx < 0 ? bx : bx + bw; ctx.fillStyle = big ? '#b8500e' : '#1d3f93'; ctx.beginPath(); ctx.moveTo(ex, by + 8); ctx.lineTo(ex + sx * 26, by + 8); ctx.lineTo(ex + sx * 14, by + bh / 2 + 8); ctx.lineTo(ex + sx * 26, by + bh - 4); ctx.lineTo(ex, by + bh - 4); ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke(); ctx.shadowColor = 'rgba(0,0,0,.5)' }
    const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, c1); g.addColorStop(1, c2)
    ctx.fillStyle = g; rr(ctx, bx, by, bw, bh, 14); ctx.fill(); ctx.shadowColor = 'transparent'
    ctx.fillStyle = 'rgba(255,255,255,.28)'; rr(ctx, bx + 4, by + 3, bw - 8, bh * 0.38, 11); ctx.fill()
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; rr(ctx, bx, by, bw, bh, 14); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; rr(ctx, bx + 3.5, by + 3.5, bw - 7, bh - 7, 11); ctx.stroke()
    if (big) for (const [sx, sy, r0] of [[bx + 10, by + 10, 4], [bx + bw - 12, by + bh - 12, 3.4], [bx + bw - 16, by + 12, 2.6]] as [number, number, number][]) { const tw2 = 0.6 + 0.4 * Math.sin(age * 9 + sx); ctx.fillStyle = 'rgba(255,255,255,' + tw2 + ')'; ctx.beginPath(); ctx.moveTo(sx, sy - r0 * 2); ctx.lineTo(sx + r0 * 0.6, sy - r0 * 0.6); ctx.lineTo(sx + r0 * 2, sy); ctx.lineTo(sx + r0 * 0.6, sy + r0 * 0.6); ctx.lineTo(sx, sy + r0 * 2); ctx.lineTo(sx - r0 * 0.6, sy + r0 * 0.6); ctx.lineTo(sx - r0 * 2, sy); ctx.lineTo(sx - r0 * 0.6, sy - r0 * 0.6); ctx.closePath(); ctx.fill() }
    ctx.font = '400 ' + tsz + 'px ' + FONT; outText(ctx, b.text, W / 2, b.sub ? by + 25 : cy + 1, '#fff', big ? 6 : 5)
    if (b.sub) { ctx.font = '400 12.5px ' + FONT; outText(ctx, b.sub, W / 2, by + 52, '#fff6d8', 4) }
    ctx.restore(); ctx.globalAlpha = 1
  }
  if (R.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, R.flash) + ')'; ctx.fillRect(0, 0, W, H); }
}

function drawCard(ctx: Ctx, x: number, y: number, w: number, h: number, lvl: number, sc: number, armedBy: number | undefined) {
  const wd = WEAPONS[lvl]; ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-w / 2, -h / 2)
  const eraCols: [string, string][] = [['#8a7a62', '#5a4d3a'], ['#5f9a67', '#37613f'], ['#5b87b8', '#33557d'], ['#9a6fb8', '#613d7d'], ['#c76a6a', '#7d3636'], ['#e0b24a', '#9a6a18']]
  const [c1, c2] = eraCols[wd.era], g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2)
  ctx.fillStyle = g; rr(ctx, 0, 0, w, h, 11); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.13)'; rr(ctx, 2, 2, w - 4, h * 0.42, 9); ctx.fill()
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; rr(ctx, 0, 0, w, h, 11); ctx.stroke(); ctx.strokeStyle = armedBy !== undefined ? 'rgba(255,226,120,.95)' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.4; rr(ctx, 2.6, 2.6, w - 5.2, h - 5.2, 9); ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(w / 2, 20, 22, 3, 0, 0, 6.283); ctx.fill()
  drawWeaponIcon(ctx, lvl, w / 2, 13.5, 0.82)
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '400 9.5px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
  outText(ctx, wd.n.length > 15 ? 'Mk 19 Launcher' : wd.n, w / 2, 29, '#fff', 3); ctx.fillStyle = '#fff2c2'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; outText(ctx, 'Lv ' + (lvl + 1), w / 2, 41, '#fff2c2', 3)
  ctx.shadowColor = 'transparent'
  if (armedBy !== undefined) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(11, 11, 8, 0, 6.283); ctx.fill(); ctx.fillStyle = '#3a2a08'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(GUARDIANS[armedBy].tag, 11, 11.5) }
  ctx.restore()
}

/** Pause-style legend. Any tap closes it. */
export function drawHelp(ctx: Ctx) {
  ctx.fillStyle = 'rgba(6,10,12,.94)'; ctx.fillRect(0, 0, W, H)
  const rules = rulesFor(G.stage), bi = BIOMES[biomeIndex(G.stage)]
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = '400 20px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('How to win', 18, 30)
  ctx.fillStyle = '#ffd84a'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(bi.n, 18, 49); ctx.fillStyle = '#9fb5aa'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(rules.tip, 18, 66)
  // New players need four things. Everything else is learned in play, so it is not listed here.
  const rows: [string, string, string][] = [
    ['zombie', 'Goal', 'Clear every enemy on the stage to move on. Rebirth unlocks at stage ' + REBIRTH_MIN + '.'],
    ['ring', 'Merge', 'Two matching guns on the bench merge into a stronger one. Tap MERGE, or buy a spare gun first.'],
    ['arrows', 'Cover', 'Enemy guns shoot from behind barricades. Drag your pack to their side to get a clear shot.'],
    ['boom', 'Abilities', 'Shield, Frenzy and Grenade buttons sit under the arena. Tap them when a wave closes in.'],
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
    ctx.fillStyle = '#fff'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(title, 62, y + 5)
    ctx.fillStyle = '#c9d8d0'; ctx.font = '500 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
    const words = body.split(' '); let line = '', ly = y + 22
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > W - 80 && line) { ctx.fillText(line, 62, ly); line = w; ly += 15 } else line = test }
    ctx.fillText(line, 62, ly); y = ly + 22
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#7f929a'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Tap anywhere to resume', W / 2, H - 22)
}

/** "Welcome back" modal shown after time away; only the COLLECT button is live. */
export function drawWelcome(ctx: Ctx, t: number) {
  const a = G.away; if (!a) return
  R.btns = {}
  ctx.fillStyle = 'rgba(4,8,10,.82)'; ctx.fillRect(0, 0, W, H)
  const cw = 296, ch = 306, cx = (W - cw) / 2, cy = 130
  const g = ctx.createLinearGradient(0, cy, 0, cy + ch); g.addColorStop(0, '#2a3a42'); g.addColorStop(1, '#16222a')
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24; ctx.fillStyle = g; rr(ctx, cx, cy, cw, ch, 22); ctx.fill(); ctx.restore()
  ctx.strokeStyle = 'rgba(255,216,74,.55)'; ctx.lineWidth = 1.5; rr(ctx, cx + 0.75, cy + 0.75, cw - 1.5, ch - 1.5, 22); ctx.stroke()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'; ctx.font = '400 24px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Welcome back!', W / 2, cy + 34)
  const h = Math.floor(a.minutes / 60), m = Math.floor(a.minutes % 60)
  ctx.fillStyle = '#9fb5aa'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Your pack guarded the base for ' + (h ? h + 'h ' : '') + m + 'm', W / 2, cy + 62)
  const bob = Math.sin(t * 4) * 2
  ctx.save(); ctx.translate(W / 2 - 62, cy + 112 + bob); ctx.scale(3.2, 3.2); icons.coin(ctx, 0, 0, '#ffd84a'); ctx.restore()
  ctx.fillStyle = '#ffd84a'; ctx.font = '400 38px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText('+' + fmt(a.gold), W / 2 - 46, cy + 112 + bob)
  ctx.textAlign = 'center'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
  if (a.capped) { ctx.fillStyle = '#ffb27a'; ctx.fillText('Stash was full after ' + IDLE.capHours + 'h. Come back sooner to earn more!', W / 2, cy + 160) }
  else { ctx.fillStyle = '#7f929a'; ctx.fillText('Stash fills for up to ' + IDLE.capHours + 'h while you are away.', W / 2, cy + 160) }
  button(ctx, 'welcome', cx + 40, cy + 184, cw - 80, 54, { top: '#52d273', bot: '#25994a', label: 'COLLECT', icon: 'coin', size: 18 })
  if (a.gold >= 1) { const left = adsLeft(), ok = left > 0
    button(ctx, 'welcome_ad', cx + 40, cy + 246, cw - 80, 40, { top: ok ? '#b58cf0' : '#5a666d', bot: ok ? '#6a3fb8' : '#39434a', label: 'Watch ad: collect 2x', size: 13, disabled: !ok })
    ctx.textAlign = 'center'; ctx.fillStyle = '#7f929a'; ctx.font = '400 10px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(ok ? 'Optional. ' + left + ' ads left today' : 'No ads left today', W / 2, cy + 297) }
}

/** Blessing pick: three cards, the game is paused until one is chosen. */
export function drawPick(ctx: Ctx, t: number) {
  if (!G.pick) return
  R.btns = {}
  ctx.fillStyle = 'rgba(4,8,10,.86)'; ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffd84a'; ctx.font = '400 26px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Choose a Blessing', W / 2, 70)
  ctx.fillStyle = '#9fb5aa'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Stacks until your next Rebirth', W / 2, 98)
  { const ok = adsLeft() > 0; button(ctx, 'reroll_ad', W / 2 + 6, H - 86, 150, 40, { top: ok ? '#b58cf0' : '#5a666d', bot: ok ? '#6a3fb8' : '#39434a', label: 'Free reroll (ad)', size: 12, disabled: !ok }) }
  button(ctx, 'reroll', W / 2 - 156, H - 86, 150, 40, { top: G.gems >= REROLL_COST ? '#5ab8ff' : '#5a666d', bot: G.gems >= REROLL_COST ? '#2b6fd0' : '#39434a', icon: 'gem', label: 'Reroll  ' + REROLL_COST, size: 13, disabled: G.gems < REROLL_COST })
  ctx.textAlign = 'center'; ctx.fillStyle = '#9fb5aa'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('You have ' + G.gems + ' gems', W / 2, H - 32)
  G.pick.forEach((id, i) => {
    const b = BLESSINGS.find(x => x.id === id)!, x = 24, y = 130 + i * 130, w = W - 48, h = 112, own = bl(id)
    const down = R.pressed === 'pick' + i, dy = down ? 2 : 0
    R.btns['pick' + i] = { x, y, w, h }
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2c3b44'); g.addColorStop(1, '#18242b')
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = g; rr(ctx, x, y + dy, w, h, 18); ctx.fill(); ctx.restore()
    ctx.strokeStyle = b.col; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 3 + i); ctx.lineWidth = 2; rr(ctx, x + 1, y + dy + 1, w - 2, h - 2, 18); ctx.stroke(); ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.arc(x + 52, y + dy + h / 2, 32, 0, 6.283); ctx.fill()
    ctx.save(); ctx.translate(x + 52, y + dy + h / 2); ctx.scale(2.4, 2.4); icons[b.icon](ctx, 0, 0, b.col); ctx.restore()
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '400 20px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(b.name, x + 100, y + dy + 36)
    ctx.fillStyle = '#d6e4dc'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(b.desc, x + 100, y + dy + 62)
    ctx.fillStyle = b.col; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(own ? 'Owned x' + own + '  →  x' + (own + 1) : 'NEW', x + 100, y + dy + 88)
  })
}

/** Rebirth confirmation: shows what you would earn and what resets. */
export function drawRebirth(ctx: Ctx, t: number) {
  R.btns = {}
  ctx.fillStyle = 'rgba(4,8,10,.86)'; ctx.fillRect(0, 0, W, H)
  const cw = 308, gain = rebirthGain(G.stage), teach = gain > 0 && G.rebirths < 2, ch = teach ? 420 : 340, cx = (W - cw) / 2, cy = teach ? 100 : 120, dy = teach ? 80 : 0
  const g = ctx.createLinearGradient(0, cy, 0, cy + ch); g.addColorStop(0, '#2d2a44'); g.addColorStop(1, '#171626')
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24; ctx.fillStyle = g; rr(ctx, cx, cy, cw, ch, 22); ctx.fill(); ctx.restore()
  ctx.strokeStyle = 'rgba(190,150,255,.6)'; ctx.lineWidth = 1.5; rr(ctx, cx + 0.75, cy + 0.75, cw - 1.5, ch - 1.5, 22); ctx.stroke()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'; ctx.font = '400 24px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Rebirth', W / 2, cy + 32)
  ctx.save(); ctx.translate(W / 2, cy + 82); ctx.scale(3.4 + 0.15 * Math.sin(t * 3), 3.4 + 0.15 * Math.sin(t * 3)); icons.star(ctx, 0, 0, '#c9a6ff'); ctx.restore()
  if (gain) {
    ctx.fillStyle = '#e4d3ff'; ctx.font = '400 28px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('+' + gain + ' Stardust', W / 2, cy + 134)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
    ctx.fillText('Damage & gold: +' + Math.round(starBonus(G.stardust) * 100) + '%  →  +' + Math.round(starBonus(G.stardust + gain) * 100) + '%  (cap +' + Math.round(STAR_CAP * 100) + '%)', W / 2, cy + 162)
    ctx.fillStyle = '#ffb27a'; ctx.fillText('Resets stage, gold, weapons, blessings and stash.', W / 2, cy + 192)
    ctx.fillStyle = '#7f929a'; ctx.fillText('Stardust and Rebirths are kept forever.', W / 2, cy + 212)
    if (teach) { // first two rebirths: say what it buys, in plain words
      ctx.fillStyle = '#e4d3ff'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
      ctx.fillText('What you gain', W / 2, cy + 240)
      ctx.fillStyle = '#9fb5aa'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
      ctx.fillText('+' + Math.round(STAR_BONUS * 100) + '% damage and gold, forever, for every Stardust', W / 2, cy + 258)
      ctx.fillText('Stages you replay below your best run at 2x speed', W / 2, cy + 274)
      ctx.fillText('Stardust builds up to +' + Math.round(STAR_CAP * 100) + '%, then the bonus caps', W / 2, cy + 290)
    }
  } else {
    ctx.fillStyle = '#ffd84a'; ctx.font = '400 18px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Reach stage ' + REBIRTH_MIN + ' to Rebirth', W / 2, cy + 134)
    ctx.fillStyle = '#9fb5aa'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('You are on stage ' + G.stage + '. Rebirthing earns Stardust,', W / 2, cy + 168); ctx.fillText('a permanent damage and gold bonus.', W / 2, cy + 188)
    ctx.fillStyle = '#e4d3ff'; ctx.fillText('Stardust: ' + G.stardust + '   Rebirths: ' + G.rebirths, W / 2, cy + 218)
  }
  if (gain) { button(ctx, 'rb_go', cx + 24, cy + 240 + dy, cw - 48, 40, { top: '#b58cf0', bot: '#6a3fb8', label: 'REBIRTH', size: 15 }); button(ctx, 'rb_close', cx + 24, cy + 288 + dy, cw - 48, 36, { top: '#5b6c75', bot: '#3a4850', label: 'Not yet', size: 13 }) }
  else button(ctx, 'rb_close', cx + 24, cy + 270, cw - 48, 44, { top: '#5b6c75', bot: '#3a4850', label: 'Close', size: 14 })
}

/** Pack down: the game is paused on a wipe. Regroup free, revive once per stage (ad), reinforce after a wall (ad or gems). */
export function drawWipe(ctx: Ctx, t: number) {
  if (!G.wipe) return
  R.btns = {}
  const wp = G.wipe, cy = 0
  ctx.fillStyle = 'rgba(4,8,10,.9)'; ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ff7a6a'; ctx.font = '400 30px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('PACK DOWN', W / 2, 130)
  ctx.fillStyle = '#c9d8d0'; ctx.font = '400 14px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Stage ' + wp.stage + '  ·  wipe ' + wp.fails, W / 2, 166)
  const canRevive = G.reviveStage !== G.stage, wall = wp.fails >= WALL_WIPES, adsOk = adsLeft() > 0 || G.noAds
  const row = (y: number, key: string, label: string, sub: string, top: string, bot: string, disabled: boolean) => {
    button(ctx, key, 30, y, W - 60, 56, { top: disabled ? '#5a666d' : top, bot: disabled ? '#39434a' : bot, label, size: 15, disabled })
    ctx.font = '400 11px ' + FONT; ctx.fillStyle = '#aebfb6'; ctx.fillText(sub, W / 2, y + 70)
  }
  row(204, 'wipe_regroup', 'Regroup', 'Restart this stage. Free.', '#6fa3c4', '#3a6a8a', false)
  row(300, 'wipe_revive', canRevive ? 'Revive (ad)' : 'Revived already', canRevive ? 'Pick up where you fell, full health. Once per stage.' : 'Only one revive per stage.', '#b58cf0', '#6a3fb8', !canRevive || !adsOk)
  if (wall) {
    row(396, 'wipe_reinf_ad', 'Reinforce (ad)', 'Next attempt: +25% power and health.', '#ffcf4a', '#e8841a', !adsOk)
    row(492, 'wipe_reinf_gems', 'Reinforce  ' + REINFORCE_GEMS + ' gems', 'Same boost, paid in gems. You have ' + G.gems + '.', '#5ab8ff', '#2b6fd0', G.gems < REINFORCE_GEMS)
  } else {
    ctx.font = '400 12px ' + FONT; ctx.fillStyle = '#7f929a'; ctx.fillText('Reinforce unlocks after ' + WALL_WIPES + ' wipes on the same stage.', W / 2, 410)
  }
  ctx.font = '400 11px ' + FONT; ctx.fillStyle = '#5f7079'; ctx.fillText('Ads are optional and only run when you tap them.', W / 2, 600); void cy; void t
}

/** One-time starter bundle, offered once after the player first reaches STARTER_STAGE (phone app only). */
export function drawStarter(ctx: Ctx, t: number) {
  R.btns = {}
  ctx.fillStyle = 'rgba(4,8,10,.9)'; ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffd84a'; ctx.font = '400 28px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('STARTER PACK', W / 2, 110)
  ctx.fillStyle = '#9fb5aa'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Once per player. Thanks for getting this far.', W / 2, 142)
  const items: [string, string][] = [['Remove ads for good', 'Keep every reward, skip every ad'], ['350 gems', 'Chests, reinforces, blessing rerolls'], ['10 minutes of Pack Boost', '+50% gold, +25% gun damage']]
  items.forEach(([a, b], i) => { const y = 180 + i * 72; plate(ctx, 24, y, W - 48, 60, 14, 'rgba(34,52,64,.75)', 'rgba(12,20,26,.75)'); ctx.textAlign = 'left'; ctx.font = '400 17px ' + FONT; ctx.fillStyle = '#fff'; ctx.fillText(a, 42, y + 22); ctx.font = '400 12px ' + FONT; ctx.fillStyle = '#aebfb6'; ctx.fillText(b, 42, y + 43) })
  const busy = IAP.status === 'busy', price = IAP.starter?.product?.priceString ?? ''
  button(ctx, 'starter_buy', W / 2 - 120, 412, 240, 54, { top: busy ? '#5a666d' : '#ffcf4a', bot: busy ? '#39434a' : '#e8841a', label: busy ? 'Please wait...' : 'Get the Starter Pack' + (price ? '  ' + price : ''), size: 15, disabled: busy })
  button(ctx, 'starter_skip', W / 2 - 80, 482, 160, 40, { top: '#6f8794', bot: '#3f525d', label: 'Not now', size: 13 })
  ctx.textAlign = 'center'; ctx.font = '400 12px ' + FONT; ctx.fillStyle = '#9fb5aa'; ctx.fillText(IAP.msg || 'One-time purchase. Offered once.', W / 2, 560); void t
}

/** Daily quests: three objectives, claim for gems + gold. */
export function drawQuests(ctx: Ctx, t: number) {
  R.btns = {}
  ctx.fillStyle = 'rgba(4,8,10,.88)'; ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'; ctx.font = '400 24px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Daily Quests', W / 2, 52)
  ctx.save(); ctx.translate(W / 2 - 32, 86); ctx.scale(1.2, 1.2); icons.gem(ctx, 0, 0, '#6fd6ff'); ctx.restore()
  ctx.textAlign = 'left'; ctx.fillStyle = '#d6f2ff'; ctx.font = '400 18px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('' + G.gems, W / 2 - 14, 87)
  ctx.textAlign = 'center'; ctx.fillStyle = '#7f929a'; ctx.font = '400 12px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Resets at midnight. Gems buy blessing rerolls.', W / 2, 114)
  G.daily.q.forEach((q, i) => {
    const d = questDef(q.id), x = 20, y = 136 + i * 112, w = W - 40, h = 98, done = q.prog >= d.target, f = Math.min(1, q.prog / d.target)
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2a3a44'); g.addColorStop(1, '#17232b')
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 16); ctx.fill(); ctx.strokeStyle = q.claimed ? 'rgba(255,255,255,.1)' : done ? 'rgba(111,214,255,.8)' : 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 16); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = q.claimed ? '#7f929a' : '#fff'; ctx.font = '400 15px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(d.text, x + 14, y + 24)
    ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, x + 14, y + 42, w - 28, 12, 6); ctx.fill()
    if (f > 0) { ctx.fillStyle = done ? '#6fd6ff' : '#ffd84a'; rr(ctx, x + 15, y + 43, Math.max(8, (w - 30) * f), 10, 5); ctx.fill() }
    ctx.fillStyle = '#c9d8d0'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText(q.prog + ' / ' + d.target, x + 14, y + 70)
    ctx.fillStyle = '#6fd6ff'; ctx.fillText('+' + d.gems + ' gems  + gold', x + 14, y + 86)
    if (q.claimed) { ctx.textAlign = 'right'; ctx.fillStyle = '#7f929a'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('CLAIMED', x + w - 14, y + 74) }
    else { if (done && adsLeft() > 0) button(ctx, 'qa' + i, x + w - 168, y + 56, 56, 34, { top: '#b58cf0', bot: '#6a3fb8', label: 'Ad 2x', size: 11 })
      button(ctx, 'qc' + i, x + w - 104, y + 56, 92, 34, { top: done ? '#52d273' : '#5a666d', bot: done ? '#25994a' : '#39434a', label: done ? 'CLAIM' : 'In progress', size: done ? 14 : 11, disabled: !done }) }
  })
  void QUEST_POOL; void t
  button(ctx, 'q_close', W / 2 - 70, H - 70, 140, 40, { top: '#5b6c75', bot: '#3a4850', label: 'Close', size: 14 })
}

/** MOCK ad screen (no real network). Shows a fake 3s TEST AD, then a CLAIM button. */
export function drawAd(ctx: Ctx, t: number) {
  const a = adState.play; if (!a) return
  R.btns = {}
  ctx.fillStyle = 'rgba(2,4,6,.94)'; ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  if (a.native) { ctx.fillStyle = '#c9d8d0'; ctx.font = '400 16px ' + FONT; ctx.fillText('Loading ad...', W / 2, H / 2); return }
  ctx.fillStyle = '#7f929a'; ctx.font = '400 11px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('TEST AD  -  no real ad network connected', W / 2, 40)
  const g = ctx.createLinearGradient(40, 120, 320, 400); g.addColorStop(0, '#3a2f66'); g.addColorStop(1, '#1d6a7a')
  ctx.fillStyle = g; rr(ctx, 40, 120, W - 80, 280, 20); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '400 26px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Your ad here', W / 2, 250 + Math.sin(t * 3) * 4)
  const f = Math.min(1, a.t / a.dur)
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, 60, 430, W - 120, 10, 5); ctx.fill(); ctx.fillStyle = '#ffd84a'; rr(ctx, 60, 430, Math.max(6, (W - 120) * f), 10, 5); ctx.fill()
  if (!a.done) { ctx.fillStyle = '#c9d8d0'; ctx.font = '400 13px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'; ctx.fillText('Reward in ' + Math.ceil(a.dur - a.t) + 's', W / 2, 466) }
  else button(ctx, 'ad_done', W / 2 - 90, 460, 180, 48, { top: '#52d273', bot: '#25994a', label: 'CLAIM REWARD', size: 15 })
  void adCooldown; void ADS
}

// Give every icon a thick dark sticker outline (silhouette drawn in 8 directions under the real icon).
for (const k of ['tank', 'panic', 'nade', 'shield', 'frenzy', 'vest', 'charm', 'sword', 'gem', 'star', 'collar', 'bolt', 'plus', 'merge']) {
  const f = icons[k]
  icons[k] = (c, x, y, col) => { for (let a = 0; a < 4; a++) f(c, x + Math.cos(a * 1.5708 + 0.785) * 1.5, y + Math.sin(a * 1.5708 + 0.785) * 1.5, OUT); f(c, x, y, col) }
}
