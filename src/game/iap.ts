/**
 * "Remove Ads" purchase through RevenueCat (the Capacitor plugin 'Purchases'), phone app only.
 * On the web, or with empty keys, nothing can be bought and the screen says so. The old always-succeeds test stub is gone, so no
 * build can unlock this for free. On the phone, the entitlement is re-checked with RevenueCat at start-up, so a hand-edited save
 * cannot keep ads off.
 */
import { G, save } from './sim'
import { RC_KEYS, RC_ENTITLEMENT } from './config'
import { track } from './telemetry'

interface CustomerInfo { entitlements?: { active?: Record<string, unknown> } }
interface Pkg { identifier: string; product?: { priceString?: string } }
interface PurchasesApi {
  configure: (o: { apiKey: string }) => Promise<void>
  getOfferings: () => Promise<{ current?: { availablePackages?: Pkg[] } }>
  purchasePackage: (o: { aPackage: Pkg }) => Promise<{ customerInfo?: CustomerInfo }>
  restorePurchases: () => Promise<{ customerInfo?: CustomerInfo }>
  getCustomerInfo: () => Promise<{ customerInfo?: CustomerInfo }>
}
export const IAP = { status: 'idle' as 'idle' | 'loading' | 'ready' | 'busy' | 'unavailable', price: '', msg: '', pkg: null as Pkg | null }
let api: PurchasesApi | null = null

function native(): { api: PurchasesApi; key: string } | null {
  try {
    const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; registerPlugin?: (n: string) => unknown } }).Capacitor
    if (!c?.isNativePlatform?.() || !c.registerPlugin) return null
    const key = c.getPlatform?.() === 'ios' ? RC_KEYS.ios : RC_KEYS.android
    return key ? { api: c.registerPlugin('Purchases') as PurchasesApi, key } : null
  } catch { return null }
}
const owns = (ci?: CustomerInfo) => !!ci?.entitlements?.active?.[RC_ENTITLEMENT]
const apply = (ci?: CustomerInfo) => { if (owns(ci) && !G.noAds) { G.noAds = true; save(); track('noads_unlocked') } else if (ci && !owns(ci) && G.noAds) { G.noAds = false; save() } }

/** Call once at start-up. Safe on the web (does nothing). */
export async function initPurchases() {
  const n = native(); if (!n) { IAP.status = 'unavailable'; return }
  IAP.status = 'loading'
  try {
    api = n.api; await api.configure({ apiKey: n.key })
    apply((await api.getCustomerInfo()).customerInfo)
    const off = await api.getOfferings(); IAP.pkg = off.current?.availablePackages?.[0] ?? null
    IAP.price = IAP.pkg?.product?.priceString ?? ''; IAP.status = IAP.pkg ? 'ready' : 'unavailable'
  } catch { IAP.status = 'unavailable' }
}
export async function buyNoAds() {
  if (!api || !IAP.pkg || IAP.status !== 'ready') return
  IAP.status = 'busy'; IAP.msg = ''; track('noads_buy_tap')
  try { const r = await api.purchasePackage({ aPackage: IAP.pkg }); apply(r.customerInfo); IAP.msg = owns(r.customerInfo) ? 'Thank you! Ads are off.' : '' }
  catch { IAP.msg = 'Purchase cancelled.' }
  IAP.status = 'ready'
}
export async function restoreBuys() {
  if (!api || IAP.status === 'busy') return
  IAP.status = 'busy'; IAP.msg = ''
  try { const r = await api.restorePurchases(); apply(r.customerInfo); IAP.msg = owns(r.customerInfo) ? 'Restored. Ads are off.' : 'No purchase found to restore.' }
  catch { IAP.msg = 'Could not restore. Try again.' }
  IAP.status = 'ready'
}
