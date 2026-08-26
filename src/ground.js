// Analytic terrain for the full 220x220 world. The same function displaces the
// mesh and is sampled by every entity, so visual and logical ground never drift.
//
// Layout (world coords, +x east, +z south):
//   village: center, flat            forest: west (x < -30)
//   ruins: east basin (x > 35)       northwest: rocky wilderness
//   keep: north plateau (z < -55) behind a cliff, ramp corridor at x ~ 8
//   stream: winds from the north ridge down the east-center, under a broken bridge

export const WATER_LEVEL = -0.5

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export function streamCenter(z) {
  return 24 + 7 * Math.sin(z * 0.08)
}

export function groundHeight(x, z) {
  // gentle rolling hills
  let h =
    (Math.sin(x * 0.11) + Math.sin(z * 0.13 + 1.7)) * 0.5 +
    Math.sin(x * 0.05 + z * 0.06) * 1.2 +
    Math.sin(x * 0.23 + 4) * Math.sin(z * 0.21) * 0.35

  // village stays flat and safe
  h *= smooth(10, 22, Math.hypot(x, z))

  // north plateau for the Ashen Keep, cliff face with a ramp corridor near x=8
  const corridor = Math.exp(-((x - 8) ** 2) / 60)
  const cliff = smooth(56, 64, -z) // sharp rise
  const ramp = smooth(46, 78, -z) // long walkable grade
  h += 6 * (cliff * (1 - corridor) + ramp * corridor)

  // NW rocky rise
  const northwest = smooth(28, 48, -x) * smooth(22, 42, -z)
  h += northwest * (1.6 + Math.sin(x * 0.45) * Math.sin(z * 0.5) * 0.9)

  // east basin for the Sunken Ruins — low, but dry by default
  const basin = smooth(38, 58, x) * (1 - smooth(40, 55, -z))
  h -= basin * 0.6

  // dry-land floor: natural terrain never dips underwater on its own;
  // only the deliberate carves below (pools, stream) reach the water
  if (h < -0.2) h = -0.2 + (h + 0.2) * 0.12

  // ruins pools: circular dips that fall below the water line
  for (const [px, pz, pr] of [[62, 8, 7], [78, -14, 6], [70, 26, 8]]) {
    const d = Math.hypot(x - px, z - pz)
    h += (-(0.9 + h) ) * smooth(pr, pr * 0.45, d) * (d < pr ? 1 : 0)
  }

  // stream: carve the bed down to ~ -1 along the winding centerline
  if (z > -62) {
    const d = Math.abs(x - streamCenter(z))
    const carve = smooth(4.2, 1.2, d)
    h += -(1.0 + h) * carve * smooth(-62, -56, z)
  }

  return h
}

// approximate outward slope; used to paint rock on cliffsides
export function groundSlope(x, z) {
  const e = 0.6
  const dx = groundHeight(x + e, z) - groundHeight(x - e, z)
  const dz = groundHeight(x, z + e) - groundHeight(x, z - e)
  return Math.hypot(dx, dz) / (2 * e)
}

// Two walkable bridge stubs leave a 2.8u gap sized for High Jump.
export const BROKEN_BRIDGE = { x: streamCenter(2), z: 2, halfWidth: 2.4, gapHalf: 1.4, stubOuter: 4.8, deckY: 0.45 }

function onBridgeStub(x, z) {
  const dx = Math.abs(x - BROKEN_BRIDGE.x)
  return Math.abs(z - BROKEN_BRIDGE.z) < BROKEN_BRIDGE.halfWidth && dx >= BROKEN_BRIDGE.gapHalf && dx < BROKEN_BRIDGE.stubOuter
}

// what entities actually stand on: terrain, or the bridge deck above the stream
export function walkableHeight(x, z, crossingBridge = false) {
  const h = groundHeight(x, z)
  const overBridge = Math.abs(z - BROKEN_BRIDGE.z) < BROKEN_BRIDGE.halfWidth && Math.abs(x - BROKEN_BRIDGE.x) < BROKEN_BRIDGE.stubOuter
  return onBridgeStub(x, z) || (crossingBridge && overBridge) ? Math.max(h, BROKEN_BRIDGE.deckY) : h
}

function isDeepWater(x, z) {
  return groundHeight(x, z) < WATER_LEVEL - 0.04 && !onBridgeStub(x, z)
}

// stop walking up cliff faces or into deep water; slide along the barrier
export function applySlopeBlock(prevX, prevZ, pos, crossingBridge = false) {
  if (crossingBridge && Math.abs(pos.z - BROKEN_BRIDGE.z) < BROKEN_BRIDGE.halfWidth && Math.abs(pos.x - BROKEN_BRIDGE.x) < BROKEN_BRIDGE.stubOuter) return
  const blocked = (nx, nz) => {
    if (isDeepWater(nx, nz)) return true
    const dist = Math.hypot(nx - prevX, nz - prevZ)
    if (dist < 1e-5) return false
    const dh = groundHeight(nx, nz) - groundHeight(prevX, prevZ)
    return dh / dist > 1.05
  }
  if (!blocked(pos.x, pos.z)) return
  if (!blocked(pos.x, prevZ)) {
    pos.z = prevZ
  } else if (!blocked(prevX, pos.z)) {
    pos.x = prevX
  } else {
    pos.x = prevX
    pos.z = prevZ
  }
}

// A High Jump that runs out above the gap finishes on the bank it was moving toward.
export function settleBridgeLanding(pos, direction) {
  if (Math.abs(pos.z - BROKEN_BRIDGE.z) >= BROKEN_BRIDGE.halfWidth || Math.abs(pos.x - BROKEN_BRIDGE.x) >= BROKEN_BRIDGE.gapHalf) return
  pos.x = BROKEN_BRIDGE.x + Math.sign(direction.x || pos.x - BROKEN_BRIDGE.x || 1) * (BROKEN_BRIDGE.gapHalf + 0.35)
}

// Small runnable crossing check: `node src/ground.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const westEdge = BROKEN_BRIDGE.x - BROKEN_BRIDGE.gapHalf - 0.1
  const walking = { x: BROKEN_BRIDGE.x - BROKEN_BRIDGE.gapHalf + 0.1, z: BROKEN_BRIDGE.z }
  applySlopeBlock(westEdge, BROKEN_BRIDGE.z, walking)
  console.assert(walking.x === westEdge)
  const jumping = { x: BROKEN_BRIDGE.x, z: BROKEN_BRIDGE.z }
  applySlopeBlock(westEdge, BROKEN_BRIDGE.z, jumping, true)
  console.assert(jumping.x === BROKEN_BRIDGE.x)
  settleBridgeLanding(jumping, { x: 1 })
  console.assert(jumping.x > BROKEN_BRIDGE.x + BROKEN_BRIDGE.gapHalf)
  console.log('Broken bridge check passed: walking stops, High Jump crosses and lands.')
}
