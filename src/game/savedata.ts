/**
 * Backup and restore for the save, plus the anonymous-usage switch. A plain DOM dialog (not canvas) so the player can use the
 * normal text selection, paste and copy of their phone. The backup code is the save plus a checksum, so a mistyped or truncated
 * code is rejected instead of wrecking progress.
 */
import { save } from './sim'
import { telemetryOn, setTelemetry } from './telemetry'
import { driveAvailable, driveBackup, driveFetch, driveRestore } from './gdrive'

const PREFIX = 'WW1.'
const sum = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0).toString(16).padStart(8, '0') }
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const unb64 = (s: string) => decodeURIComponent(escape(atob(s)))

export function makeCode(): string { save(); const raw = localStorage.getItem('ig_save') ?? '{}'; return PREFIX + b64(raw) + '.' + sum(raw) }
/** Returns the save JSON text if the code is valid, otherwise null. */
export function parseCode(code: string): string | null {
  try {
    const c = code.trim().replace(/\s+/g, ''); if (!c.startsWith(PREFIX)) return null
    const [body, ck] = c.slice(PREFIX.length).split('.'); if (!body || !ck) return null
    const raw = unb64(body); if (sum(raw) !== ck) return null
    const o = JSON.parse(raw); if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.stage !== 'number' || !Array.isArray(o.bench)) return null
    return raw
  } catch { return null }
}
export function restoreFromCode(code: string): boolean {
  const raw = parseCode(code); if (!raw) return false
  try { const cur = localStorage.getItem('ig_save'); if (cur) localStorage.setItem('ig_save_bak', cur); localStorage.setItem('ig_save', raw); location.reload(); return true } catch { return false }
}

export function openSaveData() {
  if (document.getElementById('ww-save')) return
  const wrap = document.createElement('div'); wrap.id = 'ww-save'
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(4,8,12,.88);display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.45 system-ui,sans-serif;color:#e6eef0'
  const box = document.createElement('div'); box.style.cssText = 'width:100%;max-width:420px;max-height:100%;overflow:auto;background:#17232c;border:1px solid #2b3d49;border-radius:16px;padding:16px'
  const btn = (t: string, bg: string) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = `background:${bg};color:#fff;border:0;border-radius:10px;padding:10px 14px;font:700 14px system-ui;margin:4px 6px 4px 0;cursor:pointer`; return b }
  const ta = () => { const t = document.createElement('textarea'); t.style.cssText = 'width:100%;height:84px;background:#0e171d;color:#e6eef0;border:1px solid #2b3d49;border-radius:10px;padding:8px;font:12px monospace;box-sizing:border-box'; return t }
  const h = (t: string) => { const e = document.createElement('div'); e.textContent = t; e.style.cssText = 'font:700 15px system-ui;color:#ffb347;margin:12px 0 4px'; return e }
  const note = (t: string) => { const e = document.createElement('div'); e.textContent = t; e.style.cssText = 'color:#9fb3ba;font-size:12px;margin:2px 0 6px'; return e }
  const title = document.createElement('div'); title.textContent = 'Save Data'; title.style.cssText = 'font:700 18px system-ui'
  const status = document.createElement('div'); status.style.cssText = 'min-height:18px;margin-top:8px;font-size:13px;color:#7fe0a0'

  const out = ta(); out.readOnly = true; out.value = makeCode()
  const copy = btn('Copy backup code', '#2f8a45'); copy.onclick = async () => { out.select(); try { await navigator.clipboard.writeText(out.value); status.textContent = 'Copied. Keep it somewhere safe.' } catch { status.textContent = 'Press and hold the box, then Copy.' } }
  const inp = ta(); inp.placeholder = 'Paste a backup code here'
  const rst = btn('Restore from code', '#c4631a'); let armed = false
  rst.onclick = () => {
    if (!parseCode(inp.value)) { status.style.color = '#ff8a7a'; status.textContent = 'That code is not valid. Check you copied all of it.'; return }
    if (!armed) { armed = true; rst.textContent = 'Tap again to replace progress'; status.style.color = '#ffd84a'; status.textContent = 'This replaces your current progress on this device.'; return }
    restoreFromCode(inp.value)
  }
  const drive: HTMLElement[] = []
  if (driveAvailable()) {
    const run = async (f: () => Promise<void>) => { status.style.color = '#7fe0a0'; status.textContent = 'Working...'; try { await f() } catch (e) { status.style.color = '#ff8a7a'; status.textContent = (e as Error).message } }
    const up = btn('Back up to Google Drive', '#3b6fd0'); up.onclick = () => run(async () => { await driveBackup(); status.textContent = 'Saved to your Google Drive.' })
    const dn = btn('Restore from Google Drive', '#3b6fd0'); let dArmed = false
    dn.onclick = () => run(async () => {
      const code = await driveFetch(); if (!code) { status.style.color = '#ffd84a'; status.textContent = 'No backup found in this Google account.'; return }
      if (!dArmed) { dArmed = true; dn.textContent = 'Tap again to replace progress'; status.style.color = '#ffd84a'; status.textContent = 'Backup found. This replaces your current progress.'; return }
      driveRestore(code)
    })
    drive.push(h('Google Drive'), note('Sign in with Google to keep a backup in your own Drive. The game can only see its own hidden file.'), up, dn)
  }
  const tel = document.createElement('label'); tel.style.cssText = 'display:flex;gap:8px;align-items:center;margin:14px 0 4px;font-size:13px'
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = telemetryOn(); cb.onchange = () => setTelemetry(cb.checked)
  tel.append(cb, document.createTextNode('Share anonymous usage and crash reports'))
  const close = btn('Close', '#4a5c66'); close.onclick = () => wrap.remove()
  box.append(title, h('Back up'), note('A code with all your progress. Use it to move to a new phone or recover after a reinstall.'), out, copy, h('Restore'), note('Paste a code from another device or an earlier backup.'), inp, rst, ...drive, status, tel, close)
  wrap.append(box); wrap.addEventListener('pointerdown', e => { if (e.target === wrap) wrap.remove() }); document.body.appendChild(wrap)
}
