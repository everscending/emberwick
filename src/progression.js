export const XP_PER_ENEMY = 25
export const LEVEL_XP = [0, 150, 225, 300, 375, 450, 525, 600, 700, 800, 900]
export const MAX_LEVEL = LEVEL_XP.length
export const MAX_XP = LEVEL_XP.at(-1)

const LEVEL_REWARDS = [
  'Starting stats',
  'Sword damage +5',
  'Maximum health +20',
  'Charged Slash unlocked — hold attack after a swing',
  'Maximum stamina +20',
  'Movement speed +0.75',
  'Sword damage +5',
  'Flask capacity +1',
  'Maximum health +25',
  'Maximum stamina +25',
  'Ember mastery — sword damage +10',
]
const LEVEL_STATS = [
  {},
  { damage: 25 },
  { hpMax: 120 },
  { charge: true },
  { stamMax: 120 },
  { speed: 8.75 },
  { damage: 30 },
  { flaskMax: 4 },
  { hpMax: 145 },
  { stamMax: 145 },
  { damage: 40 },
]
const ENEMY_XP = { slime: 10, roamingSlime: 10, sentinel: 20, warden: 100 }

export function xpForEnemy(type) {
  return ENEMY_XP[type] ?? XP_PER_ENEMY
}

export function levelForXP(xp) {
  for (let level = MAX_LEVEL; level > 1; level--) {
    if (xp >= LEVEL_XP[level - 1]) return level
  }
  return 1
}

export function progressionForXP(xp) {
  const level = levelForXP(xp)
  const progression = { level, hpMax: 100, stamMax: 100, damage: 20, speed: 8, flaskMax: 3, charge: false }
  for (let i = 1; i < level; i++) Object.assign(progression, LEVEL_STATS[i])
  return progression
}

export function levelReward(level) {
  return LEVEL_REWARDS[level - 1] ?? ''
}

// Small runnable balance check: `node src/progression.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  if (MAX_LEVEL !== 11 || levelForXP(MAX_XP) !== 11) throw new Error('Progression must reach Level 11')
  if (levelForXP(149) !== 1 || levelForXP(150) !== 2 || levelForXP(224) !== 2 || levelForXP(225) !== 3 || levelForXP(899) !== 10) throw new Error('XP thresholds must map to the correct levels')
  if (progressionForXP(225).charge || !progressionForXP(300).charge) throw new Error('Charged Slash must unlock at Level 4')
  const mastered = progressionForXP(MAX_XP)
  if (mastered.damage !== 40 || mastered.hpMax !== 145 || mastered.stamMax !== 145 || mastered.speed !== 8.75 || mastered.flaskMax !== 4 || !mastered.charge) throw new Error('Level boosts must accumulate through Level 11')
  if (LEVEL_REWARDS.length !== MAX_LEVEL || LEVEL_REWARDS.some(reward => !reward)) throw new Error('Every level must describe its reward')
  if (xpForEnemy('slime') !== 10 || xpForEnemy('roamingSlime') !== 10 || xpForEnemy('sentinel') !== 20 || xpForEnemy('warden') !== 100 || xpForEnemy('thornback') !== 25) throw new Error('Enemy XP rewards must remain type-specific')
  console.log('Progression check passed: 11 levels, cumulative boosts, and type-specific enemy XP.')
}
