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
const state = { values: [1, 2, 0], opening: false, gate: null, warned: false }

export function isGateSolved(values) {
  return ANSWER.every((answer, i) => values[i] === answer)
}

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

  const blocker = addCollider(GATE.x, GATE.z, 2.4)
  const handles = []
  for (let i = 0; i < 3; i++) {
    const interaction = {
      position: new THREE.Vector3(GATE.x + (i - 1) * 1.45, gy, GATE.z),
      radius: 3.25,
      prompt: `Turn ${['left', 'middle', 'right'][i]} glyph ring`,
      onInteract: () => {
        if (itemCount('sketch') < 3 && !state.warned) {
          state.warned = true
          say([{ text: 'Three empty shapes, waiting for an order. The ruin murals may hold the whole sequence.' }])
          return
        }
        glyphMeshes[i][state.values[i]].visible = false
        state.values[i] = (state.values[i] + 1) % GLYPHS.length
        glyphMeshes[i][state.values[i]].visible = true
        if (!isGateSolved(state.values)) return

        state.opening = true
        questState.q4 = 1
        blocker.remove()
        for (const handle of handles) handle.remove()
        say([
          { text: 'Triangle. Diamond. Circle. The three rings lock into place.' },
          { text: 'Stone grinds overhead. Beyond the gate, something armored stirs beside the dying Ember.' },
        ])
      },
    }
    handles.push(addInteractable(interaction))
  }
}

export function updateKeep(dt) {
  if (!state.opening || !state.gate) return
  state.gate.position.y = Math.min(state.gate.position.y + dt * 3.2, groundHeight(GATE.x, GATE.z) + 4.2)
}

// Small runnable puzzle check: `node src/keep.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  if (isGateSolved([0, 2, 1]) || !isGateSolved([0, 1, 2])) throw new Error('Keep gate must accept only the mural sequence')
  console.log('Keep gate check passed: only ▲ ◆ ● opens the gate.')
}
