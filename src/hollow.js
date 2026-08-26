import * as THREE from 'three'
import { toon } from './materials.js'
import { addCollider } from './collision.js'
import { groundHeight } from './ground.js'
import { addInteractable } from './interact.js'
import { say } from './dialogue.js'
import { questState, onShardTaken } from './quests.js'
import { addItem, hasItem } from './inventory.js'
import { spawnSlime, spawnGravewarden, setWardenDeathHandler } from './enemies.js'
import { createShrine } from './world.js'

// The Hollow Dark: an enclosed chamber on the unused NW corner of the plateau.
// Entering the cave mouth teleports here; the region reads pitch-black except
// for the player's lantern bubble (lighting handled in main.js via CHAMBER).

export const CHAMBER = { x: -80, z: -88, r: 15 }
const ENTRY = { x: -80, z: -78 } // just inside the chamber
const MOUTH_EXIT = { x: -72, z: -36 } // back outside the cave mouth

const BRAZIERS = [
  { a: 0.6, dots: 3 },
  { a: 2.2, dots: 1 },
  { a: 3.8, dots: 4 },
  { a: 5.3, dots: 2 },
]

const state = { lit: 0, wardenUp: false, done: false }

function part(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, toon(color))
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export function setupHollow(scene, player) {
  // entrance: interact at the cave mouth to step inside
  addInteractable({
    position: new THREE.Vector3(-72, groundHeight(-72, -40), -40),
    prompt: 'Enter the Hollow Dark',
    onInteract: () => {
      player.group.position.set(ENTRY.x, groundHeight(ENTRY.x, ENTRY.z), ENTRY.z)
      if (questState.q4 === 0) questState.q4 = 1
      say([
        { text: 'The dark closes over me like water. Only the lantern answers — a small, stubborn circle of warmth.' },
        { text: 'Iron bowls stand in a ring. And carvings on the wall, waiting to be read.' },
      ])
    },
  })

  // exit from inside
  addInteractable({
    position: new THREE.Vector3(ENTRY.x, groundHeight(ENTRY.x, ENTRY.z), ENTRY.z + 1.5),
    prompt: 'Climb back to daylight',
    onInteract: () => {
      player.group.position.set(MOUTH_EXIT.x, groundHeight(MOUTH_EXIT.x, MOUTH_EXIT.z), MOUTH_EXIT.z)
      say([{ text: 'Dusk never looked so bright.' }])
    },
  })

  // rock wall ring sealing the chamber
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const x = CHAMBER.x + Math.cos(a) * (CHAMBER.r + 2)
    const z = CHAMBER.z + Math.sin(a) * (CHAMBER.r + 2)
    const rock = part(new THREE.DodecahedronGeometry(3.2 + (i % 3)), 0x35313d, x, groundHeight(x, z) + 1.2, z)
    rock.rotation.set(i, a, 0)
    scene.add(rock)
    addCollider(x, z, 3.4)
  }

  // shrine just inside — mercy before the warden
  createShrine(scene, ENTRY.x + 4, ENTRY.z - 2, player)

  // the rite carving
  addInteractable({
    position: new THREE.Vector3(ENTRY.x - 4, groundHeight(ENTRY.x - 4, ENTRY.z - 2), ENTRY.z - 2),
    prompt: 'Read the wall carving',
    onInteract: () =>
      say([
        { text: 'Scratched deep, by claws or desperation: "THE WATCHERS WAKE AS EMBERS DO — ONE SPARK, THEN TWO, THEN THREE, THEN FOUR."' },
        { text: 'Each iron bowl bears a count of stone beads. Light them in the beads’ order, then.' },
      ]),
  })
  const slab = part(new THREE.BoxGeometry(2.2, 1.8, 0.3), 0x44404c, ENTRY.x - 4, groundHeight(ENTRY.x - 4, ENTRY.z - 2) + 0.9, ENTRY.z - 2)
  slab.rotation.y = 0.8
  scene.add(slab)

  // braziers in a ring, each marked with 1–4 beads
  for (const b of BRAZIERS) {
    b.x = CHAMBER.x + Math.cos(b.a) * 8
    b.z = CHAMBER.z + Math.sin(b.a) * 8
    const gy = groundHeight(b.x, b.z)
    scene.add(part(new THREE.CylinderGeometry(0.45, 0.3, 0.9, 8), 0x33333a, b.x, gy + 0.45, b.z))
    for (let d = 0; d < b.dots; d++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffcc77 }))
      bead.position.set(b.x + Math.cos(d * 1.6) * 0.55, gy + 0.5 + d * 0.14, b.z + Math.sin(d * 1.6) * 0.55)
      scene.add(bead)
    }
    b.flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), new THREE.MeshBasicMaterial({ color: 0xffaa44 }))
    b.flame.position.set(b.x, gy + 1.2, b.z)
    b.flame.visible = false
    scene.add(b.flame)
    addCollider(b.x, b.z, 0.55)
    addInteractable({
      position: new THREE.Vector3(b.x, gy, b.z),
      prompt: 'Light the brazier',
      onInteract: () => lightBrazier(scene, b),
    })
  }

  // the bone gate alcove holding the third shard
  const ax = CHAMBER.x
  const az = CHAMBER.z - 11
  const ay = groundHeight(ax, az)
  const bars = new THREE.Group()
  for (let i = -2; i <= 2; i++) bars.add(part(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), 0xd8d0c0, i * 0.4, 1.1, 0))
  bars.position.set(ax, ay, az + 1.6)
  scene.add(bars)
  const barCollider = addCollider(ax, az + 1.6, 1.1)
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: 0xff9944 }))
  shard.position.set(ax, ay + 1.1, az)
  scene.add(shard)
  let gateOpen = false
  addInteractable({
    position: new THREE.Vector3(ax, ay, az + 1.6),
    prompt: 'Bone gate',
    onInteract: () => {
      if (gateOpen) return
      if (!hasItem('boneKey')) {
        say([{ text: 'Bars of bone, cold as river stones. The lock wants a key I don’t have — yet.' }])
        return
      }
      gateOpen = true
      scene.remove(bars)
      barCollider.remove()
      say([{ text: 'The Bone Key turns with a sound like a sigh. The bars fold away.' }])
    },
  })
  addInteractable({
    position: new THREE.Vector3(ax, ay, az),
    prompt: 'Take the Ember Shard',
    onInteract: () => {
      if (!gateOpen) return
      if (state.done) return
      state.done = true
      scene.remove(shard)
      addItem('shard')
      onShardTaken()
      say([
        { text: 'The third shard. All three now sing together — loud enough to wake something old. (Skill point gained)' },
        { text: 'North, then. The Ashen Keep. The end of this long cold road.' },
      ])
    },
  })

  // when the Gravewarden falls, it drops the Bone Key
  setWardenDeathHandler((pos) => {
    say([{ text: 'The Gravewarden folds into ash — and something pale clatters to the stone.' }])
    const key = part(new THREE.TorusGeometry(0.18, 0.05, 6, 10), 0xd8d0c0, pos.x, groundHeight(pos.x, pos.z) + 0.4, pos.z)
    scene.add(key)
    const h = addInteractable({
      position: new THREE.Vector3(pos.x, groundHeight(pos.x, pos.z), pos.z),
      prompt: 'Take the Bone Key',
      onInteract: () => {
        scene.remove(key)
        h.remove()
        addItem('boneKey')
        say([{ text: 'A key carved from a single knuckle. I try not to think about whose.' }])
      },
    })
  })
}

function lightBrazier(scene, b) {
  if (b.flame.visible || state.wardenUp) return
  const expected = BRAZIERS.filter((x) => x.dots === state.lit + 1)[0]
  if (b === expected) {
    b.flame.visible = true
    state.lit++
    if (state.lit === 4) {
      state.wardenUp = true
      say([{ text: 'Four flames. The dark between them thickens, gathers… and stands up.' }])
      spawnGravewarden(scene, CHAMBER.x, CHAMBER.z)
    }
  } else {
    state.lit = 0
    for (const x of BRAZIERS) x.flame.visible = false
    spawnSlime(scene, b.x + 2, b.z + 2)
    spawnSlime(scene, b.x - 2, b.z - 2)
    say([{ text: 'Wrong bowl. Every flame gutters out — and the dark spits something at me.' }])
  }
}
