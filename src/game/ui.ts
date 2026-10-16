/** Small drawing helpers shared by the feature screens, matching the look of the core menus. */
import { W } from './data'
import { button, plate, icons, FONT, R } from './render'
import type { Ctx } from './render'

export const font = (px: number) => '400 ' + px + 'px ' + FONT
export const GREEN = { top: '#52d273', bot: '#25994a' }, GREY = { top: '#5a666d', bot: '#39434a' }, GOLD = { top: '#ffd24a', bot: '#e8741a' }
export const PURPLE = { top: '#b58cf0', bot: '#6a3fb8' }, BLUE = { top: '#6fb8ff', bot: '#2f6fd0' }, RED = { top: '#ff7a6a', bot: '#c42f2f' }

export function text(ctx: Ctx, s: string, x: number, y: number, px: number, col: string, align: CanvasTextAlign = 'center') {
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.font = font(px); ctx.fillStyle = col; ctx.fillText(s, x, y)
}
/** Word-wrapped text; returns the y below the last line. */
export function wrap(ctx: Ctx, s: string, x: number, y: number, maxW: number, px: number, col: string, align: CanvasTextAlign = 'center', lh = px + 4) {
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.font = font(px); ctx.fillStyle = col
  let line = ''
  for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (line && ctx.measureText(t).width > maxW) { ctx.fillText(line, x, y); y += lh; line = w } else line = t }
  if (line) { ctx.fillText(line, x, y); y += lh }
  return y
}
export function icon(ctx: Ctx, name: string, x: number, y: number, s: number, col: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); icons[name]?.(ctx, 0, 0, col); ctx.restore()
}
/** A settings row: icon, title, one-line description and an ON/OFF pill registered as `key`. */
export function toggleRow(ctx: Ctx, key: string, y: number, title: string, desc: string, on: boolean, ic: string, col: string, enabled = true) {
  plate(ctx, 16, y, W - 32, 58, 14)
  icon(ctx, ic, 42, y + 29, 1.4, enabled ? col : '#6f7b80')
  text(ctx, title, 68, y + 20, 14, enabled ? '#fff' : '#8a979c', 'left')
  wrap(ctx, desc, 68, y + 38, 180, 10, '#9fb5aa', 'left', 12)
  button(ctx, key, W - 86, y + 13, 60, 32, { ...(on && enabled ? GREEN : GREY), label: on ? 'ON' : 'OFF', size: 13, disabled: !enabled })
}
/** Centred modal card over a dimmed screen (for one-off prompts). Returns the card rect. */
export function card(ctx: Ctx, h: number) {
  R.btns = {} // only the card's own buttons are tappable
  ctx.fillStyle = 'rgba(4,8,12,.72)'; ctx.fillRect(0, 0, W, 640)
  const w = W - 48, x = 24, y = Math.round((640 - h) / 2)
  plate(ctx, x, y, w, h, 20, '#2d4252', '#172530')
  return { x, y, w, h }
}
