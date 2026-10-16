/**
 * Codex: the Kennel (every dog's portrait, bio and perk) and the Bestiary (every enemy type, how to beat it, and how many you've
 * downed). Discovering a new enemy pays a few gems once.
 */
import { G, save, DRAKES } from './sim'
import { ROSTER, W } from './data'
import { button, drawDogPortrait, drawEnemyPortrait } from './render'
import { addScreen, panel } from './screens'
import { xs, ON } from './ext'
import { text, wrap, GREEN, GREY, GOLD } from './ui'
import { Audio_ } from './audio'
import type { Ctx } from './render'

const BIO: Record<string, string> = {
  Rudy: 'The pack leader. An English Cream Golden Retriever north of 100 pounds, Rudy is convinced every zombie is a friend he has not met yet. When that turns out to be wrong, he simply sits on the problem.',
  Cooper: 'Rudy\'s partner in crime. Anxious, wide-eyed and always watching, which is exactly why nothing sneaks up on this pack. Panic mode is not a bug. It is a feature.',
  Bruno: 'Built like a fridge with legs. Bruno plants himself in front of the pack and refuses to move, which is great for everyone except the zombies.',
  Luna: 'Talks back to everything, zombies included. Spots trouble two fields away and makes sure the whole pack knows about it.',
  Waffles: 'Follows his nose straight to treats and gold. Nobody has ever successfully told Waffles no.',
  Pepper: 'A retired firehouse dog. Calls targets faster than anyone, then expects a belly rub for every one.',
  Honey: 'Short legs, big heart. Patches the pack up mid-fight and herds everyone back into formation.',
  Ziggy: 'Long dog, short fuse. Somehow carries more grenades than should physically fit in a dachshund.',
  Shadow: 'Quiet, quick and nearly invisible after dark. The zombies never hear him coming.',
  Mochi: 'Does exactly what Mochi wants, when Mochi wants. Somehow it always turns out lucky for the pack.',
}
interface Foe { kind: 'zombie' | 'runner' | 'robot' | 'gunner' | 'mortar' | 'launcher' | 'boss'; name: string; tip: string; from: number; col: string }
const FOES: Foe[] = [
  { kind: 'zombie', name: 'Shambler', tip: 'Slow, hungry and endless. They come in hordes, so keep your guns merged up.', from: 1, col: '#7fc06a' },
  { kind: 'robot', name: 'Scrap Bot', tip: 'Armored and slower than a shambler. Crits chew right through it.', from: 6, col: '#9fb2c4' },
  { kind: 'runner', name: 'Zombie Hound', tip: 'Fast and fragile. Gets in close before you notice. Shotguns and grenades clean them up.', from: 7, col: '#c9a06a' },
  { kind: 'launcher', name: 'Missile Bot', tip: 'Plants itself and fires missiles at where a dog was. Keep moving, or put cover between you.', from: 11, col: '#ff7a5a' },
  { kind: 'gunner', name: 'Gunner Bot', tip: 'Digs in behind barricades and returns fire. Flank it: shots from the side hit much harder.', from: 0, col: '#8fa3b8' },
  { kind: 'mortar', name: 'Mortar Bot', tip: 'Lobs shells from behind cover. When you see the ring on the ground, drag the pack out of it.', from: 0, col: '#9a8ac0' },
  { kind: 'boss', name: 'Dragon Bosses', tip: 'Every 10th stage. ' + DRAKES.length + ' dragons, each with a signature move. Dodge the rings; they enrage below 35% health.', from: 10, col: '#c04aff' },
]
const st = () => xs('codex', () => ({ kills: {} as Record<string, number>, claimed: [] as string[], seeded: false }))
const GEMS = 5
const found = (f: Foe) => (st().kills[f.kind] ?? 0) > 0
const claimable = (f: Foe) => found(f) && !st().claimed.includes(f.kind)
export const codexReady = () => FOES.filter(claimable).length

ON.kill.push(k => { const s = st(); s.kills[k.kind] = (s.kills[k.kind] ?? 0) + 1 })
// players from before the codex: count what they have clearly already met
ON.load.push(() => {
  const s = st(); if (s.seeded) return; s.seeded = true
  for (const f of FOES) if (f.from > 0 && G.best > f.from && !s.kills[f.kind]) s.kills[f.kind] = f.kind === 'boss' ? Math.floor(G.best / 10) : 1
})

let tab = 0, sel = -1
const owns = (r: number) => r < 2 || G.owned.includes(r)
function drawDogs(ctx: Ctx, t: number) {
  if (sel >= 0) {
    const d = ROSTER[sel], have = owns(sel)
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(16, 100, W - 32, 440, 16); ctx.fill()
    ctx.save(); ctx.translate(W / 2, 190); ctx.scale(3.2, 3.2); if (!have) ctx.globalAlpha = 0.18; drawDogPortrait(ctx, d, 0, 0, t); ctx.restore()
    text(ctx, have ? d.n : '???', W / 2, 270, 26, '#fff')
    text(ctx, d.breed + '  ·  ' + d.role, W / 2, 296, 13, '#ffd84a')
    let y = wrap(ctx, have ? BIO[d.n] ?? '' : 'Not in your kennel yet. ' + (d.cost ? 'Adopt for ' + d.cost + ' coins in the Kennel.' : ''), W / 2, 328, W - 70, 13, '#dfe9e4')
    if (d.perkText) { y += 6; ctx.fillStyle = 'rgba(82,210,115,.15)'; ctx.beginPath(); ctx.roundRect(36, y - 4, W - 72, 34, 10); ctx.fill(); wrap(ctx, d.perkText, W / 2, y + 13, W - 90, 12, '#9fe8b4') }
    if (d.n === 'Rudy') text(ctx, 'Ability: Tank mode (takes 40% damage, hits 1.5x)', W / 2, 500, 11, '#9fb5aa')
    if (d.n === 'Cooper') text(ctx, 'Ability: Panic mode (hits 2.3x, takes 2.5x)', W / 2, 500, 11, '#9fb5aa')
    button(ctx, 'cx_back', W / 2 - 50, 512, 100, 22, { ...GREY, label: 'All dogs', size: 11 })
    return
  }
  const cw = (W - 32 - 8) / 2, ch = 84
  ROSTER.forEach((d, i) => {
    const x = 16 + (i % 2) * (cw + 8), y = 100 + Math.floor(i / 2) * (ch + 6), have = owns(i)
    button(ctx, 'cx_d' + i, x, y, cw, ch, have ? { top: '#36505e', bot: '#22343e' } : { top: '#2c363c', bot: '#1c2428' })
    ctx.save(); ctx.translate(x + 36, y + 40); ctx.scale(1.35, 1.35); if (!have) ctx.globalAlpha = 0.18; drawDogPortrait(ctx, d, 0, 0, t); ctx.restore()
    text(ctx, have ? d.n : '???', x + 72, y + 30, 15, have ? '#fff' : '#8a979c', 'left')
    text(ctx, d.role, x + 72, y + 50, 11, have ? '#ffd84a' : '#6f7b80', 'left')
  })
}
function drawFoes(ctx: Ctx, t: number) {
  const s = st()
  FOES.forEach((f, i) => {
    const y = 100 + i * 66, ok = found(f), n = s.kills[f.kind] ?? 0
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(16, y, W - 32, 60, 12); ctx.fill()
    ctx.save(); ctx.beginPath(); ctx.roundRect(20, y + 4, 56, 52, 10); ctx.clip(); ctx.translate(48, y + 34); const sc = f.kind === 'boss' ? 0.55 : 1.1; ctx.scale(sc, sc); if (!ok) ctx.globalAlpha = 0.15; drawEnemyPortrait(ctx, f.kind, 0, -4, t, Math.floor(t / 3) % 4); ctx.restore()
    text(ctx, ok ? f.name : '???', 86, y + 15, 14, ok ? f.col : '#8a979c', 'left')
    if (ok) wrap(ctx, f.tip, 86, y + 32, claimable(f) ? 170 : 238, 9, '#c9d8d0', 'left', 11)
    else text(ctx, f.from > 0 ? 'Appears from stage ' + f.from : 'Hides behind barricades', 86, y + 34, 10, '#7f929a', 'left')
    if (claimable(f)) button(ctx, 'cx_c' + i, W - 84, y + 14, 62, 32, { ...GOLD, label: '+' + GEMS, icon: 'gem', size: 12 })
    else if (ok) text(ctx, n.toLocaleString('en-US'), W - 26, y + 15, 11, '#7f929a', 'right')
  })
}
function draw(ctx: Ctx, t: number) {
  panel(ctx, 'Codex')
  button(ctx, 'cx_t0', 16, 54, (W - 40) / 2, 36, tab === 0 ? { ...GREEN, label: 'Dogs', size: 14 } : { ...GREY, label: 'Dogs', size: 13 })
  button(ctx, 'cx_t1', 24 + (W - 40) / 2, 54, (W - 40) / 2, 36, tab === 1 ? { ...GREEN, label: 'Bestiary', size: 14 } : { ...GREY, label: 'Bestiary' + (codexReady() ? ' (' + codexReady() + ')' : ''), size: 13 })
  if (tab === 0) drawDogs(ctx, t); else drawFoes(ctx, t)
}
addScreen({
  tile: { id: 'codex', label: 'Codex', sub: () => codexReady() ? codexReady() + ' new entr' + (codexReady() > 1 ? 'ies' : 'y') : 'Dogs and enemies', icon: 'shield', col: '#c9a6ff', badge: () => codexReady() > 0 },
  section: 'grow', minor: true, unlock: 2, draw,
  button: k => {
    if (!k.startsWith('cx_')) return false
    if (k === 'cx_t0') { tab = 0; sel = -1 } else if (k === 'cx_t1') tab = 1
    else if (k === 'cx_back') sel = -1
    else if (k.startsWith('cx_d')) sel = +k.slice(4)
    else if (k.startsWith('cx_c')) { const f = FOES[+k.slice(4)]; if (f && claimable(f)) { st().claimed.push(f.kind); G.gems += GEMS; save(); Audio_.coins(); G.banner = { text: f.name + ' discovered', sub: '+' + GEMS + ' gems', t: 1.4 } } }
    return true
  },
})

