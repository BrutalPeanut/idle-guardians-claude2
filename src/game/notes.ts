// Explainer notes: a card that stays up until the player taps it, or until it has been up long enough to read.
// Banners are for quick feedback and get replaced within a second; anything that teaches goes here instead.
export interface Note { title: string; text: string; at?: number }
export const notes: Note[] = []
export const noteBox: { r: { x: number; y: number; w: number; h: number } | null } = { r: null }

/** Queue a note. Skips it if the same text is already waiting. */
export function note(title: string, text: string) { if (!notes.some(n => n.text === text)) notes.push({ title, text }) }

/** Seconds a note stays up without a tap: about 0.4s per word, never under 8s. */
export function noteHoldS(n: Note) { return Math.max(8, 5 + n.text.split(' ').length * 0.4) }
