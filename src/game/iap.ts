/**
 * "Remove Ads" purchase through RevenueCat (the Capacitor plugin 'Purchases'), phone app only.
 * On the web, or with empty keys, nothing can be bought and the screen says so. The old always-succeeds test stub is gone, so no
 * build can unlock this for free. On the phone, the entitlement is re-checked with RevenueCat at start-up, so a hand-edited save
 * cannot keep ads off.
 */
import { G, save, GEM_PACKS } from './sim'
import { RC_KEYS, RC_ENTITLEMENT } from './config'
import { track } from './telemetry'

interface CustomerInfo { entitlements?: { active?: Record<string, unknown> } }
interface Pkg { identifier: string; product?: { identifier?: string; priceString?: string } }
interface PurchasesApi {
  configure: (o: { apiKey: string }) => Promise<void>
  getOfferings: () => Promise<{ current?: { availablePackages?: Pkg[] } }>
  purchasePackage: (o: { aPackage: Pkg }) => Promise<{ customerInfo?: CustomerInfo }>
  restorePurchases: () => Promise<{ customerInfo?: CustomerInfo }>
  getCustomerInfo: () => Promise<{ customerInfo?: CustomerInfo }>
}
export const IAP = { status: 'idle' as 'idle' | 'loading' | 'ready' | 'busy' | 'unavailable', price: '', msg: '', pkg: null as Pkg | null, gems: {} as Record<string, Pkg> }
const pkgFor = (pk: Pkg[], key: string) => pk.find(p => p.identifier === key || p.product?.identifier === key || (p.product?.identifier ?? '').endsWith(key) || p.identifier.endsWith(key))
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
    const off = await api.getOfferings(), pk = off.current?.availablePackages ?? []
    IAP.pkg = pkgFor(pk, 'noads') ?? (pk.length === 1 ? pk[0] : null); for (const g of GEM_PACKS) { const f = pkgFor(pk, g.key); if (f) IAP.gems[g.key] = f }
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

/** Gem packs are consumables: gems are granted on the device the moment the store confirms the purchase. */
export async function buyGems(key: string) {
  const g = GEM_PACKS.find(x => x.key === key), pkg = IAP.gems[key]
  if (!api || !g || !pkg || IAP.status === 'busy') return
  IAP.status = 'busy'; IAP.msg = ''; track('gems_buy_tap', { k: key })
  try { await api.purchasePackage({ aPackage: pkg }); G.gems += g.gems; save(); track('gems_bought', { k: key }); IAP.msg = '+' + g.gems + ' gems. Thank you!' }
  catch { IAP.msg = 'Purchase cancelled.' }
  IAP.status = 'ready'
}
