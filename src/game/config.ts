// Public client config for the global leaderboard (Supabase). The anon key is designed to be public;
// all writes go through the submit_score() function, never direct table access. Leave empty to disable.
/** Scores are client-reported and not yet verified on the server. Keep false until submit_score validates them; the board then shows only the local best. */
export const LB_PUBLIC = false
export const LB_URL = 'https://mumuatyqwekzijuffrzw.supabase.co'   // e.g. https://abcdxyz.supabase.co
export const LB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bXVhdHlxd2VremlqdWZmcnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzU5NTMsImV4cCI6MjEwNzMxMTk1M30.FLTuroU97jiUXeL_rDagMuRx5FWfgnQarCEZ52T7yfw'   // the project's anon/public key

// ---- Ads (AdMob via the Capacitor phone app) ----
// SAFETY: real ad units are used ONLY in a build made with VITE_ADS_LIVE=1. Every other build (dev, web, the public site, the
// artifact, and any phone build you test with) is forced onto Google's official TEST ad units, so you can never serve or click
// real ads on your own devices. Test ads are Google's own and carry no ban risk.
export const ADS_LIVE = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ADS_LIVE) === '1'
/** Your real rewarded ad unit IDs (from AdMob). Leave empty until the app is approved; with empty IDs even a live build falls back to the test units. */
export const ADMOB_LIVE = { android: '', ios: '' }
/** Google's published sample rewarded units. */
export const ADMOB_TEST = { android: 'ca-app-pub-3940256099942544/5224354917', ios: 'ca-app-pub-3940256099942544/1712485313' }
/** Extra safety net for live builds: AdMob test-device IDs (printed in the Android log as "Use RequestConfiguration...setTestDeviceIds"). Real units then serve test ads on these phones. */
export const ADMOB_TEST_DEVICES: string[] = []

/** Public pages used by the in-game Privacy & Support tile and by the store listings. */
export const SITE_URL = 'https://brutalpeanut.github.io/idle-guardians-claude2/'
export const PRIVACY_URL = SITE_URL + 'privacy.html'

/** Shown in crash and usage reports so we can tell builds apart. Bump on each release. */
export const APP_VER = '0.1.0'

// ---- In-app purchase (RevenueCat, used only inside the phone app) ----
// Create a RevenueCat project, add the Play (and App Store) app, make an entitlement called "no_ads" and an offering with one
// product, then paste the PUBLIC SDK keys here. With empty keys the Remove Ads screen says purchases are unavailable.
export const RC_KEYS = { android: '', ios: '' }
export const RC_ENTITLEMENT = 'no_ads'

/** Google OAuth Web client ID (Google Cloud Console > Credentials). Empty hides the Drive backup. Not a secret. */
export const GOOGLE_CLIENT_ID = ''
