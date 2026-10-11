import { W, H, ARENA } from './data'
import { G, PACK_BOUNDS, load, save, startStage, update, buyWeapon, tryMerge, mergeAll, toggleHold, throwGrenade, useAbility, accrueAway, collectStash } from './sim'
import { R, benchRect, drainEvents, updateFx, render, drawHelp, drawWelcome } from './render'
import { Audio_ } from './audio'

/** Boots the game on a canvas; returns a disposer. */
export function startGame(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext('2d')!
  ctx.scale(cv.width / W, cv.height / H)
  load(); startStage()
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
    if (G.away) { const r = R.btns.welcome; if (r && inR(p, r)) { R.pressed = 'welcome'; mode = 'btn'; Audio_.ui() } return }
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
  const fireButton = (k: string) => {
    if (k === 'speed') G.speed = G.speed > 1 ? 1 : 2
    else if (k === 'mute') Audio_.toggleMute()
    else if (k === 'buy') { if (!buyWeapon()) G.banner = { text: G.bench.includes(null) ? 'Not enough gold' : 'Armory full — merge!', t: 1 } }
    else if (k === 'merge') mergeAll()
    else if (k === 'help') R.help = true
    else if (k === 'collect' || k === 'welcome') { if (collectStash() === 0) G.banner = { text: 'Stash is empty', sub: 'It fills while you play and while you are away', t: 1.4 } }
    else if (k === 'frenzy' || k === 'shield') useAbility(k)
    else if (k === 'nade') { const r = throwGrenade(); if (r === 'none') G.banner = { text: 'No targets', t: 0.9 } }
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
    while (acc >= 1 / 60) { if (!R.help && !G.away) update(1 / 60); acc -= 1 / 60 }
    drainEvents(); updateFx(dt); render(ctx, T)
    if (G.away) drawWelcome(ctx, T); else if (R.help) drawHelp(ctx)
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
