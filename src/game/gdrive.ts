/**
 * Optional Google Drive backup. Uses Google Identity Services (token flow) with the drive.appdata scope only, so the game can see
 * a single hidden file of its own and nothing else in the player's Drive. No server, no password, no token is stored: the player
 * taps Back up / Restore, Google asks once, and the token lives in memory for that action.
 * Web only: Google blocks its sign-in inside app webviews, so the installed app keeps using the backup code.
 */
import { GOOGLE_CLIENT_ID } from './config'
import { makeCode, parseCode, restoreFromCode } from './savedata'
import { track } from './telemetry'

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE = 'woofwars-backup.txt'
type TokenResp = { access_token?: string; error?: string }
declare global { interface Window { google?: any; Capacitor?: any } }

export const driveAvailable = () => !!GOOGLE_CLIENT_ID && !window.Capacitor?.isNativePlatform?.()

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true
    s.onload = () => res(); s.onerror = () => rej(new Error('Could not reach Google')); document.head.appendChild(s)
  })
}
async function token(): Promise<string> {
  await loadGsi()
  return new Promise((res, rej) => {
    const c = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPE,
      callback: (r: TokenResp) => r.access_token ? res(r.access_token) : rej(new Error(r.error || 'Sign-in cancelled')),
      error_callback: () => rej(new Error('Sign-in cancelled')),
    })
    c.requestAccessToken()
  })
}
const api = async (t: string, url: string, init: RequestInit = {}) => {
  const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + t } })
  if (!r.ok) throw new Error('Drive error ' + r.status)
  return r
}
async function findId(t: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE}'`)
  const r = await (await api(t, `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`)).json()
  return r.files?.[0]?.id ?? null
}
export async function driveBackup(): Promise<void> {
  const t = await token(); const body = makeCode(); const id = await findId(t)
  if (id) await api(t, `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'text/plain' }, body })
  else {
    const b = '----ww'; const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] })
    await api(t, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` },
      body: `--${b}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: text/plain\r\n\r\n${body}\r\n--${b}--` })
  }
  track('drive_backup')
}
/** Returns the backup code from Drive, or null if none/invalid. */
export async function driveFetch(): Promise<string | null> {
  const t = await token(); const id = await findId(t); if (!id) return null
  const code = await (await api(t, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).text()
  return parseCode(code) ? code : null
}
export function driveRestore(code: string) { track('drive_restore'); return restoreFromCode(code) }
