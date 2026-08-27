export const keys = {}
const justPressed = new Set()

// the browser eats keyup events when focus is lost (context menu, alt-tab),
// which would leave movement keys stuck down forever
function releaseAll() {
  for (const k in keys) keys[k] = false
}

function bindTouchButton(button) {
  const setDown = (down) => {
    keys[button.dataset.key] = down
    button.setAttribute('aria-pressed', String(down))
  }
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    button.setPointerCapture(event.pointerId)
    setDown(true)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, () => setDown(false))
  }
  button.addEventListener('click', (event) => event.stopPropagation())
}

function createTouchControls() {
  const style = document.createElement('style')
  style.textContent = `
#touch-dpad { position:fixed; left:max(16px,env(safe-area-inset-left)); bottom:max(16px,env(safe-area-inset-bottom));
  z-index:30; display:none; grid-template:repeat(3,52px)/repeat(3,52px); gap:4px; touch-action:none; user-select:none; }
#touch-dpad button { border:1px solid rgba(255,210,130,.65); border-radius:14px; color:#fff2d2; background:rgba(24,15,24,.7);
  font:24px/1 system-ui,sans-serif; touch-action:none; -webkit-tap-highlight-color:transparent; }
#touch-dpad button:active { background:rgba(122,67,37,.9); transform:scale(.94); }
#touch-dpad [data-key="KeyW"] { grid-area:1/2; }
#touch-dpad [data-key="KeyA"] { grid-area:2/1; }
#touch-dpad [data-key="KeyD"] { grid-area:2/3; }
#touch-dpad [data-key="KeyS"] { grid-area:3/2; }
#rotate-phone { position:fixed; inset:0; z-index:200; display:none; flex-direction:column; align-items:center; justify-content:center; gap:10px;
  padding:28px; box-sizing:border-box; color:#f2e5c8; background:#0b0b12; text-align:center; font:18px Georgia,serif; }
#rotate-phone strong { color:#ffbd68; font-size:25px; }
@media (pointer:coarse) and (orientation:landscape) { #touch-dpad { display:grid; } }
@media (pointer:coarse) and (orientation:portrait) { #rotate-phone { display:flex; } }
body.title-open #touch-dpad { visibility:hidden; }
`
  document.head.appendChild(style)

  const controls = document.createElement('nav')
  controls.id = 'touch-dpad'
  controls.setAttribute('aria-label', 'Movement controls')
  controls.innerHTML = `
    <button type="button" data-key="KeyW" aria-label="Move up" aria-pressed="false">▲</button>
    <button type="button" data-key="KeyA" aria-label="Move left" aria-pressed="false">◀</button>
    <button type="button" data-key="KeyD" aria-label="Move right" aria-pressed="false">▶</button>
    <button type="button" data-key="KeyS" aria-label="Move down" aria-pressed="false">▼</button>`

  controls.querySelectorAll('button').forEach(bindTouchButton)

  const rotate = document.createElement('div')
  rotate.id = 'rotate-phone'
  rotate.setAttribute('role', 'status')
  rotate.innerHTML = '<strong>Rotate your phone, Flamekeeper</strong><span>This adventure needs a wider horizon.</span>'
  document.body.append(controls, rotate)
}

if (typeof addEventListener !== 'undefined') {
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab') e.preventDefault() // Tab is the satchel, not browser focus
    if (!e.repeat) {
      justPressed.add(e.code)
      if (e.key === '?') justPressed.add('Help')
    }
    keys[e.code] = true
  })
  addEventListener('keyup', (e) => (keys[e.code] = false))
  addEventListener('mousedown', (e) => {
    justPressed.add('Mouse' + e.button)
    keys['Mouse' + e.button] = true
  })
  addEventListener('mouseup', (e) => (keys['Mouse' + e.button] = false))
  addEventListener('blur', releaseAll)
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll())
  addEventListener('contextmenu', (e) => e.preventDefault())
  createTouchControls()
}

// true once per physical key press; call endFrame() after each update
export function pressed(code) {
  return justPressed.has(code)
}

export function endFrame() {
  justPressed.clear()
}

// Small runnable touch-state check: `node src/input.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const handlers = {}
  const button = {
    dataset: { key: 'KeyW' },
    addEventListener: (type, handler) => (handlers[type] = handler),
    setAttribute() {},
    setPointerCapture() {},
  }
  bindTouchButton(button)
  handlers.pointerdown({ preventDefault() {}, pointerId: 1 })
  if (!keys.KeyW) throw new Error('Touch down must press the movement key')
  handlers.pointerup()
  if (keys.KeyW) throw new Error('Touch up must release the movement key')
  console.log('Touch input check passed.')
}
