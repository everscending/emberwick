// deterministic PRNG (mulberry32) for world generation — same seed, same world,
// every load. Runtime-only randomness (blinks, glances) can keep Math.random.
let s = 0

export function seedWorld(seed) {
  s = seed >>> 0
}

export function wrand() {
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
