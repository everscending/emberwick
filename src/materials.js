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
