/**
 * Cloud save (opt-in, Supabase). Switch it on in Menu > More > Save Data; the save is uploaded every few minutes and whenever
 * the app goes to the background. Moving to a new phone: copy your recovery code, then paste it on the new device. The code
 * carries your player identity too, so your leaderboard entry, clan and Dog Park pack come with you.
 * Needs supabase/cloud.sql (after clans.sql). Without it, the section explains cloud save isn't available yet.
 */
import { G, save } from './sim'
import { HOOK } from './ext'
import { rpc, secret } from './clannet'
import { playerId } from './leaderboard'
import { SAVE_SECTIONS } from './savedata'
import { LB_URL } from './config'
import { track } from './telemetry'

const KEY = 'ig_cloud', LAST = 'ig_cloud_at'
const ls = (k: string, v?: string | null): string | null => { try { if (v === null) localStorage.removeItem(k); else if (v !== undefined) localStorage.setItem(k, v); return localStorage.getItem(k) } catch { return null } }
export const cloudOn = () => ls(KEY) === '1'
export const recoveryCode = () => 'WWC.' + playerId().replace(/-/g, '') + '.' + secret()
export function parseRecovery(code: string): { id: string; secret: string } | null {
  const m = /^WWC\.([0-9a-f]{32})\.([0-9a-f]{32,128})$/i.exec(code.trim().replace(/\s+/g, ''))
  if (!m) return null
  const h = m[1].toLowerCase()
  return { id: h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20), secret: m[2].toLowerCase() }
}

let lastUp = 0
export async function upload(force = false): Promise<string> {
  if (!cloudOn() || !LB_URL) return 'off'
  if (!force && Date.now() - lastUp < 170000) return 'wait'
  lastUp = Date.now(); save()
  try {
    const raw = ls('ig_save') ?? '{}'
    const r = await rpc<string>('cloud_put', { p_id: playerId(), p_secret: secret(), p_data: raw, p_stage: G.best })
    if (r === 'ok') { ls(LAST, String(Date.now())); return 'ok' }
    return r
  } catch { return 'offline' }
}
export async function restore(code: string): Promise<string> {
  const k = parseRecovery(code); if (!k) return 'That recovery code is not valid. Copy all of it, starting with WWC.'
  try {
    const r = await rpc<{ data?: string; stage?: number; err?: string }>('cloud_get', { p_id: k.id, p_secret: k.secret })
    if (r.err === 'none') return 'No cloud save found for that code.'
    if (r.err || !r.data) return 'That recovery code was not accepted.'
    HOOK.noSave = true
    const cur = ls('ig_save'); if (cur) ls('ig_save_bak', cur)
    ls('ig_save', r.data); ls('ig_pid', k.id); ls('ig_csec', k.secret); ls(KEY, '1'); track('cloud_restore')
    location.reload(); return 'ok'
  } catch { return 'No connection. Try again.' }
}

setInterval(() => { try { if (!document.hidden) void upload() } catch { /* not ready */ } }, 30000)
try { document.addEventListener('visibilitychange', () => { if (document.hidden) void upload(true) }) } catch { /* no document */ }

SAVE_SECTIONS.push(status => {
  const el = (tag: string, css: string, txt = '') => { const e = document.createElement(tag); e.style.cssText = css; e.textContent = txt; return e }
  const h = el('div', 'font:700 15px system-ui;color:#ffb347;margin:12px 0 4px', 'Cloud save')
  const when = () => { const t = Number(ls(LAST) || 0); return t ? 'Last cloud save: ' + new Date(t).toLocaleString() : 'Not uploaded yet.' }
  const info = el('div', 'color:#9fb3ba;font-size:12px;margin:2px 0 6px', cloudOn() ? when() : 'Keeps a copy of your progress online so a new phone or a reinstall does not lose it. Off by default.')
  const btn = (t: string, bg: string) => { const b = el('button', `background:${bg};color:#fff;border:0;border-radius:10px;padding:10px 14px;font:700 14px system-ui;margin:4px 6px 4px 0;cursor:pointer`, t) as HTMLButtonElement; return b }
  const say = (t: string, ok = true) => { status.style.color = ok ? '#7fe0a0' : '#ff8a7a'; status.textContent = t }
  const toggle = btn(cloudOn() ? 'Cloud save: ON' : 'Turn on cloud save', cloudOn() ? '#2f8a45' : '#3b6fd0')
  const codeBox = el('textarea', 'width:100%;height:56px;background:#0e171d;color:#e6eef0;border:1px solid #2b3d49;border-radius:10px;padding:8px;font:11px monospace;box-sizing:border-box;display:' + (cloudOn() ? 'block' : 'none')) as HTMLTextAreaElement
  codeBox.readOnly = true; codeBox.value = cloudOn() ? recoveryCode() : ''
  const copy = btn('Copy recovery code', '#4a5c66'); copy.style.display = cloudOn() ? 'inline-block' : 'none'
  copy.onclick = async () => { codeBox.select(); try { await navigator.clipboard.writeText(codeBox.value); say('Recovery code copied. Keep it private: it unlocks your save.') } catch { say('Press and hold the box, then Copy.') } }
  toggle.onclick = async () => {
    if (cloudOn()) { ls(KEY, null); toggle.textContent = 'Turn on cloud save'; toggle.style.background = '#3b6fd0'; codeBox.style.display = 'none'; copy.style.display = 'none'; info.textContent = 'Cloud save is off. Your existing cloud copy stays until you turn it back on.'; return }
    ls(KEY, '1'); say('Uploading...'); const r = await upload(true)
    if (r === 'ok') { toggle.textContent = 'Cloud save: ON'; toggle.style.background = '#2f8a45'; codeBox.value = recoveryCode(); codeBox.style.display = 'block'; copy.style.display = 'inline-block'; info.textContent = when(); say('Saved to the cloud. Copy your recovery code and keep it somewhere safe.'); track('cloud_on') }
    else { ls(KEY, null); say(r === 'offline' ? 'No connection. Try again.' : 'Cloud save is not available yet.', false) }
  }
  const inp = el('textarea', 'width:100%;height:56px;background:#0e171d;color:#e6eef0;border:1px solid #2b3d49;border-radius:10px;padding:8px;font:11px monospace;box-sizing:border-box') as HTMLTextAreaElement
  inp.placeholder = 'Paste a recovery code (WWC...) to load a cloud save on this device'
  const rst = btn('Restore cloud save', '#c4631a'); let armed = false
  rst.onclick = async () => {
    if (!parseRecovery(inp.value)) { say('That recovery code is not valid. Copy all of it, starting with WWC.', false); return }
    if (!armed) { armed = true; rst.textContent = 'Tap again to replace progress'; say('This replaces your current progress on this device.', false); return }
    say('Loading...'); const r = await restore(inp.value); if (r !== 'ok') say(r, false)
  }
  return [h, info, toggle, codeBox, copy, inp, rst]
})
