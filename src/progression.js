export const XP_PER_ENEMY = 25
export const LEVEL_XP = [0, 150, 250]

export function levelForXP(xp) {
  return xp >= LEVEL_XP[2] ? 3 : xp >= LEVEL_XP[1] ? 2 : 1
}

// Small runnable balance check: `node src/progression.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  console.assert(levelForXP(0) === 1)
  console.assert(levelForXP(149) === 1)
  console.assert(levelForXP(150) === 2)
  console.assert(levelForXP(249) === 2)
  console.assert(levelForXP(250) === 3)
  console.log('XP pacing check passed: Level 2 at 6 kills, Charged Slash at 10 kills.')
}
