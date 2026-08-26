// circle colliders on the ground plane; push entities out on overlap
// ponytail: linear scan over ~50 static circles per entity per frame; spatial hash if the world grows
const circles = []

export function addCollider(x, z, r) {
  const c = { x, z, r }
  circles.push(c)
  return { remove: () => circles.splice(circles.indexOf(c), 1) }
}

export function resolveCircle(pos, radius) {
  for (const c of circles) {
    const dx = pos.x - c.x
    const dz = pos.z - c.z
    const min = c.r + radius
    const d2 = dx * dx + dz * dz
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2)
      pos.x = c.x + (dx / d) * min
      pos.z = c.z + (dz / d) * min
    }
  }
}
