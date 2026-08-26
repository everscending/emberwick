import * as THREE from 'three'
import { damageEnemiesAt } from './enemies.js'

const BOLT_SPEED = 18
const bolts = []

export function spawnBolt(scene, pos, dir, damage) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff9944 }))
  mesh.position.copy(pos)
  scene.add(mesh)
  bolts.push({ mesh, dir: dir.clone().normalize(), life: 0.9, damage })
}

export function updateProjectiles(scene, dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]
    b.mesh.position.addScaledVector(b.dir, BOLT_SPEED * dt)
    b.mesh.scale.setScalar(1 + Math.sin(b.life * 40) * 0.2) // crackle
    b.life -= dt
    if (b.life <= 0 || damageEnemiesAt(b.mesh.position, 0.7, b.damage)) {
      scene.remove(b.mesh)
      bolts.splice(i, 1)
    }
  }
}
