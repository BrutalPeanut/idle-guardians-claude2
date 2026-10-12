/**
 * Dog cosmetics. Colourways for the collar only: no stat, no balance effect.
 * Non-free looks are sold as one-time store products (cos_<id>), so they must go through the store, never ads.
 */
export const COLLARS = [
  { id: 'red', name: 'Classic red', col: '#d63a3a', free: true },
  { id: 'gold', name: 'Gold', col: '#f5c542', free: false },
  { id: 'neon', name: 'Neon teal', col: '#3cf0ff', free: false },
  { id: 'royal', name: 'Royal purple', col: '#9b59ff', free: false },
] as const
export type CollarId = (typeof COLLARS)[number]['id']
export const collarOf = (id: string) => COLLARS.find(c => c.id === id) ?? COLLARS[0]
