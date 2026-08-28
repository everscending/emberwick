import * as THREE from 'three'
import { toonRim as toon } from './materials.js'
import { stats, hurtPlayer, inAttackArc } from './player.js'
import { onEnemyKilled, questState } from './quests.js'
import { addCollider, isCirclePathClear, resolveCircle } from './collision.js'
import { applySlopeBlock, groundHeight } from './ground.js'
import { triggerAshKnightDeathFx, triggerEnemyDamageFx } from './debugfx.js'

const AGGRO_RANGE = 12
const CONTACT_RANGE = 1.0
const CONTACT_DAMAGE = 10
const BOSS_DEATH_FALL_START = 0.9
const BOSS_DEATH_FALL_END = 1.8
const PATROL_RADIUS = 3
const SENTINEL_WINDUP = 0.6
const SENTINEL_LEAP = 0.65
const SENTINEL_DROP = 0.28
const SENTINEL_JUMP_HEIGHT = 4.4
const SENTINEL_SLAM_RADIUS = 3.4
const BOSS_SLAM_LEAP = 0.68
const BOSS_SLAM_DROP = 0.3
const BOSS_JUMP_HEIGHT = 5
const BOSS_ARENA_RADIUS = 5.6
const RESPAWN_DELAY = 120

const enemies = []
const spawnPoints = []
let nextId = 1

function createPatrol(x, z, radius = PATROL_RADIUS, bodyRadius = 0.55) {
  const patrol = {
    patrolHome: new THREE.Vector2(x, z),
    patrolTarget: new THREE.Vector2(),
    patrolDir: new THREE.Vector3(),
    patrolRadius: radius,
    patrolBodyRadius: bodyRadius,
    patrolWait: Math.random() * 1.5,
  }
  choosePatrolTarget(patrol)
  return patrol
}

function choosePatrolTarget(e) {
  const fromX = e.group?.position.x ?? e.patrolHome.x
  const fromZ = e.group?.position.z ?? e.patrolHome.y
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = Math.random() * Math.PI * 2
    const distance = Math.sqrt(Math.random()) * e.patrolRadius
    const x = e.patrolHome.x + Math.cos(angle) * distance
    const z = e.patrolHome.y + Math.sin(angle) * distance
    if (isCirclePathClear(fromX, fromZ, x, z, e.patrolBodyRadius + 0.1)) {
      e.patrolTarget.set(x, z)
      return
    }
  }
  e.patrolTarget.set(fromX, fromZ)
}

function patrolDirection(e, dt) {
  if (e.patrolWait > 0) {
    e.patrolWait = Math.max(0, e.patrolWait - dt)
    return null
  }
  e.patrolDir.set(e.patrolTarget.x - e.group.position.x, 0, e.patrolTarget.y - e.group.position.z)
  if (e.patrolDir.lengthSq() < 0.09) {
    choosePatrolTarget(e)
    e.patrolWait = 0.8 + Math.random() * 1.8
    return null
  }
  return e.patrolDir.normalize()
}

function movePatrol(e, dir, distance) {
  const fromX = e.group.position.x
  const fromZ = e.group.position.z
  e.group.position.addScaledVector(dir, distance)
  applySlopeBlock(fromX, fromZ, e.group.position)
  resolveCircle(e.group.position, e.patrolBodyRadius)
  const progress = (e.group.position.x - fromX) * dir.x + (e.group.position.z - fromZ) * dir.z
  if (progress < distance * 0.5) {
    choosePatrolTarget(e)
    e.patrolWait = 0.4 + Math.random() * 0.8
    return false
  }
  e.group.rotation.y = Math.atan2(dir.x, dir.z)
  return true
}

function updatePatrol(e, dt, speed) {
  const dir = patrolDirection(e, dt)
  return dir ? movePatrol(e, dir, speed * dt) : false
}

function registerSpawn(type, scene, x, z, respawn, create, details = {}) {
  const spawn = { type, scene, x, z, respawn, create, alive: true, respawnAt: Infinity, ...details }
  spawnPoints.push(spawn)
  create(spawn)
}

function reviveSpawn(spawn) {
  spawn.alive = true
  spawn.respawnAt = Infinity
  spawn.create(spawn)
}

function respawnExpiredEnemies() {
  for (const spawn of spawnPoints) {
    if (spawn.respawn && !spawn.alive && elapsed >= spawn.respawnAt) reviveSpawn(spawn)
  }
}

export function spawnSlime(scene, x, z, { respawn = true, questTarget = false } = {}) {
  registerSpawn('slime', scene, x, z, respawn, createSlime, { questTarget })
}

function createSlime(spawn) {
  const { scene, x, z } = spawn
  const group = new THREE.Group()

  // translucent gel body with a darker core showing through
  const mat = toon(0x55aa66)
  mat.transparent = true
  mat.opacity = 0.85
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), mat)
  body.scale.y = 0.7
  body.position.y = 0.35
  body.castShadow = true
  group.add(body)

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), toon(0x2f6b3d))
  core.position.y = 0.3
  group.add(core)

  // skirt where the gel pools against the ground
  const skirt = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 8), toon(0x448855))
  skirt.scale.set(1.08, 0.24, 1.08)
  skirt.position.y = 0.1
  group.add(skirt)

  // little droplet sliding off the top
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), toon(0x6fc080))
  drop.position.set(0.12, 0.68, 0.05)
  group.add(drop)

  for (const ex of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    eye.position.set(ex, 0.44, 0.4)
    group.add(eye)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }))
    pupil.position.set(ex, 0.44, 0.48)
    group.add(pupil)
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    glint.position.set(ex + 0.025, 0.47, 0.5)
    group.add(glint)
  }

  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a3322 }))
  mouth.scale.set(1.5, 0.6, 0.5)
  mouth.position.set(0, 0.3, 0.46)
  group.add(mouth)

  group.position.set(x, 0, z)
  scene.add(group)

  enemies.push({
    id: nextId++,
    type: 'slime',
    group,
    body,
    mat,
    hp: 100, // 5 basic hits; damage nodes bring it to 4, then 3
    maxHp: 100,
    seed: Math.random() * 10, // desyncs the idle wobble
    hopTimer: Math.random(), // desync hops
    hopping: false,
    hopTime: 0,
    knockback: new THREE.Vector3(),
    flashTimer: 0,
    pop: 0,
    dying: false,
    dieTime: 0,
    spawn,
    hopDir: new THREE.Vector3(),
    patrolHop: false,
    ...createPatrol(x, z, 6),
  })
}

export function spawnThornback(scene, x, z) {
  registerSpawn('thornback', scene, x, z, true, createThornback)
}

function createThornback(spawn) {
  const { scene, x, z } = spawn
  const group = new THREE.Group()
  const mat = toon(0x5d4930)
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65), mat)
  body.position.y = 1.02
  body.scale.set(1, 0.72, 1.25)
  body.castShadow = true
  group.add(body)
  const legs = []
  const upperLegGeo = new THREE.BoxGeometry(0.24, 0.32, 0.28)
  const lowerLegGeo = new THREE.BoxGeometry(0.2, 0.32, 0.22)
  const pasternGeo = new THREE.BoxGeometry(0.16, 0.2, 0.18)
  const jointGeo = new THREE.SphereGeometry(0.14, 6, 4)
  const hoofGeo = new THREE.BoxGeometry(0.26, 0.14, 0.34)
  const legMat = toon(0x493925)
  const hoofMat = toon(0x261f19)
  for (const sx of [-0.44, 0.44]) for (const sz of [-0.46, 0.46]) {
    const upper = new THREE.Group()
    upper.position.set(sx, 0.84, sz)
    const upperLimb = new THREE.Mesh(upperLegGeo, legMat)
    upperLimb.position.y = -0.16
    const lower = new THREE.Group()
    lower.position.y = -0.32
    const elbowOrKnee = new THREE.Mesh(jointGeo, legMat)
    const lowerLimb = new THREE.Mesh(lowerLegGeo, legMat)
    lowerLimb.position.y = -0.16
    const pastern = new THREE.Group()
    pastern.position.y = -0.32
    const wristOrHock = new THREE.Mesh(jointGeo, legMat)
    wristOrHock.scale.setScalar(0.8)
    const pasternLimb = new THREE.Mesh(pasternGeo, legMat)
    pasternLimb.position.y = -0.1
    const hoof = new THREE.Mesh(hoofGeo, hoofMat)
    hoof.position.set(0, -0.23, 0.08)
    pastern.add(wristOrHock, pasternLimb, hoof)
    lower.add(elbowOrKnee, lowerLimb, pastern)
    upper.add(upperLimb, lower)
    group.add(upper)
    const front = sz > 0
    const pose = front
      ? { upperRest: 0.28, lowerRest: -0.38, pasternRest: 0.08 }
      : { upperRest: -0.46, lowerRest: 0.9, pasternRest: -0.58 }
    upper.rotation.x = pose.upperRest
    lower.rotation.x = pose.lowerRest
    pastern.rotation.x = pose.pasternRest
    legs.push({ upper, lower, pastern, front, phase: sx * sz > 0 ? 0 : Math.PI, ...pose })
  }
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), toon(0x493925))
  snout.position.set(0, 0.88, 0.65)
  snout.scale.set(1, 0.72, 0.85)
  group.add(snout)
  for (const sx of [-0.22, 0.22]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 6), toon(0xd8c9a5))
    tusk.position.set(sx, 0.78, 0.9)
    tusk.rotation.x = Math.PI / 2
    group.add(tusk)
  }
  for (let i = -2; i <= 2; i++) {
    const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 6), toon(0x3f5634))
    thorn.position.set(i * 0.22, 1.46 - Math.abs(i) * 0.07, -0.08)
    thorn.rotation.z = -i * 0.1
    group.add(thorn)
  }
  group.position.set(x, groundHeight(x, z), z)
  scene.add(group)
  enemies.push({
    id: nextId++, type: 'thornback', group, body, mat, legs, hp: 140, maxHp: 140,
    state: 'stalk', stateTime: 0, cooldown: 0.6, chargeDir: new THREE.Vector3(), attackHit: false,
    knockback: new THREE.Vector3(), flashTimer: 0, pop: 0, dying: false, spawn,
    ...createPatrol(x, z),
  })
}

export function spawnDrownedSentinel(scene, x, z) {
  registerSpawn('sentinel', scene, x, z, true, createDrownedSentinel)
}

function createDrownedSentinel(spawn) {
  const { scene, x, z } = spawn
  const group = new THREE.Group()
  const upperBody = new THREE.Group()
  group.add(upperBody)
  const mat = toon(0x53645d)
  const accentMat = toon(0x718078)
  const mossMat = toon(0x385841)
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 1), mat)
  body.position.y = 1.18
  body.scale.set(0.9, 1.05, 0.72)
  body.castShadow = true
  upperBody.add(body)
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.36, 10), accentMat)
  waist.position.y = 0.68
  upperBody.add(waist)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.09, 7, 16), accentMat)
  collar.position.y = 1.62
  collar.rotation.x = Math.PI / 2
  upperBody.add(collar)
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), mat)
  head.position.y = 1.93
  head.scale.set(0.9, 0.78, 0.82)
  head.castShadow = true
  upperBody.add(head)
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.38, 2, 1, 2), accentMat)
  jaw.position.set(0, 1.73, 0.18)
  upperBody.add(jaw)
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x7ee8c5 })
  for (const ex of [-0.15, 0.15]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), glowMat)
    eye.position.set(ex, 1.98, 0.34)
    upperBody.add(eye)
  }
  for (const cx of [-0.24, 0, 0.24]) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42 + (cx === 0 ? 0.12 : 0), 7), accentMat)
    crown.position.set(cx, 2.34 + (cx === 0 ? 0.06 : 0), -0.02)
    upperBody.add(crown)
  }
  const arms = []
  for (const sx of [-0.72, 0.72]) {
    const side = Math.sign(sx)
    const arm = new THREE.Group()
    arm.position.set(sx, 1.52, 0)
    arm.rotation.z = side * 0.22
    const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), accentMat)
    shoulder.scale.set(1.15, 0.8, 1)
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.38, 5, 10), mat)
    upperArm.position.y = -0.36
    const forearm = new THREE.Group()
    forearm.position.y = -0.65
    forearm.rotation.z = -side * 0.35
    const lowerArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 5, 10), accentMat)
    lowerArm.position.y = -0.3
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 1), mat)
    fist.position.y = -0.62
    forearm.add(lowerArm, fist)
    arm.add(shoulder, upperArm, forearm)
    upperBody.add(arm)
    arms.push({ arm, forearm, side })
  }
  const legs = []
  for (const sx of [-0.3, 0.3]) {
    const side = Math.sign(sx)
    const hip = new THREE.Group()
    hip.position.set(sx, 0.9, 0)
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 10), mat)
    thigh.position.y = -0.21
    const knee = new THREE.Group()
    knee.position.y = -0.42
    knee.rotation.x = 0.08
    const kneeStone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.21, 1), accentMat)
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 10), mat)
    shin.position.y = -0.15
    const ankle = new THREE.Group()
    ankle.position.y = -0.3
    ankle.rotation.x = -0.08
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.58, 2, 1, 2), accentMat)
    foot.position.set(0, -0.09, 0.12)
    ankle.add(foot)
    knee.add(kneeStone, shin, ankle)
    hip.add(thigh, knee)
    group.add(hip)
    legs.push({ hip, knee, ankle, side, phase: side > 0 ? 0 : Math.PI })
  }
  for (const [mx, my, mz, scale] of [[-0.5, 1.5, 0.25, 0.22], [0.38, 1.33, 0.42, 0.18], [-0.18, 2.14, -0.2, 0.16]]) {
    const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 1), mossMat)
    moss.position.set(mx, my, mz)
    upperBody.add(moss)
  }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 1), glowMat)
  core.position.set(0, 1.12, 0.56)
  const coreHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x79d4ba, transparent: true, opacity: 0.14, depthWrite: false })
  )
  coreHalo.position.copy(core.position)
  const coreLight = new THREE.PointLight(0x79d4ba, 0.45, 4)
  coreLight.position.copy(core.position)
  upperBody.add(coreHalo, core, coreLight)
  const wispGeo = new THREE.OctahedronGeometry(0.065, 0)
  const wispMat = new THREE.MeshBasicMaterial({ color: 0xa1ffe1, transparent: true, opacity: 0.75 })
  const wisps = Array.from({ length: 5 }, (_, i) => {
    const wisp = new THREE.Mesh(wispGeo, wispMat)
    wisp.userData.seed = i * Math.PI * 2 / 5
    group.add(wisp)
    return wisp
  })
  const slamRing = new THREE.Group()
  const slamMats = [
    new THREE.MeshBasicMaterial({ color: 0x79d4ba, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xb2ffe9, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  ]
  for (const [inner, outer, segments, ringMat] of [[3.05, 3.32, 64, slamMats[0]], [2.35, 2.5, 48, slamMats[1]]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, segments), ringMat)
    ring.rotation.x = -Math.PI / 2
    slamRing.add(ring)
  }
  const runeGeo = new THREE.CircleGeometry(0.12, 6)
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6
    const rune = new THREE.Mesh(runeGeo, slamMats[1])
    rune.position.set(Math.cos(a) * 2.8, 0.015, Math.sin(a) * 2.8)
    rune.rotation.x = -Math.PI / 2
    slamRing.add(rune)
  }
  slamRing.position.y = 0.3 // stays readable over uneven ruin terrain
  slamRing.visible = false
  group.add(slamRing)
  const jumpShadowMat = new THREE.MeshBasicMaterial({ color: 0x07110f, transparent: true, opacity: 0.24, depthWrite: false })
  const jumpShadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), jumpShadowMat)
  jumpShadow.rotation.x = -Math.PI / 2
  jumpShadow.position.y = 0.04
  jumpShadow.visible = false
  group.add(jumpShadow)
  const crackVertices = []
  for (let i = 0; i < 12; i++) {
    let x = 0
    let z = 0
    for (let step = 1; step <= 3; step++) {
      const angle = i * Math.PI / 6 + Math.sin(i * 3 + step) * 0.16
      const radius = 0.18 + step * 0.62
      const nx = Math.cos(angle) * radius
      const nz = Math.sin(angle) * radius
      crackVertices.push(x, 0.045, z, nx, 0.045, nz)
      x = nx
      z = nz
    }
  }
  const groundCracksMat = new THREE.LineBasicMaterial({ color: 0x111b19, transparent: true, opacity: 0, depthWrite: false })
  const groundCracksGeo = new THREE.BufferGeometry()
  groundCracksGeo.setAttribute('position', new THREE.Float32BufferAttribute(crackVertices, 3))
  const groundCracks = new THREE.LineSegments(groundCracksGeo, groundCracksMat)
  groundCracks.visible = false
  group.add(groundCracks)
  const impactBurst = new THREE.Group()
  const impactBurstMat = new THREE.MeshBasicMaterial({ color: 0xb2ffe9, transparent: true, opacity: 0, depthWrite: false })
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 4), impactBurstMat)
    spike.position.set(Math.cos(a) * 0.75, 0.28, Math.sin(a) * 0.75)
    spike.rotation.set(-Math.sin(a) * 0.5, a, Math.cos(a) * 0.5)
    impactBurst.add(spike)
  }
  impactBurst.visible = false
  group.add(impactBurst)
  group.position.set(x, groundHeight(x, z), z)
  scene.add(group)
  enemies.push({
    id: nextId++, type: 'sentinel', group, upperBody, body, mat, arms, legs, core, coreHalo, coreLight, wisps, slamRing, slamMats, jumpShadow, jumpShadowMat, groundCracks, groundCracksMat, impactBurst, impactBurstMat, hp: 180, maxHp: 180,
    state: 'stalk', stateTime: 0, cooldown: 0.8, attackHit: false,
    slamStart: new THREE.Vector3(), slamTarget: new THREE.Vector3(),
    knockback: new THREE.Vector3(), flashTimer: 0, pop: 0, dying: false, spawn,
    ...createPatrol(x, z, 3, 0.7),
  })
}

let elapsed = 0

// the Gravewarden: tall, slow stalker with a telegraphed lunge
export function spawnGravewarden(scene, x, z) {
  const group = new THREE.Group()
  const mat = toon(0x2a2a38)
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 9), mat)
  robe.position.y = 1.3
  robe.castShadow = true
  group.add(robe)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), toon(0xd8d0c0))
  skull.position.y = 2.85
  skull.scale.y = 1.15
  skull.castShadow = true
  group.add(skull)
  for (const ex of [-0.15, 0.15]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff6622 }))
    eye.position.set(ex, 2.9, 0.36)
    group.add(eye)
  }
  for (const sx of [-0.85, 0.85]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.0, 4, 8), mat)
    arm.position.set(sx, 1.7, 0.2)
    arm.rotation.z = sx > 0 ? -0.5 : 0.5
    arm.castShadow = true
    group.add(arm)
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), toon(0xd8d0c0))
    claw.position.set(sx * 1.35, 1.05, 0.35)
    claw.rotation.x = Math.PI
    group.add(claw)
  }
  group.position.set(x, groundHeight(x, z), z)
  scene.add(group)
  enemies.push({
    id: nextId++,
    type: 'warden',
    group,
    body: robe,
    mat,
    hp: 200,
    maxHp: 200,
    state: 'stalk',
    stateTime: 0,
    cooldown: 0,
    lungeDir: new THREE.Vector3(),
    knockback: new THREE.Vector3(),
    flashTimer: 0,
    pop: 0,
    dying: false,
    ...createPatrol(x, z, 2.8, 0.75),
  })
}

export function spawnAshKnight(scene, x, z, onDefeat) {
  const group = new THREE.Group()
  const upperBody = new THREE.Group()
  group.add(upperBody)
  const mat = toon(0x292a33)
  const accentMat = toon(0x17171d)
  const emberPlateMat = toon(0x4a2022)
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.82, 1), mat)
  body.position.y = 1.55
  body.scale.set(1.12, 1.14, 0.76)
  body.castShadow = true
  upperBody.add(body)
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.68, 0.42, 10), accentMat)
  waist.position.y = 0.9
  upperBody.add(waist)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.12, 7, 16), emberPlateMat)
  collar.position.y = 2.12
  collar.rotation.x = Math.PI / 2
  upperBody.add(collar)
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), mat)
  head.position.y = 2.55
  head.scale.set(1.05, 0.84, 0.9)
  head.castShadow = true
  upperBody.add(head)
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.22, 0.42, 2, 1, 2), accentMat)
  jaw.position.set(0, 2.31, 0.18)
  upperBody.add(jaw)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.17, 0.13), accentMat)
  visor.position.set(0, 2.59, 0.43)
  upperBody.add(visor)
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff5522 })
  for (const ex of [-0.21, 0.21]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat)
    eye.position.set(ex, 2.59, 0.51)
    upperBody.add(eye)
  }
  for (const [cx, height, tilt] of [[-0.29, 0.48, -0.18], [0, 0.3, 0.12], [0.29, 0.56, 0.2]]) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.13, height, 6), emberPlateMat)
    crown.position.set(cx, 2.94 + height * 0.4, -0.03)
    crown.rotation.z = tilt
    upperBody.add(crown)
  }

  const arms = []
  let swordPivot
  let offArm
  for (const sx of [-0.92, 0.92]) {
    const side = Math.sign(sx)
    const arm = new THREE.Group()
    arm.position.set(sx, 1.9, 0)
    arm.rotation.z = side * 0.2
    const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.43, 1), emberPlateMat)
    shoulder.scale.set(1.25, 0.86, 1.05)
    const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.52, 6), accentMat)
    pauldron.position.set(side * 0.2, 0.22, -0.03)
    pauldron.rotation.z = -side * 0.85
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 5, 10), mat)
    upperArm.position.y = -0.42
    const forearm = new THREE.Group()
    forearm.position.y = -0.76
    forearm.rotation.z = -side * 0.25
    const lowerArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.36, 5, 10), accentMat)
    lowerArm.position.y = -0.3
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(side < 0 ? 0.31 : 0.37, 1), mat)
    fist.position.y = -0.66
    forearm.add(lowerArm, fist)
    arm.add(shoulder, pauldron, upperArm, forearm)
    upperBody.add(arm)
    arms.push({ arm, forearm, side })
    if (side < 0) swordPivot = arm
    else offArm = arm
  }
  const weapon = new THREE.Group()
  weapon.position.set(0, -1.42, 0)
  const bladeMat = toon(0x8e8b88)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 2.5), bladeMat)
  blade.position.z = 1.2
  blade.castShadow = true
  weapon.add(blade)
  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.45, 4), bladeMat)
  bladeTip.position.z = 2.62
  bladeTip.rotation.x = Math.PI / 2
  weapon.add(bladeTip)
  const bladeSpine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 1.9), emberPlateMat)
  bladeSpine.position.set(0, 0.08, 1.05)
  weapon.add(bladeSpine)
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.16), toon(0x8b6538))
  weapon.add(guard)
  swordPivot.add(weapon)

  for (const [cx, length, angle] of [[-0.4, 1.55, -0.08], [0, 1.85, 0.03], [0.4, 1.45, 0.1]]) {
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.35, length, 0.08), emberPlateMat)
    cape.position.set(cx, 1.45 - (1.85 - length) * 0.45, -0.61)
    cape.rotation.z = angle
    upperBody.add(cape)
  }

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), glowMat)
  core.position.set(0, 1.55, 0.67)
  const coreHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5522, transparent: true, opacity: 0.16, depthWrite: false })
  )
  coreHalo.position.copy(core.position)
  const coreLight = new THREE.PointLight(0xff5522, 0.65, 5)
  coreLight.position.copy(core.position)
  upperBody.add(coreHalo, core, coreLight)
  for (const [px, py, angle] of [[-0.34, 1.8, -0.55], [0.28, 1.48, 0.45], [-0.15, 1.18, -0.25]]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.04), glowMat)
    seam.position.set(px, py, 0.7)
    seam.rotation.z = angle
    upperBody.add(seam)
  }

  const legs = []
  for (const sx of [-0.38, 0.38]) {
    const side = Math.sign(sx)
    const hip = new THREE.Group()
    hip.position.set(sx, 1.05, 0)
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.29, 0.5, 10), mat)
    thigh.position.y = -0.25
    const knee = new THREE.Group()
    knee.position.y = -0.5
    knee.rotation.x = 0.1
    const kneePlate = new THREE.Mesh(new THREE.DodecahedronGeometry(0.27, 1), emberPlateMat)
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.42, 10), accentMat)
    shin.position.y = -0.22
    const ankle = new THREE.Group()
    ankle.position.y = -0.43
    ankle.rotation.x = -0.1
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.78, 2, 1, 2), mat)
    foot.position.set(0, -0.12, 0.18)
    ankle.add(foot)
    knee.add(kneePlate, shin, ankle)
    hip.add(thigh, knee)
    group.add(hip)
    legs.push({ hip, knee, ankle, side, phase: side > 0 ? 0 : Math.PI })
  }

  const slamRing = new THREE.Group()
  const slamMats = [
    new THREE.MeshBasicMaterial({ color: 0xff5522, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false }),
  ]
  for (const [inner, outer, segments, ringMat] of [[3.75, 4.05, 64, slamMats[0]], [2.8, 2.98, 48, slamMats[1]]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, segments), ringMat)
    ring.rotation.x = -Math.PI / 2
    slamRing.add(ring)
  }
  const runeGeo = new THREE.CircleGeometry(0.14, 4)
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6
    const rune = new THREE.Mesh(runeGeo, slamMats[1])
    rune.position.set(Math.cos(a) * 3.45, 0.015, Math.sin(a) * 3.45)
    rune.rotation.x = -Math.PI / 2
    rune.rotation.z = a
    slamRing.add(rune)
  }
  slamRing.position.y = 0.12
  slamRing.visible = false
  group.add(slamRing)

  const jumpShadowMat = new THREE.MeshBasicMaterial({ color: 0x090607, transparent: true, opacity: 0.3, depthWrite: false })
  const jumpShadow = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), jumpShadowMat)
  jumpShadow.rotation.x = -Math.PI / 2
  jumpShadow.position.y = 0.04
  jumpShadow.visible = false
  group.add(jumpShadow)
  const crackVertices = []
  for (let i = 0; i < 14; i++) {
    let cx = 0
    let cz = 0
    for (let step = 1; step <= 4; step++) {
      const angle = i * Math.PI * 2 / 14 + Math.sin(i * 4 + step) * 0.16
      const radius = 0.12 + step * 0.72
      const nx = Math.cos(angle) * radius
      const nz = Math.sin(angle) * radius
      crackVertices.push(cx, 0.05, cz, nx, 0.05, nz)
      cx = nx
      cz = nz
    }
  }
  const groundCracksMat = new THREE.LineBasicMaterial({ color: 0x34100c, transparent: true, opacity: 0, depthWrite: false })
  const groundCracksGeo = new THREE.BufferGeometry()
  groundCracksGeo.setAttribute('position', new THREE.Float32BufferAttribute(crackVertices, 3))
  const groundCracks = new THREE.LineSegments(groundCracksGeo, groundCracksMat)
  groundCracks.visible = false
  group.add(groundCracks)
  const impactBurst = new THREE.Group()
  const impactBurstMat = new THREE.MeshBasicMaterial({ color: 0xff7a32, transparent: true, opacity: 0, depthWrite: false })
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 4), impactBurstMat)
    spike.position.set(Math.cos(a) * 0.85, 0.34, Math.sin(a) * 0.85)
    spike.rotation.set(-Math.sin(a) * 0.55, a, Math.cos(a) * 0.55)
    impactBurst.add(spike)
  }
  impactBurst.visible = false
  group.add(impactBurst)
  const chargeFlames = new THREE.Group()
  for (let i = -2; i <= 2; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12 + Math.abs(i) * 0.02, 0.75, 5), glowMat)
    flame.position.set(i * 0.22, 0.65 + Math.abs(i) * 0.08, -0.72)
    flame.rotation.x = -Math.PI / 2
    chargeFlames.add(flame)
  }
  chargeFlames.visible = false
  group.add(chargeFlames)

  group.position.set(x, groundHeight(x, z), z)
  scene.add(group)
  enemies.push({
    id: nextId++,
    type: 'boss',
    group,
    upperBody,
    body,
    mat,
    arms,
    legs,
    swordPivot,
    offArm,
    core,
    coreHalo,
    coreLight,
    slamRing,
    slamMats,
    jumpShadow,
    jumpShadowMat,
    groundCracks,
    groundCracksMat,
    impactBurst,
    impactBurstMat,
    chargeFlames,
    hp: 360,
    maxHp: 360,
    state: 'idle',
    stateTime: 0,
    cooldown: 1,
    attackIndex: 0,
    attackHit: false,
    phaseTwo: false,
    recoveryKind: 'normal',
    chargeDir: new THREE.Vector3(),
    slamStart: new THREE.Vector3(),
    slamTarget: new THREE.Vector3(),
    knockback: new THREE.Vector3(),
    flashTimer: 0,
    pop: 0,
    dying: false,
    onDefeat,
    ...createPatrol(x, z, 2.4, 0.8),
  })
}

function updateWarden(e, player, dt, patrolOnly) {
  const ppos = player.group.position
  const to = ppos.clone().sub(e.group.position).setY(0)
  const dist = patrolOnly ? Infinity : to.length()
  e.stateTime += dt
  e.cooldown = Math.max(0, e.cooldown - dt)
  if (e.state === 'stalk') {
    if (dist < AGGRO_RANGE && dist > 1.6) {
      to.normalize()
      e.group.position.addScaledVector(to, 2.3 * dt)
      e.group.rotation.y = Math.atan2(to.x, to.z)
    } else if (dist >= AGGRO_RANGE) {
      updatePatrol(e, dt, 0.8)
    }
    e.group.position.y = groundHeight(e.group.position.x, e.group.position.z) + Math.sin(elapsed * 2) * 0.08 // eerie hover
    if (dist < 5.5 && e.cooldown <= 0) {
      e.state = 'windup'
      e.stateTime = 0
      e.lungeDir.copy(to).normalize()
      e.body.material.emissive.setHex(0x552211) // telegraphed
    }
    if (dist < 1.5) hurtPlayer(player, 20, e.group.position)
  } else if (e.state === 'windup') {
    if (e.stateTime >= 0.55) {
      e.state = 'lunge'
      e.stateTime = 0
      e.body.material.emissive.setHex(0x000000)
    }
  } else if (e.state === 'lunge') {
    e.group.position.addScaledVector(e.lungeDir, 15 * dt)
    e.group.position.y = groundHeight(e.group.position.x, e.group.position.z)
    if (e.group.position.distanceTo(ppos) < 1.7) hurtPlayer(player, 35, e.group.position)
    if (e.stateTime >= 0.35) {
      e.state = 'stalk'
      e.cooldown = 2.2
    }
  }
}

function beginBossAttack(e, to) {
  e.state = bossAttackForIndex(e.attackIndex)
  e.attackIndex = (e.attackIndex + 1) % 3
  e.stateTime = 0
  e.attackHit = false
  e.chargeDir.copy(to).normalize()
  if (e.chargeDir.lengthSq() < 0.01) e.chargeDir.set(Math.sin(e.group.rotation.y), 0, Math.cos(e.group.rotation.y))
  e.group.rotation.y = Math.atan2(e.chargeDir.x, e.chargeDir.z)
  e.mat.emissive.setHex(0x5a1d12)
}

export function bossAttackForIndex(index) {
  return ['slashWindup', 'chargeWindup', 'slamWindup'][index % 3]
}

function clampBossArena(position, radius = BOSS_ARENA_RADIUS) {
  const fromCenter = new THREE.Vector2(position.x - 8, position.z + 87)
  if (fromCenter.length() <= radius) return false
  fromCenter.setLength(radius)
  position.x = 8 + fromCenter.x
  position.z = -87 + fromCenter.y
  return true
}

function poseBossWalk(e, walking) {
  const gait = elapsed * 5.2
  e.upperBody.position.y = walking ? Math.abs(Math.sin(gait)) * 0.08 : Math.sin(elapsed * 1.5 + e.id) * 0.025
  e.upperBody.rotation.set(walking ? 0.05 : 0, 0, 0)
  e.legs.forEach(({ hip, knee, ankle, phase }) => {
    const swing = walking ? Math.sin(gait + phase) : 0
    const bend = 0.1 + (walking ? Math.max(0, -swing) * 0.5 : 0)
    hip.rotation.x = swing * 0.38
    knee.rotation.x = bend
    ankle.rotation.x = -hip.rotation.x - bend
  })
  e.arms.forEach(({ arm, forearm, side }) => {
    const swing = walking ? Math.sin(gait + (side > 0 ? 0 : Math.PI)) : 0
    arm.rotation.set(walking ? -swing * 0.28 : 0, 0, side * 0.2)
    forearm.rotation.z = -side * 0.25
  })
}

function setBossArc(e, progress, height) {
  e.group.position.lerpVectors(e.slamStart, e.slamTarget, progress)
  e.group.position.y += height
  e.slamRing.position.y = 0.12
  e.jumpShadow.position.y = groundHeight(e.group.position.x, e.group.position.z) - e.group.position.y + 0.04
  e.jumpShadow.scale.setScalar(1 - height / BOSS_JUMP_HEIGHT * 0.45)
  e.jumpShadowMat.opacity = 0.3 - height / BOSS_JUMP_HEIGHT * 0.12
}

function beginBossRecovery(e, kind = 'normal') {
  e.state = 'recover'
  e.stateTime = 0
  e.recoveryKind = kind
  e.mat.emissive.setHex(0x000000)
}

function updateBoss(e, player, dt, patrolOnly) {
  e.stateTime += dt
  e.cooldown = Math.max(0, e.cooldown - dt)
  if (patrolOnly || questState.q4 !== 1) {
    const walking = updatePatrol(e, dt, 0.65)
    poseBossWalk(e, walking)
    if (!walking) e.group.rotation.y += dt * 0.12
    e.group.position.y = groundHeight(e.group.position.x, e.group.position.z)
    return
  }

  const ppos = player.group.position
  const to = ppos.clone().sub(e.group.position).setY(0)
  const dist = to.length()
  const pulse = 1 + Math.sin(elapsed * (e.phaseTwo ? 5 : 3)) * (e.phaseTwo ? 0.18 : 0.1)
  e.core.scale.setScalar(pulse)
  e.coreHalo.scale.setScalar(0.95 + pulse * 0.2 + (e.phaseTwo ? 0.28 : 0))
  e.coreLight.intensity = (e.phaseTwo ? 1.2 : 0.55) + pulse * 0.16

  if (!e.phaseTwo && e.hp <= e.maxHp * 0.5) {
    e.phaseTwo = true
    e.state = 'phaseShift'
    e.stateTime = 0
    e.attackHit = false
    e.core.material.color.setHex(0xffaa44)
    e.coreHalo.material.color.setHex(0xff7a32)
    e.coreLight.color.setHex(0xff7a32)
  }

  if (e.state === 'idle') {
    const walking = dist > 3.1
    poseBossWalk(e, walking)
    e.slamRing.visible = false
    e.jumpShadow.visible = false
    e.groundCracks.visible = false
    e.impactBurst.visible = false
    e.chargeFlames.visible = false
    if (dist > 0.01) e.group.rotation.y = Math.atan2(to.x, to.z)
    if (walking) e.group.position.addScaledVector(to.normalize(), (e.phaseTwo ? 2.05 : 1.8) * dt)
    if (dist < 7 && e.cooldown <= 0) beginBossAttack(e, to)
  } else if (e.state === 'phaseShift') {
    const t = Math.min(1, e.stateTime / 1.15)
    e.mat.emissive.setHex(0x7a2918)
    e.slamRing.visible = true
    e.slamRing.scale.setScalar(0.12 + t * 0.98)
    e.slamRing.rotation.y += dt * (2 + t * 3)
    e.slamMats[0].opacity = 0.85 * (1 - t * 0.45)
    e.slamMats[1].opacity = 0.65 * (1 - t * 0.35)
    e.upperBody.position.y = Math.sin(t * Math.PI) * 0.24
    e.upperBody.rotation.set(-Math.sin(t * Math.PI) * 0.12, 0, 0)
    e.swordPivot.rotation.set(-t * 0.8, -t * 0.65, -0.2 - t * 0.8)
    e.offArm.rotation.set(-t * 0.35, 0, 0.2 + t * 1.15)
    if (t >= 1) {
      e.state = 'idle'
      e.stateTime = 0
      e.cooldown = 0.35
      e.mat.emissive.setHex(0x000000)
      e.slamRing.visible = false
    }
  } else if (e.state === 'slashWindup') {
    const t = Math.min(1, e.stateTime / 0.65)
    e.mat.emissive.setHex(0x5a1d12)
    if (dist > 0.01) e.group.rotation.y = Math.atan2(to.x, to.z)
    e.upperBody.position.y = -t * 0.08
    e.upperBody.rotation.set(0, t * 0.28, 0)
    e.swordPivot.rotation.set(-t * 0.35, -t * 1.72, -0.2 - t * 0.35)
    e.offArm.rotation.z = 0.2 + t * 0.65
    if (t >= 1) {
      e.state = 'slash'
      e.stateTime = 0
      e.mat.emissive.setHex(0x000000)
    }
  } else if (e.state === 'slash') {
    const t = Math.min(1, e.stateTime / 0.34)
    e.upperBody.rotation.y = 0.28 - t * 0.56
    e.swordPivot.rotation.set(-0.35 + Math.sin(t * Math.PI) * 0.28, -1.72 + t * 3.44, -0.55)
    if (!e.attackHit && t > 0.3 && dist < 3.2) {
      e.attackHit = true
      hurtPlayer(player, e.phaseTwo ? 38 : 34, e.group.position)
    }
    if (t >= 1) {
      e.state = e.phaseTwo ? 'slashEcho' : 'recover'
      e.stateTime = 0
      e.recoveryKind = 'normal'
      e.attackHit = false
      e.slamRing.scale.setScalar(0.18)
    }
  } else if (e.state === 'slashEcho') {
    const t = Math.min(1, e.stateTime / 0.52)
    e.slamRing.visible = true
    e.slamRing.scale.setScalar(0.18 + t * 0.78)
    e.slamRing.rotation.y += dt * 4
    e.slamMats[0].opacity = 0.7 * (1 - t)
    e.slamMats[1].opacity = 0.55 * (1 - t)
    if (!e.attackHit && t > 0.42 && dist < 3.8 && player.state !== 'highJump') {
      e.attackHit = true
      hurtPlayer(player, 18, e.group.position)
    }
    if (t >= 1) beginBossRecovery(e)
  } else if (e.state === 'chargeWindup') {
    const t = Math.min(1, e.stateTime / 0.75)
    e.mat.emissive.setHex(0x5a1d12)
    if (dist > 0.01) {
      e.chargeDir.copy(to).normalize()
      e.group.rotation.y = Math.atan2(e.chargeDir.x, e.chargeDir.z)
    }
    e.upperBody.position.y = -t * 0.24
    e.upperBody.rotation.x = t * 0.24
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -t * 0.12
      knee.rotation.x = 0.1 + t * 0.72
      ankle.rotation.x = -0.1 - t * 0.5
    })
    e.swordPivot.rotation.set(-t * 0.45, t * 0.4, -0.2 - t * 0.4)
    e.offArm.rotation.set(-t * 0.55, 0, 0.2 + t * 0.35)
    e.chargeFlames.visible = e.phaseTwo && t > 0.45
    if (t >= 1) {
      e.state = 'charge'
      e.stateTime = 0
      e.mat.emissive.setHex(0x000000)
    }
  } else if (e.state === 'charge') {
    e.chargeFlames.visible = true
    e.chargeFlames.scale.z = 0.8 + Math.sin(elapsed * 24) * 0.22 + (e.phaseTwo ? 0.4 : 0)
    e.upperBody.rotation.x = 0.22
    e.swordPivot.rotation.set(-0.45, 0.4, -0.6)
    e.group.position.addScaledVector(e.chargeDir, (e.phaseTwo ? 13 : 11.5) * dt)
    const hitWall = clampBossArena(e.group.position, 5.45)
    if (!e.attackHit && e.group.position.distanceTo(ppos) < 1.75) {
      e.attackHit = true
      hurtPlayer(player, e.phaseTwo ? 44 : 40, e.group.position)
      beginBossRecovery(e)
    } else if (hitWall) {
      e.state = 'stagger'
      e.stateTime = 0
      e.chargeFlames.visible = false
      player.shake = Math.max(player.shake ?? 0, 0.28)
      e.mat.emissive.setHex(0x000000)
    } else if (e.stateTime >= 0.68) {
      if (e.phaseTwo) {
        e.state = 'chargeBurst'
        e.stateTime = 0
        e.attackHit = false
        e.slamRing.scale.setScalar(0.12)
      } else beginBossRecovery(e)
    }
  } else if (e.state === 'chargeBurst') {
    const t = Math.min(1, e.stateTime / 0.48)
    e.chargeFlames.visible = false
    e.slamRing.visible = true
    e.slamRing.scale.setScalar(0.12 + t * 0.55)
    e.slamRing.rotation.y += dt * 5
    e.slamMats[0].opacity = 0.72 * (1 - t)
    e.slamMats[1].opacity = 0.58 * (1 - t)
    if (!e.attackHit && t > 0.38 && dist < 2.7 && player.state !== 'highJump') {
      e.attackHit = true
      hurtPlayer(player, 20, e.group.position)
    }
    if (t >= 1) beginBossRecovery(e)
  } else if (e.state === 'stagger') {
    const settle = Math.min(1, e.stateTime / 0.24)
    e.upperBody.position.y = -0.34 * settle
    e.upperBody.rotation.set(0.32 * settle, 0, Math.sin(e.stateTime * 18) * 0.025)
    e.swordPivot.rotation.set(0.75 * settle, 0.2, -0.6)
    e.offArm.rotation.set(-0.35 * settle, 0, 0.8)
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -0.18 * settle
      knee.rotation.x = 0.1 + 0.95 * settle
      ankle.rotation.x = -0.1 - 0.55 * settle
    })
    if (e.stateTime >= 1.8) {
      e.state = 'idle'
      e.stateTime = 0
      e.cooldown = 0.5
    }
  } else if (e.state === 'slamWindup') {
    e.mat.emissive.setHex(0x5a1d12)
    const t = Math.min(1, e.stateTime / 0.78)
    if (dist > 0.01) e.group.rotation.y = Math.atan2(to.x, to.z)
    e.slamRing.visible = true
    e.slamRing.scale.setScalar(0.2 + t * 0.8)
    e.slamRing.rotation.y += dt * (1.5 + t * 2.5)
    e.slamMats[0].opacity = 0.25 + t * 0.58
    e.slamMats[1].opacity = 0.15 + t * 0.5
    e.jumpShadow.visible = true
    e.jumpShadow.position.y = 0.04
    e.upperBody.position.y = -t * 0.26
    e.upperBody.rotation.x = -t * 0.12
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -t * 0.16
      knee.rotation.x = 0.1 + t * 0.82
      ankle.rotation.x = -0.1 - t * 0.58
    })
    e.swordPivot.rotation.set(-t * 2.35, -t * 0.2, -0.2 - t * 0.85)
    e.offArm.rotation.z = 0.2 + t * 1.25
    if (t >= 1) {
      e.slamStart.copy(e.group.position)
      e.slamTarget.set(ppos.x, groundHeight(ppos.x, ppos.z), ppos.z)
      clampBossArena(e.slamTarget, 5.2)
      e.state = 'slamLeap'
      e.stateTime = 0
    }
  } else if (e.state === 'slamLeap') {
    const t = Math.min(1, e.stateTime / BOSS_SLAM_LEAP)
    const tracking = Math.min(1, dt * 3.2)
    e.slamTarget.x = THREE.MathUtils.lerp(e.slamTarget.x, ppos.x, tracking)
    e.slamTarget.z = THREE.MathUtils.lerp(e.slamTarget.z, ppos.z, tracking)
    clampBossArena(e.slamTarget, 5.2)
    e.slamTarget.y = groundHeight(e.slamTarget.x, e.slamTarget.z)
    setBossArc(e, t * 0.65, BOSS_JUMP_HEIGHT * (1 - (1 - t) ** 3))
    e.slamRing.visible = true
    e.jumpShadow.visible = true
    e.slamRing.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.08)
    e.slamRing.rotation.y += dt * 3.2
    e.upperBody.position.y = 0.12 + Math.sin(t * Math.PI) * 0.18
    e.upperBody.rotation.x = -0.16 * (1 - t)
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -0.24
      knee.rotation.x = 1.05 + Math.sin(t * Math.PI) * 0.35
      ankle.rotation.x = -0.72
    })
    e.swordPivot.rotation.set(-2.35, -0.2, -1.05)
    e.offArm.rotation.z = 1.45
    if (t >= 1) {
      e.state = 'slamDrop'
      e.stateTime = 0
    }
  } else if (e.state === 'slamDrop') {
    const t = Math.min(1, e.stateTime / BOSS_SLAM_DROP)
    setBossArc(e, 0.65 + t * 0.35, BOSS_JUMP_HEIGHT * (1 - t * t))
    e.slamRing.rotation.y += dt * 5
    e.upperBody.position.y = 0.12 - t * 0.32
    e.upperBody.rotation.x = t * 0.42
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -0.24 + t * 0.14
      knee.rotation.x = 1.12 - t * 0.5
      ankle.rotation.x = -0.72 + t * 0.36
    })
    e.swordPivot.rotation.set(-2.35 + t * 2.7, -0.2, -1.05 + t * 0.5)
    if (t >= 1) {
      const radius = e.phaseTwo ? 4.6 : 4
      if (Math.hypot(ppos.x - e.group.position.x, ppos.z - e.group.position.z) < radius && player.state !== 'highJump') {
        hurtPlayer(player, e.phaseTwo ? 48 : 42, e.group.position)
      }
      e.attackHit = false
      e.jumpShadow.visible = false
      e.groundCracks.visible = true
      e.groundCracks.scale.setScalar(0.3)
      e.groundCracksMat.opacity = 0.95
      e.impactBurst.visible = true
      e.impactBurst.scale.setScalar(0.45)
      e.impactBurstMat.opacity = 0.9
      e.slamRing.scale.setScalar(e.phaseTwo ? 1.14 : 1)
      player.shake = Math.max(player.shake ?? 0, 0.7)
      beginBossRecovery(e, 'slam')
    }
  } else if (e.state === 'recover') {
    const settle = Math.min(1, e.stateTime / 0.9)
    e.chargeFlames.visible = false
    e.upperBody.position.y = -0.2 * (1 - settle)
    e.upperBody.rotation.set(0.38 * (1 - settle), 0, 0)
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -0.1 * (1 - settle)
      knee.rotation.x = 0.95 - settle * 0.85
      ankle.rotation.x = -knee.rotation.x
    })
    e.swordPivot.rotation.set(0.35 * (1 - settle), 0, -0.55 + settle * 0.35)
    e.offArm.rotation.set(-0.2 * (1 - settle), 0, 0.65 - settle * 0.45)
    if (e.recoveryKind === 'slam') {
      const impact = Math.min(1, e.stateTime / 0.62)
      e.slamRing.visible = impact < 1
      e.slamRing.scale.setScalar((e.phaseTwo ? 1.14 : 1) + impact * (e.phaseTwo ? 0.5 : 0.32))
      e.slamMats[0].opacity = 0.8 * (1 - impact)
      e.slamMats[1].opacity = 0.62 * (1 - impact)
      e.impactBurst.visible = impact < 1
      e.impactBurst.scale.setScalar(0.45 + impact * 2)
      e.impactBurst.position.y = 0.06 + impact * 0.4
      e.impactBurstMat.opacity = 0.9 * (1 - impact)
      const crackGrowth = Math.min(1, e.stateTime / 0.2)
      e.groundCracks.visible = e.stateTime < 1.05
      e.groundCracks.scale.setScalar(0.3 + crackGrowth * 0.7)
      e.groundCracksMat.opacity = 0.95 * (1 - THREE.MathUtils.smoothstep(e.stateTime, 0.5, 1.05))
      if (e.phaseTwo && !e.attackHit && e.stateTime >= 0.42) {
        e.attackHit = true
        if (dist < 5.1 && player.state !== 'highJump') hurtPlayer(player, 20, e.group.position)
      }
    } else {
      e.slamRing.visible = false
      e.impactBurst.visible = false
      e.groundCracks.visible = false
    }
    if (e.stateTime >= 1.25) {
      e.state = 'idle'
      e.stateTime = 0
      e.cooldown = e.phaseTwo ? 0.35 : 0.45
      e.recoveryKind = 'normal'
    }
  }

  if (e.state !== 'slamLeap' && e.state !== 'slamDrop') {
    clampBossArena(e.group.position)
    e.group.position.y = groundHeight(e.group.position.x, e.group.position.z)
  }
  const contact = e.group.position.distanceTo(ppos)
  if (contact < 1.25 && contact > 0.01) ppos.addScaledVector(ppos.clone().sub(e.group.position).setY(0).normalize(), (1.25 - contact) * 0.5)
}

function bossDeathPoseAt(time) {
  const fall = THREE.MathUtils.smoothstep(time, BOSS_DEATH_FALL_START, BOSS_DEATH_FALL_END)
  return {
    fall,
    tilt: Math.sin(time * 18) * 0.13 * (1 - fall) + fall * Math.PI / 2,
    done: time >= BOSS_DEATH_FALL_END,
  }
}

function updateThornback(e, player, dt, patrolOnly) {
  const ppos = player.group.position
  const to = ppos.clone().sub(e.group.position).setY(0)
  const dist = patrolOnly ? Infinity : to.length()
  e.stateTime += dt
  e.cooldown = Math.max(0, e.cooldown - dt)
  const patrolling = e.state === 'stalk' && dist >= 10 && updatePatrol(e, dt, 0.9)
  const stride = e.state === 'charge' ? 0.4 : e.state === 'stalk' && (dist < 10 || patrolling) ? 0.22 : 0
  const pace = e.state === 'charge' ? 22 : 7
  const brace = e.state === 'windup' ? Math.min(1, e.stateTime / 0.65) * 0.18 : 0
  e.legs.forEach((leg) => {
    const cycle = elapsed * pace + leg.phase
    const lift = Math.max(0, Math.cos(cycle))
    leg.upper.rotation.x = leg.upperRest + Math.sin(cycle) * stride + (leg.front ? -brace : brace)
    leg.lower.rotation.x = leg.lowerRest + (leg.front ? -1.2 : 1.35) * lift * stride
    leg.pastern.rotation.x = leg.pasternRest + (leg.front ? 0.55 : -0.65) * lift * stride
  })
  if (e.state === 'stalk') {
    if (dist < 10 && dist > 3.2) {
      e.group.position.addScaledVector(to.normalize(), 1.7 * dt)
      e.group.rotation.y = Math.atan2(to.x, to.z)
    }
    if (dist < 6 && e.cooldown <= 0) {
      e.state = 'windup'
      e.stateTime = 0
      e.chargeDir.copy(to).normalize()
      e.group.rotation.y = Math.atan2(e.chargeDir.x, e.chargeDir.z)
    }
  } else if (e.state === 'windup') {
    e.mat.emissive.setHex(0x4d2414)
    e.body.scale.z = 1.25 - Math.sin(Math.min(1, e.stateTime / 0.65) * Math.PI) * 0.22
    if (e.stateTime >= 0.65) {
      e.state = 'charge'
      e.stateTime = 0
      e.attackHit = false
      e.body.scale.z = 1.25
      e.mat.emissive.setHex(0x000000)
    }
  } else if (e.state === 'charge') {
    e.group.position.addScaledVector(e.chargeDir, 10 * dt)
    if (!e.attackHit && e.group.position.distanceTo(ppos) < 1.25) {
      e.attackHit = true
      hurtPlayer(player, 20, e.group.position)
    }
    if (e.stateTime >= 0.45) {
      e.state = 'recover'
      e.stateTime = 0
    }
  } else if (e.state === 'recover') {
    e.body.rotation.z = Math.sin(e.stateTime * 15) * 0.06
    if (e.stateTime >= 0.8) {
      e.body.rotation.z = 0
      e.state = 'stalk'
      e.cooldown = 0.7
    }
  }
  e.group.position.y = groundHeight(e.group.position.x, e.group.position.z)
}

function setSentinelArc(e, progress, height) {
  e.group.position.lerpVectors(e.slamStart, e.slamTarget, progress)
  e.group.position.y += height
  e.slamRing.position.y = 0.3
  e.jumpShadow.position.y = groundHeight(e.group.position.x, e.group.position.z) - e.group.position.y + 0.04
  e.jumpShadow.scale.setScalar(1 - height / SENTINEL_JUMP_HEIGHT * 0.45)
  e.jumpShadowMat.opacity = 0.24 - height / SENTINEL_JUMP_HEIGHT * 0.1
}

function updateSentinel(e, player, dt, patrolOnly) {
  const ppos = player.group.position
  const to = ppos.clone().sub(e.group.position).setY(0)
  const dist = patrolOnly ? Infinity : to.length()
  e.stateTime += dt
  e.cooldown = Math.max(0, e.cooldown - dt)
  const pulse = 1 + Math.sin(elapsed * 3 + e.id) * 0.12
  const slamCharge = e.state === 'windup' ? Math.min(1, e.stateTime / SENTINEL_WINDUP) : e.state === 'leap' || e.state === 'slam' ? 1 : 0
  e.core.scale.setScalar(pulse)
  e.coreHalo.scale.setScalar(0.9 + pulse * 0.18 + slamCharge * 0.35)
  e.coreLight.intensity = 0.35 + pulse * 0.12 + slamCharge * 0.8
  e.wisps.forEach((wisp, i) => {
    const a = elapsed * (0.65 + i * 0.035) + wisp.userData.seed
    const airborne = e.state === 'leap' || e.state === 'slam'
    const radius = airborne ? 0.52 + i * 0.02 : 0.82 + i * 0.035
    wisp.position.set(Math.cos(a) * radius, 1.15 + Math.sin(a * 1.7) * (airborne ? 0.32 : 0.55), Math.sin(a) * radius)
    wisp.scale.set(airborne ? 0.8 : 1, e.state === 'slam' ? 2.8 : 1, airborne ? 0.8 : 1)
  })
  if (e.state === 'stalk') {
    e.slamRing.visible = false
    e.slamRing.position.y = 0.3
    e.jumpShadow.visible = false
    e.groundCracks.visible = false
    e.impactBurst.visible = false
    const chasing = dist < 9 && dist > 3.4
    const walking = chasing || (dist >= 9 && updatePatrol(e, dt, 0.7))
    const gait = elapsed * 5.8
    e.upperBody.position.y = walking ? Math.abs(Math.sin(gait)) * 0.06 : Math.sin(elapsed * 1.6 + e.id) * 0.025
    e.upperBody.rotation.x = walking ? 0.045 : 0
    e.legs.forEach(({ hip, knee, ankle, phase }) => {
      const swing = walking ? Math.sin(gait + phase) : 0
      const bend = 0.08 + (walking ? Math.max(0, -swing) * 0.56 : 0)
      hip.rotation.x = swing * 0.42
      knee.rotation.x = bend
      ankle.rotation.x = -hip.rotation.x - bend
    })
    e.arms.forEach(({ arm, forearm, side }) => {
      const swing = walking ? Math.sin(gait + (side > 0 ? 0 : Math.PI)) : 0
      arm.rotation.x = walking ? -swing * 0.38 : Math.sin(elapsed * 1.8 + side) * 0.025
      arm.rotation.z = side * 0.22
      forearm.rotation.z = -side * 0.35
    })
    if (chasing) {
      e.group.position.addScaledVector(to.normalize(), 1.15 * dt)
      e.group.rotation.y = Math.atan2(to.x, to.z)
    }
    if (dist < 4.5 && e.cooldown <= 0) {
      e.state = 'windup'
      e.stateTime = 0
      e.attackHit = false
    }
  } else if (e.state === 'windup') {
    const t = Math.min(1, e.stateTime / SENTINEL_WINDUP)
    e.mat.emissive.setHex(0x174b40)
    e.slamRing.visible = true
    e.slamRing.position.y = 0.3
    e.jumpShadow.visible = true
    e.jumpShadow.position.y = 0.04
    e.jumpShadow.scale.setScalar(1)
    e.jumpShadowMat.opacity = 0.24
    e.slamRing.scale.setScalar(0.25 + t * 0.75)
    e.slamRing.rotation.y += dt * (0.8 + t * 1.6)
    e.slamMats[0].opacity = 0.22 + t * 0.55
    e.slamMats[1].opacity = 0.12 + t * 0.5
    e.upperBody.position.y = -0.22 * Math.sin(t * Math.PI / 2)
    e.upperBody.rotation.x = -t * 0.12
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -t * 0.16
      knee.rotation.x = 0.08 + t * 0.74
      ankle.rotation.x = -0.08 - t * 0.48
    })
    e.arms.forEach(({ arm, forearm, side }) => {
      arm.rotation.x = 0
      arm.rotation.z = side * (0.22 + t * 2.2)
      forearm.rotation.z = -side * (0.35 + t * 0.65)
    })
    if (t >= 1) {
      e.slamStart.copy(e.group.position)
      e.slamTarget.set(ppos.x, groundHeight(ppos.x, ppos.z), ppos.z)
      const flightX = e.slamTarget.x - e.slamStart.x
      const flightZ = e.slamTarget.z - e.slamStart.z
      if (flightX * flightX + flightZ * flightZ > 0.01) e.group.rotation.y = Math.atan2(flightX, flightZ)
      e.state = 'leap'
      e.stateTime = 0
    }
  } else if (e.state === 'leap') {
    const t = Math.min(1, e.stateTime / SENTINEL_LEAP)
    const tracking = Math.min(1, dt * 4)
    e.slamTarget.x = THREE.MathUtils.lerp(e.slamTarget.x, ppos.x, tracking)
    e.slamTarget.z = THREE.MathUtils.lerp(e.slamTarget.z, ppos.z, tracking)
    e.slamTarget.y = groundHeight(e.slamTarget.x, e.slamTarget.z)
    const height = SENTINEL_JUMP_HEIGHT * (1 - (1 - t) ** 3)
    setSentinelArc(e, t * 0.65, height)
    e.slamRing.visible = true
    e.jumpShadow.visible = true
    e.slamRing.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.06)
    e.slamRing.rotation.y += dt * 2.4
    e.mat.emissive.setHex(0x174b40)
    e.upperBody.position.y = 0.08 + Math.sin(t * Math.PI) * 0.14
    e.upperBody.rotation.x = -0.12 * (1 - t)
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -0.2
      knee.rotation.x = 0.82 + Math.sin(t * Math.PI) * 0.42
      ankle.rotation.x = -0.62
    })
    e.arms.forEach(({ arm, forearm, side }) => {
      arm.rotation.x = -0.12
      arm.rotation.z = side * 2.68
      forearm.rotation.z = -side * 1.05
    })
    if (t >= 1) {
      e.state = 'slam'
      e.stateTime = 0
    }
  } else if (e.state === 'slam') {
    const t = Math.min(1, e.stateTime / SENTINEL_DROP)
    const height = SENTINEL_JUMP_HEIGHT * (1 - t * t)
    setSentinelArc(e, 0.65 + t * 0.35, height)
    e.slamRing.rotation.y += dt * 4
    e.mat.emissive.setHex(0x174b40)
    e.upperBody.position.y = 0.08 - t * 0.24
    e.upperBody.rotation.x = t * 0.38
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -0.2 + t * 0.12
      knee.rotation.x = 1.05 - t * 0.48
      ankle.rotation.x = -0.62 + t * 0.3
    })
    e.arms.forEach(({ arm, forearm, side }) => {
      arm.rotation.x = t * 0.28
      arm.rotation.z = side * (2.68 - t * 1.5)
      forearm.rotation.z = -side * (1.05 - t * 0.35)
    })
    if (t >= 1) {
      e.slamRing.position.y = 0.3
      e.jumpShadow.visible = false
      const landingDistance = Math.hypot(ppos.x - e.group.position.x, ppos.z - e.group.position.z)
      if (!e.attackHit && landingDistance < SENTINEL_SLAM_RADIUS) hurtPlayer(player, 28, e.group.position)
      e.attackHit = true
      player.shake = Math.max(player.shake ?? 0, 0.55)
      e.state = 'recover'
      e.stateTime = 0
      e.groundCracks.visible = true
      e.groundCracks.scale.setScalar(0.35)
      e.groundCracksMat.opacity = 0.9
      e.impactBurst.visible = true
      e.mat.emissive.setHex(0x000000)
    }
  } else if (e.state === 'recover') {
    const impact = Math.min(1, e.stateTime / 0.5)
    const settle = Math.min(1, e.stateTime / 0.8)
    e.slamRing.visible = impact < 1
    e.slamRing.scale.setScalar(1 + impact * 0.45)
    e.slamMats[0].opacity = 0.77 * (1 - impact)
    e.slamMats[1].opacity = 0.62 * (1 - impact)
    e.impactBurst.visible = impact < 1
    e.impactBurst.scale.setScalar(0.45 + impact * 1.8)
    e.impactBurst.position.y = 0.05 + impact * 0.35
    e.impactBurstMat.opacity = 0.85 * (1 - impact)
    const crackGrowth = Math.min(1, e.stateTime / 0.18)
    e.groundCracks.visible = e.stateTime < 0.95
    e.groundCracks.scale.setScalar(0.35 + crackGrowth * 0.65)
    e.groundCracksMat.opacity = 0.9 * (1 - THREE.MathUtils.smoothstep(e.stateTime, 0.45, 0.95))
    const baseScale = e.group.scale.x
    const squash = 1 - Math.min(1, e.stateTime / 0.28)
    e.group.scale.set(baseScale * (1 + squash * 0.15), baseScale * (1 - squash * 0.28), baseScale * (1 + squash * 0.15))
    e.upperBody.position.y = -0.16 * (1 - settle)
    e.upperBody.rotation.x = 0.38 * (1 - settle)
    e.legs.forEach(({ hip, knee, ankle }) => {
      hip.rotation.x = -0.08 * (1 - settle)
      knee.rotation.x = 0.82 - settle * 0.74
      ankle.rotation.x = -knee.rotation.x
    })
    e.arms.forEach(({ arm, forearm, side }) => {
      arm.rotation.x = 0.28 * (1 - settle)
      arm.rotation.z = side * (1.18 - settle * 0.96)
      forearm.rotation.z = -side * (0.7 - settle * 0.35)
    })
    if (e.stateTime >= 1) {
      e.state = 'stalk'
      e.stateTime = 0
      e.cooldown = 0.8
      e.impactBurst.visible = false
      e.groundCracks.visible = false
    }
  }
  if (e.state !== 'leap' && e.state !== 'slam') e.group.position.y = groundHeight(e.group.position.x, e.group.position.z)
}

export function updateEnemies(scene, player, dt, patrolOnly = false) {
  elapsed += dt
  respawnExpiredEnemies()
  const ppos = player.group.position

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]

    if (e.dying) {
      if (e.type === 'boss') {
        e.dieTime += dt
        const pose = bossDeathPoseAt(e.dieTime)
        e.group.rotation.z = pose.tilt
        e.group.position.y = groundHeight(e.group.position.x, e.group.position.z) + pose.fall * 0.9
        e.swordPivot.rotation.x = pose.fall * 0.7
        e.slamRing.visible = false
        e.jumpShadow.visible = false
        e.groundCracks.visible = false
        e.impactBurst.visible = false
        e.chargeFlames.visible = false
        if (!pose.done || !e.deathSoundDone) continue
        e.onDefeat?.()
      } else {
        const shades = e.type === 'warden'
          ? [0x3a3a48, 0x2a2a35, 0x55505e]
          : e.type === 'thornback'
            ? [0x5d4930, 0x3f5634, 0x8a704c]
            : e.type === 'sentinel'
              ? [0x53645d, 0x718078, 0x7ed0b0]
              : undefined
        spawnSplatter(scene, e.group.position, shades)
      }
      scene.remove(e.group)
      enemies.splice(i, 1)
      continue
    }

    // take sword hit
    if (!patrolOnly && player.attackActive && !player.hitThisSwing.has(e.id) && inAttackArc(player, e.group.position)) {
      player.hitThisSwing.add(e.id)
      applyHit(e, stats.damage * player.attackMult, ppos, player.attackMult > 1 ? 14 : 8)
      if (e.dying) continue
    }

    e.flashTimer = Math.max(0, e.flashTimer - dt)
    if (e.flashTimer > 0) e.mat.emissive.setHex(0xffffff)
    else if (e.type !== 'warden') e.mat.emissive.setHex(0x000000)
    e.pop = Math.max(0, e.pop - dt * 6)
    e.group.scale.setScalar(1 + e.pop * (e.type === 'boss' ? 0.05 : e.type === 'warden' || e.type === 'sentinel' ? 0.08 : 0.25))
    e.recoilTime = Math.max(0, (e.recoilTime ?? 0) - dt)
    e.group.rotation.x = e.recoilTime > 0 ? -Math.sin(Math.PI * (1 - e.recoilTime / 0.24)) * 0.22 : 0

    // knockback decay
    e.group.position.addScaledVector(e.knockback, dt)
    e.knockback.multiplyScalar(Math.max(0, 1 - dt * 8))

    if (e.type === 'boss') {
      updateBoss(e, player, dt, patrolOnly)
      continue
    }
    if (e.type === 'thornback') {
      updateThornback(e, player, dt, patrolOnly)
      continue
    }
    if (e.type === 'sentinel') {
      updateSentinel(e, player, dt, patrolOnly)
      continue
    }
    if (e.type === 'warden') {
      updateWarden(e, player, dt, patrolOnly)
      continue
    }

    // hop toward player when aggroed
    const dist = patrolOnly ? Infinity : e.group.position.distanceTo(ppos)
    if (e.hopping) {
      e.hopTime += dt
      const t = e.hopTime / 0.45
      if (t >= 1) {
        e.hopping = false
        e.body.position.y = 0.35
      } else {
        e.body.position.y = 0.35 + Math.sin(t * Math.PI) * 0.5
        e.body.scale.y = 0.7 + Math.sin(t * Math.PI) * 0.15 // stretches mid-hop
        const dir = e.hopDir
        if (e.patrolHop) {
          if (!movePatrol(e, dir, 4 * dt)) e.hopping = false
        } else {
          e.group.position.addScaledVector(dir, 4 * dt)
          e.group.rotation.y = Math.atan2(dir.x, dir.z)
          resolveCircle(e.group.position, 0.5)
        }
      }
    } else if (dist < AGGRO_RANGE) {
      const wob = Math.sin(elapsed * 3 + e.seed) * 0.04 // idle jelly wobble
      e.body.scale.set(1 + wob, 0.7 - wob * 1.3, 1 + wob)
      e.hopTimer -= dt
      if (e.hopTimer <= 0) {
        e.hopDir.copy(ppos).sub(e.group.position).setY(0).normalize()
        e.patrolHop = false
        e.hopping = true
        e.hopTime = 0
        e.hopTimer = 0.9
      }
    } else {
      const wob = Math.sin(elapsed * 3 + e.seed) * 0.04
      e.body.scale.set(1 + wob, 0.7 - wob * 1.3, 1 + wob)
      e.hopTimer -= dt
      if (e.hopTimer <= 0) {
        const dir = patrolDirection(e, dt)
        if (dir) {
          e.hopDir.copy(dir)
          e.patrolHop = true
          e.hopping = true
          e.hopTime = 0
          e.hopTimer = 0.9
        }
      }
    }

    e.group.position.y = groundHeight(e.group.position.x, e.group.position.z)

    // contact damage, then push apart — slimes are solid, not walk-through
    if (dist < CONTACT_RANGE) hurtPlayer(player, CONTACT_DAMAGE, e.group.position)
    if (dist < 0.95 && dist > 1e-3) {
      const push = ppos.clone().sub(e.group.position).setY(0).normalize().multiplyScalar(0.95 - dist)
      ppos.addScaledVector(push, 0.6)
      e.group.position.addScaledVector(push, -0.4)
    }
  }

  updateGibs(scene, dt)
}

// death splatter: gel chunks burst out, splash down, and melt away over a stain
const gibs = []

function spawnSplatter(scene, pos, shades = [0x55aa66, 0x448855, 0x6fc080]) {
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 6, 5), toon(shades[i % 3]))
    m.position.set(pos.x, 0.4, pos.z)
    m.castShadow = true
    scene.add(m)
    const a = Math.random() * Math.PI * 2
    const sp = 1.5 + Math.random() * 3.5
    gibs.push({ mesh: m, vel: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 3.5, Math.sin(a) * sp), life: 0.9 })
  }
  const stain = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), toon(shades[1]))
  stain.rotation.x = -Math.PI / 2
  stain.position.set(pos.x, 0.02, pos.z)
  scene.add(stain)
  gibs.push({ mesh: stain, vel: null, life: 1.8 })
}

function updateGibs(scene, dt) {
  for (let i = gibs.length - 1; i >= 0; i--) {
    const g = gibs[i]
    g.life -= dt
    if (g.vel) {
      g.vel.y -= 12 * dt
      g.mesh.position.addScaledVector(g.vel, dt)
      if (g.mesh.position.y < 0.05) {
        g.mesh.position.y = 0.05
        g.vel.set(0, 0, 0)
        g.mesh.scale.y = 0.35 // splats flat on landing
      }
    }
    if (g.life < 0.4) g.mesh.scale.multiplyScalar(Math.max(0.001, 1 - dt * 4)) // melt away
    if (g.life <= 0) {
      scene.remove(g.mesh)
      gibs.splice(i, 1)
    }
  }
}

let wardenDeathHandler = null
export function setWardenDeathHandler(fn) {
  wardenDeathHandler = fn
}

// HP bar appears above an enemy the first time it takes a hit: one sprite
// drawn from a small canvas (1px white border, dark back, ember fill)
const BAR_W = 66
const BAR_H = 10

function drawBar(e) {
  const ctx = e.barCtx
  ctx.clearRect(0, 0, BAR_W, BAR_H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, BAR_W, BAR_H) // border
  ctx.fillStyle = '#141018'
  ctx.fillRect(1, 1, BAR_W - 2, BAR_H - 2) // backing
  ctx.fillStyle = '#d84a3a'
  ctx.fillRect(2, 2, Math.round((BAR_W - 4) * Math.max(0, e.hp / e.maxHp)), BAR_H - 4) // fill
  e.barTex.needsUpdate = true
}

function showHpBar(e) {
  if (e.bar) return
  const cv = document.createElement('canvas')
  cv.width = BAR_W
  cv.height = BAR_H
  e.barCtx = cv.getContext('2d')
  e.barTex = new THREE.CanvasTexture(cv)
  e.barTex.magFilter = THREE.NearestFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: e.barTex, depthTest: false, transparent: true }))
  sprite.scale.set(1.2, 1.2 * (BAR_H / BAR_W), 1)
  sprite.position.y = e.type === 'boss' ? 3.8 : e.type === 'warden' ? 3.6 : e.type === 'sentinel' ? 3 : e.type === 'thornback' ? 1.45 : 1.2
  sprite.renderOrder = 5
  e.group.add(sprite)
  e.bar = sprite
}

function defeatTypeFor(e) {
  return e.spawn?.questTarget ? 'slime' : e.type === 'slime' ? 'roamingSlime' : e.type ?? 'slime'
}

function applyHit(e, damage, fromPos, kb) {
  e.hp -= damage
  const killed = e.hp <= 0 && !e.dying
  showHpBar(e)
  drawBar(e)
  e.flashTimer = 0.12
  e.pop = 1
  const resistance = e.type === 'boss' ? 0.12 : e.type === 'warden' ? 0.25 : e.type === 'sentinel' ? 0.35 : e.type === 'thornback' ? 0.7 : 1
  e.knockback.copy(e.group.position).sub(fromPos).setY(0).normalize().multiplyScalar(kb * resistance)
  triggerEnemyDamageFx(e, fromPos, killed)
  if (killed) {
    e.dying = true
    e.dieTime = 0
    if (e.spawn) {
      e.spawn.alive = false
      if (e.spawn.respawn) e.spawn.respawnAt = elapsed + RESPAWN_DELAY
    }
    onEnemyKilled(defeatTypeFor(e))
    if (e.type === 'warden' && wardenDeathHandler) wardenDeathHandler(e.group.position.clone())
    if (e.type === 'boss') {
      e.deathSoundDone = false
      triggerAshKnightDeathFx(() => { e.deathSoundDone = true })
    } else e.onDefeat?.()
  }
}

// area damage for projectiles etc.; returns true if something was hit
export function damageEnemiesAt(pos, radius, damage) {
  for (const e of enemies) {
    if (e.dying) continue
    if (e.group.position.distanceTo(pos) < radius) {
      applyHit(e, damage, pos, 6)
      return true
    }
  }
  return false
}

export function enemyCount() {
  return enemies.length
}

export function restoreEnemyProgress() {
  let defeatedQuestSlimes = Math.min(questState.slimesKilled, 4)
  for (let i = enemies.length - 1; i >= 0 && defeatedQuestSlimes > 0; i--) {
    const enemy = enemies[i]
    if (!enemy.spawn?.questTarget) continue
    enemy.spawn.alive = false
    enemy.spawn.scene.remove(enemy.group)
    enemies.splice(i, 1)
    defeatedQuestSlimes--
  }
}

export function bossSnapshot() {
  const boss = enemies.find((enemy) => enemy.type === 'boss')
  return boss ? { hp: Math.max(1, Math.ceil(boss.hp)) } : null
}

export function restoreBoss(saved) {
  const boss = enemies.find((enemy) => enemy.type === 'boss')
  if (boss && Number.isFinite(saved?.hp)) boss.hp = THREE.MathUtils.clamp(saved.hp, 1, boss.maxHp)
}

export function enemyReturnsAtShrine(spawn, shrinePos) {
  return spawn.respawn && Math.hypot(spawn.x - shrinePos.x, spawn.z - shrinePos.z) >= 10
}

export function respawnEnemies(shrinePos) {
  for (const spawn of spawnPoints) {
    if (!spawn.respawn) continue
    const index = enemies.findIndex((enemy) => enemy.spawn === spawn)
    if (index >= 0) {
      spawn.scene.remove(enemies[index].group)
      enemies.splice(index, 1)
    }
    spawn.alive = false
    spawn.respawnAt = elapsed + RESPAWN_DELAY
    if (!enemyReturnsAtShrine(spawn, shrinePos)) continue
    reviveSpawn(spawn)
  }
}

// Small runnable boss check: `node src/enemies.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const sequence = [0, 1, 2, 3].map(bossAttackForIndex)
  if (sequence.join(',') !== 'slashWindup,chargeWindup,slamWindup,slashWindup') throw new Error('Ash Knight must cycle through all three readable attacks')
  const wobble = bossDeathPoseAt(0.25)
  const fallen = bossDeathPoseAt(BOSS_DEATH_FALL_END)
  if (wobble.done || Math.abs(wobble.tilt) < 0.02 || !fallen.done || Math.abs(fallen.tilt - Math.PI / 2) > 0.001) throw new Error('Ash Knight death must wobble before collapsing')
  const shrine = { x: 0, z: 0 }
  if (enemyReturnsAtShrine({ x: 20, z: 0, respawn: false }, shrine) || !enemyReturnsAtShrine({ x: 20, z: 0, respawn: true }, shrine)) throw new Error('Quest enemies must stay dead while distant roaming enemies return')
  const scene = { add() {}, remove() {} }
  const patrol = { group: new THREE.Group(), ...createPatrol(0, 0) }
  patrol.patrolWait = 0
  patrol.patrolTarget.set(1, 0)
  if (!updatePatrol(patrol, 0.25, 1) || patrol.group.position.x <= 0) throw new Error('Idle enemies must move toward a nearby patrol point')
  patrol.group.position.set(0, 0, 0)
  patrol.patrolTarget.set(2, 0)
  const blocker = addCollider(1, 0, 0.25)
  if (isCirclePathClear(0, 0, 2, 0, patrol.patrolBodyRadius) || updatePatrol(patrol, 0.5, 1) || patrol.patrolWait <= 0) throw new Error('Patrols must reject and abandon routes blocked by world colliders')
  blocker.remove()
  patrol.group.position.set(1, 0, 0)
  patrol.patrolTarget.set(1, 0)
  patrol.patrolWait = 0
  if (updatePatrol(patrol, 0.016, 1) || patrol.patrolWait <= 0) throw new Error('Patrolling enemies must pause after reaching a patrol point')
  spawnSlime(scene, 20, 0)
  if (enemies.at(-1).patrolRadius < 6) throw new Error('Slimes need a visibly wide patrol area')
  if (defeatTypeFor(enemies.at(-1)) !== 'roamingSlime') throw new Error('Only marked well slimes may receive first-quest kill credit')
  const timedSpawn = enemies.pop().spawn
  timedSpawn.alive = false
  timedSpawn.respawnAt = elapsed + RESPAWN_DELAY
  const distantPlayer = { group: { position: new THREE.Vector3() } }
  updateEnemies(scene, distantPlayer, RESPAWN_DELAY - 0.01, true)
  if (enemies.length) throw new Error('Roaming enemies must stay defeated for two minutes')
  updateEnemies(scene, distantPlayer, 0.01, true)
  if (enemies.length !== 1 || enemies[0].spawn !== timedSpawn) throw new Error('Roaming enemies must respawn after two minutes')
  const wellSpawn = { respawn: false, alive: false, respawnAt: elapsed, create() { throw new Error('Well slimes must never respawn') } }
  spawnPoints.push(wellSpawn)
  respawnExpiredEnemies()
  spawnPoints.pop()
  if (wellSpawn.alive) throw new Error('Well slimes must stay permanently defeated')
  const firstId = enemies[0].id
  respawnEnemies(shrine)
  if (enemies.length !== 1 || enemies[0].id === firstId) throw new Error('Shrine rest must rebuild roaming enemies at full state')
  const thornScene = new THREE.Scene()
  spawnThornback(thornScene, 0, 0)
  const thornback = enemies.at(-1)
  if (thornback.legs.length !== 4 || thornback.legs.some((leg) => !leg.lower || !leg.pastern)) throw new Error('Thornback must have four three-part canine legs')
  thornback.cooldown = 0
  updateThornback(thornback, { group: { position: new THREE.Vector3(4, 0, 0) } }, 0.016)
  const frontLeg = thornback.legs.find((leg) => leg.front)
  const rearLeg = thornback.legs.find((leg) => !leg.front)
  if (frontLeg.lower.rotation.x >= 0 || rearLeg.lower.rotation.x <= 0 || rearLeg.pastern.rotation.x >= 0) throw new Error('Thornback joints must preserve canine front and rear bend directions')
  if (thornback.state !== 'windup' || Math.abs(thornback.group.rotation.y - Math.PI / 2) > 0.001) throw new Error('Thornback must face its locked charge direction during wind-up')
  const sentinelScene = new THREE.Scene()
  spawnDrownedSentinel(sentinelScene, 0, 0)
  const sentinel = enemies.at(-1)
  if (sentinel.arms.length !== 2 || sentinel.legs.length !== 2 || sentinel.wisps.length !== 5 || sentinel.slamRing.children.length !== 14 || sentinel.groundCracks.geometry.attributes.position.count !== 72) throw new Error('Drowned Sentinel must retain its articulated model and layered effects')
  elapsed = 0.25
  sentinel.cooldown = 10
  updateSentinel(sentinel, { group: { position: new THREE.Vector3(6, 0, 0) } }, 0.016)
  if (Math.abs(sentinel.legs[0].hip.rotation.x) < 0.2 || Math.abs(sentinel.arms[0].arm.rotation.x) < 0.2) throw new Error('Drowned Sentinel must walk with visible leg motion and opposing arm swing')
  sentinel.cooldown = 0
  const nearbyPlayer = { group: { position: new THREE.Vector3(3, 0, 0) } }
  updateSentinel(sentinel, nearbyPlayer, 0.016)
  sentinel.stateTime = 0.44
  updateSentinel(sentinel, nearbyPlayer, 0.01)
  if (sentinel.state !== 'windup' || !sentinel.slamRing.visible || Math.abs(sentinel.arms[0].arm.rotation.z) < 1) throw new Error('Drowned Sentinel must raise its arms inside a visible layered slam telegraph')
  sentinel.stateTime = SENTINEL_WINDUP - 0.01
  updateSentinel(sentinel, nearbyPlayer, 0.02)
  if (sentinel.state !== 'leap') throw new Error('Runic Slam must launch after its ground telegraph')
  sentinel.stateTime = SENTINEL_LEAP * 0.5
  updateSentinel(sentinel, nearbyPlayer, 0.01)
  const shadowGround = groundHeight(sentinel.group.position.x, sentinel.group.position.z) + 0.04
  if (sentinel.group.position.y < 3 || sentinel.group.position.x < 0.5 || sentinel.legs[0].knee.rotation.x < 0.8 || Math.abs(sentinel.group.position.y + sentinel.jumpShadow.position.y - shadowGround) > 0.01 || sentinel.slamRing.position.y !== 0.3) throw new Error('Runic Slam must arc toward its target while its shadow stays grounded and its rune ring follows')
  sentinel.stateTime = SENTINEL_LEAP - 0.01
  updateSentinel(sentinel, nearbyPlayer, 0.02)
  const apex = sentinel.group.position.y
  const apexX = sentinel.group.position.x
  sentinel.stateTime = SENTINEL_DROP * 0.5
  updateSentinel(sentinel, nearbyPlayer, 0.01)
  if (sentinel.state !== 'slam' || sentinel.group.position.y >= apex || sentinel.group.position.x <= apexX) throw new Error('Runic Slam must continue forward while accelerating back toward the ground')
  sentinel.stateTime = SENTINEL_DROP - 0.01
  const safePlayer = { group: { position: new THREE.Vector3(10, 0, 0) }, invulnerable: true, shake: 0 }
  updateSentinel(sentinel, safePlayer, 0.02)
  if (sentinel.state !== 'recover' || Math.abs(sentinel.group.position.x - 3) > 0.01 || !sentinel.impactBurst.visible || !sentinel.groundCracks.visible || safePlayer.shake < 0.5) throw new Error('Runic Slam must land on its locked target with a heavy cracking area-impact reaction')
  const bossScene = new THREE.Scene()
  spawnAshKnight(bossScene, 8, -87)
  const boss = enemies.at(-1)
  if (boss.arms.length !== 2 || boss.legs.length !== 2 || boss.slamRing.children.length !== 14 || boss.groundCracks.geometry.attributes.position.count !== 112) throw new Error('Ash Knight must use the articulated heavy Sentinel silhouette and layered impact effects')
  questState.q4 = 1
  boss.state = 'recover'
  boss.stateTime = 1.2
  updateBoss(boss, { group: { position: new THREE.Vector3(15, 0, -87) } }, 0.04)
  if (boss.state !== 'recover') throw new Error('Ash Knight recovery must remain punishable for 1.25 seconds')
  updateBoss(boss, { group: { position: new THREE.Vector3(15, 0, -87) } }, 0.02)
  if (boss.state !== 'idle') throw new Error('Ash Knight must resume attacking after its recovery window')
  boss.hp = boss.maxHp / 2
  updateBoss(boss, { group: { position: new THREE.Vector3(11, 0, -87) } }, 0.01)
  if (!boss.phaseTwo || boss.state !== 'phaseShift') throw new Error('Broken Oath must begin at half health')
  boss.state = 'slash'
  boss.stateTime = 0.33
  updateBoss(boss, { group: { position: new THREE.Vector3(15, 0, -87) }, state: 'move' }, 0.02)
  if (boss.state !== 'slashEcho') throw new Error('Broken Oath must add a delayed echo to Oathbreaker Cleave')
  boss.phaseTwo = false
  boss.hp = boss.maxHp
  boss.group.position.set(13.4, groundHeight(13.4, -87), -87)
  boss.state = 'charge'
  boss.stateTime = 0
  boss.chargeDir.set(1, 0, 0)
  const chargeTarget = { group: { position: new THREE.Vector3(8, 0, -87) }, state: 'move', shake: 0 }
  updateBoss(boss, chargeTarget, 0.1)
  if (boss.state !== 'stagger') throw new Error('A missed Furnace Rush must stagger the Ash Knight against the arena edge')
  boss.group.position.set(8, groundHeight(8, -87), -87)
  boss.state = 'slamDrop'
  boss.stateTime = BOSS_SLAM_DROP - 0.01
  boss.slamStart.copy(boss.group.position)
  boss.slamTarget.set(10, groundHeight(10, -87), -87)
  stats.hp = stats.hpMax
  const jumpingPlayer = { group: { position: boss.slamTarget.clone() }, state: 'highJump', shake: 0 }
  updateBoss(boss, jumpingPlayer, 0.02)
  if (boss.state !== 'recover' || stats.hp !== stats.hpMax || !boss.groundCracks.visible) throw new Error('Cinderfall must crack the ground while High Jump clears its area damage')
  console.log('Enemy check passed: patrols, respawns, articulated enemies, Runic Slam, and the upgraded Ash Knight moveset.')
}
