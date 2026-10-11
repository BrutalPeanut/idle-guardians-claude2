# Release readiness (Woof Wars)

## Ads and purchases
- All ads are rewarded and player-initiated. No interstitials, no banners, no ads during combat. Cap 8/day, 45 s cooldown. Keep it that way.
- Placements today: offline stash 2x, quest 2x, Lucky Spin extra, Boss Raid +1 attempt, blessing reroll, Pack Boost (+50% gold, +25% gun damage, 10 min per ad, 30 min cap).
- `src/game/ads.ts` is still a MOCK (fake 3 s TEST AD). A browser game cannot run AdMob. To ship real ads: wrap the build with Capacitor (iOS + Android), add an AdMob rewarded plugin, replace `startMockAd` with the SDK call, and call `finishAd()` from its reward callback. Do not grant a reward if the ad fails to load.
- `purchase('no_ads')` is a client-side flag in localStorage. Real billing needs Play Billing / StoreKit (or RevenueCat) with receipt validation.

## Must do before launch
1. AdMob account, app IDs and rewarded ad unit IDs; Capacitor wrapper; test on real devices with test ads first.
2. Privacy policy URL (required by both stores and AdMob), including the leaderboard (player id + chosen name) and ad data.
3. Consent: Google UMP consent message for EEA/UK, and Apple ATT prompt on iOS.
4. Audience decision: a game with cartoon dogs reads as child-directed. If it is, ads must be family-safe and personalization limited (COPPA / Play Families). Safer to target 13+ and set content rating and ad settings to match.
5. Real No-Ads purchase with receipt validation.
6. Store assets: icon (favicon draft pending approval), screenshots, description, age rating.
7. Crash and analytics reporting (none today), and a cloud save or export so a cleared browser or new phone does not wipe progress.
8. Leaderboard hardening: scores are client-reported; the server clamps and rate-limits but cannot verify. Fine for launch, not for prizes.

## Known gaps
- Never tested on a real phone by me; only headless Chromium.
- Pacing and the grenade/gun balance were tuned with an automated player, not human play.
