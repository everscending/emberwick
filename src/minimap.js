import { groundHeight, groundSlope, WATER_LEVEL, streamCenter } from './ground.js'
import { currentObjectiveTarget } from './quests.js'

// Circular minimap, rotated 45° so "up" on the map matches "up" on screen
// (W key). Terrain painted once from the same height function as the world.

const SIZE = 164
const WORLD = 220
const S = SIZE / WORLD
const R = SIZE / 2

const LANDMARKS = [
  { x: -4, z: 4, color: '#ff8833' }, // shrine
  { x: -8, z: 52, color: '#c9c9d8' }, // the old well
  { x: -62, z: 18, color: '#e8e0cc' }, // stone circle
  { x: streamCenter(2), z: 2, color: '#a8763e' }, // broken bridge
  { x: 8, z: -86, color: '#cc4433' }, // ashen keep
]

let canvas, ctx, bg

export function createMinimap() {
  bg = document.createElement('canvas')
  bg.width = bg.height = SIZE
  const b = bg.getContext('2d')
  const img = b.createImageData(SIZE, SIZE)
  const put = (i, r, g, bb) => {
    img.data[i] = r
    img.data[i + 1] = g
    img.data[i + 2] = bb
    img.data[i + 3] = 255
  }
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const wx = px / S - WORLD / 2
      const wz = py / S - WORLD / 2
      const h = groundHeight(wx, wz)
      const i = (py * SIZE + px) * 4
      if (h < WATER_LEVEL + 0.03) {
        put(i, 46, 106, 138) // water
      } else if (groundSlope(wx, wz) > 0.85) {
        put(i, 104, 100, 88) // cliffs
      } else if (-wz > 55) {
        put(i, 85, 80, 74) // ash plateau
      } else if (wx > 40) {
        put(i, 74, 107, 88) // ruins moss
      } else if (-wx > 32) {
        put(i, 42, 77, 46) // forest
      } else {
        const n = Math.sin(wx * 0.53) * Math.sin(wz * 0.47) * 12
        put(i, 61 + n, 99 + n, 57 + n) // meadow
      }
    }
  }
  b.putImageData(img, 0, 0)

  canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  canvas.style.cssText = `position: fixed; right: 16px; bottom: 16px; border-radius: 50%;
    border: 2px solid #665533; background: #0a0a12; box-shadow: 0 2px 10px rgba(0,0,0,0.5);`
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
}

export function updateMinimap(player, time) {
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.save()
  ctx.beginPath()
  ctx.arc(R, R, R - 1, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(R, R)
  ctx.rotate(Math.PI / 4) // align map-up with screen-up
  ctx.drawImage(bg, -R, -R)

  for (const l of LANDMARKS) {
    ctx.fillStyle = l.color
    ctx.beginPath()
    ctx.arc(l.x * S, l.z * S, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // pulsing objective marker
  const t = currentObjectiveTarget()
  if (t) {
    ctx.strokeStyle = '#ddaa44'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(t.x * S, t.z * S, 3.5 + Math.sin(time * 5) * 1.4, 0, Math.PI * 2)
    ctx.stroke()
  }

  // player arrow, pointing along facing
  const px = player.group.position.x * S
  const pz = player.group.position.z * S
  ctx.translate(px, pz)
  ctx.rotate(Math.atan2(player.facing.x, -player.facing.z))
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(0, -5)
  ctx.lineTo(3.4, 4)
  ctx.lineTo(-3.4, 4)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // compass letters (fixed: camera never rotates); world north renders up-right
  ctx.fillStyle = '#e8e0cc'
  ctx.font = 'bold 11px Georgia'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cr = R - 11
  const dirs = [
    ['N', 0.707, -0.707],
    ['E', 0.707, 0.707],
    ['S', -0.707, 0.707],
    ['W', -0.707, -0.707],
  ]
  for (const [ch, dx, dy] of dirs) {
    ctx.fillStyle = ch === 'N' ? '#ddaa44' : '#b8b0a0'
    ctx.fillText(ch, R + dx * cr, R + dy * cr)
  }
}
