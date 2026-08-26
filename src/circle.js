import * as THREE from 'three'
import { getCircleStones, CIRCLE } from './regions.js'
import { addInteractable } from './interact.js'
import { say } from './dialogue.js'
import { questState, onShardTaken } from './quests.js'
import { groundHeight } from './ground.js'
import { addItem } from './inventory.js'
import { spawnSlime } from './enemies.js'

// stone circle puzzle: wake the stones smallest to tallest ("small to great,
// as embers grow"). Wrong stone resets the circle. Reward: the first shard.

let progress = 0
let order = []
let done = false

export function setupStoneCircle(scene) {
  const stones = getCircleStones()
  order = [...stones].sort((a, b) => a.height - b.height)
  for (const st of stones) {
    st.glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff8833 }))
    st.glow.position.set(st.x, st.topY + 0.25, st.z)
    st.glow.visible = false
    scene.add(st.glow)
    addInteractable({
      position: new THREE.Vector3(st.x, groundHeight(st.x, st.z), st.z),
      prompt: 'Touch the standing stone',
      onInteract: () => touch(st, scene),
    })
  }
}

function touch(st, scene) {
  if (done) {
    say([{ text: 'The stone hums, content. Its work is done.' }])
    return
  }
  if (questState.q2 !== 1) {
    say([{ text: 'A sleeping stone. It hums faintly under my paw, waiting for… something.' }])
    return
  }
  if (st === order[progress]) {
    st.glow.visible = true
    progress++
    if (progress === order.length) complete(scene)
  } else {
    progress = 0
    for (const o of order) o.glow.visible = false
    spawnSlime(scene, CIRCLE.x + 3, CIRCLE.z + 6)
    spawnSlime(scene, CIRCLE.x - 4, CIRCLE.z - 5)
    say([{ text: 'The stones grumble and go dark — and the wood answers. Something is coming.' }])
  }
}

function complete(scene) {
  done = true
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: 0xff9944 }))
  const gy = groundHeight(CIRCLE.x, CIRCLE.z)
  shard.position.set(CIRCLE.x, gy + 1.0, CIRCLE.z)
  shard.rotation.x = 0.6
  scene.add(shard)
  say([{ text: 'The circle sings — five voices, one chord. Something bright rises at its heart.' }])
  const handle = addInteractable({
    position: new THREE.Vector3(CIRCLE.x, gy, CIRCLE.z),
    prompt: 'Take the Ember Shard',
    onInteract: () => {
      scene.remove(shard)
      handle.remove()
      addItem('shard')
      onShardTaken()
      say([
        { text: 'Warm as a heartbeat, even through the glove.' },
        { text: 'One shard of two. Across the stream, the drowned ruins wait.' },
      ])
    },
  })
}
