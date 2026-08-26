const css = `
#ending {
  position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
  z-index: 40; background: radial-gradient(circle, rgba(116,53,24,.88), rgba(8,7,14,.97) 68%);
  color: #f2e5c8; font-family: Georgia, serif; text-align: center;
}
#ending .panel { width: min(600px, 88vw); }
#ending h1 { margin: 0; color: #ffbd68; font-size: clamp(38px, 8vw, 72px); letter-spacing: .12em; }
#ending h2 { margin: 8px 0 22px; color: #ffe1a6; font-size: 22px; font-weight: normal; }
#ending p { color: #c9bfd0; font-size: 16px; line-height: 1.6; }
#ending .credits { margin-top: 28px; color: #8f8498; font-size: 12px; letter-spacing: .08em; }
#ending button { margin-top: 24px; padding: 8px 16px; border: 1px solid #d8954b; border-radius: 4px; background: #261b22; color: #f2e5c8; cursor: pointer; }
`

let panel, open = false

export function createEndingUI() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  panel = document.createElement('div')
  panel.id = 'ending'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  document.body.appendChild(panel)
}

export function endingMemoryText(foundAllMurals) {
  return foundAllMurals
    ? 'The murals were not a warning about a monster. They remembered the knight who carried the flame alone—and can finally lay it down.'
    : 'The Ash Knight kneels. Whatever name the ruins once gave them is lost, but their long watch is over.'
}

export function showEnding(foundAllMurals) {
  const memory = endingMemoryText(foundAllMurals)
  panel.innerHTML = `<div class="panel"><h1>EMBERWICK</h1><h2>The Great Ember burns again.</h2><p>${memory}</p><p>Far below, warm water begins to run through the village stream.</p><div class="credits">GAME WEEK · THANK YOU FOR PLAYING</div><button type="button">Continue exploring</button></div>`
  panel.style.display = 'flex'
  open = true
  panel.querySelector('button').onclick = () => {
    panel.style.display = 'none'
    open = false
  }
  panel.querySelector('button').focus()
}

export function isEndingOpen() {
  return open
}

// Small runnable ending check: `node src/ending.js`
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  if (endingMemoryText(true) === endingMemoryText(false)) throw new Error('Ending must acknowledge the mural count')
  console.log('Ending check passed: complete and incomplete mural variants differ.')
}
