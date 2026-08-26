import * as THREE from 'three'
import { keys, pressed } from './input.js'
import { toonRim as toon } from './materials.js'
import { resolveCircle } from './collision.js'
import { walkableHeight, applySlopeBlock, settleBridgeLanding } from './ground.js'
import { LEVEL_XP, levelForXP } from './progression.js'
import { triggerHeroDamageFx } from './debugfx.js'

export const stats = {
  hpMax: 100,
  hp: 100,
  stamMax: 100,
  stam: 100,
  damage: 20,
  speed: 8,
  flasks: 3,
  flaskMax: 3,
  level: 1,
  xp: 0,
  abilities: { highJump: false, charge: false },
}

const STAM_REGEN = 40
const STAM_DELAY = 0.5
const HIGH_JUMP = { cost: 35, time: 0.58, speed: 12.5 }
const ATTACK = { time: 0.42, activeFrom: 0.12, activeTo: 0.27, range: 2.3, arc: Math.PI / 1.6 } // active window = strike phase of the anim
const CHARGE = { hold: 0.5, cost: 50, time: 0.5, activeFrom: 0.08, activeTo: 0.4, range: 2.6, mult: 2.5 }
const HURT_INVULN = 0.8
const WORLD_BOUND = 103

// resting carry: blade angled up, drifting partway across the torso
const SWORD_REST = new THREE.Euler(-0.35, 0.42, 0)
const SWORD_REST_Q = new THREE.Quaternion().setFromEuler(SWORD_REST)

// isometric camera at (+14,+18,+14): screen-up and screen-right in world space
const FWD = new THREE.Vector3(-1, 0, -1).normalize()
const RIGHT = new THREE.Vector3(1, 0, -1).normalize()

// palette: red panda fur + ember knight gear
const RUST = 0xc25c2e
const CREAM = 0xe8d8c0
const DARKFUR = 0x3a2820
const PAW = 0x241812 // near-black paws, darker than the limbs so they read
const TUNIC = 0x7a8a4a // moss-green tunic so the rust fur pops
const STEEL_DARK = 0x6b7689
const CAPE = 0x8a2f2a
const LEATHER = 0x4a3320
const SKIN_DARK = 0x14141f

function part(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, toon(color))
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

export function createPlayer(scene) {
  const group = new THREE.Group()
  const rig = new THREE.Group() // tumbles during High Jump
  group.add(rig)

  // chibi proportions: helmet is ~40% of the silhouette
  // tunic torso, flared, with belt
  const body = part(new THREE.CylinderGeometry(0.3, 0.48, 0.68, 10), TUNIC, 0, 0.58)
  rig.add(body)
  rig.add(part(new THREE.CylinderGeometry(0.44, 0.47, 0.09, 10), LEATHER, 0, 0.42)) // belt
  rig.add(part(new THREE.BoxGeometry(0.11, 0.11, 0.03), 0xddaa44, 0, 0.42, 0.45)) // buckle

  // red panda head, grouped so it can turn ahead of the body
  const head = new THREE.Group()
  head.add(part(new THREE.SphereGeometry(0.44, 14, 12), RUST, 0, 1.3))
  head.add(part(new THREE.SphereGeometry(0.2, 10, 8), CREAM, 0, 1.2, 0.32)) // muzzle
  head.add(part(new THREE.SphereGeometry(0.06, 8, 6), SKIN_DARK, 0, 1.24, 0.5)) // nose
  const eyes = []
  for (const x of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), new THREE.MeshBasicMaterial({ color: 0x1a1010 }))
    eye.position.set(x, 1.38, 0.37)
    head.add(eye)
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    glint.position.set(x + 0.02, 1.41, 0.41)
    head.add(glint)
    eyes.push({ eye, glint })
    head.add(part(new THREE.SphereGeometry(0.05, 6, 6), CREAM, x, 1.5, 0.33)) // brow dot
    head.add(part(new THREE.SphereGeometry(0.11, 8, 6), CREAM, x * 2.2, 1.22, 0.22)) // cheek fluff
  }
  for (const x of [-0.3, 0.3]) {
    const ear = part(new THREE.ConeGeometry(0.15, 0.26, 6), RUST, x, 1.72, -0.02)
    ear.rotation.z = -x * 0.6
    head.add(ear)
    const inner = part(new THREE.ConeGeometry(0.08, 0.16, 6), CREAM, x * 1.02, 1.72, 0.04)
    inner.rotation.z = -x * 0.6
    head.add(inner)
  }
  rig.add(head)

  // ringed tail: a chain of joints so the curl shape can change, not just sway
  const tail = new THREE.Group()
  tail.position.set(0, 0.5, -0.4)
  const tailSegs = []
  let tailParent = tail
  for (let i = 0; i < 5; i++) {
    const joint = new THREE.Group()
    joint.position.z = i === 0 ? 0 : -0.21
    joint.add(part(new THREE.SphereGeometry(0.14 + i * 0.02, 8, 8), i % 2 ? CREAM : RUST))
    tailParent.add(joint)
    tailParent = joint
    tailSegs.push(joint)
  }
  rig.add(tail)

  // sword arm (right shoulder pivot)
  const swordArm = new THREE.Group()
  swordArm.rotation.order = 'YXZ' // Y sweep stays horizontal even with the arm raised (X)
  swordArm.position.set(-0.44, 0.92, 0) // character's right side (facing +z)
  swordArm.add(part(new THREE.CapsuleGeometry(0.11, 0.14, 4, 10), DARKFUR, 0, -0.13)) // upper arm
  // elbow hinge: cocks in the wind-up, whips straight through the strike
  const elbow = new THREE.Group()
  elbow.position.set(0, -0.28, 0)
  elbow.rotation.x = -0.5 // natural resting bend
  elbow.add(part(new THREE.CapsuleGeometry(0.1, 0.14, 4, 10), DARKFUR, 0, -0.12)) // forearm
  swordArm.add(elbow)
  // sword pivots at the hand (wrist) so the blade can align with the arm mid-swing
  const sword = new THREE.Group()
  sword.position.set(0, -0.28, 0)
  // dao: gently curved single-edged blade that flares toward the tip
  const BLADE = 0xdde2ee
  let zc = 0.14
  let yc = 0
  let ang = 0
  for (const [len, h, dAng] of [
    [0.26, 0.1, 0.05],
    [0.26, 0.11, 0.08],
    [0.26, 0.13, 0.1],
    [0.2, 0.15, 0.12],
  ]) {
    ang += dAng
    const seg = part(
      new THREE.BoxGeometry(0.05, h, len),
      BLADE,
      0,
      yc + Math.sin(ang) * len * 0.5,
      zc + Math.cos(ang) * len * 0.5
    )
    seg.rotation.x = -ang // spine curves gently upward
    sword.add(seg)
    zc += Math.cos(ang) * len
    yc += Math.sin(ang) * len
  }
  const tip = part(new THREE.ConeGeometry(0.075, 0.16, 6), BLADE, 0, yc + Math.sin(ang) * 0.07, zc + Math.cos(ang) * 0.07)
  tip.scale.x = 0.4 // flattened, angled dao point
  tip.rotation.x = Math.PI / 2 - ang
  sword.add(tip)
  const guard = part(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 12), 0x8a6a2a, 0, 0, 0.1) // disc guard
  guard.rotation.x = Math.PI / 2
  sword.add(guard)
  const grip = part(new THREE.CylinderGeometry(0.045, 0.05, 0.2, 8), 0x5a2320, 0, 0, -0.02) // cord-wrapped hilt
  grip.rotation.x = Math.PI / 2
  sword.add(grip)
  // paw gripping the hilt — parented to the sword so it follows the wrist
  const swordPaw = part(new THREE.SphereGeometry(0.1, 8, 8), PAW, 0, 0, 0.02)
  swordPaw.scale.set(1, 0.9, 1.25)
  sword.add(swordPaw)
  for (const fx of [-0.05, 0, 0.05]) sword.add(part(new THREE.SphereGeometry(0.035, 6, 6), CREAM, fx, 0.05, 0.09)) // knuckle tufts
  const ring = part(new THREE.TorusGeometry(0.05, 0.018, 6, 12), 0xddaa44, 0, 0, -0.15) // ring pommel
  ring.rotation.y = Math.PI / 2
  sword.add(ring)
  // dangling tassel: pivoted at the ring pommel, swings with the hero's motion
  const tassel = new THREE.Group()
  tassel.position.set(0, 0, -0.15)
  tassel.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 5), 0x8a1f1f, 0, -0.04, 0)) // cord
  tassel.add(part(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 6), 0xddaa44, 0, -0.09, 0)) // gold collar
  const tuft = part(new THREE.ConeGeometry(0.055, 0.2, 7), 0xc03030, 0, -0.2, 0)
  tassel.add(tuft)
  sword.add(tassel)
  // charge glow: hidden until a charged slash is winding up
  const chargeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffcc66 }))
  chargeGlow.position.set(0, 0, 0.6)
  chargeGlow.visible = false
  sword.add(chargeGlow)
  sword.rotation.copy(SWORD_REST)
  elbow.add(sword)
  swordArm.rotation.x = -0.15
  rig.add(swordArm)

  // shield arm (left) — round shield with ember emblem
  const shieldArm = new THREE.Group()
  shieldArm.position.set(0.44, 0.92, 0) // character's left side
  shieldArm.add(part(new THREE.CapsuleGeometry(0.11, 0.14, 4, 10), DARKFUR, 0, -0.13)) // upper arm
  const shieldElbow = new THREE.Group()
  shieldElbow.position.set(0, -0.28, 0)
  shieldElbow.rotation.x = -0.55 // fixed bend, holds the shield forward
  shieldElbow.add(part(new THREE.CapsuleGeometry(0.1, 0.14, 4, 10), DARKFUR, 0, -0.12)) // forearm
  const offPaw = part(new THREE.SphereGeometry(0.11, 8, 8), PAW, 0, -0.28, 0)
  offPaw.scale.set(1, 1.15, 1.2)
  shieldElbow.add(offPaw)
  for (const fx of [-0.05, 0, 0.05]) shieldElbow.add(part(new THREE.SphereGeometry(0.035, 6, 6), CREAM, fx, -0.36, 0.06)) // knuckle tufts
  shieldArm.add(shieldElbow)
  shieldArm.rotation.x = -0.15
  rig.add(shieldArm)

  // feet
  const feet = []
  for (const x of [-0.16, 0.16]) {
    const foot = part(new THREE.SphereGeometry(0.13, 8, 8), DARKFUR, x, 0.13)
    rig.add(foot)
    feet.push(foot)
  }

  scene.add(group)

  // swing trail: translucent ribbon following the blade during the strike
  const trail = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0xffd9a0,
      vertexColors: true, // per-vertex fade: additive blending makes black invisible
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  trail.frustumCulled = false
  scene.add(trail)

  return {
    trail,
    trailPts: [],
    group,
    rig,
    head,
    yaw: 0,
    targetYaw: 0,
    glanceYaw: 0,
    glanceTarget: 0,
    glanceTimer: 2,
    eyes,
    blinkTimer: 3,
    blinkAnim: -1, // -1 = eyes open, otherwise seconds into the blink
    tailBounce: 0,
    swordArm,
    shieldArm,
    elbow,
    sword,
    tassel,
    tasselDir: new THREE.Vector3(0, -1, 0),
    prevPommel: new THREE.Vector3(),
    chargeGlow,
    attackMult: 1,
    body,
    tail,
    tailSegs,
    feet,
    idleTime: 0,
    state: 'move', // move | highJump | attack
    stateTime: 0,
    actionDir: new THREE.Vector3(),
    facing: new THREE.Vector3(0, 0, 1),
    invulnerable: false,
    hurtTimer: 0,
    stamUsedAt: 0,
    walkPhase: 0,
    attackActive: false,
    hitThisSwing: new Set(),
    comboIndex: 0, // 0 = horizontal slash, 1 = overhead chop (Tunic-style alternation)
    lastAttackAt: -10,
    hitstop: 0,
    shake: 0,
    spawnPoint: new THREE.Vector3(0, 0, 0),
  }
}

function wrapAngle(a) {
  return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
}

function spendStamina(p, cost) {
  if (stats.stam < cost) return false
  stats.stam -= cost
  p.stamUsedAt = 0
  return true
}

export function gainXP(amount) {
  stats.xp = Math.min(stats.xp + amount, LEVEL_XP[2])
  stats.level = levelForXP(stats.xp)
  stats.abilities.charge = stats.level >= 3
}

export function hurtPlayer(p, amount, fromPosition) {
  if (p.invulnerable || p.hurtTimer > 0) return
  stats.hp -= amount
  p.hurtTimer = HURT_INVULN
  if (stats.hp <= 0) {
    // ponytail: instant respawn at spawn point; shrine system replaces this
    stats.hp = stats.hpMax
    stats.stam = stats.stamMax
    stats.flasks = stats.flaskMax
    p.group.position.copy(p.spawnPoint)
  } else triggerHeroDamageFx(fromPosition)
}

// arc test used by enemies when the swing is active; charged spin hits all around
export function inAttackArc(p, targetPos) {
  const to = targetPos.clone().sub(p.group.position)
  to.y = 0
  if (p.state === 'chargeAttack') return to.length() <= CHARGE.range
  if (to.length() > ATTACK.range) return false
  return to.normalize().angleTo(p.facing) < ATTACK.arc / 2
}

export function updatePlayer(p, dt) {
  const wasHighJumping = p.state === 'highJump'
  const prevX = p.group.position.x
  const prevZ = p.group.position.z
  p.stateTime += dt
  p.stamUsedAt += dt
  p.idleTime += dt
  p.hurtTimer = Math.max(0, p.hurtTimer - dt)

  // idle breathe
  p.body.scale.y = 1 + Math.sin(p.idleTime * 2.5) * 0.02

  // blinking: quick close-open every few seconds, sometimes a double blink
  p.blinkTimer -= dt
  if (p.blinkTimer <= 0 && p.blinkAnim < 0) p.blinkAnim = 0
  if (p.blinkAnim >= 0) {
    p.blinkAnim += dt
    const k = 1 - Math.sin(Math.min(p.blinkAnim / 0.13, 1) * Math.PI) * 0.95
    for (const { eye, glint } of p.eyes) {
      eye.scale.y = k
      glint.visible = k > 0.5
    }
    if (p.blinkAnim >= 0.13) {
      p.blinkAnim = -1
      p.blinkTimer = Math.random() < 0.2 ? 0.2 : 2 + Math.random() * 4 // occasional double blink
    }
  }

  // tail: curl shape drifts slowly through different poses — no twitching
  const tw = p.idleTime
  const movingNow = p.state === 'move' && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD)
  p.tailBounce += ((movingNow ? 1 : 0) - p.tailBounce) * Math.min(1, dt * 5)
  // always curls upward — drift only varies how tightly, never the direction
  // tail wraps in tight during a High Jump
  const jumpCurl = p.state === 'highJump' ? Math.sin(Math.min(p.stateTime / HIGH_JUMP.time, 1) * Math.PI) * 0.9 : 0
  const curl = jumpCurl + Math.max(0.08, 0.32 + Math.sin(tw * 0.23) * 0.16 + Math.sin(tw * 0.11 + 2.1) * 0.1)
  const side = Math.sin(tw * 0.17) * 0.2 + Math.sin(tw * 0.07 + 1.2) * 0.12 // which way it leans
  for (let i = 0; i < p.tailSegs.length; i++) {
    const j = p.tailSegs[i]
    // tip curls more than the base, like a real red panda tail; while walking a
    // footfall-synced wave travels down the segments so the tail bounces with lag
    j.rotation.x =
      curl * (0.55 + i * 0.28) +
      p.tailBounce * Math.sin(p.walkPhase * 2 - i * 0.7) * 0.05 * (0.6 + i * 0.35)
    j.rotation.y = side * (0.25 + i * 0.12)
  }
  p.tail.rotation.y = p.state === 'move' ? Math.sin(p.walkPhase) * 0.12 : 0
  p.tail.rotation.x = 0.1

  if (p.stamUsedAt >= STAM_DELAY) {
    stats.stam = Math.min(stats.stam + STAM_REGEN * dt, stats.stamMax)
  }

  if (pressed('KeyQ') && stats.flasks > 0 && stats.hp < stats.hpMax) {
    stats.flasks--
    stats.hp = Math.min(stats.hp + 50, stats.hpMax)
  }

  const move = new THREE.Vector3()
    .addScaledVector(FWD, (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0))
    .addScaledVector(RIGHT, (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0))
  if (move.lengthSq() > 0) move.normalize()

  if (p.state === 'move') {
    if (move.lengthSq() > 0) {
      p.group.position.addScaledVector(move, stats.speed * dt)
      p.targetYaw = Math.atan2(move.x, move.z)
      p.walkPhase += stats.speed * dt * 1.6
      const s = Math.sin(p.walkPhase)
      p.feet[0].position.z = s * 0.22
      p.feet[1].position.z = -s * 0.22
      p.feet[0].position.y = 0.13 + Math.max(0, s) * 0.1
      p.feet[1].position.y = 0.13 + Math.max(0, -s) * 0.1
      // arms counter-swing the legs; sword arm swings less under the blade's weight
      p.swordArm.rotation.x = -0.15 - s * 0.22
      p.shieldArm.rotation.x = -0.15 + s * 0.35
      // bounce once per footfall, slight forward lean
      p.rig.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.09
      p.rig.rotation.x = 0.07
      p.rig.rotation.z *= Math.max(0, 1 - dt * 8) // idle sway fades out
    } else {
      p.feet[0].position.set(-0.16, 0.13, 0)
      p.feet[1].position.set(0.16, 0.13, 0)
      p.swordArm.rotation.x += (-0.15 - p.swordArm.rotation.x) * Math.min(1, dt * 6)
      p.shieldArm.rotation.x += (-0.15 - p.shieldArm.rotation.x) * Math.min(1, dt * 6)
      p.rig.position.y *= Math.max(0, 1 - dt * 12)
      p.rig.rotation.x *= Math.max(0, 1 - dt * 12)

      // idle life: slow weight sway, and every few seconds a glance around
      p.rig.rotation.z = Math.sin(p.idleTime * 0.8) * 0.022
      p.glanceTimer -= dt
      if (p.glanceTimer <= 0) {
        p.glanceTarget = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.1
        p.glanceTimer = 1.5 + Math.random() * 3
      }
    }

    if (pressed('Mouse0')) {
      p.state = 'attack'
      p.stateTime = 0
      p.hitThisSwing.clear()
      // quick follow-up alternates slash/chop; pausing resets to slash
      p.comboIndex = p.idleTime - p.lastAttackAt < 0.9 ? (p.comboIndex + 1) % 2 : 0
      p.lastAttackAt = p.idleTime
    } else if (pressed('Space') && stats.abilities.highJump && spendStamina(p, HIGH_JUMP.cost)) {
      p.state = 'highJump'
      p.stateTime = 0
      p.actionDir.copy(move.lengthSq() > 0 ? move : p.facing)
      p.targetYaw = Math.atan2(p.actionDir.x, p.actionDir.z) // body aligns into the jump
      p.invulnerable = true
    }
  } else if (p.state === 'attack') {
    const t = p.stateTime / ATTACK.time
    // anticipation -> explosive strike -> recovery; combo alternates slash and chop
    const WINDUP = 0.28
    const STRIKE = 0.65
    if (p.comboIndex === 0) {
      // horizontal slash, torso twisting with the arm; wrist turns so the blade
      // extends the arm line instead of sticking up from the fist
      p.swordArm.rotation.x = -1.35 // arm raised horizontal (windup eases into this below)
      let alignBlend = 0 // 1 = guard pose, 0 = fully flattened for the cut
      if (t < WINDUP) {
        const k = t / WINDUP
        const e = k * k * (3 - 2 * k) // smoothstep pull-back
        p.swordArm.rotation.x = -0.15 - e * 1.2 // arm flows up from rest, no snap
        alignBlend = 1 - e // blade rolls flat gradually through the windup
        p.swordArm.rotation.y = e * -1.3
        p.elbow.rotation.x = -0.5 - e * 0.6 // cock the elbow
        p.feet[1].position.z = e * 0.18 // leading foot steps into the swing
        p.rig.rotation.y = e * 0.35
      } else if (t < STRIKE) {
        const k = (t - WINDUP) / (STRIKE - WINDUP)
        const e = 1 - (1 - k) ** 3 // whips out fast, decelerates at the end of the arc
        // arm stops before crossing the chest; the torso twist and lean carry the arc through
        p.swordArm.rotation.y = -1.3 + e * 2.6
        p.elbow.rotation.x = -1.1 + e * 0.95 // whip the elbow straight through the cut
        p.rig.rotation.y = 0.4 - e * 0.95
        p.rig.rotation.z = e * -0.15 // lean into the swing
        p.rig.position.y = -Math.sin(k * Math.PI) * 0.06 // sink into the cut
        p.swordArm.rotation.x = -1.35 - Math.sin(k * Math.PI) * 0.2 // blade dips through the middle
      } else {
        const k = (t - STRIKE) / (1 - STRIKE)
        const e = k * k * (3 - 2 * k)
        p.swordArm.rotation.y = 1.3 - e * 1.3
        p.swordArm.rotation.x = -1.35 + e * 1.2 // arm settles back down
        p.elbow.rotation.x = -0.15 - e * 0.35 // relax back to resting bend
        p.rig.rotation.y = -0.55 + e * 0.55
        p.rig.rotation.z = -0.15 * (1 - e)
        alignBlend = e // and the blade rolls back to guard
      }
      // world-space override: blade eases flat through the windup, locks flat
      // for the cut, and eases home in recovery — no orientation snaps
      alignBladeHorizontal(p, alignBlend)
    } else {
      // diagonal chop: cocked high over the right shoulder, cutting down and
      // across the torso to the low left — torso pitches AND twists with it
      if (t < WINDUP) {
        const k = t / WINDUP
        const e = k * k * (3 - 2 * k)
        p.sword.rotation.set(SWORD_REST.x * (1 - e), SWORD_REST.y * (1 - e), 0) // blade uncrosses as it rises
        p.swordArm.rotation.x = -0.15 - e * 2.65 // raise sword high
        p.swordArm.rotation.y = e * -0.55 // ...out over the right shoulder
        p.elbow.rotation.x = -0.5 - e * 0.8 // cock behind the head
        p.feet[1].position.z = e * 0.18 // leading foot steps into the blow
        p.rig.rotation.x = -e * 0.12 // slight lean back
        p.rig.rotation.y = e * 0.22 // shoulders wind to the right
      } else if (t < STRIKE) {
        const k = (t - WINDUP) / (STRIKE - WINDUP)
        const e = 1 - (1 - k) ** 3
        p.sword.rotation.set(0, 0, 0) // blade straight for the descending blow
        p.swordArm.rotation.x = -2.8 + e * 2.95 // hammer down past horizontal — tip finishes at ground level
        p.swordArm.rotation.y = -0.55 + e * 1.15 // ...while crossing to the low left
        p.elbow.rotation.x = -1.3 + e * 1.25 // arm nearly straight at the bottom for full reach
        p.rig.rotation.x = -0.12 + e * 0.32 // pitch forward into it
        p.rig.rotation.y = 0.22 - e * 0.5 // hips drive the diagonal
        p.rig.position.y = -e * 0.12 // sink into the finish, cut rides low
      } else {
        const k = (t - STRIKE) / (1 - STRIKE)
        const e = k * k * (3 - 2 * k)
        p.sword.rotation.set(SWORD_REST.x * e, SWORD_REST.y * e, 0) // settle back across the chest
        p.swordArm.rotation.x = 0.15 - e * 0.3
        p.swordArm.rotation.y = 0.6 - e * 0.6
        p.elbow.rotation.x = -0.05 - e * 0.45
        p.rig.rotation.x = 0.2 - e * 0.2
        p.rig.rotation.y = -0.28 + e * 0.28
        p.rig.position.y = -0.12 * (1 - e)
      }
    }
    p.attackActive = p.stateTime >= ATTACK.activeFrom && p.stateTime <= ATTACK.activeTo
    // short lunge during the strike only — repeated swings shouldn't walk across the map
    if (t >= WINDUP && t < STRIKE) {
      const k = (t - WINDUP) / (STRIKE - WINDUP)
      p.group.position.addScaledVector(p.facing, 2.2 * (1 - k) * dt)
    }
    if (p.stateTime >= ATTACK.time) {
      p.attackActive = false
      p.swordArm.rotation.set(-0.15, 0, 0)
      p.elbow.rotation.x = -0.5
      p.sword.rotation.copy(SWORD_REST)
      p.rig.rotation.set(0, 0, 0)
      p.rig.position.y = 0
      p.feet[1].position.z = 0
      // still holding attack -> wind up a charged slash
      if (keys.Mouse0 && stats.abilities.charge && stats.stam >= CHARGE.cost) {
        p.state = 'charging'
        p.stateTime = 0
      } else {
        p.state = 'move'
      }
    }
  } else if (p.state === 'charging') {
    // slow walk while the blade gathers heat
    if (move.lengthSq() > 0) {
      p.group.position.addScaledVector(move, stats.speed * 0.4 * dt)
      p.targetYaw = Math.atan2(move.x, move.z)
    }
    p.swordArm.rotation.x = -2.0
    p.elbow.rotation.x = -0.9
    const ready = p.stateTime >= CHARGE.hold
    p.chargeGlow.visible = true
    p.chargeGlow.scale.setScalar(ready ? 1.6 + Math.sin(p.stateTime * 20) * 0.2 : 0.6 + p.stateTime * 1.6)
    if (!keys.Mouse0) {
      p.chargeGlow.visible = false
      if (ready && spendStamina(p, CHARGE.cost)) {
        p.state = 'chargeAttack'
        p.stateTime = 0
        p.hitThisSwing.clear()
        p.attackMult = CHARGE.mult
      } else {
        p.state = 'move'
        p.swordArm.rotation.set(-0.15, 0, 0)
        p.elbow.rotation.x = -0.5
      }
    }
  } else if (p.state === 'chargeAttack') {
    // full spinning cut, hits everything around
    const t = p.stateTime / CHARGE.time
    p.rig.rotation.y = (1 - (1 - t) ** 2) * Math.PI * 2
    p.swordArm.rotation.x = -1.35
    p.swordArm.rotation.y = 0
    p.elbow.rotation.x = -0.2
    alignBladeHorizontal(p, t > 0.8 ? (t - 0.8) / 0.2 : 0)
    p.attackActive = p.stateTime >= CHARGE.activeFrom && p.stateTime <= CHARGE.activeTo
    if (p.stateTime >= CHARGE.time) {
      p.state = 'move'
      p.attackActive = false
      p.attackMult = 1
      p.swordArm.rotation.set(-0.15, 0, 0)
      p.elbow.rotation.x = -0.5
      p.sword.rotation.copy(SWORD_REST)
      p.rig.rotation.set(0, 0, 0)
    }
  } else if (p.state === 'highJump') {
    p.group.position.addScaledVector(p.actionDir, HIGH_JUMP.speed * dt)
    const t = Math.min(p.stateTime / HIGH_JUMP.time, 1)
    const launch = THREE.MathUtils.smoothstep(t, 0, 0.22)
    const spin = THREE.MathUtils.smoothstep(t, 0.18, 0.92)
    const theta = launch * 0.72 + spin * (Math.PI * 2 - 0.72)
    const c = 0.58 // rotate around the tucked center while the whole body follows an arc
    p.rig.rotation.x = theta
    p.rig.position.y = Math.sin(t * Math.PI) * 0.85 + c * (1 - Math.cos(theta))
    p.rig.position.z = -c * Math.sin(theta)
    // dive long first, tuck in flight, then open and compress into the landing
    const tuck = THREE.MathUtils.smoothstep(t, 0.18, 0.42) * (1 - THREE.MathUtils.smoothstep(t, 0.72, 0.96))
    const landing = t > 0.86 ? Math.sin(((t - 0.86) / 0.14) * Math.PI) : 0
    p.rig.scale.set(1, 1 - tuck * 0.28 - landing * 0.18, 1 - tuck * 0.16)
    p.swordArm.rotation.x = -0.15 - tuck * 1.8
    p.shieldArm.rotation.x = -0.15 - tuck * 1.8
    p.head.rotation.x = tuck * 0.65
    if (p.stateTime >= HIGH_JUMP.time) {
      settleBridgeLanding(p.group.position, p.actionDir)
      p.state = 'move'
      p.rig.rotation.x = 0
      p.rig.position.set(0, 0, 0)
      p.rig.scale.set(1, 1, 1)
      p.swordArm.rotation.x = -0.15
      p.shieldArm.rotation.x = -0.15
      p.head.rotation.x = 0
      p.invulnerable = false
    }
  }

  // smooth 8-way turning: head swivels toward the new heading first, body follows
  const diff = wrapAngle(p.targetYaw - p.yaw)
  p.yaw += diff * Math.min(1, dt * 9)
  p.group.rotation.y = p.yaw
  p.facing.set(Math.sin(p.yaw), 0, Math.cos(p.yaw))
  const lead = THREE.MathUtils.clamp(wrapAngle(p.targetYaw - p.yaw), -0.7, 0.7)
  // glances only while standing still; snap back to forward once moving or acting
  const idle = p.state === 'move' && move.lengthSq() === 0
  p.glanceYaw += ((idle ? p.glanceTarget : 0) - p.glanceYaw) * Math.min(1, dt * 2.5)
  p.head.rotation.y += (lead + p.glanceYaw - p.head.rotation.y) * Math.min(1, dt * 14)
  p.head.rotation.z = p.glanceYaw * -0.1 // slight curious tilt with the glance

  resolveCircle(p.group.position, 0.45)
  const crossingBridge = wasHighJumping && Math.abs(p.actionDir.x) > 0.6
  applySlopeBlock(prevX, prevZ, p.group.position, crossingBridge)
  p.group.position.x = THREE.MathUtils.clamp(p.group.position.x, -WORLD_BOUND, WORLD_BOUND)
  p.group.position.z = THREE.MathUtils.clamp(p.group.position.z, -WORLD_BOUND, WORLD_BOUND)
  p.group.position.y = walkableHeight(p.group.position.x, p.group.position.z, crossingBridge)

  updateTrail(p, dt)
  updateTassel(p, dt)
}

// the tassel hangs toward gravity but gets thrown around by the hand's motion
const _pommel = new THREE.Vector3()
const _tasselVel = new THREE.Vector3()
const _tasselTarget = new THREE.Vector3()
const _tasselQ = new THREE.Quaternion()
const _tasselParentQ = new THREE.Quaternion()
const _DOWN = new THREE.Vector3(0, -1, 0)

function updateTassel(p, dt) {
  if (dt <= 0) return
  p.sword.updateWorldMatrix(true, false)
  _pommel.set(0, 0, -0.15)
  p.sword.localToWorld(_pommel)
  _tasselVel.copy(_pommel).sub(p.prevPommel).divideScalar(dt)
  p.prevPommel.copy(_pommel)
  if (_tasselVel.lengthSq() > 400) _tasselVel.setLength(20) // teleports don't fling it
  _tasselTarget.copy(_DOWN).multiplyScalar(4).addScaledVector(_tasselVel, -0.5).normalize()
  p.tasselDir.lerp(_tasselTarget, Math.min(1, dt * 9)).normalize()
  _tasselQ.setFromUnitVectors(_DOWN, p.tasselDir)
  p.tassel.parent.getWorldQuaternion(_tasselParentQ).invert()
  p.tassel.quaternion.copy(_tasselParentQ.multiply(_tasselQ))
}

const _hand = new THREE.Vector3()
const _radial = new THREE.Vector3()
const _desired = new THREE.Quaternion()
const _parentInv = new THREE.Quaternion()
const _rest = new THREE.Quaternion()
const _Z = new THREE.Vector3(0, 0, 1)

// point the blade flat + radially outward in world space; restBlend eases back to guard
const _tangent = new THREE.Vector3()
const _binorm = new THREE.Vector3()
const _basis = new THREE.Matrix4()

function alignBladeHorizontal(p, restBlend) {
  p.swordArm.updateWorldMatrix(true, false)
  _hand.set(0, -0.28, 0)
  p.elbow.localToWorld(_hand)
  _radial.copy(_hand).sub(p.group.position)
  _radial.y = 0
  if (_radial.lengthSq() < 1e-4) _radial.copy(p.facing)
  _radial.normalize()
  // the tip travels along the swing tangent. The dao's edge is its convex -y
  // side (the curve bows toward +y, the spine). Pointing local -y along the
  // motion puts the sharp edge in the lead and lets the curve trail the cut.
  _tangent.set(-_radial.z, 0, _radial.x)
  _binorm.crossVectors(_tangent, _radial)
  _basis.makeBasis(_binorm, _tangent, _radial)
  _desired.setFromRotationMatrix(_basis)
  p.sword.parent.getWorldQuaternion(_parentInv).invert()
  p.sword.quaternion.copy(_parentInv.multiply(_desired))
  if (restBlend > 0) p.sword.quaternion.slerp(SWORD_REST_Q, restBlend)
}

const TRAIL_LIFE = 0.12

function updateTrail(p, dt) {
  for (const pt of p.trailPts) pt.age += dt
  while (p.trailPts.length && p.trailPts[0].age > TRAIL_LIFE) p.trailPts.shift()

  const sampling =
    (p.state === 'attack' && p.stateTime >= ATTACK.activeFrom - 0.03 && p.stateTime <= ATTACK.activeTo + 0.05) ||
    (p.state === 'chargeAttack' && p.stateTime >= CHARGE.activeFrom && p.stateTime <= CHARGE.activeTo)
  if (sampling) {
    p.sword.updateWorldMatrix(true, false)
    p.trailPts.push({
      base: p.sword.localToWorld(new THREE.Vector3(0, 0, 0.15)),
      tip: p.sword.localToWorld(new THREE.Vector3(0, 0, 1.2)),
      age: 0,
    })
  }

  if (p.trailPts.length < 2) {
    p.trail.visible = false
    return
  }
  p.trail.visible = true
  const verts = []
  const fades = []
  for (let i = 1; i < p.trailPts.length; i++) {
    const a = p.trailPts[i - 1]
    const b = p.trailPts[i]
    verts.push(a.base, a.tip, b.tip, a.base, b.tip, b.base)
    const fa = 1 - a.age / TRAIL_LIFE // older = darker = invisible under additive blending
    const fb = 1 - b.age / TRAIL_LIFE
    fades.push(fa, fa, fb, fa, fb, fb)
  }
  const pos = new Float32Array(verts.length * 3)
  const col = new Float32Array(verts.length * 3)
  verts.forEach((v, i) => {
    v.toArray(pos, i * 3)
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.max(0, fades[i])
  })
  p.trail.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  p.trail.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3))
}
