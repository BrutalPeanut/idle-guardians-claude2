/**
 * Online clans (Supabase). When the server has the clan functions (supabase/clans.sql), the join screen lists real clans and
 * lets players start their own; clan rosters, "online now", the weekly raid pool and Clan Hunt all use real players.
 * If the server is unreachable or not set up, the game keeps the practice clans (clearly labelled as simulated).
 * Writes carry a per-device secret, so a leaked player id is not enough to act as someone.
 */
import { G, save, joinClan } from './sim'
import { W } from './data'
import { R, button } from './render'
import { XBUTTONS, XAFTER } from './screens'
import { CLANS, PRACTICE, NET, isNet, clanById, weekKey } from './clan'
import type { ClanDef, NetClan, NetMember } from './clan'
import { LB_URL, LB_KEY } from './config'
import { playerId, playerName } from './leaderboard'
import { ON, xs } from './ext'
import { GREEN } from './ui'
import { track } from './telemetry'

const hdr = () => ({ apikey: LB_KEY, Authorization: 'Bearer ' + LB_KEY, 'Content-Type': 'application/json' })
export async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(LB_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: hdr(), body: JSON.stringify(body) })
  if (!r.ok) throw new Error(fn + ' ' + r.status)
  return r.json() as Promise<T>
}
export function secret(): string {
  try {
    let s = localStorage.getItem('ig_csec')
    if (!s) { const a = new Uint8Array(24); crypto.getRandomValues(a); s = Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('ig_csec', s) }
    return s
  } catch { return '' }
}
const st = () => xs('clannet', () => ({ defs: {} as Record<string, ClanDef> }))
const COLS = ['#7fd6a0', '#6fb8ff', '#ffd84a', '#ff9a6a', '#c9a6ff', '#ff6a7a', '#6fe0d8', '#f0b468']
const colFor = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return COLS[Math.abs(h) % COLS.length] }
const toDef = (c: NetClan): ClanDef => ({ id: c.id, name: c.name, tag: c.tag, base: 1, req: c.min_stage, col: colFor(c.id) })

let lastList = 0, lastRoster = 0, lastReport = 0, busy = false
export async function refreshList(force = false) {
  if (!LB_URL || busy || (!force && Date.now() - lastList < 30000)) return
  lastList = Date.now()
  try {
    const list = await rpc<NetClan[]>('clan_list', { p_week: weekKey(), p_limit: 30 })
    NET.on = true; NET.clans = list
    for (const c of list) NET.defs[c.id] = toDef(c)
    CLANS.splice(0, CLANS.length, ...list.map(c => NET.defs[c.id]))
  } catch { NET.on = false; CLANS.splice(0, CLANS.length, ...PRACTICE) } // no server functions yet: practice clans
}
async function refreshRoster(force = false) {
  const c = G.clan; if (!c || !isNet(clanById(c.id)) || (!force && Date.now() - lastRoster < 20000)) return
  lastRoster = Date.now()
  try { NET.roster = await rpc<NetMember[]>('clan_roster', { p_clan: c.id, p_id: playerId() }); NET.rosterOf = c.id } catch { /* keep the last roster */ }
}
async function report(force = false) {
  const c = G.clan; if (!c || !isNet(clanById(c.id)) || (!force && Date.now() - lastReport < 60000)) return
  lastReport = Date.now()
  try {
    const r = await rpc<string>('clan_report', { p_id: playerId(), p_secret: secret(), p_pname: playerName(), p_stage: G.best, p_week: weekKey(), p_dmg: c.wk })
    if (r === 'none') { G.clan = null; save(); G.banner = { text: 'You are no longer in that clan', t: 1.8 } } // left on another device
  } catch { /* offline */ }
}

// keep our own clan resolvable offline, then go online
ON.load.push(() => {
  const s = st(); for (const id in s.defs) NET.defs[id] = s.defs[id]
  setTimeout(() => { void refreshList(true).then(() => report(true)).then(() => refreshRoster(true)) }, 2000)
})
setInterval(() => {
  try {
    if (document.hidden) return
    void report()
    if (R.screen === 'clan') { void refreshList(); void refreshRoster() }
  } catch { /* not ready */ }
}, 5000)
ON.gevent.push(e => { if (e.type === 'raid_end') { lastReport = 0; void report(true) } })

const remember = (d: ClanDef) => { NET.defs[d.id] = d; st().defs = { [d.id]: d }; save() }
async function netJoin(d: ClanDef) {
  if (busy) return; busy = true
  try {
    const r = await rpc<string>('clan_join', { p_id: playerId(), p_secret: secret(), p_clan: d.id, p_pname: playerName(), p_stage: G.best })
    if (r === 'ok' || r === 'member') { remember(d); if (joinClan(d.id)) { G.banner = { text: 'Joined ' + d.name, sub: 'Your raids now count for real clanmates', t: 1.8 }; track('clan_join_net') } void refreshRoster(true); void report(true) }
    else G.banner = { text: ({ full: 'That clan is full', stage: 'Reach stage ' + d.req + ' first', gone: 'That clan no longer exists', auth: 'Could not verify this device' } as Record<string, string>)[r] ?? 'Could not join', t: 1.6 }
  } catch { G.banner = { text: 'No connection', sub: 'Try again in a moment', t: 1.4 } }
  busy = false; void refreshList(true)
}
async function netLeave() { try { await rpc('clan_leave', { p_id: playerId(), p_secret: secret() }) } catch { /* left locally anyway */ } NET.roster = []; NET.rosterOf = ''; void refreshList(true) }

function openCreate() {
  if (document.getElementById('ww-clan')) return
  const wrap = document.createElement('div'); wrap.id = 'ww-clan'
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(4,8,12,.88);display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.45 system-ui,sans-serif;color:#e6eef0'
  const box = document.createElement('div'); box.style.cssText = 'width:100%;max-width:380px;background:#17232c;border:1px solid #2b3d49;border-radius:16px;padding:16px'
  const field = (label: string, ph: string, max: number) => { const l = document.createElement('label'); l.style.cssText = 'display:block;margin:10px 0 2px;font-size:12px;color:#9fb3ba'; l.textContent = label; const i = document.createElement('input'); i.maxLength = max; i.placeholder = ph; i.style.cssText = 'width:100%;box-sizing:border-box;background:#0e171d;color:#e6eef0;border:1px solid #2b3d49;border-radius:10px;padding:10px;font:15px system-ui'; box.append(l, i); return i }
  const title = document.createElement('div'); title.textContent = 'Start a clan'; title.style.cssText = 'font:700 18px system-ui'; box.append(title)
  const name = field('Clan name (3-20 letters or numbers)', 'Good Boys Club', 20), tag = field('Tag (2-4 letters)', 'GBC', 4), min = field('Minimum stage to join', '1', 3)
  min.inputMode = 'numeric'
  const status = document.createElement('div'); status.style.cssText = 'min-height:18px;margin-top:10px;font-size:13px;color:#ff8a7a'
  const row = document.createElement('div'); row.style.cssText = 'margin-top:12px;display:flex;gap:8px'
  const b = (t: string, bg: string) => { const e = document.createElement('button'); e.textContent = t; e.style.cssText = `flex:1;background:${bg};color:#fff;border:0;border-radius:10px;padding:11px;font:700 14px system-ui;cursor:pointer`; return e }
  const go = b('Create', '#2f8a45'), cancel = b('Cancel', '#4a5c66')
  cancel.onclick = () => wrap.remove()
  go.onclick = async () => {
    go.disabled = true; status.textContent = ''
    try {
      const r = await rpc<string>('clan_create', { p_id: playerId(), p_secret: secret(), p_name: name.value, p_tag: tag.value, p_min: Math.max(1, parseInt(min.value || '1', 10) || 1), p_pname: playerName(), p_stage: G.best })
      const err: Record<string, string> = { name: 'Name needs at least 3 letters or numbers.', tag: 'Tag needs 2-4 letters.', taken: 'That name is taken.', member: 'Leave your current clan first.', limit: 'You can start 2 clans a day.', auth: 'Could not verify this device.' }
      if (err[r]) { status.textContent = err[r]; go.disabled = false; return }
      const d: ClanDef = { id: r, name: name.value.trim(), tag: tag.value.trim().toUpperCase(), base: 1, req: Math.max(1, parseInt(min.value || '1', 10) || 1), col: colFor(r) }
      remember(d); joinClan(d.id); track('clan_create'); wrap.remove(); G.banner = { text: d.name + ' founded!', sub: 'Share the name so friends can find it', t: 2 }
      void refreshList(true); void refreshRoster(true)
    } catch { status.textContent = 'No connection. Try again.'; go.disabled = false }
  }
  row.append(go, cancel); box.append(status, row); wrap.append(box)
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) wrap.remove() }); document.body.appendChild(wrap); name.focus()
}

XAFTER.clan = ctx => {
  if (!NET.on || G.clan) return
  button(ctx, 'cn_create', W / 2 - 90, 528, 180, 34, { ...GREEN, label: 'Start your own clan', size: 13 })
}
XBUTTONS.push(k => {
  if (k === 'cn_create') { if (G.best < 3) G.banner = { text: 'Reach stage 3 to start a clan', t: 1.4 }; else openCreate(); return true }
  if (k.startsWith('cj_') && NET.on && !G.clan) { const d = CLANS[+k.slice(3)]; if (d && isNet(d)) { if (G.best < d.req) G.banner = { text: 'Reach stage ' + d.req, sub: 'to join ' + d.name, t: 1.4 }; else void netJoin(d) } return true }
  if (k === 'cleave' && R.leaveArm && G.clan && isNet(clanById(G.clan.id))) { void netLeave(); st().defs = {}; return false } // the core screen then leaves locally
  return false
})
