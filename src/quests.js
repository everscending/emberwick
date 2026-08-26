import { gainXP, stats } from './player.js'
import { XP_PER_ENEMY } from './progression.js'
import { addItem, hasItem } from './inventory.js'

const shardPickupSoundUrl = '/assets/audio/zelda-item-2.mp3'
const shardPickupSound = typeof Audio === 'undefined' ? null : new Audio(shardPickupSoundUrl)
if (shardPickupSound) {
  shardPickupSound.preload = 'auto'
  shardPickupSound.volume = 0.65
}

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
  if (shardPickupSound) {
    shardPickupSound.currentTime = 0
    shardPickupSound.play().catch(() => {})
  }
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

export function millieDialogue() {
  const text = questState.q4 === 2
    ? 'The stream is warm again. I had forgotten water could feel alive.'
    : questState.shards >= 2
      ? 'The stream changed when you found that second shard. Even the north road has begun to glow.'
      : questState.q2 >= 2
        ? 'The forest stones are shining through the trees. Fen will want to see what chose you.'
        : questState.q1 === 2
          ? 'The well runs clear. Mind the woods now — Fen says the stones answer patient hands.'
          : 'The well bucket keeps coming back with teeth marks. Maren needs your help.'
  return [{ name: 'Millie', text }]
}

export function tamDialogue() {
  const text = questState.q4 === 2
    ? 'Look north—the ridge is ember-red, not black. You actually brought the dawn back.'
    : questState.shards >= 2
      ? 'Warm lights woke along the northern road. The Keep knows you are coming.'
      : questState.q3 >= 1
        ? 'Those ruin mirrors once carried sunlight. Follow the beam and read what its builders left beside it.'
        : questState.q2 === 3
          ? 'Pegasus Boots? Then the broken bridge is a gap, not a wall. Take a running jump.'
          : 'That gloom on the north ridge has been there a year. That is not weather.'
  return [{ name: 'Tam', text }]
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
  return { x: 21, z: 2 } // west approach to the broken bridge
}

// Small runnable quest check: `node src/quests.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  if (!shardPickupSoundUrl.endsWith('zelda-item-2.mp3')) throw new Error('Shard pickup must use the Zelda Item 2 sound')
  questState.q1 = 2
  hermitDialogue()
  onShardTaken()
  if (questState.q2 !== 2 || !currentObjective().includes('Hermit Fen')) throw new Error('First shard must send the player back to Fen')
  if (!millieDialogue()[0].text.includes('stones')) throw new Error('Millie must react to the first shard')
  hermitDialogue()
  if (questState.q2 !== 3 || !hasItem('pegasusBoots') || !stats.abilities.highJump) throw new Error('Fen must unlock High Jump with the Pegasus Boots')
  if (currentObjectiveTarget().x !== 21) throw new Error('The broken-bridge objective must point to the safe west approach')
  if (!tamDialogue()[0].text.includes('broken bridge')) throw new Error('Tam must react to the Pegasus Boots')
  console.log('Pegasus Boots check passed: first shard leads back to Fen and unlocks High Jump.')
}

export function elderDialogue() {
  if (questState.q1 === 0) {
    questState.q1 = 1
    return [
      { name: 'Elder Maren', text: 'Little knight. The Great Ember gutters, and the cold creeps into our fields.' },
      { name: 'Elder Maren', text: 'Slimes have taken the well — even they crave what warmth remains. Drive them out, and we will speak of what comes after.' },
      { text: 'The well. Four of those things, by my count. Best stay quick.' },
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
