/** Global leaderboard client (Supabase REST). Everything fails soft: no network or no config just means an empty board. */
import { LB_URL, LB_KEY } from './config'
import { G } from './sim'

export interface Row { id: string; name: string; stage: number; rebirths: number }
export const LB = { status: (LB_URL && LB_KEY ? 'idle' : 'off') as 'off' | 'idle' | 'loading' | 'ok' | 'err', rows: [] as Row[], rank: 0, total: 0, at: 0 }

const ADJ = ['Brave', 'Fluffy', 'Sneaky', 'Zoomy', 'Mighty', 'Sleepy', 'Turbo', 'Lucky', 'Salty', 'Cosmic', 'Wiggly', 'Grumpy']
const DOG = ['Corgi', 'Beagle', 'Husky', 'Pug', 'Lab', 'Doodle', 'Collie', 'Shiba', 'Terrier', 'Poodle', 'Mutt', 'Retriever']
const store = (k: string, v?: string): string | null => { try { if (v !== undefined) localStorage.setItem(k, v); return localStorage.getItem(k) } catch { return null } }
const uuid = () => (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16) })
const rnd = (a: string[]) => a[Math.floor(Math.random() * a.length)]
const makeName = () => rnd(ADJ) + rnd(DOG) + (10 + Math.floor(Math.random() * 90))

export const playerId = () => { let id = store('ig_pid'); if (!id) { id = uuid(); store('ig_pid', id) } return id }
export const playerName = () => { let n = store('ig_pname'); if (!n) { n = makeName(); store('ig_pname', n) } return n }
export function rerollName() { store('ig_pname', makeName()); void submit(true) }

const hdr = () => ({ apikey: LB_KEY, Authorization: 'Bearer ' + LB_KEY, 'Content-Type': 'application/json' })
let lastSent = 0, lastStage = 0, lastReb = -1

/** Push our best stage. Throttled; only sends when something improved (or forced, e.g. after a rename). */
export async function submit(force = false) {
  if (LB.status === 'off') return
  const now = Date.now()
  if (!force && (G.best === lastStage && G.rebirths === lastReb)) return
  if (!force && now - lastSent < 20000) return
  lastSent = now; lastStage = G.best; lastReb = G.rebirths
  try {
    await fetch(LB_URL + '/rest/v1/rpc/submit_score', { method: 'POST', headers: hdr(), keepalive: true, body: JSON.stringify({ p_id: playerId(), p_name: playerName(), p_stage: G.best, p_rebirths: G.rebirths }) })
  } catch { /* offline: try again on the next improvement */ }
}

export async function refresh() {
  if (LB.status === 'off' || LB.status === 'loading') return
  LB.status = 'loading'
  try {
    await submit(true)
    const [top, me] = await Promise.all([
      fetch(LB_URL + '/rest/v1/players?select=id,name,stage,rebirths&order=stage.desc,rebirths.desc,updated_at.asc&limit=50', { headers: hdr() }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() }),
      fetch(LB_URL + '/rest/v1/rpc/my_rank', { method: 'POST', headers: hdr(), body: JSON.stringify({ p_id: playerId() }) }).then(r => r.ok ? r.json() : null),
    ])
    LB.rows = top as Row[]; LB.rank = me?.rank ?? 0; LB.total = me?.total ?? LB.rows.length; LB.status = 'ok'; LB.at = Date.now()
  } catch { LB.status = 'err' }
}
