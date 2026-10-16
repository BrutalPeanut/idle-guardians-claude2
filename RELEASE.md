# Release readiness (Woof Wars)

## Ads and purchases
- All ads are rewarded and player-initiated. No interstitials, no banners, no ads during combat. Cap 8/day, 45 s cooldown. Keep it that way.
- Placements today: offline stash 2x, quest 2x, Lucky Spin extra, Boss Raid +1 attempt, blessing reroll, Pack Boost (+50% gold, +25% gun damage, 10 min per ad, 30 min cap).
- `src/game/ads.ts` is still a MOCK (fake 3 s TEST AD). A browser game cannot run AdMob. To ship real ads: wrap the build with Capacitor (iOS + Android), add an AdMob rewarded plugin, replace `startMockAd` with the SDK call, and call `finishAd()` from its reward callback. Do not grant a reward if the ad fails to load.
- `purchase('no_ads')` is a client-side flag in localStorage. Real billing needs Play Billing / StoreKit (or RevenueCat) with receipt validation.

## Testing without risking an AdMob ban
- Real ad units are only ever used by a build made with `VITE_ADS_LIVE=1`. Every other build (dev, web, public site, artifact, and any phone build you test with) is forced onto Google's official sample ad units and `isTesting: true`. Test ads are Google's own and cannot get the account banned.
- Real unit IDs go in `ADMOB_LIVE` in `src/game/config.ts`. If they're empty, even a live build falls back to test units.
- On the web the game uses the fake "TEST AD" screen and never talks to an ad network.
- Before shipping, also add your phone's test-device ID to `ADMOB_TEST_DEVICES` (the Android log prints it the first time an ad loads), so even your release build shows test ads on your own devices.
- Never tap real ads on your own phone, and never test with your live unit on a non-test build.
- The native path (Capacitor plugin calls) is covered by a mocked test only; it has not run against the real AdMob plugin yet.

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

## Backend and purchase setup
- **Telemetry:** run `supabase/telemetry.sql` once in the Supabase SQL editor. Until then, events are silently dropped.
- **Remove Ads:** create a non-consumable product, link it in RevenueCat to an entitlement named `no_ads`, put the public SDK keys in `RC_KEYS` (src/game/config.ts), and install `@revenuecat/purchases-capacitor`. Untested against the real plugin; test with a Play licence tester first.
- **Google Drive backup (web):** in Google Cloud Console create an OAuth *Web* client, enable the Drive API, add the site URL as an authorised JavaScript origin, set the `drive.appdata` scope on the consent screen, and paste the client ID into `GOOGLE_CLIENT_ID` (src/game/config.ts). Empty hides the buttons. Not available in the installed app (Google blocks webview sign-in); it uses the backup code.

## Treat Club (monthly membership)
- Play Console: create an auto-renewing **subscription** (suggested $4.99/month). App Store: same, in a subscription group.
- RevenueCat: attach it to a new entitlement named `treat_club`, and add a package with identifier `treat_club` to the current offering.
- Perks while active: 20 gems to claim per day, +25% idle stash cap, +1 Boss Raid attempt per daily claim. Never gates content.
- The entitlement is re-checked on start-up and cached with its expiry, so perks work offline until the paid period ends; a refund/cancel ends them at the next start-up.
- Store listing must mention the subscription, price and auto-renewal (the in-game screen already does).
