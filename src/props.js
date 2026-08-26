import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { grad } from './materials.js'
import { addCollider } from './collision.js'
import { groundHeight } from './ground.js'

// Kenney CC0 model pipeline. Models load async; placements resolve when ready.
// Materials are converted to toon (keeping the pack's colors/atlas) so assets
// and characters share one look. `wind` adds the flora vertex sway.

const loader = new GLTFLoader()
const cache = new Map() // "pack/name" -> Promise<THREE.Group>
const windMats = []

// EMBERWICK grade: Kenney's pastel-teal palette remapped to our dusk world.
// Named flat materials (nature pack) get exact palette swaps; anything else
// falls back to an HSL grade that tames teal-greens and deepens values.
const NATURE_PALETTE = {
  leafsGreen: 0x4a8a55,
  leafsDark: 0x2e5d3a,
  leafs: 0x417a4c,
  leafsFall: 0xb8763a,
  grass: 0x3e6b45,
  woodBark: 0x6b4a32,
  woodBarkDark: 0x4e3524,
  wood: 0x7a5638,
  dirt: 0x6e563e,
  dirtDark: 0x54402e,
  stone: 0x8a877e,
  stoneDark: 0x6a675f,
  rock: 0x7d7a72,
  snow: 0xe8e0d0,
}

function gradeColor(c, name) {
  if (name && NATURE_PALETTE[name] !== undefined) {
    c.setHex(NATURE_PALETTE[name])
    return
  }
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  if (hsl.h > 0.2 && hsl.h < 0.55 && hsl.s > 0.25) {
    c.setHSL(0.31, hsl.s * 0.65, hsl.l * 0.6) // teal-greens -> forest green, deeper
  } else {
    c.setHSL(hsl.h, hsl.s * 0.95, hsl.l * 0.82) // everything sits deeper in the dusk
  }
}

// atlas packs (town/grave): regrade the palette texture pixel-by-pixel once
const gradedTextures = new WeakMap()

function gradeTexture(tex) {
  if (gradedTextures.has(tex)) return gradedTextures.get(tex)
  const img = tex.image
  const cv = document.createElement('canvas')
  cv.width = img.width
  cv.height = img.height
  const ctx = cv.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, cv.width, cv.height)
  const px = data.data
  const c = new THREE.Color()
  const hsl = { h: 0, s: 0, l: 0 }
  for (let i = 0; i < px.length; i += 4) {
    c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255)
    c.getHSL(hsl)
    if (hsl.h > 0.2 && hsl.h < 0.55 && hsl.s > 0.25) c.setHSL(0.31, hsl.s * 0.65, hsl.l * 0.6)
    else c.setHSL(hsl.h, hsl.s * 0.95, hsl.l * 0.85)
    px[i] = c.r * 255
    px[i + 1] = c.g * 255
    px[i + 2] = c.b * 255
  }
  ctx.putImageData(data, 0, 0)
  const out = new THREE.CanvasTexture(cv)
  out.colorSpace = tex.colorSpace
  out.flipY = tex.flipY
  out.magFilter = THREE.NearestFilter
  out.minFilter = THREE.NearestFilter
  gradedTextures.set(tex, out)
  return out
}

function toonify(root, windAmp) {
  root.traverse((o) => {
    if (!o.isMesh) return
    const old = o.material
    const color = old.color.clone()
    gradeColor(color, old.name)
    const m = new THREE.MeshToonMaterial({
      color,
      map: old.map ? gradeTexture(old.map) : null,
      gradientMap: grad,
    })
    if (windAmp) {
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
            #else
              vec3 iPos = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
            #endif
            float wob = sin(uTime * 1.6 + iPos.x * 0.6 + iPos.z * 0.8) + 0.4 * sin(uTime * 3.1 + iPos.z * 1.3);
            float bend = ${windAmp.toFixed(4)} * max(0.0, transformed.y);
            transformed.x += wob * bend;
            transformed.z += wob * bend * 0.55;`
          )
      }
      windMats.push(m)
    }
    o.material = m
    o.castShadow = true
    o.receiveShadow = true
  })
}

export function loadModel(pack, name, windAmp = 0) {
  const key = `${pack}/${name}/${windAmp}`
  if (!cache.has(key)) {
    cache.set(
      key,
      loader.loadAsync(`/assets/${pack}/${name}.glb`).then((gltf) => {
        const root = gltf.scene
        toonify(root, windAmp)
        return root
      })
    )
  }
  return cache.get(key)
}

// place one prop on the terrain; fire-and-forget
export function place(scene, pack, name, x, z, { rot = 0, scale = 1, collider = 0, y = 0, wind = 0 } = {}) {
  if (groundHeight(x, z) < -0.4) console.warn(`PLACEMENT IN WATER: ${pack}/${name} at (${x}, ${z})`)
  loadModel(pack, name, wind).then((model) => {
    const inst = model.clone()
    inst.position.set(x, groundHeight(x, z) + y, z)
    inst.rotation.y = rot
    inst.scale.setScalar(scale)
    scene.add(inst)
  })
  if (collider) addCollider(x, z, collider)
}

// scatter many copies of one model with few draw calls: one InstancedMesh per
// submesh of the source. spots: [{x, z, rot?, scale?, y?}]
export function scatter(scene, pack, name, spots, { collider = 0, wind = 0 } = {}) {
  if (collider) for (const s of spots) addCollider(s.x, s.z, collider * (s.scale ?? 1))
  loadModel(pack, name, wind).then((model) => {
    model.updateWorldMatrix(false, true)
    const spotMats = spots.map((s) => {
      const m = new THREE.Matrix4()
      m.compose(
        new THREE.Vector3(s.x, groundHeight(s.x, s.z) + (s.y ?? 0), s.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot ?? 0),
        new THREE.Vector3().setScalar(s.scale ?? 1)
      )
      return m
    })
    model.traverse((o) => {
      if (!o.isMesh) return
      const inst = new THREE.InstancedMesh(o.geometry, o.material, spots.length)
      inst.castShadow = true
      inst.receiveShadow = true
      const local = o.matrixWorld.clone() // submesh transform within the model
      const m = new THREE.Matrix4()
      spotMats.forEach((sm, i) => inst.setMatrixAt(i, m.multiplyMatrices(sm, local)))
      scene.add(inst)
    })
  })
}

export function updateProps(time) {
  for (const m of windMats) m.userData.uTime.value = time
}
