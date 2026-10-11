// Vector icons for the 13-rung weapon ladder. Same chibi recipe as the sprites:
// bold dark outline, flat base + one shade, one light direction (top-left).
// Local space: x in [-22, 22], y in [-10, 10], weapon points right.
type Ctx = CanvasRenderingContext2D
type Pt = [number, number]

const OL = '#241810'
const METAL = '#a3b0bd', METAL_D = '#66727f', DARK = '#3b434d', WOOD = '#bd7a42', WOOD_D = '#85502a', BRASS = '#ecbc4c', OLIVE = '#7a8a54', OLIVE_D = '#56633a', GLASS = '#8fd6ff'

function base(c: Ctx) { c.lineWidth = 1.3; c.strokeStyle = OL; c.lineJoin = 'round'; c.lineCap = 'round' }
function poly(c: Ctx, pts: Pt[], fill: string) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); c.stroke() }
function rect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); c.stroke() }
function circ(c: Ctx, x: number, y: number, r: number, fill: string) { c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fillStyle = fill; c.fill(); c.stroke() }
function dot(c: Ctx, x: number, y: number, r: number, fill: string) { c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fillStyle = fill; c.fill() }
/** Outlined thick line (outline pass then colour pass). */
function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, col: string) {
  c.strokeStyle = OL; c.lineWidth = w + 1.6; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke()
  c.strokeStyle = col; c.lineWidth = w; c.stroke(); c.strokeStyle = OL; c.lineWidth = 1.3
}
/** Top-left light glint on a horizontal metal part. */
function glint(c: Ctx, x: number, y: number, w: number) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); c.strokeStyle = OL; c.lineWidth = 1.3 }
function bowArc(c: Ctx, ctrlX: number, tipX: number, tipY: number, w: number, col: string) {
  c.strokeStyle = OL; c.lineWidth = w + 1.6; c.beginPath(); c.moveTo(tipX, -tipY); c.quadraticCurveTo(ctrlX, 0, tipX, tipY); c.stroke()
  c.strokeStyle = col; c.lineWidth = w; c.stroke(); c.strokeStyle = OL; c.lineWidth = 1.3
}
function arrow(c: Ctx, x0: number, x1: number) {
  line(c, x0, 0, x1, 0, 1.5, '#efe3b8')
  poly(c, [[x1 - 1, -3], [x1 + 4, 0], [x1 - 1, 3]], METAL)
  poly(c, [[x0 - 1, 0], [x0 + 4, -3.4], [x0 + 5, 0]], '#e0584a'); poly(c, [[x0 - 1, 0], [x0 + 4, 3.4], [x0 + 5, 0]], '#e0584a')
}

const draw: ((c: Ctx) => void)[] = [
  // 0 Thrown Rock
  c => { poly(c, [[-8, 2], [-6, -5], [0, -8], [7, -5], [9, 1], [4, 6], [-3, 6]], '#a89b88'); poly(c, [[9, 1], [4, 6], [-3, 6], [1, 2], [6, -1]], '#7f7464'); dot(c, -3, -3, 2, '#d6ccbb'); dot(c, 3, 1, 1, '#6f6558') },
  // 1 Slingshot (upright Y-frame, band and stone)
  c => { line(c, 0, 10, 0, 3, 4.6, WOOD); line(c, 0, 3, -8, -8.5, 3.6, WOOD); line(c, 0, 3, 8, -8.5, 3.6, WOOD); circ(c, -8, -9, 1.9, WOOD_D); circ(c, 8, -9, 1.9, WOOD_D)
    line(c, -8, -9, 0, -3, 1.5, '#d9503f'); line(c, 8, -9, 0, -3, 1.5, '#d9503f'); circ(c, 0, -3, 2.8, '#a89b88'); dot(c, -0.8, -3.9, 0.9, '#d6ccbb') },
  // 2 Recurve Bow
  c => { bowArc(c, 15, -3, 10, 3.2, WOOD); line(c, -3, -10, -9, 0, 0.9, '#f2eee0'); line(c, -9, 0, -3, 10, 0.9, '#f2eee0'); rect(c, 3, -3, 5, 6, 2, '#6d3d22'); arrow(c, -9, 16) },
  // 3 Compound Bow
  c => { line(c, 6, -6, 0, -10, 2.6, '#2f6b4a'); line(c, 6, 6, 0, 10, 2.6, '#2f6b4a'); rect(c, 4, -6.5, 4, 13, 2, '#3f8a5f'); circ(c, 0, -9, 2.8, DARK); circ(c, 0, 9, 2.8, DARK)
    line(c, 0, -9, -8, 0, 0.9, '#f2eee0'); line(c, -8, 0, 0, 9, 0.9, '#f2eee0'); circ(c, 10, -3, 1.7, BRASS); line(c, 8, 6, 16, 8, 1.6, DARK); circ(c, 17, 8, 1.8, METAL_D); arrow(c, -8, 17) },
  // 4 Pistol
  c => { poly(c, [[-9, -1], [0, -1], [-2, 9.5], [-11, 9.5]], DARK); rect(c, 0, -1, 9, 5.5, 2.4, 'rgba(0,0,0,0)'); rect(c, -9, -8.5, 27, 7.5, 2.4, METAL); rect(c, 17, -6.5, 3.5, 4, 1, DARK); glint(c, -6, -7, 20)
    for (let x = -7; x < -1; x += 2) { c.beginPath(); c.moveTo(x, -7.5); c.lineTo(x, -3); c.stroke() } rect(c, 11, -10, 2, 2, 0.6, DARK) },
  // 5 Revolver
  c => { poly(c, [[-10, -1], [-1, -1], [-3, 9.5], [-12, 8]], WOOD); rect(c, -1, 0, 8, 5, 2.4, 'rgba(0,0,0,0)'); rect(c, 4, -7, 18, 4.4, 1.6, METAL); glint(c, 6, -6, 14)
    rect(c, -7, -8.5, 12, 8.5, 2.5, METAL_D); rect(c, -2, -9.5, 9, 10, 2.5, METAL); c.beginPath(); for (const x of [0.5, 3, 5.5]) { c.moveTo(x, -8.5); c.lineTo(x, -1.5) } c.stroke()
    poly(c, [[-9, -8], [-6, -11], [-4.5, -8]], DARK); dot(c, 21, -9, 0.0, '#000') },
  // 6 Hunting Rifle (bolt action, scoped)
  c => { poly(c, [[-22, -2], [-9, -4.5], [-9, 3.5], [-13, 4.5], [-22, 7]], WOOD); poly(c, [[-22, 7], [-13, 4.5], [-9, 3.5], [-9, 0], [-20, 3]], WOOD_D)
    rect(c, 0, -2, 12, 4, 1.6, WOOD); rect(c, 2, -4.6, 20, 2.8, 1, DARK); glint(c, 4, -3.8, 16); rect(c, -10, -5.5, 13, 6.5, 1.8, METAL_D)
    line(c, -3, -1.5, -3, 2.5, 1, METAL); circ(c, -3, 3, 1.7, METAL); rect(c, -7, -10.5, 15, 3.8, 1.9, DARK); circ(c, 8, -8.6, 2.4, GLASS); circ(c, -7, -8.6, 2, GLASS)
    rect(c, -5, -7, 1.8, 1.8, 0.5, METAL_D); rect(c, 3.5, -7, 1.8, 1.8, 0.5, METAL_D); glint(c, -5, -9.8, 10) },
  // 7 Shotgun (pump)
  c => { poly(c, [[-22, -1], [-9, -4], [-9, 3], [-13, 4.5], [-22, 8]], WOOD); poly(c, [[-22, 8], [-13, 4.5], [-9, 3], [-9, 0.5], [-20, 4]], WOOD_D)
    rect(c, 1, -5, 21, 2.8, 1, METAL); glint(c, 3, -4.2, 16); rect(c, 1, -2, 18, 2.4, 1, DARK); rect(c, -10, -6, 12, 7.5, 1.8, METAL_D)
    rect(c, 5, -2.2, 11, 5.4, 2.4, WOOD); c.beginPath(); for (const x of [8, 10.5, 13]) { c.moveTo(x, -1); c.lineTo(x, 2) } c.stroke(); circ(c, 21.4, -6.3, 0.9, BRASS); rect(c, -4, 1, 6, 4, 2, 'rgba(0,0,0,0)') },
  // 8 SMG
  c => { line(c, -8, -4, -19, -2, 1.5, METAL); line(c, -19, -2, -17, 5, 1.5, METAL); poly(c, [[-9, 0], [-3.5, 0], [-6, 9], [-11, 9]], DARK); poly(c, [[1, 0], [6.5, 0], [8, 10], [2.5, 10]], METAL_D)
    rect(c, -9, -8, 23, 8, 2, DARK); rect(c, 13, -7, 8.5, 5, 1.6, METAL); glint(c, -6, -7, 16); rect(c, -3, -10.5, 5, 2.6, 1, METAL_D); line(c, -7, -4, 8, -4, 1, BRASS); rect(c, 19, -6, 2.4, 3, 0.6, DARK) },
  // 9 Assault Rifle
  c => { poly(c, [[-22, -4.5], [-12, -4.5], [-12, 3], [-17, 3.5]], DARK); rect(c, -12, -6.5, 18, 7, 2, DARK); glint(c, -10, -5.7, 14); rect(c, 6, -6, 11, 5.5, 1.6, METAL_D)
    c.beginPath(); for (const x of [8.5, 11, 13.5]) { c.moveTo(x, -5); c.lineTo(x, -1.5) } c.stroke(); rect(c, 17, -4.4, 5, 2, 0.8, METAL); rect(c, 19.5, -7.2, 1.6, 3, 0.5, DARK)
    rect(c, -9, -10.5, 11, 3.6, 1.6, DARK); circ(c, 1.5, -8.7, 1.5, GLASS); poly(c, [[-2, 0.5], [3.5, 0.5], [7, 10], [1, 10.5]], METAL); poly(c, [[-10.5, 0.5], [-6, 0.5], [-8, 9], [-13, 8.5]], DARK); line(c, -9, -3.5, 3, -3.5, 1, BRASS) },
  // 10 Minigun (rotary barrels)
  c => { rect(c, -21, -6.5, 13, 13, 4, DARK); rect(c, -17, 5, 8, 4, 1, BRASS); for (const y of [-6.5, -2.3, 1.9]) { rect(c, -8, y, 29, 3.2, 1.2, METAL); glint(c, -6, y + 0.8, 24) }
    rect(c, -2, -7.8, 3.4, 15.6, 1.4, METAL_D); rect(c, 10, -7.8, 3.4, 15.6, 1.4, METAL_D); rect(c, 19, -7.8, 3, 15.6, 1.4, DARK); rect(c, -17, -11, 12, 3, 1.4, DARK) },
  // 11 M2 Browning (tripod)
  c => { line(c, -4, 3, -12, 10, 2.2, DARK); line(c, -4, 3, 5, 10, 2.2, DARK); line(c, -12, -3, -19, -6, 2, METAL_D); line(c, -12, 0, -19, 3, 2, METAL_D); circ(c, -19, -6, 1.8, DARK); circ(c, -19, 3, 1.8, DARK)
    rect(c, 3, -5, 19, 4, 1.4, METAL); glint(c, 5, -4.2, 15); for (const x of [6, 9.5, 13, 16.5]) dot(c, x, -3, 0.8, DARK)
    rect(c, -13, -7.5, 17, 10.5, 2, DARK); rect(c, -13, -10, 17, 3.4, 1.4, METAL_D); glint(c, -11, -9, 13); for (const x of [-1, 2, 5]) rect(c, x - 11, 0.5, 2, 3, 0.8, BRASS) },
  // 12 Mk 19 Automatic Grenade Launcher
  c => { rect(c, -12, 4, 14, 6, 1.5, OLIVE_D); for (const x of [-10, -6, -2]) rect(c, x, 1.4, 3, 5, 1.4, BRASS)
    rect(c, -17, -8.5, 23, 12, 2.5, OLIVE); poly(c, [[-17, 0.5], [6, 0.5], [6, 3.5], [-14.5, 3.5], [-17, 1.5]], OLIVE_D); glint(c, -15, -7.5, 18)
    rect(c, 5, -6, 11, 7, 2.2, DARK); rect(c, 15, -7, 6.5, 9, 1.5, METAL); glint(c, 16, -6, 4); rect(c, -6, -11.5, 8, 3, 1.2, DARK); circ(c, 18.5, -2.5, 2.2, '#2b2b2b'); dot(c, 18.5, -2.5, 1, BRASS) },
]

/** Draw weapon `lvl` centred at (x, y). `scale` 1 = 44px wide. `flip` mirrors it to face left. */
export function drawWeaponIcon(ctx: Ctx, lvl: number, x: number, y: number, scale = 1, flip = false) {
  const fn = draw[lvl]; if (!fn) return
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -scale : scale, scale); base(ctx); fn(ctx); ctx.restore()
}
