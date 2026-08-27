import * as THREE from 'three'
import { toon } from './materials.js'
import { wrand } from './rand.js'
import { addCollider } from './collision.js'
import { groundHeight, groundSlope } from './ground.js'

// Instanced vegetation with GPU wind. Each archetype is a few instanced part
// meshes (one draw call per part, any number of trees). Wind bends vertices in
// the shader — rigid trunks use normal toon materials while foliage, grass,
// and flowers sway out of step.

const windMats = []

function windToon(color, amp) {
  const m = toon(color)
  m.userData.uTime = { value: 0 }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = m.userData.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float wob = sin(uTime * 1.6 + iPos.x * 0.6 + iPos.z * 0.8) + 0.4 * sin(uTime * 3.1 + iPos.z * 1.3);
          float bend = ${amp.toFixed(4)} * max(0.0, transformed.y);
          transformed.x += wob * bend;
          transformed.z += wob * bend * 0.55;
        #endif`
      )
  }
  windMats.push(m)
  return m
}

const cyl = (...a) => new THREE.CylinderGeometry(...a)
const cone = (...a) => new THREE.ConeGeometry(...a)
const sph = (r) => new THREE.SphereGeometry(r, 8, 7)

const TYPES = {
  pine: {
    collider: 0.45,
    parts: [
      { geo: cyl(0.12, 0.18, 0.6, 6).translate(0, 0.3, 0), color: 0x5a4030, amp: 0 },
      { geo: cone(0.72, 1.0, 7).translate(0, 1.0, 0), color: 0x2e5d34, amp: 0.02 },
      { geo: cone(0.55, 0.9, 7).translate(0, 1.65, 0), color: 0x35714b, amp: 0.028 },
      { geo: cone(0.36, 0.75, 7).translate(0, 2.25, 0), color: 0x3f7d52, amp: 0.036 },
    ],
  },
  tall: {
    collider: 0.35,
    parts: [
      { geo: cyl(0.1, 0.14, 1.1, 6).translate(0, 0.55, 0), color: 0x5a4030, amp: 0 },
      { geo: cone(0.45, 1.5, 7).translate(0, 1.8, 0), color: 0x2c5a40, amp: 0.024 },
      { geo: cone(0.3, 1.1, 7).translate(0, 2.9, 0), color: 0x37704e, amp: 0.034 },
    ],
  },
  blob: {
    collider: 0.5,
    parts: [
      { geo: cyl(0.14, 0.2, 0.8, 6).translate(0, 0.4, 0), color: 0x5a4030, amp: 0 },
      { geo: sph(0.85).translate(0, 1.55, 0), color: 0x35714b, amp: 0.022 },
      { geo: sph(0.55).translate(0.42, 2.05, 0.2), color: 0x3f7d52, amp: 0.03 },
    ],
  },
  dead: {
    collider: 0.3,
    parts: [
      { geo: cyl(0.09, 0.16, 1.9, 5).translate(0, 0.95, 0), color: 0x3a322c, amp: 0.006 },
      { geo: cyl(0.04, 0.07, 0.9, 4).translate(0, 0.45, 0).rotateZ(0.9).translate(-0.25, 1.35, 0), color: 0x352e28, amp: 0.012 },
      { geo: cyl(0.03, 0.06, 0.7, 4).translate(0, 0.35, 0).rotateZ(-0.75).rotateY(1.2).translate(0.2, 1.7, 0.1), color: 0x352e28, amp: 0.014 },
    ],
  },
}

const UP = new THREE.Vector3(0, 1, 0)

// trees only grow on dry, reasonably level ground — whatever a region requests
const plantable = (x, z) => groundHeight(x, z) > -0.15 && groundSlope(x, z) < 0.9

// spots: [{x, z, type?, scale?, rot?, tint?}] — regions pass their own lists
export function plantForest(scene, spots) {
  spots = spots.filter((s) => plantable(s.x, s.z))
  const byType = {}
  for (const s of spots) {
    s.type ??= wrand() < 0.6 ? 'pine' : wrand() < 0.5 ? 'tall' : 'blob'
    s.scale ??= 0.8 + wrand() * 0.7
    s.rot ??= wrand() * Math.PI * 2
    s.tint ??= 0.82 + wrand() * 0.3
    ;(byType[s.type] ??= []).push(s)
  }
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const col = new THREE.Color()
  for (const [type, list] of Object.entries(byType)) {
    const def = TYPES[type]
    for (const p of def.parts) {
      const mesh = new THREE.InstancedMesh(p.geo, type === 'dead' || !p.amp ? toon(p.color) : windToon(p.color, p.amp), list.length)
      mesh.castShadow = true
      list.forEach((s, i) => {
        q.setFromAxisAngle(UP, s.rot)
        m4.compose(v.set(s.x, groundHeight(s.x, s.z), s.z), q, sc.setScalar(s.scale))
        mesh.setMatrixAt(i, m4)
        mesh.setColorAt(i, col.setScalar(s.tint))
      })
      scene.add(mesh)
    }
    for (const s of list) addCollider(s.x, s.z, def.collider * s.scale)
  }
}

export function plantGrass(scene, count, area, exclude) {
  const mesh = new THREE.InstancedMesh(
    cone(0.05, 0.24, 4).translate(0, 0.12, 0),
    windToon(0x4a7040, 0.35),
    count
  )
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const col = new THREE.Color()
  for (let i = 0; i < count; i++) {
    let x, z
    do {
      x = (wrand() - 0.5) * 2 * area
      z = (wrand() - 0.5) * 2 * area
    } while (Math.hypot(x, z) < exclude || !plantable(x, z))
    q.setFromAxisAngle(UP, wrand() * Math.PI * 2)
    m4.compose(v.set(x, groundHeight(x, z) + 0.02, z), q, sc.setScalar(0.7 + wrand() * 0.9))
    mesh.setMatrixAt(i, m4)
    mesh.setColorAt(i, col.setScalar(0.8 + wrand() * 0.4))
  }
  scene.add(mesh)
}

// tall reeds along stream banks — spots: [{x, z}]
export function plantReeds(scene, spots) {
  const mesh = new THREE.InstancedMesh(
    cone(0.035, 0.85, 4).translate(0, 0.42, 0),
    windToon(0x5a7a48, 0.5),
    spots.length
  )
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const col = new THREE.Color()
  spots.forEach((s, i) => {
    q.setFromAxisAngle(UP, wrand() * Math.PI * 2)
    m4.compose(v.set(s.x, groundHeight(s.x, s.z), s.z), q, sc.setScalar(0.7 + wrand() * 0.6))
    mesh.setMatrixAt(i, m4)
    mesh.setColorAt(i, col.setScalar(0.8 + wrand() * 0.4))
  })
  scene.add(mesh)
}

// meadow flowers: instanced heads that catch the wind
export function plantFlowers(scene, spots) {
  spots = spots.filter((s) => plantable(s.x, s.z))
  const colors = [0xe8d0a8, 0xd88a9a, 0xc8b8e8]
  const mesh = new THREE.InstancedMesh(
    sph(0.055).translate(0, 0.28, 0),
    windToon(0xffffff, 0.4),
    spots.length
  )
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const col = new THREE.Color()
  spots.forEach((s, i) => {
    q.setFromAxisAngle(UP, wrand() * Math.PI * 2)
    m4.compose(v.set(s.x, groundHeight(s.x, s.z), s.z), q, sc.setScalar(0.8 + wrand() * 0.6))
    mesh.setMatrixAt(i, m4)
    mesh.setColorAt(i, col.setHex(colors[i % 3]))
  })
  scene.add(mesh)
}

export function updateFlora(time) {
  for (const m of windMats) m.userData.uTime.value = time
}
