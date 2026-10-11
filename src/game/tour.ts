/** Optional tutorial. Asked once, only of new players, and always skippable. Replayable from Menu. */
import { W, H } from './data'
import { R, button, rr } from './render'
import type { Ctx } from './render'
import { Audio_ } from './audio'

interface Step { title: string; body: string; hl: { x: number; y: number; w: number; h: number } }
const STEPS: Step[] = [
  { title: 'Move your pack', body: 'Touch the arena and drag. Your dogs follow your finger, relative to where you first touched.', hl: { x: 8, y: 74, w: 344, h: 388 } },
  { title: 'Buy and merge weapons', body: 'Each dog fires the weapon it carries. Drag two matching weapons together to merge them into a stronger one. Every dog keeps its own gun.', hl: { x: 8, y: 466, w: 344, h: 116 } },
  { title: 'Action bar', body: 'BUY a weapon, MERGE all matching pairs, or HOLD to plant your support dogs so Rudy and Cooper can flank enemy barricades.', hl: { x: 8, y: 596, w: 344, h: 40 } },
  { title: 'Abilities', body: 'Shield blocks all damage, Frenzy doubles your fire rate, and Grenade blasts the biggest clump. Each has a cooldown.', hl: { x: 208, y: 416, w: 142, h: 46 } },
  { title: 'Idle gold', body: 'Your pack earns gold even while you are away. Tap this chip to collect it.', hl: { x: 82, y: 43, w: 128, h: 28 } },
  { title: 'Menu', body: 'Gear, daily quests, login streak, rebirth and stats all live under MENU. A red dot means something is ready.', hl: { x: 204, y: 464, w: 148, h: 24 } },
]
export const TOUR_KEY = 'ig_tut'
export const tourSeen = () => { try { return localStorage.getItem(TOUR_KEY) !== null } catch { return true } }
export const markTour = (v: string) => { try { localStorage.setItem(TOUR_KEY, v) } catch { /* storage unavailable */ } }

function dim(ctx: Ctx, hl?: Step['hl']) {
  ctx.save(); ctx.fillStyle = 'rgba(2,5,7,.78)'; ctx.beginPath(); ctx.rect(0, 0, W, H)
  if (hl) ctx.roundRect(hl.x, hl.y, hl.w, hl.h, 12)
  ctx.fill('evenodd'); ctx.restore()
  if (hl) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(hl.x, hl.y, hl.w, hl.h, 12); ctx.stroke() }
}

/** First-launch question. Nothing happens unless the player says yes. */
export function drawTourAsk(ctx: Ctx) {
  R.btns = {}; dim(ctx)
  const cw = 296, ch = 190, cx = (W - cw) / 2, cy = 190
  ctx.fillStyle = '#1d2a31'; rr(ctx, cx, cy, cw, ch, 20); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; rr(ctx, cx + 0.75, cy + 0.75, cw - 1.5, ch - 1.5, 20); ctx.stroke()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'; ctx.font = '800 20px "Arial Rounded MT Bold","Trebuchet MS","Segoe UI",system-ui,sans-serif'; ctx.fillText('New here?', W / 2, cy + 34)
  ctx.fillStyle = '#c9d8d0'; ctx.font = '600 13px "Arial Rounded MT Bold","Trebuchet MS","Segoe UI",system-ui,sans-serif'; ctx.fillText('Want a quick one-minute tour?', W / 2, cy + 66); ctx.fillStyle = '#7f929a'; ctx.font = '600 11px "Arial Rounded MT Bold","Trebuchet MS","Segoe UI",system-ui,sans-serif'; ctx.fillText('You can always find it later under Menu.', W / 2, cy + 86)
  button(ctx, 'tour_yes', cx + 20, cy + 106, cw - 40, 40, { top: '#52d273', bot: '#25994a', label: 'Show me', size: 14 })
  button(ctx, 'tour_no', cx + 20, cy + 150, cw - 40, 30, { top: '#5b6c75', bot: '#3a4850', label: 'No thanks', size: 12 })
}

export function drawTour(ctx: Ctx) {
  const i = R.tour; if (i === null) return
  const s = STEPS[i]; R.btns = {}; dim(ctx, s.hl)
  const cw = 308, ch = 150, cx = (W - cw) / 2, below = s.hl.y + s.hl.h / 2 < H / 2, cy = below ? Math.min(s.hl.y + s.hl.h + 14, H - ch - 14) : Math.max(14, s.hl.y - ch - 14)
  ctx.fillStyle = '#1d2a31'; rr(ctx, cx, cy, cw, ch, 18); ctx.fill(); ctx.strokeStyle = 'rgba(255,216,74,.5)'; ctx.lineWidth = 1.5; rr(ctx, cx + 0.75, cy + 0.75, cw - 1.5, ch - 1.5, 18); ctx.stroke()
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd84a'; ctx.font = '800 16px "Arial Rounded MT Bold","Trebuchet MS","Segoe UI",system-ui,sans-serif'; ctx.fillText(s.title, cx + 16, cy + 24)
  ctx.textAlign = 'right'; ctx.fillStyle = '#7f929a'; ctx.font = '700 11px "Arial Rounded MT Bold","Trebuchet MS","Segoe UI",system-ui,sans-serif'; ctx.fillText((i + 1) + ' / ' + STEPS.length, cx + cw - 16, cy + 24)
  ctx.textAlign = 'left'; ctx.fillStyle = '#e8f1ec'; ctx.font = '500 13px "Arial Rounded MT Bold","Trebuchet MS","Segoe UI",system-ui,sans-serif'
  const words = s.body.split(' '); let line = '', ly = cy + 52
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > cw - 32 && line) { ctx.fillText(line, cx + 16, ly); line = w; ly += 17 } else line = t }
  ctx.fillText(line, cx + 16, ly)
  button(ctx, 'tour_skip', cx + 14, cy + ch - 42, 92, 32, { top: '#5b6c75', bot: '#3a4850', label: 'Skip tour', size: 12 })
  button(ctx, 'tour_next', cx + cw - 118, cy + ch - 42, 104, 32, { top: '#52d273', bot: '#25994a', label: i === STEPS.length - 1 ? 'Done' : 'Next', size: 13 })
}

export function tourButton(k: string): boolean {
  if (k === 'tour_yes') { markTour('yes'); R.tourAsk = false; R.tour = 0; return true }
  if (k === 'tour_no') { markTour('no'); R.tourAsk = false; return true }
  if (k === 'tour_next') { if (R.tour !== null) R.tour = R.tour + 1 >= STEPS.length ? null : R.tour + 1; Audio_.ui(); return true }
  if (k === 'tour_skip') { R.tour = null; return true }
  return false
}
