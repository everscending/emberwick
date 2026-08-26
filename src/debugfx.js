import * as THREE from 'three'
import { groundHeight } from './ground.js'

export const DAMAGE_FX = [
  ['flash', 'Whole-body Flash'],
  ['recoil', 'Full-body Recoil'],
  ['knockback', 'Directional Knockback'],
  ['sparks', 'Ember Sparks'],
  ['cameraNormal', 'Camera Kick · Normal'],
  ['cameraHeavy', 'Camera Shake · Heavy'],
  ['hitstop', 'Hitstop · 80 ms'],
  ['audio', 'Impact Grunt'],
  ['skid', 'Foot Skid + Dust'],
  ['lowHealth', 'Low-health Pulse'],
  ['shatter', 'Ember Shatter'],
  ['ink', 'Ink Impact'],
  ['spirit', 'Spirit Displacement'],
  ['ground', 'Ground Smash'],
]

const css = `
#damage-debug { position:fixed; right:18px; top:50%; transform:translateY(-50%); display:none; z-index:35;
  width:min(330px,calc(100vw - 36px)); padding:18px; color:#e8e0cc; font-family:Georgia,serif;
  background:rgba(14,12,22,.96); border:2px solid #7b5735; border-radius:8px; box-shadow:0 12px 40px #0009; }
#damage-debug h2 { margin:0 0 4px; color:#ffbd68; font-size:20px; }
#damage-debug p { margin:0 0 13px; color:#9fa8bc; font-size:12px; }
#damage-debug .grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
#damage-debug .fx-item { display:grid; grid-template-columns:24px minmax(0,1fr); align-items:center; overflow:hidden;
  border:1px solid #665533; border-radius:4px; background:#292235; }
#damage-debug .fx-item input { margin:0 0 0 7px; accent-color:#d88a43; cursor:pointer; }
#damage-debug button { padding:8px 7px; border:1px solid #665533; border-radius:4px; color:#eee4d0;
  background:#292235; cursor:pointer; font:12px Georgia,serif; }
#damage-debug .fx-item button { padding:8px 4px; border:0; border-radius:0; text-align:left; background:transparent; }
#damage-debug button:hover,#damage-debug button:focus-visible { border-color:#ffad55; outline:none; background:#382a38; }
#damage-debug .all { grid-column:1/-1; color:#24150f; background:#d88a43; border-color:#ffbd68; font-weight:bold; }
#damage-debug .close { grid-column:1/-1; color:#aaa4b4; background:#181520; }
#damage-ink { position:fixed; left:50%; top:50%; z-index:4; width:300px; height:190px; pointer-events:none;
  opacity:0; background:#09070d; clip-path:polygon(0 43%,18% 33%,8% 8%,34% 25%,47% 0,56% 27%,88% 13%,75% 39%,100% 54%,72% 62%,91% 91%,58% 73%,43% 100%,34% 70%,4% 84%,22% 57%); }
#damage-shatter { position:fixed; inset:0; z-index:3; pointer-events:none; opacity:0;
  background:radial-gradient(circle at center,transparent 12%,rgba(255,105,48,.12) 24%,rgba(82,5,10,.58) 100%);
  backdrop-filter:saturate(.25) contrast(1.15); }
#damage-low-health { position:fixed; inset:-4%; z-index:2; pointer-events:none; opacity:0;
  background:radial-gradient(circle,transparent 42%,rgba(105,0,13,.8) 100%); }
`

let panel, inkLayer, shatterLayer, lowHealthLayer, open = false, scene, player, audioContext
let flashTime = 0, recoilTime = 0, knockTime = 0, skidTime = 0, inkTime = 0, shatterTime = 0, lowHealthTime = 0, recoilBase
const knockDirection = new THREE.Vector3()
const flashMaterials = new Map()
const sparks = [], dusts = [], waves = [], ghosts = [], smashes = []
const sparkGeo = new THREE.OctahedronGeometry(0.065, 0)
const waveGeo = new THREE.RingGeometry(0.72, 0.9, 48)

export function createDamageDebugUI(world, hero) {
  scene = world
  player = hero
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  panel = document.createElement('div')
  panel.id = 'damage-debug'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-labelledby', 'damage-debug-title')
  panel.innerHTML = `<h2 id="damage-debug-title">Damage FX Lab</h2><p>Simulates a hit from directly in front of the hero.</p><div class="grid">${DAMAGE_FX.map(([id, label]) => `<div class="fx-item"><input type="checkbox" value="${id}" data-fx-check checked aria-label="Include ${label}"><button type="button" data-fx="${id}">${label}</button></div>`).join('')}<button type="button" class="all" data-fx="all">Trigger Checked Effects</button><button type="button" class="close">Close · 6 / Esc</button></div>`
  panel.querySelectorAll('[data-fx]').forEach((button) => { button.onclick = () => triggerDamageFx(button.dataset.fx) })
  panel.querySelector('.close').onclick = toggleDamageDebug
  panel.onmousedown = (event) => event.stopPropagation()
  document.body.appendChild(panel)
  inkLayer = document.createElement('div')
  inkLayer.id = 'damage-ink'
  shatterLayer = document.createElement('div')
  shatterLayer.id = 'damage-shatter'
  lowHealthLayer = document.createElement('div')
  lowHealthLayer.id = 'damage-low-health'
  document.body.append(inkLayer, shatterLayer, lowHealthLayer)
  addEventListener('pointerdown', ensureImpactAudio, { once: true })
  addEventListener('keydown', ensureImpactAudio, { once: true })
}

export function toggleDamageDebug() {
  open = !open
  panel.style.display = open ? 'block' : 'none'
  if (open) panel.querySelector('button').focus()
}

export function isDamageDebugOpen() {
  return open
}

export function selectedDamageFx(options) {
  return [...options].filter((option) => option.checked).map((option) => option.value)
}

function startFlash(seconds = 0.1, target = player.rig) {
  target.traverse((part) => {
    if (!part.isMesh) return
    const materials = Array.isArray(part.material) ? part.material : [part.material]
    for (const material of materials) if (!flashMaterials.has(material)) {
      flashMaterials.set(material, { color: material.color?.getHex(), emissive: material.emissive?.getHex() })
    }
  })
  flashTime = Math.max(flashTime, seconds)
}

function paintFlash() {
  for (const [material] of flashMaterials) {
    material.color?.setHex(0xffd4d4)
    material.emissive?.setHex(0xff7777)
  }
}

function restoreFlash() {
  for (const [material, saved] of flashMaterials) {
    if (saved.color !== undefined) material.color.setHex(saved.color)
    if (saved.emissive !== undefined) material.emissive.setHex(saved.emissive)
  }
  flashMaterials.clear()
}

function startRecoil() {
  if (!recoilBase) recoilBase = {
    rigRotation: player.rig.rotation.clone(), rigPosition: player.rig.position.clone(),
    head: player.head.rotation.clone(), sword: player.swordArm.rotation.clone(), shield: player.shieldArm.rotation.clone(),
  }
  recoilTime = 0.28
}

function spawnSparks(count = 6, color = 0xff8b3d) {
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    const mesh = new THREE.Mesh(sparkGeo, material)
    mesh.position.copy(player.group.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.65 + Math.random() * 0.7, (Math.random() - 0.5) * 0.5))
    scene.add(mesh)
    sparks.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 4, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.55 })
  }
}

function playImpactGrunt() {
  const ctx = ensureImpactAudio()
  if (!ctx) return
  const now = ctx.currentTime
  const voice = ctx.createOscillator()
  const body = ctx.createOscillator()
  const throat = ctx.createBiquadFilter()
  const mouth = ctx.createBiquadFilter()
  const voiceGain = ctx.createGain()
  const bodyGain = ctx.createGain()
  voice.type = 'sawtooth'
  voice.frequency.setValueAtTime(125, now)
  voice.frequency.exponentialRampToValueAtTime(68, now + 0.28)
  body.type = 'triangle'
  body.frequency.setValueAtTime(63, now)
  body.frequency.exponentialRampToValueAtTime(42, now + 0.24)
  throat.type = mouth.type = 'peaking'
  throat.frequency.value = 340
  throat.Q.value = 2.2
  throat.gain.value = 14
  mouth.frequency.value = 820
  mouth.Q.value = 3
  mouth.gain.value = 8
  voiceGain.gain.setValueAtTime(0.001, now)
  voiceGain.gain.exponentialRampToValueAtTime(0.14, now + 0.018)
  voiceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
  bodyGain.gain.setValueAtTime(0.055, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
  voice.connect(throat).connect(mouth).connect(voiceGain).connect(ctx.destination)
  body.connect(bodyGain).connect(ctx.destination)
  voice.start(now)
  body.start(now)
  voice.stop(now + 0.3)
  body.stop(now + 0.24)
}

function ensureImpactAudio() {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!Audio) return
  const ctx = audioContext ||= new Audio()
  ctx.resume().catch(() => {})
  return ctx
}

function impactDirection(target, source, fallback) {
  const direction = source ? target.clone().sub(source) : fallback.clone()
  direction.y = 0
  if (!direction.lengthSq()) direction.copy(fallback)
  return direction.normalize()
}

function setHeroImpactDirection(source) {
  knockDirection.copy(impactDirection(player.group.position, source, player.facing.clone().multiplyScalar(-1)))
}

function spawnSkidDust(target = player.group, direction = knockDirection, count = 10) {
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({ color: 0x9b8064, transparent: true, opacity: 0.55, depthWrite: false })
    const mesh = new THREE.Mesh(sparkGeo, material)
    mesh.scale.set(1.6, 0.55, 1.6)
    mesh.position.copy(target.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.12, (Math.random() - 0.5) * 0.7))
    scene.add(mesh)
    dusts.push({ mesh, velocity: direction.clone().multiplyScalar(-0.8 - Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.25 + Math.random() * 0.45, (Math.random() - 0.5) * 0.8)), life: 0.55 })
  }
}

function spawnWave(color = 0xff7044) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
  const mesh = new THREE.Mesh(waveGeo, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.copy(player.group.position)
  mesh.position.y = groundHeight(mesh.position.x, mesh.position.z) + 0.08
  mesh.scale.setScalar(0.15)
  scene.add(mesh)
  waves.push({ mesh, life: 0.5 })
}

function spawnSpirit() {
  const root = new THREE.Group()
  const ghost = player.rig.clone(true)
  const materials = []
  ghost.traverse((part) => {
    if (!part.isMesh) return
    part.material = part.material.clone()
    part.material.color?.setHex(0xaadfff)
    part.material.transparent = true
    part.material.opacity = 0.32
    part.material.depthWrite = false
    materials.push(part.material)
  })
  root.position.copy(player.group.position)
  root.rotation.copy(player.group.rotation)
  root.add(ghost)
  scene.add(root)
  ghosts.push({ root, materials, direction: player.facing.clone().multiplyScalar(-1), life: 0.6 })
}

function spawnEnemySpirit(enemy, direction) {
  const root = enemy.group.clone(true)
  const materials = []
  root.traverse((part) => {
    if (part.isSprite) part.visible = false
    if (!part.isMesh) return
    const originals = Array.isArray(part.material) ? part.material : [part.material]
    const clones = originals.map((material) => {
      const clone = material.clone()
      clone.color?.setHex(0xaadfff)
      clone.transparent = true
      clone.opacity = 0.32
      clone.depthWrite = false
      materials.push(clone)
      return clone
    })
    part.material = Array.isArray(part.material) ? clones : clones[0]
  })
  scene.add(root)
  ghosts.push({ root, materials, direction: direction.clone(), life: 0.6 })
}

function spawnGroundSmash() {
  const root = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color: 0x29151a, transparent: true, opacity: 0.85, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 32), material)
  ring.rotation.x = -Math.PI / 2
  root.add(ring)
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9 + Math.random() * 0.2
    const length = 0.5 + Math.random() * 0.75
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, length), material)
    crack.position.set(Math.sin(a) * length * 0.52, 0, Math.cos(a) * length * 0.52)
    crack.rotation.y = a
    root.add(crack)
  }
  root.position.copy(player.group.position)
  root.position.y = groundHeight(root.position.x, root.position.z) + 0.06
  root.scale.setScalar(0.1)
  scene.add(root)
  smashes.push({ root, material, life: 1 })
}

export function triggerDamageFx(name) {
  if (name === 'all') {
    for (const id of selectedDamageFx(panel.querySelectorAll('[data-fx-check]'))) triggerDamageFx(id)
  } else if (name === 'flash') startFlash()
  else if (name === 'recoil') startRecoil()
  else if (name === 'knockback') {
    setHeroImpactDirection()
    knockTime = 0.18
  }
  else if (name === 'sparks') spawnSparks()
  else if (name === 'cameraNormal') player.shake = Math.max(player.shake, 0.18)
  else if (name === 'cameraHeavy') player.shake = Math.max(player.shake, 0.55)
  else if (name === 'hitstop') player.hitstop = Math.max(player.hitstop, 0.08)
  else if (name === 'audio') playImpactGrunt()
  else if (name === 'skid') {
    setHeroImpactDirection()
    skidTime = 0.32
    spawnSkidDust()
  } else if (name === 'lowHealth') lowHealthTime = 1.8
  else if (name === 'shatter') {
    shatterTime = 0.55
    startFlash(0.13)
    spawnSparks(12, 0xff6338)
    spawnWave()
    player.shake = Math.max(player.shake, 0.55)
  } else if (name === 'ink') inkTime = 0.36
  else if (name === 'spirit') spawnSpirit()
  else if (name === 'ground') spawnGroundSmash()
}

export function triggerHeroDamageFx(fromPosition) {
  setHeroImpactDirection(fromPosition)
  startFlash()
  startRecoil()
  knockTime = 0.18
  playImpactGrunt()
  skidTime = 0.32
  spawnSkidDust()
}

export function triggerEnemyDamageFx(enemy, fromPosition) {
  const direction = impactDirection(enemy.group.position, fromPosition, new THREE.Vector3(0, 0, 1))
  startFlash(0.1, enemy.group)
  enemy.recoilTime = 0.24
  playImpactGrunt()
  spawnSkidDust(enemy.group, direction)
  spawnEnemySpirit(enemy, direction)
}

export function updateDamageDebug(dt) {
  if (flashTime > 0) {
    flashTime -= dt
    paintFlash()
    if (flashTime <= 0) restoreFlash()
  }
  if (recoilTime > 0) {
    recoilTime -= dt
    const hit = Math.sin(Math.PI * (1 - Math.max(0, recoilTime) / 0.28))
    player.rig.rotation.x = recoilBase.rigRotation.x - hit * 0.26
    player.rig.position.z = recoilBase.rigPosition.z - hit * 0.1
    player.head.rotation.x = recoilBase.head.x + hit * 0.46
    player.swordArm.rotation.z = recoilBase.sword.z - hit * 0.68
    player.shieldArm.rotation.z = recoilBase.shield.z + hit * 0.68
    if (recoilTime <= 0) {
      player.rig.rotation.copy(recoilBase.rigRotation)
      player.rig.position.copy(recoilBase.rigPosition)
      player.head.rotation.copy(recoilBase.head)
      player.swordArm.rotation.copy(recoilBase.sword)
      player.shieldArm.rotation.copy(recoilBase.shield)
      recoilBase = undefined
    }
  }
  if (knockTime > 0 && player.hitstop <= 0) {
    knockTime -= dt
    player.group.position.addScaledVector(knockDirection, 3.2 * dt)
    player.group.position.y = groundHeight(player.group.position.x, player.group.position.z)
  }
  if (skidTime > 0 && player.hitstop <= 0) {
    skidTime -= dt
    player.group.position.addScaledVector(knockDirection, 1.6 * (skidTime / 0.32) * dt)
    player.group.position.y = groundHeight(player.group.position.x, player.group.position.z)
  }
  inkTime = Math.max(0, inkTime - dt)
  const inkT = inkTime / 0.36
  inkLayer.style.opacity = String(Math.sin(inkT * Math.PI) * 0.88)
  inkLayer.style.transform = `translate(-50%,-50%) rotate(-8deg) scale(${1.35 - inkT * 0.45})`
  shatterTime = Math.max(0, shatterTime - dt)
  shatterLayer.style.opacity = String(Math.sin((shatterTime / 0.55) * Math.PI) * 0.9)
  lowHealthTime = Math.max(0, lowHealthTime - dt)
  const lowHealthFade = Math.min(1, lowHealthTime / 0.35)
  const lowHealthPulse = Math.max(0, Math.sin((1.8 - lowHealthTime) * Math.PI * 3)) ** 2
  lowHealthLayer.style.opacity = String((0.16 + lowHealthPulse * 0.58) * lowHealthFade)
  lowHealthLayer.style.transform = `scale(${1.02 - lowHealthPulse * 0.02})`

  for (let i = sparks.length - 1; i >= 0; i--) {
    const spark = sparks[i]
    spark.life -= dt
    spark.mesh.position.addScaledVector(spark.velocity, dt)
    spark.velocity.y -= 9 * dt
    spark.mesh.material.opacity = Math.max(0, spark.life / 0.55)
    if (spark.life <= 0) {
      scene.remove(spark.mesh)
      spark.mesh.material.dispose()
      sparks.splice(i, 1)
    }
  }
  for (let i = dusts.length - 1; i >= 0; i--) {
    const dust = dusts[i]
    dust.life -= dt
    dust.mesh.position.addScaledVector(dust.velocity, dt)
    dust.mesh.scale.multiplyScalar(1 + dt * 1.8)
    dust.mesh.material.opacity = Math.max(0, dust.life / 0.55) * 0.55
    if (dust.life <= 0) {
      scene.remove(dust.mesh)
      dust.mesh.material.dispose()
      dusts.splice(i, 1)
    }
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const wave = waves[i]
    wave.life -= dt
    const t = 1 - wave.life / 0.5
    wave.mesh.scale.setScalar(0.15 + t * 3.4)
    wave.mesh.material.opacity = Math.max(0, wave.life / 0.5) * 0.8
    if (wave.life <= 0) {
      scene.remove(wave.mesh)
      wave.mesh.material.dispose()
      waves.splice(i, 1)
    }
  }
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const ghost = ghosts[i]
    ghost.life -= dt
    ghost.root.position.addScaledVector(ghost.direction, dt * 1.8)
    ghost.root.position.y += dt * 0.45
    for (const material of ghost.materials) material.opacity = Math.max(0, ghost.life / 0.6) * 0.32
    if (ghost.life <= 0) {
      scene.remove(ghost.root)
      ghost.materials.forEach((material) => material.dispose())
      ghosts.splice(i, 1)
    }
  }
  for (let i = smashes.length - 1; i >= 0; i--) {
    const smash = smashes[i]
    smash.life -= dt
    const t = 1 - smash.life
    smash.root.scale.setScalar(Math.min(1, t * 8))
    smash.material.opacity = Math.max(0, Math.min(0.85, smash.life * 1.7))
    if (smash.life <= 0) {
      scene.remove(smash.root)
      smash.root.traverse((part) => part.geometry?.dispose())
      smash.material.dispose()
      smashes.splice(i, 1)
    }
  }
}

// Small runnable menu check: `node src/debugfx.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const ids = new Set(DAMAGE_FX.map(([id]) => id))
  if (DAMAGE_FX.length !== 14 || !['flash', 'recoil', 'knockback', 'sparks', 'cameraNormal', 'cameraHeavy', 'hitstop', 'audio', 'skid', 'lowHealth', 'shatter', 'ink', 'spirit', 'ground'].every((id) => ids.has(id))) throw new Error('Damage FX menu must expose every requested effect')
  if (selectedDamageFx([{ value: 'flash', checked: true }, { value: 'ink', checked: false }]).join() !== 'flash') throw new Error('Combined trigger must include only checked effects')
  if (impactDirection(new THREE.Vector3(2, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)).x !== 1) throw new Error('Damage direction must point away from the hit source')
  console.log('Damage FX check passed: individual triggers and checked-only combined selection.')
}
