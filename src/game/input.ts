import { W, H, ARENA } from './data'
import { G, load, save, startStage, update, buyWeapon, tryMerge, mergeAll } from './sim'
import { R, benchRect, drainEvents, updateFx, render } from './render'
import { Audio_ } from './audio'

/** Boots the game on a canvas; returns a disposer. */
export function startGame(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext('2d')!
  ctx.scale(cv.width / W, cv.height / H)
  load(); startStage()
  try {
    const s = JSON.parse(localStorage.getItem('ig_save') || 'null')
    if (s && s.t) { const mins = Math.min(120, (Date.now() - s.t) / 60000); if (mins > 1) { const g = Math.floor(mins * (3 + G.stage * 2) * 0.5); G.gold += g; G.banner = { text: 'Welcome back! +' + g + ' gold', t: 2.5 } } }
  } catch { /* no save */ }

  const pt = (ev: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H } }
  const inR = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
  let mode: 'bench' | 'pack' | 'btn' | null = null

  const down = (ev: PointerEvent) => {
    ev.preventDefault(); cv.setPointerCapture(ev.pointerId); Audio_.resume()
    const p = pt(ev); R.hint = 0
    for (const k in R.btns) if (inR(p, R.btns[k])) { R.pressed = k; mode = 'btn'; Audio_.ui(); return }
    for (let i = 0; i < 8; i++) if (G.bench[i] !== null && inR(p, benchRect(i))) { R.drag = { from: i, x: p.x, y: p.y }; mode = 'bench'; return }
    if (p.y > ARENA.y0 - 10 && p.y < ARENA.y1 + 10) { mode = 'pack'; R.dragTarget = true; G.pack.tx = p.x; G.pack.ty = p.y - 20 }
  }
  const move = (ev: PointerEvent) => {
    const p = pt(ev)
    if (mode === 'bench' && R.drag) { R.drag.x = p.x; R.drag.y = p.y; R.dragOver = -1; for (let i = 0; i < 8; i++) if (inR(p, benchRect(i))) R.dragOver = i }
    else if (mode === 'pack') { G.pack.tx = p.x; G.pack.ty = p.y - 20 }
  }
  const fireButton = (k: string) => {
    if (k === 'speed') G.speed = G.speed > 1 ? 1 : 2
    else if (k === 'mute') Audio_.toggleMute()
    else if (k === 'buy') { if (!buyWeapon()) G.banner = { text: G.bench.includes(null) ? 'Not enough gold' : 'Armory full — merge!', t: 1 } }
    else if (k === 'merge') mergeAll()
  }
  const up = (ev: PointerEvent) => {
    if (mode === 'btn' && R.pressed) { const r = R.btns[R.pressed]; if (r && inR(pt(ev), r)) fireButton(R.pressed); R.pressed = null }
    R.dragOver = -1; R.dragTarget = false
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
  const vis = () => { if (document.hidden) save() }
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move)
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('contextmenu', noMenu)
  document.addEventListener('visibilitychange', vis)

  let last = performance.now(), acc = 0, T = 0, raf = 0
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now
    acc += dt; T += dt
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60 }
    drainEvents(); updateFx(dt); render(ctx, T)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => {
    cancelAnimationFrame(raf); save()
    cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move)
    cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); cv.removeEventListener('contextmenu', noMenu)
    document.removeEventListener('visibilitychange', vis)
  }
}
export { H }
