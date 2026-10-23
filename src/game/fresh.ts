// ?fresh: a separate run in this browser, with its own save keys, so a player's normal save is never read or overwritten.
// The run keeps its progress across visits. ?fresh&reset=1 starts a new run (once per tab, so refreshing doesn't wipe it again).
export const FRESH = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').has('fresh') } catch { return false } })()
if (FRESH) {
  try {
    const p = new URLSearchParams(globalThis.location?.search ?? '')
    if (p.has('reset') && !sessionStorage.getItem('ig_fresh_reset')) {
      localStorage.removeItem('ig_save_fresh'); localStorage.removeItem('ig_save_fresh_bak'); localStorage.removeItem('ig_tut_fresh')
      sessionStorage.setItem('ig_fresh_reset', '1')
    }
  } catch { /* storage unavailable: the run just continues */ }
}
