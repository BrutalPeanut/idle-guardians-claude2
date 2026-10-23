/** Skill tree: three branches of four skills, bought with Paw Points (earned by reaching new stages and by Rebirth). */
export type Branch = 'fang' | 'fur' | 'nose'
export interface Skill { id: string; branch: Branch; name: string; desc: string; max: number; need?: number /* best stage needed before it can be bought */ }
export const BRANCHES: { id: Branch; name: string; col: string }[] = [
  { id: 'fang', name: 'Fang', col: '#ff6a5a' }, { id: 'fur', name: 'Fur', col: '#5be07f' }, { id: 'nose', name: 'Nose', col: '#ffd84a' },
]
export const SKILLS: Skill[] = [
  { id: 'sharp',   branch: 'fang', name: 'Sharp Teeth',     desc: '+3% damage per rank', max: 5 },
  { id: 'quick',   branch: 'fang', name: 'Quick Draw',      desc: '+2% fire rate per rank', max: 5 },
  { id: 'keen',    branch: 'fang', name: 'Keen Eyes',       desc: '+2% crit chance per rank', max: 5 },
  { id: 'flanker', branch: 'fang', name: 'Flank Master',    desc: '+8% flanking bonus per rank', max: 5 },
  { id: 'splash',  branch: 'fang', name: 'Splash Rounds',   desc: 'Bullets burst on hit: 35% damage to foes within 30px', max: 1, need: 12 },
  { id: 'coat',    branch: 'fur',  name: 'Thick Coat',      desc: '+4% max HP per rank', max: 5 },
  { id: 'bunker',  branch: 'fur',  name: 'Dig In',          desc: '+8% cover HP per rank', max: 5 },
  { id: 'aegisS',  branch: 'fur',  name: 'Shield Shine',    desc: 'Shield lasts +0.4s per rank', max: 5 },
  { id: 'recov',   branch: 'fur',  name: 'Quick Recovery',  desc: 'Downed dogs return 1s sooner per rank', max: 5 },
  { id: 'gold',    branch: 'nose', name: 'Gold Nose',       desc: '+4% kill gold per rank', max: 5 },
  { id: 'hunter',  branch: 'nose', name: 'Treasure Hunter', desc: 'Chests lean +3% toward rarer gear per rank', max: 5 },
  { id: 'boomS',   branch: 'nose', name: 'Grenadier',       desc: 'Grenade +8% damage, 3% faster cooldown per rank', max: 5 },
  { id: 'keeper',  branch: 'nose', name: 'Stash Keeper',    desc: 'Idle stash holds +10% more per rank', max: 5 },
]
export const RESPEC_GEMS = 5
/** Total points earned: one per 2 stages of your best run, plus 3 per Rebirth. */
export const pointsEarned = (best: number, rebirths: number) => Math.floor(best / 2) + 3 * rebirths
