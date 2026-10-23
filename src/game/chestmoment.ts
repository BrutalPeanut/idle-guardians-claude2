// Chest moment: a chest earned during play stops the game and asks the player to open it, then teaches Gear.
import { W, H } from './data'
import { R, button } from './render'
import type { Ctx } from './render'
import { G, openChest, unlocked } from './sim'
import { chestIcon } from './screens'
import { CHEST_NAMES } from './gear'
import { FRESH as FRESH_LINK } from './fresh'
import { HOOK } from './ext'

const F = '"Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif'
const total = () => G.chests[0] + G.chests[1] + G.chests[2]
const busy = () => !!(R.screen || R.quests || R.rebirth || G.pick || G.wipe || G.away || R.tour !== null || R.tourAsk || G.raid)

/** Once per frame: a new chest opens the chest moment as soon as the player is free and Gear is unlocked. */
export function chestGate() {
  const n = total()
  if (R.lastChests < 0) { R.lastChests = n; return }
  if (n < R.lastChests) { R.lastChests = n; return }
  if (n > R.lastChests && unlocked('gear') && !busy() && !R.chestMoment && !R.summary && !R.gearIntro && !R.freshAsk) {
    R.chestMoment = { tier: G.chests[2] ? 2 : G.chests[1] ? 1 : 0 }; R.lastChests = n
  }
}

export function drawChestMoment(ctx: Ctx, t: number) {
  const m = R.chestMoment; if (!m) return
  R.btns = {}
  ctx.fillStyle = 'rgba(2,4,6,.94)'; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.translate(W / 2, 230)
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = 'rgba(255,216,74,' + (0.05 + 0.04 * Math.sin(t * 2 + i)) + ')'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, -420); ctx.lineTo(20, -420); ctx.closePath(); ctx.fill() }
  ctx.restore()
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd84a'; ctx.font = '400 30px ' + F; ctx.fillText('CHEST EARNED!', W / 2, 112)
  chestIcon(ctx, W / 2, 230, 2.4, m.tier, 0)
  ctx.fillStyle = '#fff'; ctx.font = '400 18px ' + F; ctx.fillText(CHEST_NAMES[m.tier], W / 2, 336)
  ctx.fillStyle = '#c9dcd2'; ctx.font = '400 14px ' + F
  ctx.fillText('Chests hold gear: collars, vests and charms.', W / 2, 368)
  ctx.fillText('Open it to make your dogs stronger.', W / 2, 388)
  button(ctx, 'chest_open', W / 2 - 110, 430, 220, 56, { top: '#52d273', bot: '#25994a', shine: true, glow: true, label: 'OPEN IT', size: 18 })
  ctx.textAlign = 'left'
}

/** Opens the chest, shows the reveal on the Gear screen, and queues the Gear teaching screen after it. */
export function openChestMoment() {
  const m = R.chestMoment; if (!m) return
  const r = openChest(m.tier)
  R.chestMoment = null; R.lastChests = total()
  if (!r) return
  R.summary = { ids: r.sold ? [] : [r.item.id], sold: r.sold ?? 0, chests: 1 }; R.sel = -1
  R.screen = 'gear'
  if (!G.tipsSeen.gearIntro) R.gearIntro = true
}

export function drawGearIntro(ctx: Ctx, t: number) {
  R.btns = {}
  ctx.fillStyle = 'rgba(2,4,6,.94)'; ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd84a'; ctx.font = '400 22px ' + F; ctx.fillText('GEAR MAKES DOGS STRONGER', W / 2, 120)
  const steps = [['1', 'Tap an item to select it.'], ['2', "Tap a dog's slot to equip it."], ['3', 'Each dog has its own gear.']]
  steps.forEach(([n, txt], i) => {
    const y = 190 + i * 74, pulse = i === 0 ? 0.5 + 0.5 * Math.sin(t * 4) : 0
    ctx.fillStyle = 'rgba(255,216,74,' + (0.35 + 0.4 * pulse) + ')'; ctx.beginPath(); ctx.arc(70, y + 4, 20, 0, 6.283); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = '400 20px ' + F; ctx.fillText(n, 70, y + 11)
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8f2ec'; ctx.font = '400 15px ' + F; ctx.fillText(txt, 100, y + 10); ctx.textAlign = 'center'
  })
  button(ctx, 'gear_intro_ok', W / 2 - 100, 420, 200, 52, { top: '#52d273', bot: '#25994a', shine: true, label: 'GOT IT', size: 17 })
  ctx.textAlign = 'left'
}

// Development only (?fresh): on the first frame of a tab, if a fresh run is saved, ask whether to continue it or restart.
// Remove with the fresh link before production.
export function freshGate() {
  if (R.freshChecked) return
  R.freshChecked = true
  if (!FRESH_LINK) return
  try {
    if (sessionStorage.getItem('ig_fresh_asked')) return
    const raw = localStorage.getItem('ig_save_fresh'); if (!raw) return
    const s = JSON.parse(raw); R.freshStage = typeof s?.stage === 'number' ? s.stage : 1
    R.freshAsk = true
  } catch { /* storage unavailable: just continue */ }
}

export function drawFreshAsk(ctx: Ctx, _t: number) {
  R.btns = {}
  ctx.fillStyle = 'rgba(2,4,6,.94)'; ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd84a'; ctx.font = '400 24px ' + F; ctx.fillText('FRESH RUN SAVED', W / 2, 180)
  ctx.fillStyle = '#c9dcd2'; ctx.font = '400 15px ' + F
  ctx.fillText('Stage ' + R.freshStage + ' is saved in this browser.', W / 2, 218)
  ctx.fillText('Continue it, or start over?', W / 2, 242)
  button(ctx, 'fresh_continue', W / 2 - 110, 290, 220, 56, { top: '#52d273', bot: '#25994a', shine: true, label: 'CONTINUE STAGE ' + R.freshStage, size: 15 })
  button(ctx, 'fresh_restart', W / 2 - 110, 366, 220, 52, { top: '#e0731a', bot: '#a8480f', label: 'FRESH RESTART', size: 15 })
  ctx.fillStyle = '#7f929a'; ctx.font = '400 11px ' + F; ctx.fillText('Development only: this prompt goes away before release.', W / 2, 452)
  ctx.textAlign = 'left'
}

/** Continue keeps the saved run; restart clears it and reloads into a new one. Either way the prompt is not shown again in this tab. */
export function freshAnswer(restart: boolean) {
  R.freshAsk = false
  try { sessionStorage.setItem('ig_fresh_asked', '1') } catch { /* storage unavailable */ }
  if (restart) {
    HOOK.noSave = true // the page must not write the old run back while it unloads
    try { localStorage.removeItem('ig_save_fresh'); localStorage.removeItem('ig_save_fresh_bak'); localStorage.removeItem('ig_tut_fresh') } catch { /* storage unavailable */ }
    location.reload()
  }
}
