const DEFS = {
  shard: { name: 'Ember Shard', desc: 'A fragment of the Great Ember. Warm as a heartbeat.' },
  pegasusBoots: { name: 'Pegasus Boots', desc: 'Old winged boots that remember how to cross where roads fail.' },
  rustedKey: { name: 'Rusted Key', desc: 'Old iron, teeth worn thin. Something in the village still answers to it.' },
  boneKey: { name: 'Bone Key', desc: 'Carved from something that walked. It hums near old doors.' },
  sketch: { name: 'Mural Sketch', desc: 'A glyph copied from the ruin walls. The Keep will ask for these.' },
}

const items = {} // id -> count

export function addItem(id, n = 1) {
  items[id] = (items[id] ?? 0) + n
  if (open) render()
}

export function hasItem(id) {
  return (items[id] ?? 0) > 0
}

export function itemCount(id) {
  return items[id] ?? 0
}

const css = `
#inv {
  position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
  background: rgba(5, 5, 12, 0.75); z-index: 10; font-family: Georgia, serif;
}
#inv .panel {
  background: rgba(14, 12, 22, 0.97); border: 2px solid #665533; border-radius: 8px;
  padding: 22px 28px; color: #e8e0cc; width: min(420px, 90vw);
}
#inv h2 { margin: 0 0 12px; color: #ddaa44; font-size: 20px; }
#inv .item { border: 1px solid #3a3348; border-radius: 5px; padding: 8px 10px; margin-bottom: 7px; font-size: 14px; }
#inv .item .nm { font-weight: bold; color: #e8d0a8; }
#inv .item .ds { font-size: 12px; color: #9aa; margin-top: 2px; }
#inv .empty { color: #776; font-style: italic; font-size: 14px; }
#inv .hint { text-align: right; font-size: 12px; color: #776; margin-top: 10px; }
`

let panel, open = false

export function createInventoryUI() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  panel = document.createElement('div')
  panel.id = 'inv'
  document.body.appendChild(panel)
}

function render() {
  const rows = Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => {
      const d = DEFS[id]
      return `<div class="item"><div class="nm">${d.name}${n > 1 ? ` ×${n}` : ''}</div><div class="ds">${d.desc}</div></div>`
    })
    .join('')
  panel.innerHTML = `<div class="panel"><h2>Satchel</h2>${rows || '<div class="empty">Nothing but pocket lint and purpose.</div>'}<div class="hint">Tab ▸ close</div></div>`
}

export function toggleInventory() {
  open = !open
  panel.style.display = open ? 'flex' : 'none'
  if (open) render()
}

export function isInventoryOpen() {
  return open
}
