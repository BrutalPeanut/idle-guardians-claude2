/**
 * Ad + purchase seams. Rewarded ads only, always player-initiated, never during combat (the game pauses while one plays).
 * MOCK: no real ad network is wired up. `showRewardedAd` runs a fake 3s "TEST AD" screen, then grants the reward.
 * To go live, replace `startMockAd` with the network SDK call and call `finishAd()` from its reward callback.
 */
import { G } from './sim'
import { dayKey } from './quests'

export const ADS = { dailyCap: 8, cooldownS: 45, mockDurationS: 3 }
export interface AdPlay { reason: string; t: number; dur: number; done: boolean; grant: () => void }
export const adState: { play: AdPlay | null; lastEnd: number } = { play: null, lastEnd: -1e9 }

function rollDay() { const d = dayKey(); if (G.ads.day !== d) G.ads = { day: d, used: 0 } }
export const adsLeft = () => { rollDay(); return G.noAds ? 99 : Math.max(0, ADS.dailyCap - G.ads.used) }
export const adCooldown = () => Math.max(0, ADS.cooldownS - (Date.now() - adState.lastEnd) / 1000)

/** Ask to show a rewarded ad. `grant` runs only after the ad completes (immediately for No-Ads owners). */
export function showRewardedAd(reason: string, grant: () => void): 'ok' | 'cap' | 'cooldown' | 'busy' {
  if (adState.play) return 'busy'
  if (G.noAds) { grant(); return 'ok' } // No-Ads purchase: keep the reward, skip the ad
  if (adsLeft() <= 0) return 'cap'
  if (adCooldown() > 0) return 'cooldown'
  startMockAd(reason, grant); return 'ok'
}
function startMockAd(reason: string, grant: () => void) { adState.play = { reason, t: 0, dur: ADS.mockDurationS, done: false, grant } }
export function tickAd(dt: number) { const a = adState.play; if (a && !a.done && (a.t += dt) >= a.dur) a.done = true }
/** Called when the player taps CLAIM after the ad finishes. */
export function finishAd() {
  const a = adState.play; if (!a || !a.done) return
  adState.play = null; adState.lastEnd = Date.now(); rollDay(); G.ads.used++; a.grant()
}

/** TEST in-app purchase stub (no real billing). SKUs: 'no_ads'. */
export function purchase(sku: 'no_ads'): boolean { if (sku === 'no_ads') { G.noAds = true; return true } return false }
