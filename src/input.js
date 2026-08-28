export const keys = {}
const justPressed = new Set()
let jumpButton
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

function pressInput(code) {
  justPressed.add(code)
  if (code === 'Space' || code === 'Mouse2') justPressed.add('Jump')
  keys[code] = true
}

export function setJumpControlUnlocked(unlocked, animate = false) {
  if (!jumpButton) return
  jumpButton.classList.toggle('unlocked', unlocked)
  jumpButton.classList.toggle('unlocking', unlocked && animate)
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

function bindTouchAction(button, code) {
  let activePointer = null
  button.addEventListener('pointerdown', (event) => {
    if (activePointer !== null) return
    event.preventDefault()
    activePointer = event.pointerId
    button.setPointerCapture(event.pointerId)
    pressInput(code)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, (event) => {
      if (event.pointerId !== activePointer) return
      activePointer = null
      keys[code] = false
    })
  }
  for (const type of ['selectstart', 'dragstart', 'contextmenu']) {
    button.addEventListener(type, (event) => event.preventDefault())
  }
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
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
#touch-actions { position:fixed; right:33px; bottom:196px; z-index:30; display:none; width:134px; height:60px;
  flex-direction:row; justify-content:center; gap:14px; touch-action:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
.touch-action { position:relative; width:60px; height:60px; padding:0; border:2px solid rgba(255,210,130,.65); border-radius:50%;
  color:#ffe0a0; background:radial-gradient(circle at 38% 32%,rgba(117,77,53,.96),rgba(30,20,29,.94) 72%);
  box-shadow:inset 0 0 12px rgba(255,210,130,.13),0 4px 14px rgba(0,0,0,.5); font:34px/1 Georgia,serif;
  overflow:visible; touch-action:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent; }
.touch-action:active { transform:scale(.92); background:radial-gradient(circle at 38% 32%,rgba(169,102,53,.98),rgba(46,27,31,.96) 72%); }
.sword-icon, .pegasus-icon { display:block; width:42px; height:42px; margin:auto; overflow:hidden; }
#touch-jump { display:none; }
#touch-jump.unlocked { display:block; }
#touch-jump.unlocking { animation:jump-unlock 1.15s cubic-bezier(.2,1.5,.35,1) both; }
#touch-jump.unlocking::before { content:''; position:absolute; inset:-10px; border:3px solid #ffd477; border-radius:50%; pointer-events:none;
  animation:jump-unlock-ring 1.15s ease-out both; }
#touch-jump.unlocking::after { content:'✦'; position:absolute; left:50%; top:50%; color:#fff3bc; font:18px/1 serif; pointer-events:none;
  text-shadow:-33px -17px #ffb34d,31px -22px #ffe49b,-30px 24px #fff0a6,34px 20px #ff9d38;
  animation:jump-unlock-sparks 1.15s ease-out both; }
@keyframes jump-unlock { 0% { opacity:0; transform:scale(.15) rotate(-28deg); } 48% { opacity:1; transform:scale(1.34) rotate(8deg); box-shadow:0 0 30px #ffad42; } 72% { transform:scale(.9) rotate(-3deg); } 100% { transform:scale(1) rotate(0); } }
@keyframes jump-unlock-ring { 0% { opacity:1; transform:scale(.2); } 75%,100% { opacity:0; transform:scale(1.45); } }
@keyframes jump-unlock-sparks { 0% { opacity:0; transform:translate(-50%,-50%) scale(.2) rotate(0); } 35% { opacity:1; } 100% { opacity:0; transform:translate(-50%,-50%) scale(1.5) rotate(100deg); } }
#rotate-phone { position:fixed; inset:0; z-index:200; display:none; flex-direction:column; align-items:center; justify-content:center; gap:10px;
  padding:28px; box-sizing:border-box; color:#f2e5c8; background:#0b0b12; text-align:center; font:18px Georgia,serif; }
#rotate-phone strong { color:#ffbd68; font-size:25px; }
@media (pointer:coarse) and (orientation:landscape) { #touch-pad { display:block; } #touch-actions { display:flex; } }
@media (pointer:coarse) and (orientation:landscape) and (max-height:350px) {
  #touch-actions { right:44px; width:112px; height:52px; gap:8px; }
  .touch-action { width:52px; height:52px; }
  .sword-icon, .pegasus-icon { width:36px; height:36px; }
}
@media (pointer:coarse) and (orientation:portrait) { #rotate-phone { display:flex; } }
body.title-open #touch-pad, body.title-open #touch-actions { visibility:hidden; }
`
  document.head.appendChild(style)

  const controls = document.createElement('div')
  controls.id = 'touch-pad'
  controls.setAttribute('role', 'group')
  controls.setAttribute('aria-label', 'Eight-direction movement control')
  controls.innerHTML = '<span id="touch-thumb" aria-hidden="true"></span>'
  bindTouchPad(controls)

  const actions = document.createElement('div')
  actions.id = 'touch-actions'
  actions.setAttribute('role', 'group')
  actions.setAttribute('aria-label', 'Combat controls')
  const sword = document.createElement('button')
  sword.type = 'button'
  sword.className = 'touch-action'
  sword.setAttribute('aria-label', 'Swing sword')
  sword.innerHTML = `<svg class="sword-icon" viewBox="0 0 64 64" aria-hidden="true">
    <path d="m18 43 31-33 9-4-4 10-31 32Z" fill="#dce4e8" stroke="#fff0bd" stroke-width="2" stroke-linejoin="round"/>
    <path d="m14 39 14 14" fill="none" stroke="#d7a64f" stroke-width="5" stroke-linecap="round"/>
    <path d="m20 48-10 10" fill="none" stroke="#7d4c2b" stroke-width="6" stroke-linecap="round"/>
    <circle cx="8" cy="59" r="3" fill="#d7a64f" stroke="#ffe2a0" stroke-width="1.5"/>
  </svg>`
  bindTouchAction(sword, 'Mouse0')
  const jump = document.createElement('button')
  jump.id = 'touch-jump'
  jump.type = 'button'
  jump.className = 'touch-action'
  jump.setAttribute('aria-label', 'Jump with Pegasus Boots')
  jump.innerHTML = `<svg class="pegasus-icon" viewBox="0 0 72 64" aria-hidden="true">
    <path d="M36 34C38 18 49 7 65 4c-3 9-9 16-17 21 7-4 13-6 19-5-5 10-15 16-29 18Z" fill="#d7a64f" stroke="#ffe2a0" stroke-width="2" stroke-linejoin="round"/>
    <path d="M38 33c8-6 15-14 21-23M40 35c9-4 16-9 22-14M37 29c4-7 10-14 16-18" fill="none" stroke="#8a5c2e" stroke-width="2" stroke-linecap="round"/>
    <path d="M29 9h18l-2 29c0 4 2 6 6 8l3 2v10H44v-4H14c-7 0-9-4-6-7l16-9 2-24c0-3 1-5 3-5Z" fill="#49434b" stroke="#f3d28c" stroke-width="2" stroke-linejoin="round"/>
    <path d="m23 37 22 1 6 8-29-3Z" fill="#8b5b35" stroke="#f3d28c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M8 50c2 3 4 4 8 4h28v4h10" fill="none" stroke="#d7a64f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M39 17h4M39 25h4M38 33h4" stroke="#d9dde0" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`
  jumpButton = jump
  jump.addEventListener('animationend', (event) => {
    if (event.animationName === 'jump-unlock') jump.classList.remove('unlocking')
  })
  bindTouchAction(jump, 'Jump')
  actions.append(sword, jump)

  const rotate = document.createElement('div')
  rotate.id = 'rotate-phone'
  rotate.setAttribute('role', 'status')
  rotate.innerHTML = '<strong>Rotate your phone, Flamekeeper</strong><span>This adventure needs a wider horizon.</span>'
  document.body.append(controls, actions, rotate)
}

if (typeof addEventListener !== 'undefined') {
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab') e.preventDefault() // Tab is the satchel, not browser focus
    if (!e.repeat) {
      pressInput(e.code)
      if (e.key === '?') justPressed.add('Help')
    }
    keys[e.code] = true
  })
  addEventListener('keyup', (e) => (keys[e.code] = false))
  addEventListener('mousedown', (e) => {
    pressInput('Mouse' + e.button)
  })
  addEventListener('mouseup', (e) => (keys['Mouse' + e.button] = false))
  let attackPointer = null
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.defaultPrevented || e.target.closest?.('#touch-pad, button') || attackPointer !== null) return
    e.preventDefault()
    attackPointer = e.pointerId
    pressInput('Mouse0')
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
  pressInput('Mouse2')
  if (!pressed('Jump')) throw new Error('Right click must trigger jump')
  console.log('Eight-direction touch and right-click jump check passed.')
}
