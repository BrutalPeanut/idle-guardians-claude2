/**
 * Ad + purchase seams. Rewarded ads only, always player-initiated, never during combat (the game pauses while one plays).
 * MOCK: no real ad network is wired up. `showRewardedAd` runs a fake 3s "TEST AD" screen, then grants the reward.
 * To go live, replace `startMockAd` with the network SDK call and call `finishAd()` from its reward callback.
 */
import { G } from './sim'
import { dayKey } from './quests'
import { track } from './telemetry'
import { ADS_LIVE, ADMOB_LIVE, ADMOB_TEST, ADMOB_TEST_DEVICES } from './config'

export const ADS = { dailyCap: 8, cooldownS: 45, mockDurationS: 3 }
export interface AdPlay { reason: string; t: number; dur: number; done: boolean; grant: () => void; native?: boolean }
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
  const nat = nativeAdMob()
  if (nat) { track('ad_start', { r: reason, m: 'native' }); startNativeAd(nat, reason, grant); return 'ok' }
  track('ad_start', { r: reason, m: 'mock' }); startMockAd(reason, grant); return 'ok'
}

// ---- real ads (only inside the Capacitor phone app) ----
interface Cap { isNativePlatform?: () => boolean; getPlatform?: () => string; registerPlugin?: (n: string) => unknown }
interface AdMobApi { requestConsentInfo?: () => Promise<{ status?: string; isConsentFormAvailable?: boolean; canRequestAds?: boolean }>; showConsentForm?: () => Promise<{ canRequestAds?: boolean }>; initialize: (o: object) => Promise<void>; prepareRewardVideoAd: (o: object) => Promise<unknown>; showRewardVideoAd: () => Promise<unknown> }
let adInit: Promise<void> | null = null
/** The AdMob plugin, or null on the web (the game then uses the fake TEST AD, which can never touch a real ad network). */
function nativeAdMob(): { api: AdMobApi; platform: 'android' | 'ios' } | null {
  try {
    const c = (window as unknown as { Capacitor?: Cap }).Capacitor
    if (!c?.isNativePlatform?.() || !c.registerPlugin) return null
    const platform = c.getPlatform?.() === 'ios' ? 'ios' : 'android'
    return { api: c.registerPlugin('AdMob') as AdMobApi, platform }
  } catch { return null }
}
/** Which unit a native ad uses. Live IDs only in a live build with IDs filled in; otherwise Google's test unit. */
export function adUnitId(platform: 'android' | 'ios') { return ADS_LIVE && ADMOB_LIVE[platform] ? ADMOB_LIVE[platform] : ADMOB_TEST[platform] }
export const adsAreTest = (platform: 'android' | 'ios' = 'android') => adUnitId(platform) === ADMOB_TEST[platform]
function startNativeAd(n: { api: AdMobApi; platform: 'android' | 'ios' }, reason: string, grant: () => void) {
  adState.play = { reason, t: 0, dur: 1e9, done: false, grant, native: true }
  const fail = () => { track('ad_fail', { r: reason }); adState.play = null; adState.lastEnd = Date.now() - ADS.cooldownS * 500; G.banner = { text: 'Ad not available', sub: 'Try again in a bit', t: 1.6 } }
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 120000))
  const run = (async () => {
    // consent first (Google's UMP message: shown only where the law requires it), then initialise, then request an ad
    adInit ??= (async () => {
      try { const info = await n.api.requestConsentInfo?.(); if (info?.isConsentFormAvailable && info.status === 'REQUIRED') await n.api.showConsentForm?.() } catch { /* no consent form configured yet: carry on with test ads */ }
      await n.api.initialize({ initializeForTesting: !ADS_LIVE, testingDevices: ADMOB_TEST_DEVICES })
    })()
    await adInit
    await n.api.prepareRewardVideoAd({ adId: adUnitId(n.platform), isTesting: !ADS_LIVE || adsAreTest(n.platform) })
    await n.api.showRewardVideoAd() // resolves with the reward item only once the reward is earned
  })()
  Promise.race([run, timeout]).then(() => { if (!adState.play) return; track('ad_done', { r: reason }); adState.play = null; adState.lastEnd = Date.now(); rollDay(); G.ads.used++; grant() }, () => { adInit = null; if (adState.play) fail() })
}
function startMockAd(reason: string, grant: () => void) { adState.play = { reason, t: 0, dur: ADS.mockDurationS, done: false, grant } }
export function tickAd(dt: number) { const a = adState.play; if (a && !a.native && !a.done && (a.t += dt) >= a.dur) a.done = true }
/** Called when the player taps CLAIM after the ad finishes. */
export function finishAd() {
  const a = adState.play; if (!a || !a.done) return
  track('ad_done', { r: a.reason }); adState.play = null; adState.lastEnd = Date.now(); rollDay(); G.ads.used++; a.grant()
}
