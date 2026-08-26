import * as THREE from 'three'
import { toonRim as toon } from './materials.js'
import { addInteractable } from './interact.js'
import { addCollider } from './collision.js'
import { groundHeight } from './ground.js'
import { say } from './dialogue.js'

const SKIN = 0xe8c8a0
const HAIR = 0xd8d2c4 // aged silver

const npcs = []

function part(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, toon(color))
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

export function createNPC(scene, { x, z, name, robeColor = 0x775577, dialogue }) {
  const group = new THREE.Group()
  const darker = new THREE.Color(robeColor).multiplyScalar(0.65).getHex()

  // layered robe: body, hem band, rope belt, shoulder shawl
  group.add(part(new THREE.ConeGeometry(0.5, 1.3, 10), robeColor, 0, 0.65))
  group.add(part(new THREE.CylinderGeometry(0.5, 0.53, 0.14, 10), darker, 0, 0.09)) // hem
  const belt = part(new THREE.TorusGeometry(0.34, 0.03, 6, 14), 0xa89060, 0, 0.62)
  belt.rotation.x = Math.PI / 2
  group.add(belt)
  group.add(part(new THREE.ConeGeometry(0.42, 0.4, 10), darker, 0, 1.2)) // shawl

  // arms folded low in the sleeves, cream hands peeking out
  for (const sx of [-1, 1]) {
    const arm = part(new THREE.CapsuleGeometry(0.09, 0.26, 4, 8), darker, sx * 0.3, 0.95)
    arm.rotation.z = sx * 0.7
    arm.rotation.x = 0.5
    group.add(arm)
    group.add(part(new THREE.SphereGeometry(0.06, 8, 6), SKIN, sx * 0.12, 0.82, 0.22))
  }

  // head: skin, silver hair cap and bun, brows, eyes, nose
  group.add(part(new THREE.SphereGeometry(0.3, 12, 10), SKIN, 0, 1.5))
  const hair = part(new THREE.SphereGeometry(0.31, 12, 10), HAIR, 0, 1.56, -0.05)
  hair.scale.set(1, 0.85, 1)
  group.add(hair)
  group.add(part(new THREE.SphereGeometry(0.11, 8, 6), HAIR, 0, 1.74, -0.22)) // bun
  for (const ex of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }))
    eye.position.set(ex, 1.52, 0.27)
    group.add(eye)
    group.add(part(new THREE.BoxGeometry(0.09, 0.022, 0.02), HAIR, ex, 1.59, 0.28)) // brow
  }
  group.add(part(new THREE.SphereGeometry(0.035, 6, 6), 0xd8b088, 0, 1.46, 0.3)) // nose

  // ember staff: the elder carries a piece of the dying flame
  const staff = new THREE.Group()
  staff.position.set(0.42, 0, 0.12)
  staff.rotation.z = -0.06
  const shaft = part(new THREE.CylinderGeometry(0.03, 0.04, 1.7, 6), 0x6b4a2e, 0, 0.85)
  staff.add(shaft)
  const wrap = part(new THREE.TorusGeometry(0.05, 0.015, 6, 10), 0xa89060, 0, 1.35)
  staff.add(wrap)
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff8833 }))
  ember.position.y = 1.78
  staff.add(ember)
  group.add(staff)

  group.position.set(x, groundHeight(x, z), z)
  scene.add(group)
  addCollider(x, z, 0.55)

  addInteractable({
    position: group.position,
    prompt: `Talk to ${name}`,
    onInteract: () => say(dialogue()),
  })

  npcs.push({ group, ember, seed: Math.random() * 10 })
  return group
}

export function updateNPCs(time) {
  for (const n of npcs) {
    n.group.scale.y = 1 + Math.sin(time * 1.8 + n.seed) * 0.012 // slow breathing
    n.ember.scale.setScalar(1 + Math.sin(time * 5 + n.seed) * 0.15) // staff ember pulses
  }
}
