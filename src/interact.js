import { pressed } from './input.js'

const css = `
#prompt {
  position: fixed; left: 50%; bottom: 130px; transform: translateX(-50%);
  font-family: monospace; font-size: 15px; color: #e8e0cc;
  background: rgba(10, 10, 20, 0.8); border: 1px solid #665533;
  border-radius: 4px; padding: 5px 12px; display: none; user-select: none;
}
`

const interactables = []
let promptEl

export function createInteractUI() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  promptEl = document.createElement('div')
  promptEl.id = 'prompt'
  document.body.appendChild(promptEl)
}

// { position: Vector3, radius?, prompt, onInteract } -> handle with remove()
export function addInteractable(it) {
  it.radius ??= 2.2
  interactables.push(it)
  return { remove: () => interactables.splice(interactables.indexOf(it), 1) }
}

export function updateInteract(player) {
  let best = null
  let bestDist = Infinity
  for (const it of interactables) {
    const d = it.position.distanceTo(player.group.position)
    if (d < it.radius && d < bestDist) {
      best = it
      bestDist = d
    }
  }

  if (best) {
    promptEl.textContent = `E — ${typeof best.prompt === 'function' ? best.prompt() : best.prompt}`
    promptEl.style.display = 'block'
    if (pressed('KeyE')) best.onInteract()
  } else {
    promptEl.style.display = 'none'
  }
}

export function hidePrompt() {
  promptEl.style.display = 'none'
}
