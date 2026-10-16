/**
 * Brag card: a 1080x1350 image of your pack, best stage and best loot, shared through the phone's share sheet
 * (Web Share with the image where supported, the Capacitor Share plugin with a link otherwise, or a PNG download on desktop).
 * Every share carries the game's link, so it doubles as a referral.
 */
import { G } from './sim'
import { ROSTER, W } from './data'
import { button, drawDogPortrait, FONT } from './render'
import { addScreen, panel } from './screens'
import { RARITY, itemName } from './gear'
import { SITE_URL } from './config'
import { playerName } from './leaderboard'
import { text, GREEN, BLUE } from './ui'
import { track } from './telemetry'
import type { Ctx } from './render'

const CW = 360, CH = 450, SCALE = 3 // drawn in game units, exported at 1080x1350
const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n.toLocaleString('en-US')

export function shareText() { return 'My pack reached stage ' + G.best + ' in Woof Wars! 🐶🔫 Can your dogs beat that? ' + SITE_URL }

function bestItem() { let b = null as null | (typeof G.gear)[number]; for (const it of G.gear) if (!b || it.rar > b.rar || (it.rar === b.rar && it.lvl > b.lvl)) b = it; return b }

/** Draws the card in 360x450 units at the current transform. */
export function drawCard(ctx: Ctx, t: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, '#1f3a2c'); bg.addColorStop(1, '#0d1a14'); ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH)
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 12; for (let x = -CH; x < CW + 40; x += 38) { ctx.beginPath(); ctx.moveTo(x, CH); ctx.lineTo(x + CH, 0); ctx.stroke() } ctx.restore()
  // title
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '400 40px ' + FONT; ctx.lineJoin = 'round'
  ctx.strokeStyle = '#241810'; ctx.lineWidth = 8; ctx.strokeText('WOOF WARS', CW / 2, 42)
  const g = ctx.createLinearGradient(0, 22, 0, 62); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#ff9a2a'); ctx.fillStyle = g; ctx.fillText('WOOF WARS', CW / 2, 42)
  text(ctx, playerName() + "'s pack", CW / 2, 76, 15, '#cfe8da')
  // the pack: Rudy, Cooper and the two support dogs in the squad
  const dogs = [0, 1, ...G.squad.slice(0, 2)].map(i => ROSTER[i]).filter(Boolean)
  ctx.fillStyle = 'rgba(120,200,140,.12)'; ctx.beginPath(); ctx.ellipse(CW / 2, 222, 160, 26, 0, 0, 6.283); ctx.fill()
  const pos: [number, number][] = [[CW / 2 - 46, 140], [CW / 2 + 46, 140], [CW / 2 - 112, 192], [CW / 2 + 112, 192]]
  dogs.forEach((d, i) => { ctx.save(); const [x, y] = pos[i]; ctx.translate(x, y); ctx.scale(2.1, 2.1); drawDogPortrait(ctx, d, 0, 0, t); ctx.restore() })
  // stats
  const box = (x: number, y: number, w: number, label: string, val: string, col: string) => {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(x, y, w, 64, 14); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke()
    text(ctx, label, x + w / 2, y + 17, 11, '#9fb5aa'); ctx.font = '400 24px ' + FONT; ctx.strokeStyle = '#241810'; ctx.lineWidth = 5; ctx.strokeText(val, x + w / 2, y + 43); ctx.fillStyle = '#fff'; ctx.fillText(val, x + w / 2, y + 43)
  }
  box(20, 262, 156, 'BEST STAGE', '' + G.best, '#ffd84a')
  box(184, 262, 156, 'ZOMBIES DOWN', fmt(G.life.kills ?? G.kills ?? 0), '#ff7a6a')
  box(20, 334, 100, 'REBIRTHS', '' + G.rebirths, '#c9a6ff')
  box(128, 334, 104, 'DOGS', (G.owned.length + 2) + ' / ' + ROSTER.length, '#6fd6ff')
  box(240, 334, 100, 'BOSSES', fmt(G.life.bosses ?? 0), '#ff9a3a')
  const it = bestItem()
  text(ctx, it ? 'Best loot: ' + itemName(it) : 'Best loot: still looking!', CW / 2, 414, 13, it ? RARITY[it.rar].col : '#9fb5aa')
  text(ctx, 'Play free: ' + SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), CW / 2, 436, 10, '#7f929a')
}

let cache: { key: string; cv: HTMLCanvasElement } | null = null
function render(): HTMLCanvasElement {
  const key = [G.best, G.rebirths, G.owned.length, G.squad.join(), playerName(), G.gear.length].join('|')
  if (cache?.key === key) return cache.cv
  const cv = document.createElement('canvas'); cv.width = CW * SCALE; cv.height = CH * SCALE
  const c = cv.getContext('2d')!; c.scale(SCALE, SCALE); drawCard(c, 1.2)
  cache = { key, cv }; return cv
}
const toBlob = (cv: HTMLCanvasElement) => new Promise<Blob | null>(res => { try { cv.toBlob(b => res(b), 'image/png') } catch { res(null) } })

let status = ''
export async function shareCard() {
  status = 'Preparing...'
  const blob = await toBlob(render()), txt = shareText()
  try {
    const file = blob ? new File([blob], 'woof-wars.png', { type: 'image/png' }) : null
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (file && nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text: txt }); status = 'Shared!'; track('share', { m: 'web_img' }); return }
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; registerPlugin?: (n: string) => unknown; isPluginAvailable?: (n: string) => boolean } }).Capacitor
    if (cap?.isNativePlatform?.() && cap.registerPlugin && (!cap.isPluginAvailable || cap.isPluginAvailable('Share'))) {
      const sh = cap.registerPlugin('Share') as { share: (o: { title?: string; text?: string; url?: string; dialogTitle?: string }) => Promise<unknown> }
      await sh.share({ title: 'Woof Wars', text: txt, url: SITE_URL, dialogTitle: 'Share your pack' }); status = 'Shared!'; track('share', { m: 'cap' }); return
    }
    if (nav.share) { await nav.share({ text: txt, url: SITE_URL }); status = 'Shared!'; track('share', { m: 'web_txt' }); return }
    if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'woof-wars.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }
    try { await navigator.clipboard.writeText(txt) } catch { /* clipboard blocked */ }
    status = 'Image saved, caption copied.'; track('share', { m: 'download' })
  } catch { status = '' } // the player closed the share sheet
}

function draw(ctx: Ctx, t: number) {
  panel(ctx, 'Share Your Pack')
  const s = 0.82, w = CW * s, h = CH * s, x = (W - w) / 2, y = 62
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.clip(); ctx.translate(x, y); ctx.scale(s, s); drawCard(ctx, t); ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.stroke()
  button(ctx, 'sh_go', 40, y + h + 14, W - 80, 46, { ...GREEN, label: 'Share', size: 18 })
  button(ctx, 'sh_copy', 90, y + h + 66, W - 180, 30, { ...BLUE, label: 'Copy link', size: 12 })
  if (status) text(ctx, status, W / 2, y + h + 110, 11, '#d6f2ff')
}
addScreen({
  tile: { id: 'share', label: 'Share', sub: () => 'Brag about your pack', icon: 'star', col: '#52d273' },
  section: 'more', minor: true, unlock: 3, draw,
  button: k => {
    if (k === 'sh_go') { void shareCard(); return true }
    if (k === 'sh_copy') { navigator.clipboard?.writeText(shareText()).then(() => { status = 'Link copied!' }, () => { status = SITE_URL }); return true }
    return false
  },
})
