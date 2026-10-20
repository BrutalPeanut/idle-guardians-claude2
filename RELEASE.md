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
- Children: privacy.html says the game is not directed to under-13s. Cartoon dogs may still read as child-directed; the audience decision must match that statement.
- Never tested on a real phone by me; only headless Chromium.
- Pacing and the grenade/gun balance were tuned with an automated player, not human play.

## Backend and purchase setup
- **Telemetry:** run `supabase/telemetry.sql` once in the Supabase SQL editor. Until then, events are silently dropped.
- **Other purchases:** gem packs (gems_s/m/l), Starter Pack (starter), Season Pass (pass_plus), and cosmetic collars (cos_gold/cos_neon/cos_royal) are also RevenueCat products. Gems and passes are granted on-device only, so they need server-side receipt validation before launch.
- **Remove Ads:** create a non-consumable product, link it in RevenueCat to an entitlement named `no_ads`, put the public SDK keys in `RC_KEYS` (src/game/config.ts), and install `@revenuecat/purchases-capacitor`. Untested against the real plugin; test with a Play licence tester first.
- **Google Drive backup (web):** in Google Cloud Console create an OAuth *Web* client, enable the Drive API, add the site URL as an authorised JavaScript origin, set the `drive.appdata` scope on the consent screen, and paste the client ID into `GOOGLE_CLIENT_ID` (src/game/config.ts). Empty hides the buttons. Not available in the installed app (Google blocks webview sign-in); it uses the backup code.

## Treat Club (monthly membership)
- Play Console: create an auto-renewing **subscription** (suggested $4.99/month). App Store: same, in a subscription group.
- RevenueCat: attach it to a new entitlement named `treat_club`, and add a package with identifier `treat_club` to the current offering.
- Perks while active: 20 gems to claim per day, +25% idle stash cap, +1 Boss Raid attempt per daily claim. Never gates content.
- The entitlement is re-checked on start-up and cached with its expiry, so perks work offline until the paid period ends; a refund/cancel ends them at the next start-up.
- Store listing must mention the subscription, price and auto-renewal (the in-game screen already does).

## Triggered offers
- Two one-time consumable products in the current RevenueCat offering, package identifiers `offer_wall` (suggested $2.99) and `offer_rebirth` (suggested $4.99).
- Wall Breaker appears once, after the first time a stage walls the player (2+ wipes); Rebirth Bundle appears once, right after the first Rebirth. Each then sits in Menu > Rewards > Offers for 48 hours. Never shown on the web or if the product isn't configured.

## Online clans
- Run `supabase/clans.sql` once in the Supabase SQL editor. Until then the game keeps the practice clans (labelled as simulated).
- All clan reads/writes are SECURITY DEFINER functions; tables are not readable by the anon key. Writes require the player id plus a per-device secret (stored hashed), and rosters never return player ids.
- Limits: 30 members per clan, 2 new clans per player per day, names/tags filtered to letters, numbers, spaces, _ and -.

## Dog Park (async PvP)
- Run `supabase/park.sql` once, after `clans.sql` (it reuses the per-device secret). Until then players get practice battles against AI packs (labelled).
- Snapshots (firepower = best smoothed DPS seen, health = pack max HP) are client-reported like the leaderboard: fine for a casual ladder, not for prizes.

## Cloud save
- Run `supabase/cloud.sql` once, after `clans.sql`. Opt-in from Menu > More > Save Data. The privacy page now covers cloud save, clans and Dog Park.

## Launch hardening (top-10 review)
- Leaderboard submission is off (`LB_PUBLIC = false` in src/game/config.ts) until submit_score validates scores on the server. Flip it only after that.
- Starter Pack is offered at stage 15 (was 11), so the first 14 stages are fully free.
- Stall watchdog: a walking enemy that sits still for 20 s outside melee range is cleared, so a stage can't stop progressing.
- Regression sweep: `tests/stage_sweep.py` auto-plays ten stages and fails if any stage doesn't clear in 300 simulated seconds or throws. Run it before every release.
- Still open: server-verify gem and pass purchases; real playtest; audience decision (under-13 wording in privacy.html).
