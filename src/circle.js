import * as THREE from 'three'
import { getCircleStones, CIRCLE, openForestShortcut } from './regions.js'
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
let circleWarmth

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
  circleWarmth = new THREE.PointLight(0xff8833, 0, 18)
  circleWarmth.position.set(CIRCLE.x, groundHeight(CIRCLE.x, CIRCLE.z) + 4, CIRCLE.z)
  scene.add(circleWarmth)
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
  for (const st of order) st.glow.visible = true
  openForestShortcut()
  spawnShard(scene)
  say([{ text: 'The circle sings — five voices, one chord. Something bright rises at its heart.' }])
}

function spawnShard(scene) {
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: 0xff9944 }))
  const gy = groundHeight(CIRCLE.x, CIRCLE.z)
  shard.position.set(CIRCLE.x, gy + 1.0, CIRCLE.z)
  shard.rotation.x = 0.6
  scene.add(shard)
  const handle = addInteractable({
    position: new THREE.Vector3(CIRCLE.x, gy, CIRCLE.z),
    prompt: 'Take the Ember Shard',
    onInteract: () => {
      scene.remove(shard)
      handle.remove()
      addItem('shard')
      onShardTaken()
      warmStoneCircle()
      say([
        { text: 'Warm as a heartbeat, even through the glove.' },
        { text: 'One shard of two. Across the stream, the drowned ruins wait.' },
      ])
    },
  })
}

function warmStoneCircle() {
  if (!circleWarmth) return
  circleWarmth.intensity = 10
  for (const stone of order) {
    stone.glow.material.color.setHex(0xffbb55)
    stone.glow.scale.setScalar(1.5)
  }
}

export function stoneCircleSnapshot() {
  return { progress, done }
}

export function restoreStoneCircle(saved = {}, scene) {
  progress = Number.isInteger(saved.progress) ? THREE.MathUtils.clamp(saved.progress, 0, order.length) : 0
  done = Boolean(saved.done) || questState.q2 >= 2
  if (done) progress = order.length
  order.forEach((stone, i) => { stone.glow.visible = i < progress })
  if (done) openForestShortcut()
  if (questState.q2 >= 2) warmStoneCircle()
  if (done && questState.q2 === 1) spawnShard(scene)
}
