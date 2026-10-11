import { W, H, ARENA } from './data'
import { G, PACK_BOUNDS, load, save, startStage, update, buyWeapon, tryMerge, mergeAll, toggleHold, throwGrenade, useAbility, accrueAway, collectStash, chooseBlessing, doRebirth, rebirthGain, claimQuest, rerollBlessings, ensureDaily, REROLL_COST } from './sim'
import { drawScreen, screenButton } from './screens'
import { drawTour, drawTourAsk, tourButton, tourSeen } from './tour'
import { showRewardedAd, tickAd, finishAd, adState } from './ads'
import { R, benchRect, drainEvents, updateFx, render, drawHelp, drawWelcome, drawPick, drawRebirth, drawQuests, drawAd } from './render'
import { Audio_ } from './audio'

/** Boots the game on a canvas; returns a disposer. */
export function startGame(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext('2d')!
  ctx.scale(cv.width / W, cv.height / H)
  load(); startStage()
  if (!tourSeen() && G.stage <= 2 && G.bought === 0) R.tourAsk = true // asked once, new players only
  accrueAway() // time since the last visit fills the stash (capped); opens the welcome-back card

  const pt = (ev: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H } }
  const inR = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
  let mode: 'bench' | 'pack' | 'btn' | null = null
  // Relative drag: pack moves by the finger's delta from the initial touch (ax/ay = touch origin, px/py = pack position at that origin).
  const drag = { ax: 0, ay: 0, px: 0, py: 0 }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const dragTo = (p: { x: number; y: number }) => {
    let tx = drag.px + (p.x - drag.ax), ty = drag.py + (p.y - drag.ay)
    const cx = clamp(tx, PACK_BOUNDS.x0, PACK_BOUNDS.x1), cy = clamp(ty, PACK_BOUNDS.y0, PACK_BOUNDS.y1)
    drag.px += cx - tx; drag.py += cy - ty; tx = cx; ty = cy // re-anchor at edges so reversing direction responds instantly
    G.pack.tx = tx; G.pack.ty = ty
    if (R.dragAnchor) { R.dragAnchor.cx = p.x; R.dragAnchor.cy = p.y }
  }

  const down = (ev: PointerEvent) => {
    ev.preventDefault(); cv.setPointerCapture(ev.pointerId); Audio_.resume()
    const p = pt(ev); R.hint = 0
    if (adState.play) { const r = R.btns.ad_done; if (r && adState.play.done && inR(p, r)) { R.pressed = 'ad_done'; mode = 'btn'; Audio_.ui() } return }
    if (G.away) { for (const k of ['welcome', 'welcome_ad']) { const r = R.btns[k]; if (r && inR(p, r)) { R.pressed = k; mode = 'btn'; Audio_.ui() } } return }
    if (G.pick) { for (const k of ['pick0', 'pick1', 'pick2', 'reroll', 'reroll_ad']) { const r = R.btns[k]; if (r && inR(p, r)) { R.pressed = k; mode = 'btn'; Audio_.ui() } } return }
    if (R.tourAsk || R.tour !== null) { for (const k in R.btns) if (inR(p, R.btns[k])) { R.pressed = k; mode = 'btn'; Audio_.ui() } return }
    if (R.screen) { for (const k in R.btns) if (inR(p, R.btns[k])) { R.pressed = k; mode = 'btn'; Audio_.ui() } return }
    if (R.quests) { for (const k of ['qc0', 'qc1', 'qc2', 'qa0', 'qa1', 'qa2', 'q_close']) { const r = R.btns[k]; if (r && inR(p, r)) { R.pressed = k; mode = 'btn'; Audio_.ui() } } return }
    if (R.rebirth) { for (const k of ['rb_go', 'rb_close']) { const r = R.btns[k]; if (r && inR(p, r)) { R.pressed = k; mode = 'btn'; Audio_.ui() } } return }
    if (R.help) { R.help = false; Audio_.ui(); return }
    for (const k in R.btns) if (inR(p, R.btns[k])) { R.pressed = k; mode = 'btn'; Audio_.ui(); return }
    for (let i = 0; i < 8; i++) if (G.bench[i] !== null && inR(p, benchRect(i))) { R.drag = { from: i, x: p.x, y: p.y }; mode = 'bench'; return }
    if (p.y > ARENA.y0 - 10 && p.y < ARENA.y1 + 10) { mode = 'pack'; drag.ax = p.x; drag.ay = p.y; drag.px = G.pack.x; drag.py = G.pack.y; G.pack.tx = G.pack.x; G.pack.ty = G.pack.y; R.dragAnchor = { sx: p.x, sy: p.y, cx: p.x, cy: p.y } }
  }
  const move = (ev: PointerEvent) => {
    const p = pt(ev)
    if (mode === 'bench' && R.drag) { R.drag.x = p.x; R.drag.y = p.y; R.dragOver = -1; for (let i = 0; i < 8; i++) if (inR(p, benchRect(i))) R.dragOver = i }
    else if (mode === 'pack') dragTo(p)
  }
  const adGate = (r: string) => { if (r === 'cap') G.banner = { text: 'No ads left today', sub: 'Back tomorrow', t: 1.4 }; else if (r === 'cooldown') G.banner = { text: 'Ad not ready yet', sub: 'Try again in a moment', t: 1.4 } }
  const fireButton = (k: string) => {
    if (tourButton(k) || screenButton(k)) return
    if (k === 'speed') G.speed = G.speed > 1 ? 1 : 2
    else if (k === 'mute') Audio_.toggleMute()
    else if (k === 'buy') { if (!buyWeapon()) G.banner = { text: G.bench.includes(null) ? 'Not enough gold' : 'Armory full — merge!', t: 1 } }
    else if (k === 'merge') mergeAll()
    else if (k === 'help') R.help = true
    else if (k === 'collect' || k === 'welcome') { if (collectStash() === 0) G.banner = { text: 'Stash is empty', sub: 'It fills while you play and while you are away', t: 1.4 } }
    else if (k === 'ad_done') finishAd()
    else if (k === 'raid_ad') { if (R.screen === 'raid') adGate(showRewardedAd('raid', () => { G.raidInfo.extra++; G.banner = { text: '+1 Raid attempt', t: 1.4 } })) }
    else if (k === 'welcome_ad') { if (G.away) adGate(showRewardedAd('stash2x', () => { collectStash(2) })) }
    else if (k === 'reroll_ad') { if (G.pick) adGate(showRewardedAd('reroll', () => { rerollBlessings(true) })) }
    else if (k.startsWith('qa')) { const qi = +k.slice(2); if (R.quests) adGate(showRewardedAd('quest2x', () => { if (claimQuest(qi, 2)) Audio_.coins() })) }
    else if (k === 'menu') R.screen = 'hub'
    else if (k === 'scr_x') R.screen = null
    else if (k === 'scr_close') R.screen = R.screen === 'hub' ? null : 'hub'
    else if (k.startsWith('nav_')) { const id = k.slice(4); if (id === 'quests') { ensureDaily(); R.screen = null; R.quests = true } else if (id === 'rebirth') { R.screen = null; R.rebirth = true } else if (id === 'tour') { R.screen = null; R.tour = 0 } else if (id === 'help') { R.screen = null; R.help = true } else R.screen = id }
    else if (k === 'q_close') R.quests = false
    else if (k.startsWith('qc')) { if (claimQuest(+k.slice(2))) Audio_.coins() }
    else if (k === 'reroll') { if (!rerollBlessings()) G.banner = { text: 'Need ' + REROLL_COST + ' gems', sub: 'Earn gems from daily quests', t: 1.4 } }
    else if (k === 'stardust') R.rebirth = true
    else if (k === 'rb_close') R.rebirth = false
    else if (k === 'rb_go') { R.rebirth = false; if (!rebirthGain(G.stage)) G.banner = { text: 'Rebirth unlocks at stage 20', t: 1.4 }; else doRebirth() }
    else if (k.startsWith('pick')) chooseBlessing(+k.slice(4))
    else if (k === 'frenzy' || k === 'shield') useAbility(k)
    else if (k === 'tank' || k === 'panic') { if (useAbility(k) === 'down') G.banner = { text: (k === 'tank' ? 'Rudy' : 'Cooper') + ' is down', t: 1.0 } }
    else if (k === 'auto') G.auto.on = !G.auto.on
    else if (k === 'nade') { G.nadeTaught = true; const r = throwGrenade(); if (r === 'none') G.banner = { text: 'No targets', t: 0.9 } }
    else if (k === 'hold') { if (toggleHold() === 'locked') G.banner = { text: 'HOLD unlocks at stage 5', sub: 'Needs a support guardian (Bruno)', t: 1.6 } }
  }
  const up = (ev: PointerEvent) => {
    if (mode === 'btn' && R.pressed) { const r = R.btns[R.pressed]; if (r && inR(pt(ev), r)) fireButton(R.pressed); R.pressed = null }
    R.dragOver = -1; R.dragAnchor = null
    if (mode === 'bench' && R.drag) {
      const p = pt(ev), from = R.drag.from; let to = -1
      for (let i = 0; i < 8; i++) if (inR(p, benchRect(i))) to = i
      if (to >= 0 && to !== from) {
        if (!tryMerge(from, to)) {
          const a = G.bench[from], b = G.bench[to]
          if (b === null) { G.bench[to] = a; G.bench[from] = null; save() }
          else if (a !== null && a !== b) { G.bench[to] = a; G.bench[from] = b; save() }
        }
      }
      R.drag = null
    }
    mode = null
  }
  const noMenu = (e: Event) => e.preventDefault()
  const vis = () => { if (document.hidden) save(); else accrueAway() }
  const autosave = setInterval(() => { if (!document.hidden) save() }, 15000)
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move)
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('contextmenu', noMenu)
  document.addEventListener('visibilitychange', vis)

  let last = performance.now(), acc = 0, T = 0, raf = 0
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now
    acc += dt; T += dt
    while (acc >= 1 / 60) { tickAd(1 / 60); if (!adState.play && !R.help && !R.rebirth && !R.quests && !R.screen && !R.tourAsk && R.tour === null && !G.away && !G.pick) update(1 / 60); acc -= 1 / 60 }
    drainEvents(); updateFx(dt); render(ctx, T)
    if (adState.play) drawAd(ctx, T); else if (G.away) drawWelcome(ctx, T); else if (G.pick) drawPick(ctx, T); else if (R.tourAsk) drawTourAsk(ctx); else if (R.tour !== null) drawTour(ctx); else if (R.screen) drawScreen(ctx, T); else if (R.quests) drawQuests(ctx, T); else if (R.rebirth) drawRebirth(ctx, T); else if (R.help) drawHelp(ctx)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => {
    cancelAnimationFrame(raf); clearInterval(autosave); save()
    cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move)
    cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); cv.removeEventListener('contextmenu', noMenu)
    document.removeEventListener('visibilitychange', vis)
  }
}
export { H }
