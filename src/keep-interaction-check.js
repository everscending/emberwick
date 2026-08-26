const listeners = {}
let renderedPrompt
globalThis.addEventListener = (type, handler) => (listeners[type] ??= []).push(handler)
globalThis.document = {
  hidden: false,
  addEventListener() {},
  head: { appendChild() {} },
  body: { appendChild(node) { if (node.id === 'prompt') renderedPrompt = node } },
  createElement: () => ({ style: {}, textContent: '' }),
}

const THREE = await import('three')
const { groundHeight } = await import('./ground.js')
const { addItem } = await import('./inventory.js')
const { createInteractUI, updateInteract } = await import('./interact.js')
const { setupKeep, keepSnapshot } = await import('./keep.js')
const { endFrame } = await import('./input.js')

createInteractUI()
setupKeep(new THREE.Scene())

const player = { group: { position: new THREE.Vector3() } }
player.group.position.set(8, groundHeight(8, -77.15), -77.15)
updateInteract(player)
if (!renderedPrompt.textContent.includes('Find all 3 Mural Sketches (0/3)')) {
  throw new Error(`Locked gate offers a false action: ${renderedPrompt.textContent}`)
}

addItem('sketch', 3)
function turnAt(x) {
  player.group.position.set(x, groundHeight(x, -77.15), -77.15)
  for (const handler of listeners.keydown) handler({ code: 'KeyE', key: 'e', repeat: false, preventDefault() {} })
  updateInteract(player)
  endFrame()
  for (const handler of listeners.keyup) handler({ code: 'KeyE' })
}

turnAt(8)
const afterFirst = keepSnapshot().values.join()
turnAt(8)
const afterSecond = keepSnapshot().values.join()
turnAt(6.55)
const afterLeft = keepSnapshot().values.join()
turnAt(9.45)
const afterRight = keepSnapshot().values.join()

if (afterFirst === afterSecond || afterSecond === afterLeft || afterLeft === afterRight) {
  throw new Error(`Glyph interaction locked after a turn: ${afterFirst} → ${afterSecond} → ${afterLeft} → ${afterRight}`)
}
console.log(`Glyph interaction remained active: ${afterFirst} → ${afterSecond} → ${afterLeft} → ${afterRight}`)
