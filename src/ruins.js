import * as THREE from 'three'
import { toon } from './materials.js'
import { addCollider } from './collision.js'
import { groundHeight } from './ground.js'
import { addInteractable } from './interact.js'
import { say } from './dialogue.js'
import { questState, onShardTaken } from './quests.js'
import { addItem } from './inventory.js'
import { addTrigger } from './gates.js'

// Sunken Ruins content: three story murals (each yields a Mural Sketch),
// and the sunstone mirror puzzle guarding the second shard.

const BEAM_Y = 1.3
const SUNSTONE = { x: 54, z: 0 }
const MIRRORS = [
  { x: 60, z: -5, need: 3 },
  { x: 68, z: -2, need: 6 },
  { x: 72, z: 6, need: 1 },
]
const VAULT = { x: 70, z: 14 }

const MURALS = [
  {
    x: 52, z: -20, glyph: '▲',
    lines: [
      { text: 'A mural, older than the village. A knight kneels before a roaring flame, offering up… their own name.' },
      { text: 'Beneath it, a carved mark: a triangle. I copy it down. (Mural Sketch added)' },
    ],
  },
  {
    x: 80, z: -10, glyph: '◆',
    lines: [
      { text: 'The same knight, walking north alone, the flame cupped in their hands. Every other face in the carving is turned away.' },
      { text: 'The mark beneath: a diamond. Copied. (Mural Sketch added)' },
    ],
  },
  {
    x: 66, z: 30, glyph: '●',
    lines: [
      { text: 'The last mural. The flame gone small. The knight kneels in ash, armor scorched black… armor shaped like mine.' },
      { text: 'The mark: a circle. Triangle, diamond, circle — a sequence someone wanted remembered. (Mural Sketch added)' },
    ],
  },
]

function part(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, toon(color))
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

const state = { orientations: [0, 0, 0], solved: false }
let beamGroup

export function setupRuins(scene) {
  // arrival beat
  addTrigger({
    x: 40, z: 2, r: 6,
    fire: () => {
      if (questState.q3 === 0) questState.q3 = 1
      say([
        { text: 'The drowned ruins. Columns like broken teeth, and pools that hold the sky too still.' },
        { text: 'Old light equipment on pedestals… and walls with carvings. Both feel worth my time.' },
      ])
    },
  })

  // murals
  for (const m of MURALS) {
    const gy = groundHeight(m.x, m.z)
    const slab = part(new THREE.BoxGeometry(2.4, 2.0, 0.35), 0x6e7a68, m.x, gy + 1.0, m.z)
    slab.rotation.y = Math.atan2(70 - m.x, 8 - m.z) // face the heart of the ruins
    scene.add(slab)
    addCollider(m.x, m.z, 1.3)
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), new THREE.MeshBasicMaterial({ color: 0x88ffcc }))
    glyph.position.set(m.x, gy + 1.1, m.z)
    glyph.rotation.y = slab.rotation.y
    glyph.translateZ(0.19)
    scene.add(glyph)
    let examined = false
    addInteractable({
      position: new THREE.Vector3(m.x, gy, m.z),
      prompt: 'Study the mural',
      onInteract: () => {
        if (!examined) {
          examined = true
          addItem('sketch')
        }
        say(m.lines)
      },
    })
  }

  // sunstone: the beam source
  const sy = groundHeight(SUNSTONE.x, SUNSTONE.z)
  scene.add(part(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 8), 0x6e7a68, SUNSTONE.x, sy + 0.5, SUNSTONE.z))
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffdd88 }))
  orb.position.set(SUNSTONE.x, sy + BEAM_Y, SUNSTONE.z)
  scene.add(orb)
  addCollider(SUNSTONE.x, SUNSTONE.z, 0.7)

  // mirrors on pedestals, E rotates 45°
  MIRRORS.forEach((mr, i) => {
    const gy = groundHeight(mr.x, mr.z)
    scene.add(part(new THREE.CylinderGeometry(0.32, 0.45, 1.0, 7), 0x707c6e, mr.x, gy + 0.5, mr.z))
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.06), toon(0xbcd8e8))
    glass.position.set(mr.x, gy + BEAM_Y, mr.z)
    glass.rotation.x = -0.3
    scene.add(glass)
    mr.glass = glass
    addCollider(mr.x, mr.z, 0.6)
    addInteractable({
      position: new THREE.Vector3(mr.x, gy, mr.z),
      prompt: 'Turn the mirror',
      onInteract: () => {
        if (state.solved) {
          say([{ text: 'The light holds its path. Best not to argue with it.' }])
          return
        }
        state.orientations[i] = (state.orientations[i] + 1) % 8
        glass.rotation.y = (state.orientations[i] * Math.PI) / 4
        rebuildBeam(scene)
      },
    })
  })

  // the vault that holds the second shard
  const vy = groundHeight(VAULT.x, VAULT.z)
  scene.add(part(new THREE.BoxGeometry(1.6, 1.0, 1.6), 0x616e5e, VAULT.x, vy + 0.5, VAULT.z))
  const lid = part(new THREE.BoxGeometry(1.8, 0.25, 1.8), 0x57645a, VAULT.x, vy + 1.12, VAULT.z)
  scene.add(lid)
  state.lid = lid
  addCollider(VAULT.x, VAULT.z, 1.1)
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0x88ffcc }))
  crystal.position.set(VAULT.x, vy + 1.6, VAULT.z)
  scene.add(crystal)

  beamGroup = new THREE.Group()
  scene.add(beamGroup)
  rebuildBeam(scene)
}

function beamPoints() {
  const pts = [new THREE.Vector3(SUNSTONE.x, groundHeight(SUNSTONE.x, SUNSTONE.z) + BEAM_Y, SUNSTONE.z)]
  for (const mr of MIRRORS) pts.push(new THREE.Vector3(mr.x, groundHeight(mr.x, mr.z) + BEAM_Y, mr.z))
  pts.push(new THREE.Vector3(VAULT.x, groundHeight(VAULT.x, VAULT.z) + 1.6, VAULT.z))
  return pts
}

function rebuildBeam(scene) {
  beamGroup.clear()
  const pts = beamPoints()
  // beam always leaves the sunstone; each further leg needs its mirror aligned
  let legs = 1
  for (let i = 0; i < MIRRORS.length; i++) {
    if (state.orientations[i] === MIRRORS[i].need) legs++
    else break
  }
  for (let i = 0; i < legs && i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const len = a.distanceTo(b)
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, len, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.85 })
    )
    seg.position.copy(a).add(b).multiplyScalar(0.5)
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    beamGroup.add(seg)
  }
  if (legs === MIRRORS.length + 1 && !state.solved) solve(scene)
}

function solve(scene) {
  state.solved = true
  scene.remove(state.lid)
  say([{ text: 'The light lands true — the vault sighs open, like it had been holding its breath for a century.' }])
  const vy = groundHeight(VAULT.x, VAULT.z)
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: 0xff9944 }))
  shard.position.set(VAULT.x, vy + 1.4, VAULT.z)
  scene.add(shard)
  const handle = addInteractable({
    position: new THREE.Vector3(VAULT.x, vy, VAULT.z),
    prompt: 'Take the Ember Shard',
    onInteract: () => {
      scene.remove(shard)
      handle.remove()
      addItem('shard')
      onShardTaken()
      say([
        { text: 'Both shards now hum to each other in my satchel.' },
        { text: 'The Ashen Keep waits to the north — and so does the knight on these walls.' },
      ])
    },
  })
}
