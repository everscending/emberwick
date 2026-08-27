const SAVE_KEY = 'emberwick.save.v1'

const TITLE_STOPS = [
  { x: -4, z: 4, panX: 7, panZ: -2, cameraX: 13, cameraY: 15, cameraZ: 13 },
  { x: -8, z: 52, panX: 5, panZ: -6, cameraX: 12, cameraY: 15, cameraZ: 13 },
  { x: -48, z: 8, panX: 6, panZ: 5, cameraX: 13, cameraY: 16, cameraZ: 12 },
  { x: -74, z: -18, panX: 2, panZ: 8, cameraX: 13, cameraY: 16, cameraZ: 13 },
  { x: -80, z: 36, panX: 7, panZ: -3, cameraX: 12, cameraY: 16, cameraZ: 13 },
  { x: 36, z: 2, panX: 8, panZ: 2, cameraX: 13, cameraY: 15, cameraZ: 13 },
  { x: 68, z: 2, panX: 8, panZ: 1, cameraX: 13, cameraY: 16, cameraZ: 13 },
  { x: 78, z: -14, panX: 3, panZ: 7, cameraX: 12, cameraY: 16, cameraZ: 13 },
  { x: 0, z: -72, panX: 6, panZ: -2, cameraX: 13, cameraY: 17, cameraZ: 13 },
  { x: 7, z: -84, panX: 7, panZ: 0, cameraX: 13, cameraY: 17, cameraZ: 13 },
].sort(() => Math.random() - 0.5)
const TITLE_STOP_SECONDS = 20
const TITLE_BLEND_SECONDS = 1.5

export function titleTourState(elapsed) {
  const leg = TITLE_STOP_SECONDS + TITLE_BLEND_SECONDS
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
  const phase = time % leg
  const current = Math.floor(time / leg) % TITLE_STOPS.length
  if (phase < TITLE_STOP_SECONDS) return { stop: TITLE_STOPS[current], index: current, pan: phase / TITLE_STOP_SECONDS }
  const index = (current + 1) % TITLE_STOPS.length
  return { stop: TITLE_STOPS[index], index, pan: 0 }
}

export function readSave(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(SAVE_KEY))
    return value?.version === 1 && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export function writeSave(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify({ ...state, version: 1 }))
    return true
  } catch {
    return false
  }
}

export function clearSave(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(SAVE_KEY)
    return true
  } catch {
    return false
  }
}

let open = true

export function createTitleScreen(saved, onStart) {
  const style = document.createElement('style')
  style.textContent = `
#title-screen { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center;
  overflow:hidden; color:#f2e5c8; background:transparent; font-family:Georgia,serif; }
#title-screen .panel { position:relative; z-index:1; width:min(860px,94vw); text-align:center; }
#title-screen .logo-lockup { position:relative; overflow:hidden; aspect-ratio:1280/410; margin:0; }
#title-screen .logo-image { position:absolute; inset:0; width:100%; transform:translateY(-21.25%); }
#title-screen .title-flame { position:absolute; left:74.15%; top:34.5%; width:4.2%; aspect-ratio:.52;
  transform:translate(-50%,-100%); transform-origin:50% 100%; filter:drop-shadow(0 0 6px #ffb52e) drop-shadow(0 0 15px #ff4b16);
  animation:title-flame-flicker .16s infinite alternate ease-in-out; }
#title-screen .title-flame::before { content:''; position:absolute; inset:0; clip-path:polygon(50% 0,66% 25%,80% 48%,73% 76%,54% 100%,30% 91%,17% 65%,29% 35%);
  background:radial-gradient(ellipse at 50% 78%,#fffbd0 0 11%,#ffd75d 29%,#ff7a18 58%,#d9320d 78%,transparent 80%);
  animation:title-flame-shape .24s infinite alternate ease-in-out; }
#title-screen .title-flame::after { content:''; position:absolute; left:34%; right:34%; bottom:4%; height:48%; border-radius:50% 50% 45% 45%;
  background:linear-gradient(#fff4a0,#fff 70%,#7bc7ff); filter:blur(.3px); animation:title-flame-core .18s infinite alternate ease-in-out; }
#title-screen .title-sparks { position:absolute; left:74.15%; top:13%; width:3px; height:3px; border-radius:50%; background:#ffd36a;
  box-shadow:-8px 18px #ff8a27,7px 31px #ffc248; animation:title-sparks 1.4s infinite ease-out; }
#title-screen .tagline { width:min(620px,90vw); margin:4px auto 26px; color:#e4d8e8; font-size:16px; text-shadow:0 2px 8px #000; }
#title-screen .primary { display:grid; width:min(620px,90vw); margin:auto; gap:9px; }
#title-screen .primary { grid-template-columns:1fr 1fr; }
#title-screen button { min-height:44px; padding:9px 12px; color:#f2e5c8; background:#261b22; border:1px solid #8b6844; border-radius:5px; font:15px Georgia,serif; cursor:pointer; }
#title-screen button:hover,#title-screen button:focus-visible { outline:none; border-color:#ffbd68; background:#38252a; }
#title-screen button:disabled { opacity:.38; cursor:not-allowed; }
body.title-open #hud,body.title-open #obj,body.title-open>canvas:not(:first-of-type) { visibility:hidden; }
#title-screen .scene-blend { position:absolute; inset:0; width:100%; height:100%; opacity:0; pointer-events:none; }
@keyframes title-flame-flicker { to { transform:translate(-50%,-100%) rotate(2deg) scale(.92,1.08); filter:drop-shadow(0 0 8px #ffd456) drop-shadow(0 0 18px #ff5217); } }
@keyframes title-flame-shape { to { clip-path:polygon(54% 0,72% 30%,75% 51%,68% 78%,48% 100%,25% 88%,20% 61%,36% 34%); transform:skewX(-4deg); } }
@keyframes title-flame-core { to { transform:translateX(10%) scale(.86,1.12); opacity:.86; } }
@keyframes title-sparks { from { transform:translateY(42px) scale(1); opacity:0; } 18% { opacity:1; } to { transform:translate(5px,-18px) scale(.2); opacity:0; } }
@media (prefers-reduced-motion:reduce) { #title-screen .title-flame,#title-screen .title-flame::before,#title-screen .title-flame::after,#title-screen .title-sparks { animation:none; } }
@media (max-width:540px) { #title-screen .primary { grid-template-columns:1fr; } }
`
  document.head.appendChild(style)
  const panel = document.createElement('div')
  panel.id = 'title-screen'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.innerHTML = `<div class="panel"><h1 class="logo-lockup"><img class="logo-image" src="/assets/emberwick-logo-no-flame.png" alt="EMBERWICK"><span class="title-flame" aria-hidden="true"></span><span class="title-sparks" aria-hidden="true"></span></h1><div class="tagline">Carry the last warmth home.</div><div class="primary"><button data-choice="continue" ${saved ? '' : 'disabled'}>Continue</button><button data-choice="new">New Game</button></div></div>`
  document.body.classList.add('title-open')
  document.body.appendChild(panel)
  panel.querySelectorAll('button:not(:disabled)').forEach((button) => {
    button.onclick = () => {
      const choice = button.dataset.choice
      panel.remove()
      document.body.classList.remove('title-open')
      open = false
      onStart(choice === 'continue' ? saved : null, choice !== 'continue')
    }
  })
  panel.querySelector(saved ? '[data-choice="continue"]' : '[data-choice="new"]').focus()
}

export function isTitleOpen() {
  return open
}

// Small runnable storage check: `node src/save.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
  if (!writeSave({ quests: { q1: 2 } }, storage) || readSave(storage).quests.q1 !== 2) throw new Error('Save must round-trip through storage')
  storage.setItem(SAVE_KEY, '{broken')
  const start = titleTourState(0)
  const blend = titleTourState(20)
  const next = titleTourState(21.5)
  if (readSave(storage) !== null || start.stop === next.stop || blend.stop !== next.stop || blend.pan !== 0 || next.pan !== 0) throw new Error('Save fallback and title tour timing must remain stable')
  console.log(`Save check passed: storage fallback and ${TITLE_STOPS.length}-stop, 20-second title tour timing.`)
}
