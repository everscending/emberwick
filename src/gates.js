import { questState } from './quests.js'
import { say, isDialogueOpen } from './dialogue.js'
import { BROKEN_BRIDGE } from './ground.js'

// soft progression gates at region mouths: crossing while locked pushes the
// player back and plays a turn-back monologue (throttled)
const gates = [
  {
    x: -32,
    z: 0,
    r: 6,
    isOpen: () => questState.q1 === 2,
    line: 'The forest whispers… but Maren comes first. The village well is still crawling.',
  },
  {
    x: BROKEN_BRIDGE.x + 4,
    z: BROKEN_BRIDGE.z,
    r: 4.5,
    isOpen: () => questState.q2 === 3,
    line: 'The broken bridge yawns ahead. I should finish my business with Hermit Fen first.',
  },
  {
    x: 8,
    z: -52,
    r: 8,
    isOpen: () => questState.shards >= 2,
    line: 'The Keep pulls at me… but without both shards, the Great Ember would never light.',
  },
]

// one-shot trigger zones (region arrivals, story beats)
const triggers = []

export function addTrigger(t) {
  triggers.push(t)
}

export function updateGates(player, time) {
  const pos = player.group.position

  for (let i = triggers.length - 1; i >= 0; i--) {
    const t = triggers[i]
    if (Math.hypot(pos.x - t.x, pos.z - t.z) < t.r) {
      triggers.splice(i, 1)
      t.fire()
    }
  }
  for (const g of gates) {
    if (g.isOpen()) continue
    const dx = pos.x - g.x
    const dz = pos.z - g.z
    const d = Math.hypot(dx, dz)
    if (d < g.r) {
      // place the player just outside the gate circle
      const push = (g.r + 0.3) / Math.max(d, 0.001)
      pos.x = g.x + dx * push
      pos.z = g.z + dz * push
      if (!isDialogueOpen() && time - (g.lastSaid ?? -10) > 6) {
        g.lastSaid = time
        say([{ text: g.line }])
      }
    }
  }
}
