// Drawing for cover, hazards, enemy fire telegraphs and status icons. Same chibi recipe: bold outline, 2-tone, light from top-left.
import { HAZARD_SQUASH } from './cover'
import type { Cover, CoverKind, Hazard } from './cover'
import type { EBullet, Missile, Shell, Status } from './sim'

type Ctx = CanvasRenderingContext2D
const OL = '#241810'
const TOP = 10 // visual height above the collision box

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = true) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) c.stroke() }
function poly(c: Ctx, pts: [number, number][], fill: string) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); c.stroke() }
function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke = true) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.283); c.fillStyle = fill; c.fill(); if (stroke) c.stroke() }

/** Painters work in a box centred on (0,0): x in [-w/2,w/2], collision y in [-h/2,h/2], art extends TOP px above. */
const paint: Record<CoverKind, (c: Ctx, w: number, h: number, t: number) => void> = {
  log: (c, w, h) => { const t = -h / 2 - TOP + 4; rr(c, -w / 2, t, w, h + TOP - 4, 9, '#9a6234'); rr(c, -w / 2 + 3, t + 3, w - 6, 7, 4, '#b8793f', false)
    c.strokeStyle = '#6e4322'; c.lineWidth = 1.2; for (let x = -w / 2 + 12; x < w / 2 - 8; x += 13) { c.beginPath(); c.moveTo(x, t + 8); c.lineTo(x + 3, h / 2 - 4); c.stroke() }
    c.strokeStyle = OL; c.lineWidth = 2; ell(c, w / 2 - 7, t + (h + TOP - 4) / 2, 6, (h + TOP - 4) / 2 - 1, '#d9a566'); ell(c, w / 2 - 7, t + (h + TOP - 4) / 2, 3, 5, '#b8793f', false)
    ell(c, -w / 4, t + 2, 14, 4, '#5fa04a', false); ell(c, w / 6, t + 3, 9, 3, '#7ac05f', false) },
  stump: (c, w, h) => { const t = -h / 2 - TOP; rr(c, -w / 2 + 4, t + 8, w - 8, h + TOP - 6, 8, '#8a5a30'); ell(c, 0, t + 8, w / 2 - 4, 9, '#d9a566'); ell(c, 0, t + 8, w / 4, 4.5, '#b8793f', false); ell(c, 0, t + 8, w / 9, 2, '#8a5a30', false)
    ell(c, -w / 3, h / 2 - 2, 7, 3, '#5fa04a', false) },
  boulder: (c, w, h) => { const t = -h / 2 - TOP; poly(c, [[-w / 2, h / 2], [-w / 2 + 6, t + 12], [-w / 5, t + 2], [w / 4, t], [w / 2 - 4, t + 12], [w / 2, h / 2]], '#8e9aa0')
    poly(c, [[w / 6, t + 1], [w / 2 - 4, t + 12], [w / 2, h / 2], [w / 8, h / 2]], '#6b777d'); ell(c, -w / 5, t + 8, w / 5, 4, '#5fa04a', false); ell(c, -w / 3, t + 14, 8, 3, '#7ac05f', false) },
  sandstone: (c, w, h) => { const t = -h / 2 - TOP; rr(c, -w / 2, t, w, h + TOP, 7, '#d9a85c'); c.save(); c.beginPath(); c.roundRect(-w / 2, t, w, h + TOP, 7); c.clip()
    rr(c, -w / 2, t + (h + TOP) * 0.34, w, (h + TOP) * 0.33, 0, '#c4914a', false); rr(c, -w / 2, t + (h + TOP) * 0.67, w, (h + TOP) * 0.34, 0, '#a87a3a', false); c.restore()
    c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.roundRect(-w / 2, t, w, h + TOP, 7); c.stroke(); rr(c, -w / 2 + 3, t + 3, w * 0.45, 4, 2, 'rgba(255,240,200,.55)', false) },
  ruin: (c, w, h) => { const t = -h / 2 - TOP; poly(c, [[-w / 2, h / 2], [-w / 2, t + 6], [-w / 4, t], [-w / 8, t + 7], [w / 5, t + 2], [w / 3, t + 9], [w / 2, t + 4], [w / 2, h / 2]], '#c9a06a')
    c.strokeStyle = '#8a6a3c'; c.lineWidth = 1.2; for (let y = t + 12; y < h / 2; y += 8) { c.beginPath(); c.moveTo(-w / 2 + 2, y); c.lineTo(w / 2 - 2, y); c.stroke(); for (let x = -w / 2 + 10 + ((y - t) % 16 ? 8 : 0); x < w / 2; x += 16) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 8); c.stroke() } } c.strokeStyle = OL; c.lineWidth = 2 },
  driftwood: (c, w, h) => { const t = -h / 2 - TOP + 8; rr(c, -w / 2, t + 8, w, 10, 5, '#d8cdb4'); rr(c, -w / 2 + 6, t - 2, w - 10, 10, 5, '#e8dfc8'); rr(c, -w / 2 + 2, t + 16, w - 4, 10, 5, '#c9bda2')
    c.fillStyle = '#9a8a6a'; for (const [x, y] of [[-w / 4, t + 13], [w / 5, t + 3], [w / 3, t + 21]]) { c.beginPath(); c.arc(x, y, 2, 0, 6.283); c.fill() } },
  sandcastle: (c, w, h) => { const t = -h / 2 - TOP; rr(c, -w / 2, t + 8, w, h + TOP - 8, 4, '#e8cf94'); const n = Math.max(3, Math.floor(w / 18)), bw = w / n
    for (let i = 0; i < n; i += 2) rr(c, -w / 2 + i * bw, t, bw, 10, 2, '#f1dba6'); c.strokeStyle = 'rgba(160,120,60,.5)'; c.lineWidth = 1; for (let x = -w / 2 + 8; x < w / 2; x += 14) { c.beginPath(); c.moveTo(x, t + 14); c.lineTo(x, h / 2 - 3); c.stroke() } c.strokeStyle = OL
    c.lineWidth = 1.6; c.beginPath(); c.moveTo(w / 2 - 12, t); c.lineTo(w / 2 - 12, t - 10); c.stroke(); poly(c, [[w / 2 - 12, t - 10], [w / 2 - 3, t - 7], [w / 2 - 12, t - 4]], '#e85a4a'); c.lineWidth = 2 },
  crate: (c, w, h) => { const t = -h / 2 - TOP + 2; rr(c, -w / 2, t, w, h + TOP - 2, 4, '#b8864a'); c.strokeStyle = '#7a5428'; c.lineWidth = 2.2; c.beginPath(); c.rect(-w / 2 + 4, t + 4, w - 8, h + TOP - 10); c.moveTo(-w / 2 + 4, t + 4); c.lineTo(w / 2 - 4, h / 2 - 4); c.moveTo(w / 2 - 4, t + 4); c.lineTo(-w / 2 + 4, h / 2 - 4); c.stroke(); c.strokeStyle = OL; c.lineWidth = 2 },
  obsidian: (c, w, h, t) => { const top = -h / 2 - TOP - 6, n = Math.max(3, Math.floor(w / 22)), sw = w / n
    for (let i = 0; i < n; i++) { const x = -w / 2 + i * sw, ph = top - (i % 2 ? 0 : 6) + (i === 1 ? -4 : 0); poly(c, [[x, h / 2], [x + sw * 0.15, ph + 12], [x + sw * 0.5, ph], [x + sw * 0.9, ph + 14], [x + sw, h / 2]], i % 2 ? '#3b2f4a' : '#2c2338') }
    c.strokeStyle = '#ff7a2a'; c.lineWidth = 1.6; c.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3); for (let i = 0; i < n; i++) { const x = -w / 2 + i * sw + sw * 0.5; c.beginPath(); c.moveTo(x, h / 2 - 3); c.lineTo(x + (i % 2 ? 3 : -3), top + 18); c.stroke() } c.globalAlpha = 1; c.strokeStyle = OL; c.lineWidth = 2 },
  iceblock: (c, w, h) => { const t = -h / 2 - TOP; c.globalAlpha = 0.92; rr(c, -w / 2, t, w, h + TOP, 8, '#9fe0f5'); c.globalAlpha = 1; rr(c, -w / 2 + 3, t + 3, w - 6, 8, 4, 'rgba(255,255,255,.55)', false)
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; for (const x of [-w / 4, w / 8, w / 3]) { c.beginPath(); c.moveTo(x, t + 14); c.lineTo(x - 8, h / 2 - 3); c.stroke() } c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.roundRect(-w / 2, t, w, h + TOP, 8); c.stroke() },
  snowwall: (c, w, h) => { const t = -h / 2 - TOP; poly(c, [[-w / 2, h / 2], [-w / 2 + 4, t + 14], [-w / 4, t + 3], [0, t + 8], [w / 4, t], [w / 2 - 4, t + 12], [w / 2, h / 2]], '#f4f8fc'); poly(c, [[w / 4, t], [w / 2 - 4, t + 12], [w / 2, h / 2], [w / 6, h / 2]], '#c5d6e8'); ell(c, -w / 6, t + 9, w / 6, 3, '#ffffff', false) },
  rotlog: (c, w, h, t) => { const y0 = -h / 2 - TOP + 4; rr(c, -w / 2, y0, w, h + TOP - 4, 9, '#5a4a38'); rr(c, -w / 2 + 3, y0 + 3, w - 6, 6, 3, '#74604a', false)
    for (const [x, col] of [[-w / 4, '#7affc8'], [w / 6, '#9aff7a'], [w / 3, '#7affc8']] as [number, string][]) { c.fillStyle = col; c.globalAlpha = 0.7 + 0.3 * Math.sin(t * 2 + x); c.beginPath(); c.arc(x, y0 + 2, 3, 0, 6.283); c.fill(); c.globalAlpha = 1 }
    ell(c, w / 2 - 7, y0 + (h + TOP - 4) / 2, 6, (h + TOP - 4) / 2 - 1, '#7a6650'); ell(c, -w / 5, y0 + 2, 12, 3.5, '#4f7a3a', false) },
  dock: (c, w, h, t) => { const y0 = -h / 2 - TOP + 6; for (let x = -w / 2; x < w / 2 - 2; x += 14) rr(c, x, y0 + 8, 12.5, h + TOP - 10, 2, x / 14 % 2 ? '#6f5a40' : '#7d6747')
    rr(c, -w / 2 - 2, y0 - 2, 7, h + TOP + 2, 2, '#4f3f2c'); rr(c, w / 2 - 5, y0 - 2, 7, h + TOP + 2, 2, '#4f3f2c'); c.fillStyle = '#ffd27a'; c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 3); c.beginPath(); c.arc(w / 2 - 1.5, y0 - 6, 4, 0, 6.283); c.fill(); c.globalAlpha = 1; c.lineWidth = 1.2; c.stroke(); c.lineWidth = 2 },
}
const DUST: Record<CoverKind, string> = { log: '#9a6234', stump: '#8a5a30', boulder: '#8e9aa0', sandstone: '#d9a85c', ruin: '#c9a06a', driftwood: '#d8cdb4', sandcastle: '#e8cf94', crate: '#b8864a', obsidian: '#ff7a2a', iceblock: '#bff0ff', snowwall: '#f4f8fc', rotlog: '#5a4a38', dock: '#7d6747' }
export const coverDust = (k: CoverKind) => DUST[k]

export function drawCover(ctx: Ctx, c: Cover, t: number) {
  const hpf = c.hp / c.max, degraded = hpf <= 0.35
  ctx.save(); ctx.translate(c.x, c.y)
  ctx.fillStyle = c.side === 'player' ? 'rgba(80,170,255,.26)' : 'rgba(255,80,70,.26)'; ctx.beginPath(); ctx.ellipse(0, c.h / 2 + 1, c.w / 2 + 8, 8, 0, 0, 6.283); ctx.fill()
  ctx.strokeStyle = c.side === 'player' ? 'rgba(120,200,255,.55)' : 'rgba(255,120,110,.55)'; ctx.lineWidth = 1.5; ctx.stroke()
  if (degraded) ctx.rotate(0.045 * (c.id % 2 ? 1 : -1))
  ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.lineJoin = 'round'
  paint[c.kind](ctx, c.w, c.h, t)
  // damage: cracks grow as HP drops; below 35% it visibly degrades (chipped top, dull tint)
  const cracks = hpf < 0.8 ? (hpf < 0.55 ? (hpf < 0.35 ? 5 : 3) : 1) : 0
  ctx.strokeStyle = 'rgba(30,20,10,.75)'; ctx.lineWidth = 1.4
  for (let i = 0; i < cracks; i++) { const x = -c.w / 2 + ((i * 37 + c.id * 13) % 100) / 100 * c.w, y = -c.h / 2 - 2 + (i % 2) * 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 6); ctx.lineTo(x - 2, y + 11); ctx.lineTo(x + 3, y + 16); ctx.stroke() }
  if (degraded) {
    ctx.fillStyle = 'rgba(60,40,25,.28)'; ctx.fillRect(-c.w / 2, -c.h / 2 - TOP, c.w, c.h + TOP)
    ctx.fillStyle = 'rgba(0,0,0,.35)'; for (const x of [-c.w / 3, c.w / 5]) { ctx.beginPath(); ctx.moveTo(x - 6, -c.h / 2 - TOP); ctx.lineTo(x, -c.h / 2 - TOP + 8); ctx.lineTo(x + 6, -c.h / 2 - TOP); ctx.fill() }
  }
  if (c.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, c.flash * 6) + ')'; ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2 - TOP, c.w, c.h + TOP, 6); ctx.fill() }
  ctx.restore()
  if (hpf < 1) { const bw = c.w * 0.62, x = c.x - bw / 2, y = c.y - c.h / 2 - TOP - 8; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(x - 1, y - 1, bw + 2, 6, 3); ctx.fill()
    ctx.fillStyle = degraded ? '#ff6a4a' : hpf < 0.6 ? '#ffd24a' : '#7ae08a'; ctx.beginPath(); ctx.roundRect(x, y, Math.max(3, bw * hpf), 4, 2); ctx.fill() }
}

export function drawHazard(ctx: Ctx, h: Hazard, t: number) {
  const ry = h.r * HAZARD_SQUASH; ctx.save(); ctx.translate(h.x, h.y)
  if (h.kind === 'lava') {
    ctx.fillStyle = '#2a1414'; ctx.beginPath(); ctx.ellipse(0, 1, Math.max(0, h.r + 4), Math.max(0, ry + 3), 0, 0, 6.283); ctx.fill()
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, h.r); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.4, '#ff9a2a'); g.addColorStop(1, '#d8341a'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0, h.r), Math.max(0, ry), 0, 0, 6.283); ctx.fill()
    ctx.fillStyle = 'rgba(255,240,160,.8)'; for (let i = 0; i < 4; i++) { const a = t * 1.3 + i * 1.7, k = (Math.sin(t * 2 + i) + 1) / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * h.r * 0.5, Math.sin(a) * ry * 0.5 - k * 3, 1.5 + k * 1.5, 0, 6.283); ctx.fill() }
  } else if (h.kind === 'mud') {
    ctx.fillStyle = '#3a2c1c'; ctx.beginPath(); ctx.ellipse(0, 1, Math.max(0, h.r + 3), Math.max(0, ry + 2), 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#5a4630'; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0, h.r), Math.max(0, ry), 0, 0, 6.283); ctx.fill()
    ctx.strokeStyle = 'rgba(180,150,100,.4)'; ctx.lineWidth = 1.2; for (let i = 0; i < 2; i++) { const k = ((t * 0.4 + i * 0.5) % 1); ctx.beginPath(); ctx.ellipse(h.r * 0.15, 0, Math.max(0, h.r * 0.6 * k), Math.max(0, ry * 0.6 * k), 0, 0, 6.283); ctx.stroke() }
    ctx.fillStyle = '#7a6444'; for (const [x, y] of [[-h.r * 0.4, 1], [h.r * 0.3, -2]]) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.283); ctx.fill() }
  } else if (h.kind === 'ice') {
    const g = ctx.createLinearGradient(-h.r, -ry, h.r, ry); g.addColorStop(0, '#e8f8ff'); g.addColorStop(1, '#a8d8f0'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0, h.r), Math.max(0, ry), 0, 0, 6.283); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-h.r * 0.5, -ry * 0.2); ctx.lineTo(-h.r * 0.1, -ry * 0.55); ctx.moveTo(h.r * 0.1, ry * 0.5); ctx.lineTo(h.r * 0.5, ry * 0.1); ctx.stroke()
    ctx.strokeStyle = 'rgba(80,150,200,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0, h.r), Math.max(0, ry), 0, 0, 6.283); ctx.stroke()
  } else {
    ctx.fillStyle = 'rgba(80,190,215,.5)'; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0, h.r), Math.max(0, ry), 0, 0, 6.283); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0, h.r), Math.max(0, ry), 0, 0, 6.283); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.2; for (let i = 0; i < 2; i++) { const k = ((t * 0.35 + i * 0.5) % 1); ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0, h.r * 0.8 * k), Math.max(0, ry * 0.8 * k), 0, 0, 6.283); ctx.stroke() }
  }
  ctx.restore()
}

export function drawEBullets(ctx: Ctx, bs: EBullet[]) {
  for (const b of bs) { const a = Math.atan2(b.vy, b.vx); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a); ctx.shadowColor = '#ff4a3a'; ctx.shadowBlur = 8
    ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.roundRect(-8, -2, 12, 4, 2); ctx.fill(); ctx.fillStyle = '#fff0c0'; ctx.beginPath(); ctx.roundRect(-3, -1, 6, 2, 1); ctx.fill(); ctx.restore() }
}
/** Mortar telegraph: ground ring fills as the shell comes down so players can read it and move. */
/** Missiles: a pulsing target ring where it will land, a smoke trail, and the rocket itself. */
export function drawMissiles(ctx: Ctx, ms: Missile[], t: number) {
  for (const m of ms) {
    const ry = m.r * HAZARD_SQUASH, pulse = 0.55 + 0.4 * Math.sin(t * 16)
    ctx.fillStyle = 'rgba(255,60,40,.12)'; ctx.beginPath(); ctx.ellipse(m.tx, m.ty, m.r, ry, 0, 0, 6.283); ctx.fill()
    ctx.strokeStyle = 'rgba(255,90,60,' + pulse + ')'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.ellipse(m.tx, m.ty, m.r, ry, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
    ctx.beginPath(); ctx.moveTo(m.tx - 7, m.ty); ctx.lineTo(m.tx + 7, m.ty); ctx.moveTo(m.tx, m.ty - 5); ctx.lineTo(m.tx, m.ty + 5); ctx.stroke()
    const a = Math.atan2(m.vy, m.vx), sp = Math.hypot(m.vx, m.vy) || 1
    const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx / sp * 30, m.y - m.vy / sp * 30); g.addColorStop(0, 'rgba(255,200,120,.8)'); g.addColorStop(1, 'rgba(120,110,100,0)')
    ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx / sp * 30, m.y - m.vy / sp * 30); ctx.stroke(); ctx.lineCap = 'butt'
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(a)
    ctx.fillStyle = '#d6dbe0'; ctx.strokeStyle = OL; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(-7, -2.4, 12, 4.8, 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#ff4a30'; ctx.beginPath(); ctx.moveTo(5, -2.4); ctx.lineTo(10, 0); ctx.lineTo(5, 2.4); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#555c66'; ctx.beginPath(); ctx.moveTo(-7, -2.4); ctx.lineTo(-10, -5); ctx.lineTo(-4, -2.4); ctx.moveTo(-7, 2.4); ctx.lineTo(-10, 5); ctx.lineTo(-4, 2.4); ctx.fill()
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(-10 - Math.random() * 3, 0, 4, 2, 0, 0, 6.283); ctx.fill()
    ctx.restore()
  }
}
export function drawShells(ctx: Ctx, ss: Shell[], t: number) {
  for (const s of ss) {
    if (s.t < 0 && s.col) continue
    const p = Math.max(0, Math.min(1, s.t / s.dur)), ry = s.r * HAZARD_SQUASH, cl = s.col ?? ''
    ctx.fillStyle = 'rgba(255,70,50,' + (0.10 + 0.16 * p) + ')'; ctx.beginPath(); ctx.ellipse(s.tx, s.ty, s.r, ry, 0, 0, 6.283); ctx.fill()
    ctx.strokeStyle = cl || 'rgba(255,90,70,' + (0.55 + 0.4 * Math.sin(t * 14)) + ')'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.ellipse(s.tx, s.ty, s.r, ry, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = 'rgba(255,120,90,.55)'; ctx.beginPath(); ctx.ellipse(s.tx, s.ty, s.r * p, ry * p, 0, 0, 6.283); ctx.fill()
    const x = s.x + (s.tx - s.x) * p, y = s.y + (s.ty - s.y) * p - Math.sin(Math.PI * p) * 90
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(s.x + (s.tx - s.x) * p, s.y + (s.ty - s.y) * p, 5, 2.5, 0, 0, 6.283); ctx.fill()
    ctx.fillStyle = cl || '#2b2b33'; ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, cl ? 6 : 5, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.fillStyle = cl ? '#fff' : '#ff9a3a'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 1.6, 0, 6.283); ctx.fill()
  }
}

function shield(ctx: Ctx, x: number, y: number) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#4aa8ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, -6); ctx.lineTo(6, 1); ctx.quadraticCurveTo(6, 6, 0, 8); ctx.quadraticCurveTo(-6, 6, -6, 1); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-4, -4, 3, 7); ctx.restore() }
function arrows(ctx: Ctx, x: number, y: number, manual: boolean) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = manual ? '#ff7a2a' : '#ffc34a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4
  for (const dx of [-5, 3]) { ctx.beginPath(); ctx.moveTo(dx - 2, -6); ctx.lineTo(dx + 4, 0); ctx.lineTo(dx - 2, 6); ctx.lineTo(dx, 0); ctx.closePath(); ctx.fill(); ctx.stroke() } ctx.restore() }
/** Small status icons above a guardian: shield = in cover, arrows = flanking (amber auto, orange when you placed them). */
export function drawStatus(ctx: Ctx, gx: number, gy: number, st: Status) {
  const y = gy - 26; if (st.cover && st.flank) { shield(ctx, gx - 8, y); arrows(ctx, gx + 9, y, st.flank === 2) } else if (st.cover) shield(ctx, gx, y); else if (st.flank) arrows(ctx, gx, y, st.flank === 2)
}
/** Flag + dashed ring marking where the support squad is planted. */
export function drawHold(ctx: Ctx, x: number, y: number, t: number) {
  ctx.save(); ctx.translate(x, y + 18); ctx.strokeStyle = 'rgba(255,200,90,.7)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 6; ctx.beginPath(); ctx.ellipse(0, 0, 54, 24, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
  ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -16); ctx.stroke(); ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 1.4; ctx.stroke()
  ctx.fillStyle = '#ffc34a'; ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(11, -12 + Math.sin(t * 5) * 1.2); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
}
