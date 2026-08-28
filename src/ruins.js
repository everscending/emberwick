import * as THREE from 'three'
import { toon } from './materials.js'
import { addCollider } from './collision.js'
import { groundHeight } from './ground.js'
import { addInteractable } from './interact.js'
import { say } from './dialogue.js'
import { questState, onShardTaken } from './quests.js'
import { addItem, setSketchGlyphs } from './inventory.js'
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
    x: 55, z: -7, glyph: '▲',
    lines: [
      { text: 'A mural, older than the village. A knight kneels before a roaring flame, offering up… their own name.' },
      { text: 'Beneath it, a carved mark: a triangle. I copy it down. (Mural Sketch added)' },
    ],
  },
  {
    x: 66, z: -7, glyph: '◆',
    lines: [
      { text: 'The same knight, walking north alone, the flame cupped in their hands. Every other face in the carving is turned away.' },
      { text: 'The mark beneath: a diamond. Copied. (Mural Sketch added)' },
    ],
  },
  {
    x: 77, z: 7, glyph: '●',
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

const muralPanelMat = toon(0x343d38)
const muralReliefMat = toon(0x8b9383)
const muralShadowMat = toon(0x515b52)
const muralAshMat = toon(0x252b29)
const muralEmberMat = new THREE.MeshBasicMaterial({ color: 0xd88945 })

function reliefPiece(root, geo, material, x, y, rotation = 0, z = 0.09) {
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(x, y, z)
  mesh.rotation.z = rotation
  mesh.castShadow = true
  root.add(mesh)
  return mesh
}

function muralKnight(root, x, y, pose, material = muralReliefMat, facing = 1) {
  reliefPiece(root, new THREE.SphereGeometry(0.14, 7, 6), material, x, y + 0.42, 0, 0.13)
  reliefPiece(root, new THREE.BoxGeometry(0.12, 0.13, 0.08), material, x, y + 0.57, -facing * 0.28)
  reliefPiece(root, new THREE.BoxGeometry(0.32, 0.48, 0.08), material, x, y + 0.1)
  reliefPiece(root, new THREE.BoxGeometry(0.1, 0.38, 0.07), material, x + facing * 0.22, y + 0.16, -facing * 0.78)
  reliefPiece(root, new THREE.BoxGeometry(0.1, 0.34, 0.07), material, x + facing * 0.3, y + 0.08, -facing * 1.02)
  if (pose === 'walk') {
    reliefPiece(root, new THREE.BoxGeometry(0.12, 0.44, 0.08), material, x - 0.13, y - 0.32, 0.55)
    reliefPiece(root, new THREE.BoxGeometry(0.12, 0.44, 0.08), material, x + 0.13, y - 0.32, -0.55)
  } else {
    reliefPiece(root, new THREE.BoxGeometry(0.12, 0.42, 0.08), material, x - facing * 0.1, y - 0.3, -facing * 0.32)
    reliefPiece(root, new THREE.BoxGeometry(0.12, 0.42, 0.08), material, x + facing * 0.12, y - 0.42, facing * 1.18)
  }
}

function muralGlyphGeometry(glyph) {
  if (glyph === '▲') return new THREE.CircleGeometry(0.25, 3, Math.PI / 2)
  if (glyph === '◆') {
    const geo = new THREE.PlaneGeometry(0.36, 0.36)
    geo.rotateZ(Math.PI / 4)
    return geo
  }
  return new THREE.RingGeometry(0.15, 0.25, 18)
}

function addMuralRelief(slab, mural, index) {
  const root = new THREE.Group()
  root.position.z = 0.22
  slab.add(root)
  reliefPiece(root, new THREE.BoxGeometry(2.55, 1.88, 0.07), muralPanelMat, 0, 0, 0, 0)
  reliefPiece(root, new THREE.BoxGeometry(2.72, 0.11, 0.11), muralReliefMat, 0, 0.97)
  reliefPiece(root, new THREE.BoxGeometry(2.72, 0.11, 0.11), muralReliefMat, 0, -0.97)
  reliefPiece(root, new THREE.BoxGeometry(0.11, 1.94, 0.11), muralReliefMat, -1.33, 0)
  reliefPiece(root, new THREE.BoxGeometry(0.11, 1.94, 0.11), muralReliefMat, 1.33, 0)
  reliefPiece(root, new THREE.BoxGeometry(2.2, 0.035, 0.04), muralShadowMat, 0, -0.52, 0, 0.08)

  if (index === 0) {
    muralKnight(root, -0.52, 0.16, 'kneel')
    reliefPiece(root, new THREE.BoxGeometry(0.48, 0.12, 0.08), muralReliefMat, 0.55, -0.05)
    reliefPiece(root, new THREE.ConeGeometry(0.19, 0.5, 5), muralEmberMat, 0.55, 0.3, 0, 0.15)
    reliefPiece(root, new THREE.SphereGeometry(0.08, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffd47a }), 0.55, 0.19, 0, 0.18)
  } else if (index === 1) {
    muralKnight(root, -0.05, 0.13, 'walk')
    reliefPiece(root, new THREE.SphereGeometry(0.11, 7, 5), muralEmberMat, 0.42, 0.38, 0, 0.15)
    for (const side of [-1, 1]) {
      reliefPiece(root, new THREE.CircleGeometry(0.1, 7), muralShadowMat, side * 0.88, 0.5)
      reliefPiece(root, new THREE.BoxGeometry(0.25, 0.32, 0.06), muralShadowMat, side * 0.88, 0.22, side * 0.35)
    }
    for (let x = -0.85; x <= 0.85; x += 0.42) reliefPiece(root, new THREE.BoxGeometry(0.24, 0.06, 0.05), muralShadowMat, x, -0.37, x * 0.2)
  } else {
    reliefPiece(root, new THREE.RingGeometry(0.56, 0.62, 20), muralShadowMat, 0, 0.12)
    muralKnight(root, -0.18, 0.1, 'kneel', muralAshMat)
    reliefPiece(root, new THREE.ConeGeometry(0.12, 0.3, 5), muralEmberMat, 0.48, 0.28, 0, 0.15)
    for (const [x, scale] of [[-0.78, 0.1], [-0.48, 0.07], [0.2, 0.08], [0.78, 0.11]]) {
      reliefPiece(root, new THREE.CircleGeometry(scale, 6), muralShadowMat, x, -0.38 + scale)
    }
  }

  const glyphMaterial = new THREE.MeshBasicMaterial({ color: 0x88ffcc })
  reliefPiece(root, muralGlyphGeometry(mural.glyph), glyphMaterial, 0, -0.74, 0, 0.15)
  const glyphLight = new THREE.PointLight(0x88ffcc, 0.45, 3)
  glyphLight.position.set(0, -0.72, 0.5)
  root.add(glyphLight)
  mural.glyphMaterial = glyphMaterial
  mural.glyphLight = glyphLight
}

const state = { orientations: [0, 0, 0], solved: false, murals: [false, false, false], arrivalSeen: false }
let beamGroup

const syncMuralSketches = () => setSketchGlyphs(MURALS.filter((_, i) => state.murals[i]).map(({ glyph }) => glyph))

function updateMuralVisual(index) {
  const color = state.murals[index] ? 0xffb45e : 0x88ffcc
  MURALS[index].glyphMaterial?.color.setHex(color)
  MURALS[index].glyphLight?.color.setHex(color)
  if (MURALS[index].glyphLight) MURALS[index].glyphLight.intensity = state.murals[index] ? 0.75 : 0.45
}

export function setupRuins(scene) {
  // arrival beat
  addTrigger({
    x: 40, z: 2, r: 6,
    fire: () => {
      if (state.arrivalSeen) return
      state.arrivalSeen = true
      if (questState.q3 === 0) questState.q3 = 1
      say([
        { text: 'The drowned ruins. Columns like broken teeth, and pools that hold the sky too still.' },
        { text: 'Old light equipment on pedestals… and walls with carvings. Both feel worth my time.' },
      ])
    },
  })

  // murals
  MURALS.forEach((m, i) => {
    const gy = groundHeight(m.x, m.z)
    const slab = part(new THREE.BoxGeometry(3.0, 2.35, 0.38), 0x6e7a68, m.x, gy + 1.18, m.z)
    slab.rotation.y = Math.PI / 4 // present every relief toward the fixed isometric camera
    addMuralRelief(slab, m, i)
    scene.add(slab)
    addCollider(m.x, m.z, 1.55)
    updateMuralVisual(i)
    addInteractable({
      position: new THREE.Vector3(m.x, gy, m.z),
      prompt: 'Study the mural',
      onInteract: () => {
        if (!state.murals[i]) {
          state.murals[i] = true
          updateMuralVisual(i)
          syncMuralSketches()
          addItem('sketch')
        }
        say(m.lines)
      },
    })
  })

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
  spawnShard(scene)
}

function spawnShard(scene) {
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

export function ruinsSnapshot() {
  return { orientations: [...state.orientations], solved: state.solved, murals: [...state.murals], arrivalSeen: state.arrivalSeen }
}

export function restoreRuins(saved = {}, scene) {
  const orientations = Array.isArray(saved.orientations) ? saved.orientations : []
  state.orientations = MIRRORS.map((_, i) => Number.isInteger(orientations[i]) ? THREE.MathUtils.clamp(orientations[i], 0, 7) : 0)
  state.murals = MURALS.map((_, i) => Boolean(saved.murals?.[i]))
  MURALS.forEach((_, i) => updateMuralVisual(i))
  syncMuralSketches()
  state.arrivalSeen = Boolean(saved.arrivalSeen) || questState.q3 > 0
  state.solved = Boolean(saved.solved) || questState.q3 >= 2
  if (state.solved) state.orientations = MIRRORS.map(({ need }) => need)
  MIRRORS.forEach((mirror, i) => { mirror.glass.rotation.y = (state.orientations[i] * Math.PI) / 4 })
  if (state.solved) {
    scene.remove(state.lid)
    if (questState.q3 === 1) spawnShard(scene)
  }
  rebuildBeam(scene)
}
