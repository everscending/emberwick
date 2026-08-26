import { gainXP, stats } from './player.js'
import { XP_PER_ENEMY } from './progression.js'
import { addItem, hasItem } from './inventory.js'

export const questState = {
  q1: 0, // 0 not started, 1 active, 2 done — same scale for q2..q4
  q2: 0, // 0 find Fen, 1 solve circle, 2 return with shard, 3 boots received
  q3: 0,
  q4: 0,
  shards: 0, // Ember Shards collected (2 unlock the Keep)
  slimesKilled: 0,
}

export function onEnemyKilled(type) {
  if (type === 'slime') questState.slimesKilled++
  gainXP(type === 'warden' ? 100 : XP_PER_ENEMY)
}

export function currentObjective() {
  if (questState.q1 === 0) return 'Speak with Elder Maren'
  if (questState.q1 === 1)
    return questState.slimesKilled >= 4
      ? 'Return to Elder Maren'
      : `Clear the slimes near the well (${questState.slimesKilled}/4)`
  if (questState.q2 === 0) return 'Find the hermit of the Whispering Forest'
  if (questState.q2 === 1) return 'Wake the stone circle, small to great'
  if (questState.q2 === 2) return 'Return the Ember Shard to Hermit Fen'
  if (questState.q3 === 1) return 'Restore the sunstone’s light'
  if (questState.shards >= 2 && questState.q4 === 0) return 'Ascend to the Ashen Keep'
  if (questState.q4 === 1) return 'Confront the Ash Knight'
  if (questState.q4 === 2) return 'The Great Ember burns again'
  return 'High Jump across the broken bridge (Space)'
}

export function onShardTaken() {
  questState.shards++
  if (questState.q2 === 1) questState.q2 = 2
  else if (questState.q3 === 1) questState.q3 = 2
}

export function hermitDialogue() {
  if (questState.q2 === 0) {
    questState.q2 = 1
    return [
      { name: 'Hermit Fen', text: 'Hm? A knight the size of a loaf. The forest sent you, or the old woman did — same thing, these days.' },
      { name: 'Hermit Fen', text: 'The first shard sleeps beneath the standing stones, far north through the deep wood. They wake for a patient hand.' },
      { name: 'Hermit Fen', text: 'And mind this, little loaf: small to great. Wake them small to great — as embers grow into fires. Rush it, and the wood will answer.' },
    ]
  }
  if (questState.q2 === 1) {
    return [{ name: 'Hermit Fen', text: 'Small to great. Stones are simple folk — it is knights that overcomplicate.' }]
  }
  if (questState.q2 === 2) {
    questState.q2 = 3
    addItem('pegasusBoots')
    stats.abilities.highJump = true
    return [
      { name: 'Hermit Fen', text: 'The shard chose you. Good. The road east is less certain — the bridge has mostly become a memory.' },
      { name: 'Hermit Fen', text: 'Take these Pegasus Boots. They once belonged to a courier who considered roads a polite suggestion. Run at the gap, jump, and tuck. The boots will remember the rest.' },
      { text: 'Pegasus Boots acquired — High Jump unlocked. Press Space while moving.' },
    ]
  }
  return [{ name: 'Hermit Fen', text: 'The circle sang. First time in sixty years. Go on, little loaf — the ruins keep poor company.' }]
}

// world position the compass/minimap should point to for the current objective
export function currentObjectiveTarget() {
  if (questState.q1 === 0) return { x: -8, z: 8 } // Elder Maren
  if (questState.q1 === 1) return questState.slimesKilled >= 4 ? { x: -8, z: 8 } : { x: -8, z: 52 } // slimes at the old well
  if (questState.q2 === 0) return { x: -80, z: 36 } // Hermit Fen, deep southwest
  if (questState.q2 === 1) return { x: -72, z: -18 } // stone circle, far north woods
  if (questState.q2 === 2) return { x: -80, z: 36 } // return to Fen for the Pegasus Boots
  if (questState.q3 === 1) return { x: 54, z: 0 } // the sunstone
  if (questState.shards >= 2 && questState.q4 < 2) return { x: 8, z: -86 } // the Keep
  return { x: 25, z: 2 } // broken bridge
}

// Small runnable quest check: `node src/quests.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  questState.q1 = 2
  hermitDialogue()
  onShardTaken()
  if (questState.q2 !== 2 || !currentObjective().includes('Hermit Fen')) throw new Error('First shard must send the player back to Fen')
  hermitDialogue()
  if (questState.q2 !== 3 || !hasItem('pegasusBoots') || !stats.abilities.highJump) throw new Error('Fen must unlock High Jump with the Pegasus Boots')
  console.log('Pegasus Boots check passed: first shard leads back to Fen and unlocks High Jump.')
}

export function elderDialogue() {
  if (questState.q1 === 0) {
    questState.q1 = 1
    return [
      { name: 'Elder Maren', text: 'Little knight. The Great Ember gutters, and the cold creeps into our fields.' },
      { name: 'Elder Maren', text: 'Slimes have taken the well — even they crave what warmth remains. Drive them out, and we will speak of what comes after.' },
      { text: 'The well. Four of those things, by my count. Best keep the shield up.' },
    ]
  }
  if (questState.q1 === 1 && questState.slimesKilled < 4) {
    return [{ name: 'Elder Maren', text: 'The well, little knight. The slimes will not leave on their own.' }]
  }
  if (questState.q1 === 1) {
    questState.q1 = 2
    return [
      { name: 'Elder Maren', text: 'The well runs clear. You have your mother’s arm — and her stubbornness.' },
      { name: 'Elder Maren', text: 'Now listen. Two shards of the Great Ember remain: one in the forest, one in the drowned ruins. Gather them, then face the Ashen Keep — or the flame dies with all of us.' },
      { text: 'The road will be dangerous. Every enemy I defeat sharpens the ember in me.' },
    ]
  }
  return [{ name: 'Elder Maren', text: 'The forest waits, little knight. Walk with the flame.' }]
}
