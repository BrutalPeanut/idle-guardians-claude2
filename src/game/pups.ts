/**
 * Pups: tiny companions that trot behind the pack and give one bonus each. Every pup is earned by a milestone (no random pulls,
 * nothing for sale). One pup tags along at a time; feed it Bones to level it (up to Lv 10, +15% of its bonus per level).
 */
import { G, save } from './sim'
import { W } from './data'
import type { Guardian } from './data'
import { button, drawPlainDog } from './render'
import { addScreen, panel } from './screens'
import { xs, addBonus, DRAW } from './ext'
import type { BonusKey } from './ext'
import { st as dogSt } from './doglevels'
import { parkWins } from './park'
import { text, GREEN, GREY, GOLD } from './ui'
import { Audio_ } from './audio'
import { track } from './telemetry'
import type { Ctx } from './render'

interface PupDef { id: string; name: string; fur: string; shade: string; ear: string; stat: BonusKey; val: number; desc: string; goal: string; prog: () => number; need: number }
const life = (k: string) => G.life[k] ?? 0
export const PUPS: PupDef[] = [
  { id: 'biscuit', name: 'Biscuit', fur: '#e8c48a', shade: '#c49a5c', ear: '#a87a3a', stat: 'gold', val: 0.05, desc: 'gold from kills', goal: 'Reach stage 15', prog: () => G.best, need: 15 },
  { id: 'pip', name: 'Pip', fur: '#f4f1ec', shade: '#cfc8bd', ear: '#3a3a3a', stat: 'dmg', val: 0.04, desc: 'damage', goal: 'Defeat 5 bosses', prog: () => life('bosses'), need: 5 },
  { id: 'noodle', name: 'Noodle', fur: '#9a6a46', shade: '#6a4228', ear: '#4a2e1a', stat: 'rate', val: 0.03, desc: 'fire rate', goal: 'Merge 200 weapons', prog: () => life('merges'), need: 200 },
  { id: 'pebble', name: 'Pebble', fur: '#cfd6de', shade: '#9aa6b5', ear: '#4b5666', stat: 'hp', val: 0.06, desc: 'max HP', goal: 'Clear 3 Daily Dungeons', prog: () => life('dungeons'), need: 3 },
  { id: 'sprout', name: 'Sprout', fur: '#efb066', shade: '#c47a2c', ear: '#c47a2c', stat: 'stash', val: 0.1, desc: 'idle stash', goal: 'Reach a 7-day login streak', prog: () => G.login.streak, need: 7 },
  { id: 'ember', name: 'Ember', fur: '#5a5662', shade: '#2e2b33', ear: '#2e2b33', stat: 'crit', val: 0.02, desc: 'crit chance', goal: 'Win 5 Dog Park battles', prog: parkWins, need: 5 },
  { id: 'clover', name: 'Clover', fur: '#ecd3a6', shade: '#c49a5c', ear: '#8a5a2a', stat: 'coins', val: 0.1, desc: 'boss coins', goal: 'Finish 10 Boss Raids', prog: () => life('raids'), need: 10 },
  { id: 'pudding', name: 'Pudding', fur: '#f0b468', shade: '#c47f35', ear: '#c47f35', stat: 'dmg', val: 0.03, desc: 'damage', goal: 'Fuse 10 pieces of gear', prog: () => life('fused'), need: 10 },
]
const MAX_LV = 10, PER_LV = 0.15
const st = () => xs('pups', () => ({ got: [] as string[], lv: {} as Record<string, number>, active: '', seen: [] as string[] }))
export const pupLv = (id: string) => st().lv[id] ?? 1
export const pupVal = (p: PupDef) => p.val * (1 + PER_LV * (pupLv(p.id) - 1))
export const feedCost = (lv: number) => 10 * lv
const earned = (p: PupDef) => st().got.includes(p.id)
const claimable = (p: PupDef) => !earned(p) && p.prog() >= p.need
export const pupsReady = () => PUPS.filter(claimable).length

// bonuses: only the active pup counts
for (const p of PUPS) addBonus(p.stat, () => st().active === p.id ? pupVal(p) : 0)

const asGuardian = (p: PupDef): Guardian => ({ n: p.name, breed: 'Pup', role: 'Pup', fur: p.fur, shade: p.shade, ear: p.ear, off: [0, 0], look: 'plain', hpMul: 1, dmgMul: 1, tag: '' })
// the active pup trots just behind the pack
let px = 0, py = 0
DRAW.world.push((ctx, t) => {
  const p = PUPS.find(x => x.id === st().active); if (!p) return
  const tx = G.pack.x + (G.pack.x > 180 ? -58 : 58), ty = G.pack.y + 4
  if (!px && !py) { px = tx; py = ty }
  px += (tx - px) * 0.06; py += (ty - py) * 0.06
  ctx.translate(px, py + Math.abs(Math.sin(t * 7)) * -1.5); ctx.scale(0.55, 0.55); drawPlainDog(ctx, asGuardian(p), 0, 0, 0, t)
})

function draw(ctx: Ctx, t: number) {
  panel(ctx, 'Pups')
  const s = st(), bones = dogSt().bones
  text(ctx, 'Pups are earned, never bought. One tags along at a time.', W / 2, 62, 11, '#9fb5aa')
  text(ctx, bones + ' bones', W / 2, 80, 12, '#f4ead6')
  const cw = (W - 32 - 8) / 2, ch = 104
  PUPS.forEach((p, i) => {
    const x = 16 + (i % 2) * (cw + 8), y = 94 + Math.floor(i / 2) * (ch + 6), got = earned(p), on = s.active === p.id, ready = claimable(p)
    ctx.fillStyle = on ? 'rgba(82,210,115,.18)' : 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 12); ctx.fill()
    if (on) { ctx.strokeStyle = '#52d273'; ctx.lineWidth = 2; ctx.stroke() }
    ctx.save(); ctx.translate(x + 30, y + 42); ctx.scale(0.9, 0.9); if (!got) ctx.globalAlpha = 0.2; drawPlainDog(ctx, asGuardian(p), 0, 0, 0, t); ctx.restore()
    text(ctx, got ? p.name + '  Lv' + pupLv(p.id) : '???', x + 58, y + 16, 13, got ? '#fff' : '#8a979c', 'left')
    text(ctx, '+' + (pupVal(p) * 100).toFixed(pupVal(p) * 100 < 10 ? 1 : 0) + '% ' + p.desc, x + 58, y + 34, 10, got ? '#ffd84a' : '#6f7b80', 'left')
    if (!got) {
      text(ctx, p.goal, x + 58, y + 52, 9, '#9fb5aa', 'left')
      const f = Math.min(1, p.prog() / p.need); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.roundRect(x + 58, y + 62, cw - 68, 7, 3.5); ctx.fill(); ctx.fillStyle = '#52d273'; ctx.beginPath(); ctx.roundRect(x + 58, y + 62, Math.max(4, (cw - 68) * f), 7, 3.5); ctx.fill()
      button(ctx, 'pu_c' + i, x + 8, y + ch - 30, cw - 16, 24, { ...(ready ? GOLD : GREY), label: ready ? 'Adopt!' : Math.min(p.prog(), p.need) + ' / ' + p.need, size: 11, disabled: !ready })
    } else {
      button(ctx, 'pu_a' + i, x + 8, y + ch - 30, (cw - 24) / 2, 24, { ...(on ? GREY : GREEN), label: on ? 'With you' : 'Bring', size: 11, disabled: on })
      const lv = pupLv(p.id), c = feedCost(lv), ok = lv < MAX_LV && bones >= c
      button(ctx, 'pu_f' + i, x + 16 + (cw - 24) / 2, y + ch - 30, (cw - 24) / 2, 24, { ...(ok ? GOLD : GREY), icon: lv < MAX_LV ? 'bone' : undefined, label: lv < MAX_LV ? '' + c : 'MAX', size: 11, disabled: !ok })
    }
  })
}
addScreen({
  tile: { id: 'pups', label: 'Pups', sub: () => pupsReady() ? pupsReady() + ' ready to adopt!' : st().got.length + ' / ' + PUPS.length + ' adopted', icon: 'star', col: '#ff9ad8', badge: () => pupsReady() > 0 },
  section: 'grow', minor: true, unlock: 5, draw,
  button: k => {
    if (!k.startsWith('pu_')) return false
    const p = PUPS[+k.slice(4)], s = st(); if (!p) return true
    if (k.startsWith('pu_c') && claimable(p)) { s.got.push(p.id); if (!s.active) s.active = p.id; save(); Audio_.fanfare(); G.banner = { text: p.name + ' adopted!', sub: '+' + Math.round(p.val * 100) + '% ' + p.desc, t: 1.8 }; track('pup', { p: p.id }) }
    else if (k.startsWith('pu_a') && earned(p)) { s.active = p.id; save(); Audio_.ui() }
    else if (k.startsWith('pu_f') && earned(p)) { const lv = pupLv(p.id), c = feedCost(lv), d = dogSt(); if (lv < MAX_LV && d.bones >= c) { d.bones -= c; s.lv[p.id] = lv + 1; save(); Audio_.merge(1) } }
    return true
  },
})
