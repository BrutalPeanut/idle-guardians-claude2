# Building the Android / iOS app (Capacitor)

Prerequisites: Node, Android Studio (Android) or Xcode on a Mac (iOS), a Play Console / Apple developer account.

1. Edit `capacitor.config.json`: replace `com.CHANGEME.woofwars` with your permanent app ID (it cannot change after publishing).
2. Install (needs network):
   ```
   npm i @capacitor/core @capacitor-community/admob
   npm i -D @capacitor/cli
   npm i @capacitor/android @capacitor/ios
   ```
3. Build the web bundle and create the native projects:
   ```
   tools/build.sh            # writes capdist/index.html (self-contained, no network needed)
   npx cap add android
   npx cap add ios           # Mac only
   npx cap sync
   ```
4. AdMob app ID (from admob.google.com, *not* an ad unit ID):
   - Android: `android/app/src/main/AndroidManifest.xml`, inside `<application>`:
     `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-XXXX~YYYY"/>`
   - iOS: `ios/App/App/Info.plist`: `GADApplicationIdentifier` = the same ID, plus `NSUserTrackingUsageDescription` and the `SKAdNetworkItems` list from Google's iOS guide.
5. Test with the default build. It uses Google's sample ad units and is safe on your own phone. Open it with `npx cap open android`, press Run.
6. Put your phone's AdMob test-device ID in `ADMOB_TEST_DEVICES` (`src/game/config.ts`). The Android log prints it the first time an ad loads.
7. For the release only: fill `ADMOB_LIVE` in `src/game/config.ts` with your real rewarded unit IDs and build with `VITE_ADS_LIVE=1 tools/build.sh`, then `npx cap sync`. Never run this build on your own phone without step 6.
8. Android Studio: Build > Generate Signed Bundle (AAB). Keep the signing key and its password backed up somewhere safe.
9. Consent: in AdMob, Privacy & messaging, create the GDPR (EEA/UK) message and publish it. The game already asks for consent before any ad request.

Status: config and code are in place, but the native projects have not been generated or run yet (the sandbox that wrote this had no npm access).
