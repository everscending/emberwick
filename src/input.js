export const keys = {}
const justPressed = new Set()
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
const TOUCH_DIRECTIONS = [
  ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'],
  ['KeyA'], ['KeyW', 'KeyA'], ['KeyW'], ['KeyW', 'KeyD'],
]

// the browser eats keyup events when focus is lost (context menu, alt-tab),
// which would leave movement keys stuck down forever
function releaseAll() {
  for (const k in keys) keys[k] = false
}

function setTouchDirection(dx, dy) {
  MOVE_KEYS.forEach((code) => (keys[code] = false))
  if (Math.hypot(dx, dy) < 12) return
  const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
  TOUCH_DIRECTIONS[sector].forEach((code) => (keys[code] = true))
}

function bindTouchPad(pad) {
  const thumb = pad.querySelector('#touch-thumb')
  let activePointer = null

  const move = (event) => {
    if (event.pointerId !== activePointer) return
    event.preventDefault()
    const rect = pad.getBoundingClientRect()
    const dx = event.clientX - rect.left - rect.width / 2
    const dy = event.clientY - rect.top - rect.height / 2
    const distance = Math.hypot(dx, dy)
    const scale = distance > 46 ? 46 / distance : 1
    thumb.style.transform = `translate3d(calc(-50% + ${dx * scale}px),calc(-50% + ${dy * scale}px),0)`
    setTouchDirection(dx, dy)
  }

  pad.addEventListener('pointerdown', (event) => {
    if (activePointer !== null) return
    activePointer = event.pointerId
    pad.setPointerCapture(event.pointerId)
    move(event)
  })
  pad.addEventListener('pointermove', move)
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    pad.addEventListener(type, (event) => {
      if (event.pointerId !== activePointer) return
      activePointer = null
      setTouchDirection(0, 0)
      thumb.style.transform = ''
    })
  }
  for (const type of ['selectstart', 'dragstart', 'contextmenu']) {
    pad.addEventListener(type, (event) => event.preventDefault())
  }
}

function createTouchControls() {
  const style = document.createElement('style')
  style.textContent = `
#touch-pad { position:fixed; left:max(18px,env(safe-area-inset-left)); bottom:max(18px,env(safe-area-inset-bottom)); z-index:30;
  display:none; width:152px; height:152px; border:2px solid rgba(255,210,130,.55); border-radius:50%; box-sizing:border-box;
  background:repeating-conic-gradient(from 22.5deg,rgba(255,210,130,.18) 0 1deg,transparent 1deg 45deg),rgba(24,15,24,.66);
  box-shadow:inset 0 0 24px rgba(0,0,0,.7),0 4px 20px rgba(0,0,0,.35); touch-action:none; user-select:none;
  -webkit-user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent; }
#touch-pad::after { content:''; position:absolute; inset:31px; border:1px solid rgba(255,210,130,.22); border-radius:50%; pointer-events:none; }
#touch-thumb { position:absolute; left:50%; top:50%; width:58px; height:58px; border:1px solid rgba(255,225,160,.8); border-radius:50%;
  transform:translate(-50%,-50%); background:radial-gradient(circle at 40% 35%,rgba(255,221,147,.75),rgba(122,67,37,.88) 65%);
  box-shadow:0 3px 10px rgba(0,0,0,.6),inset 0 0 8px rgba(255,235,190,.3); pointer-events:none; contain:layout paint;
  will-change:transform; backface-visibility:hidden; }
#rotate-phone { position:fixed; inset:0; z-index:200; display:none; flex-direction:column; align-items:center; justify-content:center; gap:10px;
  padding:28px; box-sizing:border-box; color:#f2e5c8; background:#0b0b12; text-align:center; font:18px Georgia,serif; }
#rotate-phone strong { color:#ffbd68; font-size:25px; }
@media (pointer:coarse) and (orientation:landscape) { #touch-pad { display:block; } }
@media (pointer:coarse) and (orientation:portrait) { #rotate-phone { display:flex; } }
body.title-open #touch-pad { visibility:hidden; }
`
  document.head.appendChild(style)

  const controls = document.createElement('div')
  controls.id = 'touch-pad'
  controls.setAttribute('role', 'group')
  controls.setAttribute('aria-label', 'Eight-direction movement control')
  controls.innerHTML = '<span id="touch-thumb" aria-hidden="true"></span>'
  bindTouchPad(controls)

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
  let attackPointer = null
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.defaultPrevented || e.target.closest?.('#touch-pad, button') || attackPointer !== null) return
    e.preventDefault()
    attackPointer = e.pointerId
    justPressed.add('Mouse0')
    keys.Mouse0 = true
  }, { passive: false })
  const releaseTouchAttack = (e) => {
    if (e.pointerId !== attackPointer) return
    attackPointer = null
    keys.Mouse0 = false
  }
  addEventListener('pointerup', releaseTouchAttack)
  addEventListener('pointercancel', releaseTouchAttack)
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

// Small runnable eight-direction check: `node src/input.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const cases = [
    [20, 0, 'KeyD'], [20, 20, 'KeyD,KeyS'], [0, 20, 'KeyS'], [-20, 20, 'KeyA,KeyS'],
    [-20, 0, 'KeyA'], [-20, -20, 'KeyA,KeyW'], [0, -20, 'KeyW'], [20, -20, 'KeyD,KeyW'],
  ]
  for (const [x, y, expected] of cases) {
    setTouchDirection(x, y)
    const actual = MOVE_KEYS.filter((code) => keys[code]).sort().join(',')
    if (actual !== expected) throw new Error(`Touch direction ${x},${y} produced ${actual}; expected ${expected}`)
  }
  setTouchDirection(0, 0)
  if (MOVE_KEYS.some((code) => keys[code])) throw new Error('Touch dead zone must release movement')
  console.log('Eight-direction touch input check passed.')
}
