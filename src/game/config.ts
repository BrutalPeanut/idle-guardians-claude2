// Public client config for the global leaderboard (Supabase). The anon key is designed to be public;
// all writes go through the submit_score() function, never direct table access. Leave empty to disable.
export const LB_URL = 'https://mock.supabase.co'   // e.g. https://abcdxyz.supabase.co
export const LB_KEY = 'anon'   // the project's anon/public key
