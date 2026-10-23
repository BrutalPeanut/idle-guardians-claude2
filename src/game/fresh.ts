// ?fresh: a separate run in this browser that starts from the beginning, tutorial included.
// It uses its own save keys, so a player's normal save is never read or overwritten.
// Opening the link in a new tab starts over; refreshing keeps the run (sessionStorage marks the tab as started).
export const FRESH = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').has('fresh') } catch { return false } })()
if (FRESH) {
  try {
    if (!sessionStorage.getItem('ig_fresh_started')) {
      localStorage.removeItem('ig_save_fresh'); localStorage.removeItem('ig_save_fresh_bak')
      sessionStorage.setItem('ig_fresh_started', '1')
    }
  } catch { /* storage unavailable: the run just continues */ }
}
