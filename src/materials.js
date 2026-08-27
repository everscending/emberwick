import * as THREE from 'three'

// shared 3-step gradient for cel shading
export const grad = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)
grad.minFilter = grad.magFilter = THREE.NearestFilter
grad.needsUpdate = true

export function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: grad })
}

export function toonVertexColored() {
  return new THREE.MeshToonMaterial({ gradientMap: grad, vertexColors: true })
}

export function windVertexTransform(amp) {
  return `#include <begin_vertex>
  float gust = 0.18 + 0.04 * sin(uTime * 0.45);
  float bend = ${amp.toFixed(4)} * max(0.0, transformed.y) * gust;
  transformed.x += bend;
  transformed.z += bend * 0.35;`
}

// toon + warm fresnel rim — separates characters from the background
export function toonRim(color) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: grad })
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.0);
      totalEmissiveRadiance += vec3(1.0, 0.72, 0.45) * rimF * 0.22;`
    )
  }
  return m
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  if (/iPos|instanceMatrix|modelMatrix/.test(windVertexTransform(0.02))) throw new Error('Nearby foliage must share one prevailing wind instead of deriving opposing sway from tree position')
  console.log('Material check passed: foliage shares one restrained prevailing wind.')
}
