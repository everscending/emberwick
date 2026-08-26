import * as THREE from 'three'
import { toon } from './materials.js'
import { addCollider } from './collision.js'
import { groundHeight } from './ground.js'
import { addInteractable } from './interact.js'
import { say } from './dialogue.js'
import { itemCount } from './inventory.js'
import { questState } from './quests.js'

const GATE = { x: 8, z: -80 }
const ARENA = { x: 8, z: -87, radius: 6.4 }
const ANSWER = [0, 1, 2] // ▲ ◆ ● — the ruins mural sequence
const GLYPHS = ['▲', '◆', '●']
const state = { values: [1, 2, 0], opening: false, gate: null, warned: false, blocker: null, handles: [], glyphMeshes: [] }

export function isGateSolved(values) {
  return ANSWER.every((answer, i) => values[i] === answer)
}

const canTurnGlyphs = (sketches) => sketches >= 3

function glyphGeometry(index) {
  if (index === 0) return new THREE.CircleGeometry(0.34, 3)
  if (index === 1) {
    const g = new THREE.PlaneGeometry(0.48, 0.48)
    g.rotateZ(Math.PI / 4)
    return g
  }
  return new THREE.RingGeometry(0.2, 0.33, 16)
}

function buildArenaFloor(scene) {
  const fitToGround = (geo, lift) => {
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = -pos.getY(i)
      pos.setZ(i, groundHeight(ARENA.x + x, ARENA.z + z) + lift)
    }
    geo.computeVertexNormals()
    return geo
  }
  const geo = fitToGround(new THREE.RingGeometry(0, ARENA.radius, 40, 8), 0.035)
  const floor = new THREE.Mesh(geo, toon(0x302d2d))
  floor.position.set(ARENA.x, 0, ARENA.z)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const rune = new THREE.Mesh(fitToGround(new THREE.RingGeometry(4.8, 5.0, 32), 0.075), new THREE.MeshBasicMaterial({ color: 0x5b3026 }))
  rune.position.set(ARENA.x, 0, ARENA.z)
  rune.rotation.x = -Math.PI / 2
  scene.add(rune)
}

export function setupKeep(scene) {
  buildArenaFloor(scene)

  const gy = groundHeight(GATE.x, GATE.z)
  const gate = new THREE.Group()
  gate.position.set(GATE.x, gy, GATE.z)
  gate.add(new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.8, 0.42), toon(0x39373b)))
  gate.children[0].position.y = 1.9
  gate.children[0].castShadow = true

  const glyphMeshes = []
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.45
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.09, 8, 20), toon(0x76604b))
    ring.position.set(x, 1.9, 0.24)
    gate.add(ring)
    glyphMeshes[i] = GLYPHS.map((_, glyph) => {
      const mesh = new THREE.Mesh(glyphGeometry(glyph), new THREE.MeshBasicMaterial({ color: 0xe39a4a }))
      mesh.position.set(x, 1.9, 0.34)
      mesh.visible = glyph === state.values[i]
      gate.add(mesh)
      return mesh
    })
  }
  scene.add(gate)
  state.gate = gate
  state.glyphMeshes = glyphMeshes

  const blocker = addCollider(GATE.x, GATE.z, 2.4)
  const handles = []
  state.blocker = blocker
  state.handles = handles
  for (let i = 0; i < 3; i++) {
    const ringName = ['left', 'middle', 'right'][i]
    const interaction = {
      position: new THREE.Vector3(GATE.x + (i - 1) * 1.45, gy, GATE.z),
      radius: 3.25,
      prompt: () => {
        const sketches = itemCount('sketch')
        return canTurnGlyphs(sketches) ? `Turn ${ringName} glyph ring` : `Find all 3 Mural Sketches (${sketches}/3)`
      },
      onInteract: () => {
        const sketches = itemCount('sketch')
        if (!canTurnGlyphs(sketches)) {
          if (!state.warned) say([{ text: `I copied only ${sketches} of the three ruin murals. I need the whole sequence before these rings will turn.` }])
          state.warned = true
          return
        }
        glyphMeshes[i][state.values[i]].visible = false
        state.values[i] = (state.values[i] + 1) % GLYPHS.length
        glyphMeshes[i][state.values[i]].visible = true
        if (!isGateSolved(state.values)) return

        state.opening = true
        questState.q4 = 1
        removeGateLocks()
        say([
          { text: 'Triangle. Diamond. Circle. The three rings lock into place.' },
          { text: 'Stone grinds overhead. Beyond the gate, something armored stirs beside the dying Ember.' },
        ])
      },
    }
    handles.push(addInteractable(interaction))
  }
}

function removeGateLocks() {
  state.blocker?.remove()
  state.blocker = null
  for (const handle of state.handles) handle.remove()
  state.handles = []
}

export function keepSnapshot() {
  return { values: [...state.values], opening: state.opening, warned: state.warned }
}

export function restoreKeep(saved = {}) {
  const values = Array.isArray(saved.values) ? saved.values : state.values
  state.values = ANSWER.map((_, i) => Number.isInteger(values[i]) ? THREE.MathUtils.clamp(values[i], 0, GLYPHS.length - 1) : state.values[i])
  state.warned = Boolean(saved.warned)
  state.opening = Boolean(saved.opening) || questState.q4 >= 1
  if (state.opening && !Array.isArray(saved.values)) state.values = [...ANSWER]
  state.glyphMeshes.forEach((meshes, i) => meshes.forEach((mesh, glyph) => { mesh.visible = glyph === state.values[i] }))
  if (state.opening) {
    removeGateLocks()
    state.gate.position.y = groundHeight(GATE.x, GATE.z) + 4.2
  }
}

export function updateKeep(dt) {
  if (!state.opening || !state.gate) return
  state.gate.position.y = Math.min(state.gate.position.y + dt * 3.2, groundHeight(GATE.x, GATE.z) + 4.2)
}

// Small runnable puzzle check: `node src/keep.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  if (isGateSolved([0, 2, 1]) || !isGateSolved([0, 1, 2])) throw new Error('Keep gate must accept only the mural sequence')
  if (canTurnGlyphs(2) || !canTurnGlyphs(3)) throw new Error('All three Mural Sketches must be required every time')
  console.log('Keep gate check passed: only ▲ ◆ ● opens the gate.')
}
