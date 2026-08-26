const SAVE_KEY = 'emberwick.save.v1'

export const CHAPTERS = [
  { id: 'q1', label: 'Quest 1 · Village Well', state: { quests: { q1: 1 }, player: { position: [-8, 0, 45] } } },
  { id: 'q2', label: 'Quest 2 · Whispering Forest', state: { stats: { xp: 150 }, quests: { q1: 2, q2: 0, slimesKilled: 4 }, player: { position: [-75, 0, 34], shrine: [-82.5, 0, 31.5] } } },
  { id: 'q3', label: 'Quest 3 · Sunken Ruins', state: { stats: { xp: 250, abilities: { highJump: true } }, quests: { q1: 2, q2: 3, q3: 0, shards: 1, slimesKilled: 4 }, items: { shard: 1, pegasusBoots: 1 }, player: { position: [36, 0, 2], shrine: [45.5, 0, 9.5] }, circle: { progress: 5, done: true } } },
  { id: 'q4', label: 'Quest 4 · Ashen Keep', state: { stats: { xp: 250, abilities: { highJump: true } }, quests: { q1: 2, q2: 3, q3: 2, q4: 0, shards: 2, slimesKilled: 4 }, items: { shard: 2, pegasusBoots: 1, sketch: 3 }, player: { position: [0, 0, -72], shrine: [1.5, 0, -70.5] }, circle: { progress: 5, done: true }, ruins: { solved: true, murals: [true, true, true], arrivalSeen: true } } },
  { id: 'boss', label: 'Final Boss · Ash Knight', state: { stats: { xp: 250, abilities: { highJump: true } }, quests: { q1: 2, q2: 3, q3: 2, q4: 1, shards: 2, slimesKilled: 4 }, items: { shard: 2, pegasusBoots: 1, sketch: 3 }, player: { position: [8, 0, -82], shrine: [1.5, 0, -70.5] }, circle: { progress: 5, done: true }, ruins: { solved: true, murals: [true, true, true], arrivalSeen: true }, keep: { values: [0, 1, 2], opening: true } } },
]

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
  color:#f2e5c8; background:radial-gradient(circle at 50% 38%,rgba(93,48,33,.94),rgba(8,7,14,.99) 67%); font-family:Georgia,serif; }
#title-screen .panel { width:min(620px,90vw); text-align:center; }
#title-screen h1 { margin:0; color:#ffbd68; font-size:clamp(48px,10vw,88px); letter-spacing:.14em; text-shadow:0 5px 24px #000; }
#title-screen .tagline { margin:4px 0 26px; color:#c9bfd0; font-size:16px; }
#title-screen .primary,#title-screen .chapters { display:grid; gap:9px; }
#title-screen .primary { grid-template-columns:1fr 1fr; }
#title-screen .chapters { grid-template-columns:repeat(2,1fr); margin-top:9px; }
#title-screen button { min-height:44px; padding:9px 12px; color:#f2e5c8; background:#261b22; border:1px solid #8b6844; border-radius:5px; font:15px Georgia,serif; cursor:pointer; }
#title-screen button:hover,#title-screen button:focus-visible { outline:none; border-color:#ffbd68; background:#38252a; }
#title-screen button:disabled { opacity:.38; cursor:not-allowed; }
#title-screen h2 { margin:24px 0 8px; color:#bca98c; font-size:13px; font-weight:normal; letter-spacing:.14em; text-transform:uppercase; }
#title-screen .hint { margin-top:18px; color:#756d79; font-size:11px; }
@media (max-width:540px) { #title-screen .primary,#title-screen .chapters { grid-template-columns:1fr; } }
`
  document.head.appendChild(style)
  const panel = document.createElement('div')
  panel.id = 'title-screen'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.innerHTML = `<div class="panel"><h1>EMBERWICK</h1><div class="tagline">Carry the last warmth home.</div><div class="primary"><button data-choice="continue" ${saved ? '' : 'disabled'}>Continue</button><button data-choice="new">New Game</button></div><h2>Chapter Select</h2><div class="chapters">${CHAPTERS.map(({ id, label }) => `<button data-choice="${id}">${label}</button>`).join('')}</div><div class="hint">Chapter presets replace the current autosave.</div></div>`
  document.body.appendChild(panel)
  panel.querySelectorAll('button:not(:disabled)').forEach((button) => {
    button.onclick = () => {
      const choice = button.dataset.choice
      const chapter = CHAPTERS.find(({ id }) => id === choice)
      panel.remove()
      open = false
      onStart(choice === 'continue' ? saved : chapter?.state ?? null, choice !== 'continue')
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
  if (readSave(storage) !== null || !CHAPTERS.some(({ id }) => id === 'boss')) throw new Error('Invalid saves must fail safely and boss chapter must exist')
  console.log('Save check passed: storage round-trip, invalid-data fallback, and boss preset.')
}
