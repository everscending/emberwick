const css = `
#dlg {
  position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%);
  width: min(640px, 90vw); background: rgba(10, 10, 20, 0.92);
  border: 2px solid #665533; border-radius: 6px; padding: 14px 18px;
  font-family: Georgia, serif; color: #e8e0cc; display: none;
}
#dlg .name { color: #ddaa44; font-weight: bold; margin-bottom: 6px; font-size: 14px; }
#dlg .text { font-size: 17px; line-height: 1.4; min-height: 44px; }
#dlg .text.mono { font-style: italic; color: #aab4cc; }
#dlg .hint { text-align: right; font-size: 12px; color: #776; margin-top: 4px; }
@media (pointer:coarse) and (orientation:landscape) {
  #dlg { left:max(184px,calc(env(safe-area-inset-left) + 160px)); right:200px; bottom:max(16px,env(safe-area-inset-bottom));
    width:auto; max-height:calc(100vh - 32px); box-sizing:border-box; transform:none; padding:10px 12px; overflow-y:auto; }
  #dlg .text { min-height:38px; font-size:15px; line-height:1.3; }
}
`

const CHARS_PER_SEC = 40
const dialogueSound = typeof Audio === 'undefined' ? null : new Audio('/assets/audio/dialogue-voice.mp3')
if (dialogueSound) {
  dialogueSound.preload = 'auto'
  dialogueSound.volume = 0.18
  dialogueSound.loop = true
}

function startDialogueSound() {
  if (!dialogueSound) return
  dialogueSound.currentTime = 0
  dialogueSound.play().catch(() => {})
}

function stopDialogueSound() {
  if (!dialogueSound) return
  dialogueSound.pause()
  dialogueSound.currentTime = 0
}

let box, nameEl, textEl
let queue = []
let current = null
let revealed = 0

export function createDialogueUI() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)

  box = document.createElement('div')
  box.id = 'dlg'
  box.innerHTML = `<div class="name"></div><div class="text"></div><div class="hint">E: next</div>`
  document.body.appendChild(box)
  nameEl = box.querySelector('.name')
  textEl = box.querySelector('.text')
}

// lines: [{ name?, text }] — no name renders as inner monologue
export function say(lines, onComplete) {
  if (onComplete && lines.length) {
    const last = lines.length - 1
    lines = [...lines.slice(0, last), { ...lines[last], onComplete }]
  }
  queue.push(...lines)
  if (!current) next()
}

function next() {
  stopDialogueSound()
  const finished = current
  current = queue.shift() ?? null
  if (!current) {
    box.style.display = 'none'
  } else {
    revealed = 0
    box.style.display = 'block'
    nameEl.textContent = current.name ?? ''
    nameEl.style.display = current.name ? 'block' : 'none'
    textEl.className = current.name ? 'text' : 'text mono'
    textEl.textContent = ''
    if (current.text.length) startDialogueSound()
  }
  finished?.onComplete?.()
}

export function isDialogueOpen() {
  return current !== null
}

// Space only finishes the current line; E/click also advance once it is visible.
export function advanceDialogue(revealOnly = false) {
  if (!current) return
  if (revealed < current.text.length) {
    revealed = current.text.length
    textEl.textContent = current.text
    stopDialogueSound()
  }
  else if (!revealOnly) next()
}

export function updateDialogue(dt) {
  if (!current) return
  if (revealed < current.text.length) {
    revealed = Math.min(current.text.length, revealed + CHARS_PER_SEC * dt)
    textEl.textContent = current.text.slice(0, Math.floor(revealed))
    if (revealed === current.text.length) stopDialogueSound()
  }
}

// Small runnable input check: `node src/dialogue.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  if (dialogueSound !== null) throw new Error('Node dialogue check must not create browser audio')
  if (!css.includes('left:max(184px') || !css.includes('right:200px')) throw new Error('Mobile dialogue must leave space between movement controls and minimap')
  current = { text: 'Finish this sentence.' }
  textEl = { textContent: '' }
  revealed = 3
  advanceDialogue(true)
  if (revealed !== current.text.length || textEl.textContent !== current.text) throw new Error('Space must reveal the current dialogue line')
  advanceDialogue(true)
  if (!current) throw new Error('Space must not advance a completed dialogue line')
  let completed = false
  box = { style: {} }
  current = { text: 'Done.', onComplete: () => (completed = true) }
  revealed = current.text.length
  advanceDialogue()
  if (!completed) throw new Error('Dialogue completion callback must run after its final line')
  console.log('Dialogue check passed: Space reveals without advancing.')
}
