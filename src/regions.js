import * as THREE from 'three'
import { toon } from './materials.js'
import { wrand, seedWorld } from './rand.js'
import { addCollider } from './collision.js'
import { BROKEN_BRIDGE, groundHeight, streamCenter } from './ground.js'
import { plantForest, plantGrass, plantReeds } from './flora.js'
import { place, scatter, loadModel } from './props.js'

const rng = (a, b) => a + wrand() * (b - a)

function part(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, toon(color))
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// World dressing v2: Kenney CC0 packs (nature/town/graveyard) + clustered
// density scatter. Trees/rocks/props are instanced per model. All wind-swayed
// vegetation goes through the props wind patch.

// the village is laid out around its hearth shrine: four roads radiate from
// the plaza — east to the broken stream bridge, south to the old well, north toward
// the plateau, west to the forest mouth. Cottages sit in the quadrants.
export const HUB = { x: -4, z: 4 } // the village shrine
const ROADS = [
  { ex: 21, ez: 2 }, // east: to the broken bridge
  { ex: -8, ez: 50 }, // south: to the well
  { ex: 2, ez: -30 }, // north: toward the Ashen Keep road
  { ex: -29, ez: 1 }, // west: to the Whispering Forest
]
for (const r of ROADS) {
  const dx = r.ex - HUB.x
  const dz = r.ez - HUB.z
  const len = Math.hypot(dx, dz)
  const steps = Math.round(len / 1.6)
  r.pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // gentle perpendicular sway, pinned straight at both ends
    const sway = Math.sin(t * 5 + len) * 1.4 * Math.sin(t * Math.PI)
    r.pts.push({
      x: HUB.x + dx * t + (-dz / len) * sway,
      z: HUB.z + dz * t + (dx / len) * sway,
    })
  }
}
const nearRoad = (x, z) => ROADS.some((r) => r.pts.some((p) => Math.hypot(x - p.x, z - p.z) < 2.4))

// cottage sites — scatter passes must keep clear of these footprints
const HOUSES = [
  { x: 8, z: -8 }, // northeast quadrant
  { x: 10, z: 13 }, // southeast, garden behind
  { x: -16, z: 12 }, // southwest, woodpile at the side
]
const nearHouse = (x, z) => HOUSES.some((h) => Math.hypot(x - h.x, z - h.z) < 6.5)

export function buildWorld(scene) {
  seedWorld(20260827) // fixed seed: the world is identical on every load
  const nearStream = (x, z) => Math.abs(x - streamCenter(z)) < 6 && z > -60

  // ---------- trees ----------
  const pineTall = []
  const pineRound = []
  const villageTrees = []
  const meadowTrees = []
  const fallAccents = []
  const northwestPines = []
  const deadTrees = [] // flora's bare-branch archetype: ruins + plateau

  // Whispering Forest: dense, two pine species intermixed
  const inClearing = (x, z) =>
    Math.hypot(x - (-72), z - (-18)) < 9 || Math.hypot(x - (-80), z - 36) < 8 // stone circle + hermit clearing
  for (let i = 0; i < 170; i++) {
    const x = rng(-100, -28)
    const z = rng(-48, 55)
    if (Math.abs(z) < 5 && x > -55) continue // western mouth stays open
    if (inClearing(x, z)) continue
    ;(wrand() < 0.6 ? pineTall : pineRound).push({ x, z, scale: rng(1.7, 2.6), rot: rng(0, 6.28) })
  }
  // border + interior walls (tight rows, gaps preserved)
  for (let z = -48; z < 55; z += 2.0) {
    if (Math.abs(z) < 5) continue
    pineTall.push({ x: -30 + rng(-0.8, 0.8), z: z + rng(-0.6, 0.6), scale: rng(2.0, 2.5), rot: rng(0, 6.28) })
    pineRound.push({ x: -33.5 + rng(-0.8, 0.8), z: z + 1.0 + rng(-0.6, 0.6), scale: rng(2.0, 2.5), rot: rng(0, 6.28) })
  }
  for (let x = -96; x < -44; x += 2.0) {
    if (x > -56 && x < -48) continue
    pineTall.push({ x: x + rng(-0.7, 0.7), z: 20 + rng(-0.8, 0.8), scale: rng(2.0, 2.6), rot: rng(0, 6.28) })
  }
  for (let x = -88; x < -34; x += 2.0) {
    if (x < -84) continue
    pineRound.push({ x: x + rng(-0.7, 0.7), z: -10 + rng(-0.8, 0.8), scale: rng(2.0, 2.6), rot: rng(0, 6.28) })
  }
  // village + meadows: friendly rounded trees, autumn accents
  for (let i = 0; i < 16; i++) {
    const a = rng(0, 6.28)
    const r = rng(15, 25)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (!nearStream(x, z) && !nearHouse(x, z) && !nearRoad(x, z)) villageTrees.push({ x, z, scale: rng(1.8, 2.4), rot: rng(0, 6.28) })
  }
  for (let i = 0; i < 55; i++) {
    const x = rng(-30, 45)
    const z = rng(28, 100)
    if (nearStream(x, z) || nearRoad(x, z)) continue
    ;(wrand() < 0.25 ? fallAccents : meadowTrees).push({ x, z, scale: rng(1.7, 2.5), rot: rng(0, 6.28) })
  }
  for (let i = 0; i < 28; i++) northwestPines.push({ x: rng(-100, -45), z: rng(-58, -30), scale: rng(1.5, 2.2), rot: rng(0, 6.28) })
  for (let i = 0; i < 30; i++) deadTrees.push({ x: rng(45, 100), z: rng(-35, 40), type: 'dead', tint: 0.75 + wrand() * 0.3 })
  for (let i = 0; i < 30; i++) deadTrees.push({ x: rng(-40, 55), z: rng(-100, -68), type: 'dead', tint: 0.55 + wrand() * 0.25 })

  scatter(scene, 'nature', 'tree_pineTallA_detailed', pineTall, { collider: 0.4, wind: 0.02 })
  scatter(scene, 'nature', 'tree_pineRoundC', pineRound, { collider: 0.45, wind: 0.02 })
  scatter(scene, 'nature', 'tree_default', villageTrees, { collider: 0.4, wind: 0.02 })
  scatter(scene, 'nature', 'tree_oak', meadowTrees, { collider: 0.45, wind: 0.02 })
  scatter(scene, 'nature', 'tree_default_fall', fallAccents, { collider: 0.4, wind: 0.02 })
  scatter(scene, 'nature', 'tree_pineSmallB', northwestPines, { collider: 0.35, wind: 0.02 })
  plantForest(scene, deadTrees)

  // ---------- ground cover ----------
  plantGrass(scene, 500, 100, 2)
  const reeds = []
  for (let i = 0; i < 120; i++) {
    const z = rng(-55, 100)
    const side = wrand() < 0.5 ? -1 : 1
    reeds.push({ x: streamCenter(z) + side * rng(3.2, 4.6), z })
  }
  plantReeds(scene, reeds)

  // flower drifts: clustered, not confetti
  for (const model of ['flower_purpleA', 'flower_redA', 'flower_yellowA']) {
    const spots = []
    for (let c = 0; c < 5; c++) {
      const cx = rng(-24, 24) + (wrand() < 0.35 ? 0 : 0)
      const cz = rng(-24, 24) + (wrand() < 0.4 ? 45 : 0)
      for (let i = 0; i < 8; i++) {
        const fx = cx + rng(-3, 3)
        const fz = cz + rng(-3, 3)
        if (!nearHouse(fx, fz) && !nearRoad(fx, fz)) spots.push({ x: fx, z: fz, scale: rng(1.6, 2.4), rot: rng(0, 6.28) })
      }
    }
    scatter(scene, 'nature', model, spots, { wind: 0.25 })
  }

  // mushroom rings + clusters in the forest
  const shrooms = []
  for (let c = 0; c < 9; c++) {
    const cx = rng(-95, -38)
    const cz = rng(-45, 50)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.28
      shrooms.push({ x: cx + Math.cos(a) * rng(0.8, 1.4), z: cz + Math.sin(a) * rng(0.8, 1.4), scale: rng(1.5, 2.6), rot: rng(0, 6.28) })
    }
  }
  scatter(scene, 'nature', 'mushroom_redGroup', shrooms)

  // stumps and fallen logs
  const stumps = []
  const logs = []
  for (let i = 0; i < 14; i++) stumps.push({ x: rng(-95, -35), z: rng(-45, 50), scale: rng(1.6, 2.2), rot: rng(0, 6.28) })
  for (let i = 0; i < 12; i++) {
    const inForest = wrand() < 0.6
    const lx = inForest ? rng(-95, -38) : rng(-25, 40)
    const lz = inForest ? rng(-45, 50) : rng(25, 95)
    if (!nearRoad(lx, lz)) logs.push({ x: lx, z: lz, scale: rng(1.8, 2.4), rot: rng(0, 6.28) })
  }
  scatter(scene, 'nature', 'stump_roundDetailed', stumps, { collider: 0.35 })
  scatter(scene, 'nature', 'log_large', logs, { collider: 0.5 })

  // bushes everywhere green
  const bushes = []
  for (let i = 0; i < 60; i++) {
    const x = rng(-95, 95)
    const z = rng(-50, 95)
    if (Math.hypot(x, z) < 6 || nearStream(x, z) || nearHouse(x, z) || nearRoad(x, z)) continue
    bushes.push({ x, z, scale: rng(1.4, 2.4), rot: rng(0, 6.28) })
  }
  scatter(scene, 'nature', 'plant_bushDetailed', bushes, { wind: 0.06 })

  // rocks: real ones, clustered on the northwest rise + sprinkled elsewhere
  const rocksBig = []
  const rocksSmall = []
  for (let i = 0; i < 55; i++) {
    const onRise = i < 20
    const x = onRise ? rng(-100, -40) : rng(-95, 95)
    const z = onRise ? rng(-55, -25) : rng(-95, 95)
    if (Math.hypot(x, z) < 8 || nearStream(x, z) || nearRoad(x, z)) continue
    ;(wrand() < 0.4 ? rocksBig : rocksSmall).push({ x, z, scale: rng(1.5, onRise ? 3.4 : 2.4), rot: rng(0, 6.28) })
  }
  scatter(scene, 'nature', 'rock_largeA', rocksBig, { collider: 0.7 })
  scatter(scene, 'nature', 'rock_smallC', rocksSmall)

  // lilies float in the ruin pools and stream shallows
  const lilies = []
  for (const [px, pz, pr] of [[62, 8, 5], [78, -14, 4], [70, 26, 6]]) {
    for (let i = 0; i < 6; i++) lilies.push({ x: px + rng(-pr, pr) * 0.6, z: pz + rng(-pr, pr) * 0.6, y: 0.55, scale: rng(1.6, 2.6), rot: rng(0, 6.28) })
  }
  scatter(scene, 'nature', 'lily_large', lilies)

  buildVillage(scene)
  buildMeadowLandmarks(scene)
  buildBrokenBridge(scene)
  buildWell(scene)
  buildStoneCircle(scene)
  buildRuins(scene)
  buildKeep(scene)
}

// ---------- village ----------
const UP_AXIS = new THREE.Vector3(0, 1, 0)
const smokes = []
let keepEmber, keepEmberLight

// cottage: Kenney wall tiles (1x1 cells, panel on the +x edge, rotY selects
// the edge) around a 2x3 footprint, topped by a solid gabled roof prism.
// Front (door) is local +z, which buildVillage points at the well green.
function buildHouse(scene, x, z, rot) {
  const S = 2 // one wall tile = 2 world units; footprint 4x6
  const g = new THREE.Group()
  g.position.set(x, groundHeight(x, z), z)
  g.rotation.y = rot
  scene.add(g)
  addCollider(x, z, 3.2)
  const put = (name, cx, cz, ry) =>
    loadModel('town', name).then((m) => {
      const c = m.clone()
      c.position.set(cx * S, 0, cz * S)
      c.rotation.y = ry
      c.scale.setScalar(S)
      g.add(c)
    })
  // rotY(0)=panel on +x edge, PI=-x, PI/2=-z (back), -PI/2=+z (front)
  put('wall', 0.5, -1, 0) // east side
  put('wall-window-shutters', 0.5, 0, 0)
  put('wall', 0.5, 1, 0)
  put('wall', -0.5, -1, Math.PI) // west side
  put('wall-window-shutters', -0.5, 0, Math.PI)
  put('wall', -0.5, 1, Math.PI)
  put('wall', -0.5, -1, Math.PI / 2) // back
  put('wall-window-small', 0.5, -1, Math.PI / 2)
  put('wall-door', 0.5, 1, -Math.PI / 2) // front: door + shuttered window
  put('wall-window-shutters', -0.5, 1, -Math.PI / 2)

  // gabled roof: one triangular prism over the whole footprint, slight overhang
  const shape = new THREE.Shape()
  shape.moveTo(-2.35, -0.04)
  shape.lineTo(2.35, -0.04)
  shape.lineTo(0, 1.7)
  shape.closePath()
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 6.7, bevelEnabled: false })
  roofGeo.translate(0, 0, -3.35)
  const roof = new THREE.Mesh(roofGeo, toon(0x8a3d2e))
  roof.position.y = S
  roof.castShadow = true
  roof.receiveShadow = true
  g.add(roof)
  // stone chimney poking through the roof
  const chimney = part(new THREE.BoxGeometry(0.55, 1.6, 0.55), 0x77706a, 1.1, S + 1.0, -1.2)
  g.add(chimney)

  const top = new THREE.Vector3(1.1, S + 2.0, -1.2).applyAxisAngle(UP_AXIS, rot).add(g.position)
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x9a9aa8, transparent: true, opacity: 0.3 })
    )
    scene.add(puff)
    smokes.push({ mesh: puff, x: top.x, y: top.y, z: top.z, phase: i / 3 })
  }
}

// one cobbled road: dirt bed + stone flags along the samples, lanterns
// spaced on alternating sides, flowers tucked between
function buildRoad(scene, road) {
  const pts = road.pts
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[Math.min(pts.length - 1, i + 1)]
    const b = q === p ? pts[i - 1] : p // last flag reuses the previous heading
    const rot = Math.atan2(-(q.z - b.z), q.x - b.x) // path_stone runs along local x
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1.0, 10), toon(0x6a5a42))
    patch.rotation.x = -Math.PI / 2
    patch.position.set(p.x, groundHeight(p.x, p.z) + 0.02, p.z)
    patch.receiveShadow = true
    scene.add(patch)
    place(scene, 'nature', 'path_stone', p.x, p.z, { rot, scale: 1.9 })
    const px2 = -Math.sin(rot)
    const pz2 = -Math.cos(rot)
    const side = i % 12 < 6 ? 1 : -1
    if (i % 6 === 3 && i > 3 && i < pts.length - 1) {
      place(scene, 'town', 'lantern', p.x + px2 * 2.0 * side, p.z + pz2 * 2.0 * side, { scale: 1.6, collider: 0.2 })
    } else if (i % 6 === 0 && i > 0) {
      place(scene, 'nature', 'flower_yellowA', p.x - px2 * 1.8 * side, p.z - pz2 * 1.8 * side, { rot: rng(0, 6.28), scale: 2, wind: 0.25 })
    }
  }
}

// the village radiates from the hearth shrine: a flagstone plaza around it,
// four roads leaving it, cottages facing it from the quadrants between
function buildVillage(scene) {
  const faceHub = (x, z) => Math.atan2(HUB.x - x, HUB.z - z)

  // plaza: ring of flags around the shrine, lanterns on the diagonals
  // (the road exits sit on the axes, so the diagonals stay clear)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    place(scene, 'nature', 'path_stone', HUB.x + Math.cos(a) * 3.0, HUB.z + Math.sin(a) * 3.0, { rot: -a + Math.PI / 2, scale: 1.9 })
  }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    place(scene, 'town', 'lantern', HUB.x + sx * 3.4, HUB.z + sz * 3.4, { scale: 1.7, collider: 0.2 })
  }

  for (const r of ROADS) buildRoad(scene, r)

  // cottages face the shrine, each with a flagstone walk and a door lantern
  for (const h of HOUSES) {
    const rot = faceHub(h.x, h.z)
    buildHouse(scene, h.x, h.z, rot)
    const dx = Math.sin(rot)
    const dz = Math.cos(rot)
    for (let i = 0; i < 3; i++) {
      const px = h.x + dx * (3.6 + i * 1.5)
      const pz = h.z + dz * (3.6 + i * 1.5)
      place(scene, 'nature', 'path_stone', px, pz, { rot: Math.atan2(-dz, dx), scale: 1.7 })
    }
    place(scene, 'town', 'lantern', h.x + dx * 3.4 - dz * 1.6, h.z + dz * 3.4 + dx * 1.6, { scale: 1.6, collider: 0.2 })
  }

  // the old oak shades the plaza's southeast corner
  place(scene, 'nature', 'tree_oak', 4, 9, { rot: 0.8, scale: 3.6, collider: 0.9, wind: 0.02 })

  // market stall on the north side of the bridge road, cart parked beside it
  place(scene, 'town', 'stall-red', 10, 6.2, { rot: Math.PI, scale: 2, collider: 1.2 })
  place(scene, 'town', 'cart', 13.6, 6.0, { rot: Math.PI + 0.35, scale: 2, collider: 1.0 })

  // garden plot behind the southeast cottage, fenced on its open sides
  const gx = 12.5
  const gz = 17
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++)
      place(scene, 'nature', ['crop_pumpkin', 'crop_turnip', 'crops_wheatStageB'][c], gx + c * 1.1, gz + r * 1.3, { scale: 1.8 })
  for (let i = 0; i < 4; i++) place(scene, 'nature', 'fence_simple', gx - 0.5 + i * 1.35, gz + 2.6, { scale: 1.4 })
  for (let i = 0; i < 3; i++) place(scene, 'nature', 'fence_simple', gx + 3.4, gz - 0.6 + i * 1.35, { rot: Math.PI / 2, scale: 1.4 })

  // firewood stacked at the side of the southwest cottage
  place(scene, 'nature', 'log_stackLarge', -18.4, 10.4, { rot: faceHub(-16, 12) + Math.PI / 2, scale: 1.8, collider: 0.7 })

  // signposts where the broken-bridge and well roads leave the plaza
  place(scene, 'nature', 'sign', 0.2, 1.6, { rot: -1.2, scale: 2.2 })
  place(scene, 'nature', 'sign', -6.8, 8.8, { rot: 2.4, scale: 2.2 })
}

function buildMeadowLandmarks(scene) {
  // traveler's camp on the south road
  place(scene, 'nature', 'tent_detailedOpen', 8, 52, { rot: 2.4, scale: 2.4, collider: 1.2 })
  place(scene, 'nature', 'campfire_logs', 5.5, 50.5, { scale: 2.2 })
  place(scene, 'nature', 'log', 4, 52, { rot: 1.1, scale: 2 })
  // a lonely waystone ringed by flowers
  place(scene, 'nature', 'stone_tallB', -18, 60, { rot: 0.8, scale: 2.6, collider: 1.0 })
  // windmill on the eastern meadow hill: stone tower + kit blade assembly
  {
    const wx = 30
    const wz2 = 44
    const wy = groundHeight(wx, wz2)
    const tower = part(new THREE.CylinderGeometry(1.5, 2.0, 6.5, 9), 0x9a8a70, wx, wy + 3.25, wz2)
    scene.add(tower)
    const cap = part(new THREE.ConeGeometry(2.1, 1.9, 9), 0x8a3d2e, wx, wy + 7.3, wz2)
    scene.add(cap)
    addCollider(wx, wz2, 2.2)
    const rot = -0.6
    place(scene, 'town', 'windmill', wx + Math.sin(rot) * 2.0, wz2 + Math.cos(rot) * 2.0, { rot, scale: 2.2, y: 5.4 })
  }
  // watermill on the stream, south
  const wz = 34
  place(scene, 'town', 'watermill', streamCenter(wz) - 3.2, wz, { rot: Math.PI / 2, scale: 2.6, y: 0.9 * 2.6, collider: 2.2 })
}

// Two battered timber stubs leave a clear High-Jump-sized gap over the stream.
function buildBrokenBridge(scene) {
  const b = BROKEN_BRIDGE
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const plank = part(
        new THREE.BoxGeometry(0.82, 0.14, 4.1 - (i === 0 ? 0.7 : 0)),
        0x68432c,
        b.x + side * (b.gapHalf + 0.38 + i * 0.76),
        b.deckY,
        b.z
      )
      plank.rotation.y = (i === 0 ? 0.08 : 0.015 * (i % 2 ? 1 : -1)) * side
      plank.rotation.z = i === 0 ? 0.08 * side : 0
      scene.add(plank)
    }
    for (const zSide of [-1, 1]) {
      scene.add(part(new THREE.BoxGeometry(3.7, 0.16, 0.2), 0x4d321f, b.x + side * 3.25, b.deckY - 0.18, b.z + zSide * 1.55))
      const post = part(new THREE.BoxGeometry(0.18, 1.05, 0.18), 0x4d321f, b.x + side * 4.4, b.deckY + 0.48, b.z + zSide * 1.8)
      post.rotation.z = 0.08 * side
      scene.add(post)
    }
  }
  place(scene, 'nature', 'sign', b.x - 5.2, b.z + 2.8, { rot: 1.8, scale: 2.2 })
}

// the old well sits out in the north-east meadow — far enough from town that
// nobody noticed the slimes moving in (quest 1's site)
const WELL_SITE = { x: -8, z: 52 } // a real walk south through the meadows

function buildWell(scene) {
  const g = new THREE.Group()
  g.add(part(new THREE.CylinderGeometry(0.9, 1.0, 0.7, 10), 0x6a6a75, 0, 0.35))
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.62, 10), new THREE.MeshBasicMaterial({ color: 0x0a0a12 }))
  hole.rotation.x = -Math.PI / 2
  hole.position.y = 0.71
  g.add(hole)
  for (const sx of [-0.75, 0.75]) g.add(part(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 6), 0x6b4a2e, sx, 1.1))
  const roof = part(new THREE.ConeGeometry(1.25, 0.6, 4), 0x8a3d2e, 0, 2.0)
  roof.rotation.y = Math.PI / 4
  g.add(roof)
  g.position.set(WELL_SITE.x, groundHeight(WELL_SITE.x, WELL_SITE.z), WELL_SITE.z)
  scene.add(g)
  addCollider(WELL_SITE.x, WELL_SITE.z, 1.1)
  // the south road from the shrine plaza ends here (see ROADS)
}

// deep-forest clearing: the stone circle — five stones of subtly different heights
const circleStones = []
export const CIRCLE = { x: -72, z: -18 }

export function getCircleStones() {
  return circleStones
}

function buildStoneCircle(scene) {
  const heights = [2.0, 2.45, 1.75, 2.7, 2.2] // close enough that you must really look
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const x = CIRCLE.x + Math.cos(a) * 4.5
    const z = CIRCLE.z + Math.sin(a) * 4.5
    const h = heights[i]
    const gy = groundHeight(x, z)
    place(scene, 'nature', 'stone_tallB', x, z, { rot: a + rng(-0.3, 0.3), scale: h / 0.88, collider: 0.7 })
    circleStones.push({ x, z, height: h, topY: gy + h })
  }
  // mossy detail around the clearing
  for (let i = 0; i < 4; i++)
    place(scene, 'nature', 'rock_smallFlatA', CIRCLE.x + rng(-6, 6), CIRCLE.z + rng(-6, 6), { rot: rng(0, 6.28), scale: 2 })
}

// sunken ruins: colonnades, broken walls, urns among the pools
function buildRuins(scene) {
  // a processional colonnade leading toward the vault
  for (let i = 0; i < 5; i++) {
    for (const side of [-1, 1]) {
      place(scene, 'town', 'pillar-stone', 56 + i * 4, side * 3.2 + 4, { scale: 2.6, collider: 0.6 })
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = rng(48, 96)
    const z = rng(-30, 36)
    place(scene, 'grave', wrand() < 0.5 ? 'stone-wall-damaged' : 'stone-wall', x, z, { rot: rng(0, 6.28), scale: 2.4, collider: 1.0 })
  }
  for (let i = 0; i < 10; i++) {
    place(scene, 'grave', wrand() < 0.5 ? 'urn-round' : 'debris', rng(48, 94), rng(-28, 34), { rot: rng(0, 6.28), scale: 2 })
  }
  for (let i = 0; i < 6; i++) {
    place(scene, 'grave', 'column-large', rng(50, 92), rng(-26, 32), { rot: rng(0, 6.28), scale: 2.4, collider: 0.7 })
  }
}

// ashen keep: a dead fortress in a field of graves
function buildKeep(scene) {
  const kx = 8
  const kz = -86
  // curtain walls with a south gate: real stone wall segments
  const wallRun = (x0, z0, x1, z1, skipMid = false) => {
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz)
    const n = Math.round(len / 2.0)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      if (skipMid && t > 0.35 && t < 0.65) continue // the gate opening
      const x = x0 + dx * t
      const z = z0 + dz * t
      place(scene, 'grave', wrand() < 0.35 ? 'stone-wall-damaged' : 'stone-wall', x, z, {
        rot: Math.atan2(dz, dx),
        scale: 2.6,
        collider: 1.1,
      })
    }
  }
  wallRun(kx - 11, kz + 6, kx + 11, kz + 6, true) // south wall + gate
  wallRun(kx - 11, kz - 12, kx + 11, kz - 12)
  wallRun(kx - 11, kz + 6, kx - 11, kz - 12)
  wallRun(kx + 11, kz + 6, kx + 11, kz - 12)
  // gate flanked by obelisks and fire baskets
  for (const side of [-1, 1]) {
    place(scene, 'grave', 'pillar-obelisk', kx + side * 2.6, kz + 6, { scale: 3, collider: 0.7 })
    place(scene, 'grave', 'fire-basket', kx + side * 4.4, kz + 7.5, { scale: 2.4, collider: 0.5 })
  }
  // the sanctum: a crypt holding the dim Great Ember
  place(scene, 'grave', 'crypt-large', kx, kz - 9, { rot: Math.PI, scale: 3, collider: 3.4 })
  place(scene, 'grave', 'altar-stone', kx, kz - 7, { scale: 2.4, collider: 1.2 })
  keepEmber = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0x662a12 }))
  keepEmber.position.set(kx, groundHeight(kx, kz - 7) + 1.6, kz - 7)
  scene.add(keepEmber)
  keepEmberLight = new THREE.PointLight(0xff7722, 0, 24)
  keepEmberLight.position.copy(keepEmber.position)
  scene.add(keepEmberLight)
  // graveyard field on the approach — the failed who came before
  for (let i = 0; i < 22; i++) {
    const x = kx + rng(-26, 26)
    const z = kz + rng(9, 26)
    const model = ['gravestone-round', 'gravestone-wide', 'gravestone-broken', 'cross-wood'][Math.floor(wrand() * 4)]
    place(scene, 'grave', model, x, z, { rot: rng(-0.4, 0.4) + (wrand() < 0.5 ? Math.PI : 0), scale: 2.2, collider: 0.5 })
  }
  // lightposts marking the top of the ramp
  place(scene, 'grave', 'lightpost-single', kx - 3, kz + 24, { rot: 0.4, scale: 2.4, collider: 0.3 })
  place(scene, 'grave', 'lightpost-single', kx + 3, kz + 24, { rot: -0.4, scale: 2.4, collider: 0.3 })
}

export function restoreGreatEmber() {
  if (!keepEmber) return
  keepEmber.material.color.setHex(0xff7a22)
  keepEmber.scale.setScalar(1.5)
  keepEmberLight.intensity = 18
}

export function updateRegions(time) {
  for (const s of smokes) {
    const f = (time * 0.16 + s.phase) % 1
    s.mesh.position.set(s.x + Math.sin(f * 7 + s.phase * 9) * 0.18 + f * 0.4, s.y + f * 2.4, s.z)
    s.mesh.scale.setScalar(0.4 + f * 1.1)
    s.mesh.material.opacity = 0.3 * (1 - f)
  }
}
