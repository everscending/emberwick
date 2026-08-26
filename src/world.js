import * as THREE from 'three'
import { toon } from './materials.js'
import { stats } from './player.js'
import { addCollider } from './collision.js'
import { groundHeight } from './ground.js'
import { plantForest, plantGrass } from './flora.js'
import { addInteractable } from './interact.js'
import { say } from './dialogue.js'
import { respawnEnemies } from './enemies.js'

const flames = []
const fireflies = []

import { wrand } from './rand.js'

const rng = (a, b) => a + wrand() * (b - a)

export function scatterEnvironment(scene) {
  // village roads now radiate from the shrine plaza — built in regions.js

  // fireflies (they glow under bloom)
  for (let i = 0; i < 36; i++) {
    const fly = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffcc77 }))
    scene.add(fly)
    fireflies.push({ mesh: fly, seed: rng(0, 100), cx: rng(-90, 90), cz: rng(-90, 90) })
  }
}

function part(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, toon(color))
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

export function createShrine(scene, x, z, player) {
  const group = new THREE.Group()

  // ash ring scorched into the ground
  const ash = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), toon(0x1e1e26))
  ash.rotation.x = -Math.PI / 2
  ash.position.y = 0.01
  ash.receiveShadow = true
  group.add(ash)

  // stepped stone base with scattered rubble
  group.add(part(new THREE.CylinderGeometry(1.05, 1.15, 0.25, 8), 0x55555f, 0, 0.125))
  group.add(part(new THREE.CylinderGeometry(0.75, 0.85, 0.25, 8), 0x666677, 0, 0.37))
  for (let i = 0; i < 4; i++) {
    const a = i * 1.9 + 0.7
    const rock = part(new THREE.DodecahedronGeometry(0.1 + (i % 2) * 0.05), 0x4a4a55, Math.cos(a) * 1.25, 0.08, Math.sin(a) * 1.25)
    rock.rotation.set(i, a, 0)
    group.add(rock)
  }

  // carved pillar with ring bands and glowing runes
  group.add(part(new THREE.CylinderGeometry(0.22, 0.3, 1.0, 6), 0x5a5a68, 0, 1.0))
  for (const by of [0.68, 1.32]) {
    const band = part(new THREE.TorusGeometry(0.27, 0.03, 6, 12), 0x44444e, 0, by)
    band.rotation.x = Math.PI / 2
    group.add(band)
  }
  const runes = []
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0xff7722 }))
    rune.position.set(Math.sin(a) * 0.27, 1.0, Math.cos(a) * 0.27)
    rune.rotation.y = a
    group.add(rune)
    runes.push(rune)
  }

  // iron brazier bowl holding the ember and flame
  group.add(part(new THREE.CylinderGeometry(0.34, 0.16, 0.2, 8), 0x33333a, 0, 1.6))
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8833 }))
  ember.position.y = 1.76
  group.add(ember)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xffaa44 }))
  flame.position.y = 2.0
  group.add(flame)

  // embers drifting up from the flame
  const particles = []
  for (let i = 0; i < 3; i++) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffbb66 }))
    group.add(spark)
    particles.push({ mesh: spark, phase: i / 3 })
  }

  const light = new THREE.PointLight(0xff7722, 12, 14)
  light.position.y = 2
  group.add(light)
  flames.push({ ember, light, flame, runes, particles, seed: Math.random() * 100 })

  group.position.set(x, groundHeight(x, z), z)
  scene.add(group)
  addCollider(x, z, 1.0)

  addInteractable({
    position: group.position,
    prompt: 'Pray at the hearth shrine',
    onInteract: () => {
      stats.hp = stats.hpMax
      stats.stam = stats.stamMax
      stats.flasks = stats.flaskMax
      player.spawnPoint.copy(group.position).add(new THREE.Vector3(1.5, 0, 1.5))
      respawnEnemies(group.position)
      say([{ text: 'Warmth crawls back into my hands. Should I fall, this flame will call me home.' }])
    },
  })

  return group
}

// ambient drift: pollen in the meadows, leaves in the forest, ash on the plateau
const ambient = []
const ambientColor = new THREE.Color()

export function createAmbient(scene) {
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.09),
      new THREE.MeshBasicMaterial({ color: 0xffdd99, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    )
    scene.add(m)
    ambient.push({ mesh: m, seed: Math.random() * 100 })
  }
}

export function updateAmbient(time, px, pz) {
  // one palette per region, chosen by where the player stands
  const target =
    -pz > 55 ? 0x9a9aa4 : -px > 32 ? 0x86b06a : px > 38 ? 0xb8c8d4 : 0xffdd99
  ambientColor.lerp(new THREE.Color(target), 0.02)
  // particles live at fixed WORLD positions and wrap into the 36u window
  // around the player — they never translate along with the character
  const wrap = (v, c) => c + ((((v - c + 18) % 36) + 36) % 36) - 18
  for (const a of ambient) {
    a.mesh.material.color.copy(ambientColor)
    const f = (time * (0.05 + (a.seed % 1) * 0.05) + a.seed) % 1
    const wx = wrap(a.seed * 37.7 + Math.sin(time * 0.4 + a.seed) * 2.5, px)
    const wz = wrap(a.seed * 91.3 + Math.cos(time * 0.33 + a.seed) * 2.5, pz)
    a.mesh.position.set(wx, 4.2 * (1 - f) + 0.3 + groundHeight(wx, wz), wz)
    a.mesh.rotation.set(time * 1.3 + a.seed, time * 1.1 + a.seed * 2, 0)
    a.mesh.material.opacity = 0.65 * Math.min(1, (1 - f) * 3) * Math.min(1, f * 8)
  }
}

export function updateWorld(time) {
  for (const f of flames) {
    const flick = 1 + Math.sin(time * 9 + f.seed) * 0.12 + Math.sin(time * 23 + f.seed) * 0.06
    f.light.intensity = 12 * flick
    f.ember.scale.setScalar(flick)
    f.flame.scale.set(flick, 1 + Math.sin(time * 13 + f.seed) * 0.2, flick)
    for (const r of f.runes) r.material.color.setHSL(0.07, 1, 0.45 + Math.sin(time * 4 + f.seed + r.position.x * 7) * 0.15)
    for (const p of f.particles) {
      const frac = (time * 0.35 + p.phase) % 1 // rise, fade, restart
      p.mesh.position.set(Math.sin(frac * 9 + f.seed) * 0.1, 1.9 + frac * 0.9, Math.cos(frac * 7 + f.seed) * 0.1)
      p.mesh.scale.setScalar(1 - frac * 0.8)
    }
  }

  for (const f of fireflies) {
    const fx = f.cx + Math.sin(time * 0.3 + f.seed) * 3 + Math.sin(time * 0.9 + f.seed * 2) * 0.6
    const fz = f.cz + Math.cos(time * 0.23 + f.seed) * 3 + Math.cos(time * 1.1 + f.seed) * 0.5
    f.mesh.position.set(fx, groundHeight(fx, fz) + 0.7 + Math.sin(time * 0.7 + f.seed) * 0.5, fz)
    // slow blink
    f.mesh.visible = Math.sin(time * 1.3 + f.seed * 3) > -0.6
  }
}
