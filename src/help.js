const css = `
#help {
  position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
  background: rgba(5, 5, 12, 0.78); z-index: 20; font-family: Georgia, serif;
}
#help .panel {
  background: rgba(14, 12, 22, 0.98); border: 2px solid #665533; border-radius: 8px;
  padding: 22px 28px; color: #e8e0cc; width: min(620px, 92vw); max-height: 90vh; overflow: auto;
}
#help h2 { margin: 0 0 14px; color: #ddaa44; font-size: 22px; }
#help h3 { margin: 18px 0 7px; color: #e8d0a8; font-size: 15px; }
#help .controls { display: grid; grid-template-columns: max-content 1fr; gap: 7px 16px; font-size: 14px; }
#help kbd { min-width: 62px; text-align: center; padding: 2px 7px; border: 1px solid #665533; border-radius: 4px; background: #241f2d; font: 12px monospace; color: #ffe0a0; }
#help ul { margin: 0; padding-left: 20px; color: #aab4cc; font-size: 13px; }
#help button { float: right; margin-top: 16px; padding: 6px 12px; color: #e8e0cc; background: #2a2438; border: 1px solid #665533; border-radius: 4px; cursor: pointer; }
#help button:hover, #help button:focus-visible { border-color: #ddaa44; outline: none; }
#help-hint { position: fixed; left: 16px; bottom: 14px; color: #c9bda8; font: 13px Georgia, serif; text-shadow: 0 1px 4px #000; pointer-events: none; user-select: none; }
#help-hint kbd { padding: 1px 5px; border: 1px solid #665533; border-radius: 3px; color: #ffe0a0; background: rgba(20,17,27,.8); font: 12px monospace; }
body.title-open #help-hint { visibility: hidden; }
@media (pointer: coarse) { #help-hint { display: none; } }
`

let panel, open = false

export function createHelpUI() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)

  panel = document.createElement('div')
  panel.id = 'help'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'help-title')
  panel.innerHTML = `<div class="panel">
    <h2 id="help-title">How to Play</h2>
    <div class="controls">
      <kbd>W A S D</kbd><span>Move</span>
      <kbd>Left click</kbd><span>Slash; click again quickly to continue the combo</span>
      <kbd>Space / Right click</kbd><span>High Jump after receiving the Pegasus Boots</span>
      <kbd>Hold click</kbd><span>Charged Slash after reaching Level 4; hold after a normal swing</span>
      <kbd>Q</kbd><span>Drink an Ember Flask to restore 50 HP</span>
      <kbd>E</kbd><span>Interact, talk, or advance dialogue</span>
      <kbd>Tab</kbd><span>Open the satchel</span>
      <kbd>?</kbd><span>Open or close this help menu</span>
      <kbd>4 / 5</kbd><span>Debug: travel to the forest / ruins</span>
      <kbd>6</kbd><span>Debug: open the damage-effects lab</span>
    </div>
    <h3>Useful to know</h3>
    <ul>
      <li>Slimes award 10 XP, Drowned Sentinels 20, and most other enemies 25. Charged Slash unlocks at Level 4 (300 XP).</li>
      <li>The objective appears at the top-right. Its gold marker pulses on the minimap.</li>
      <li>Hearth shrines heal you, refill flasks, and become your respawn point.</li>
      <li>Roaming enemies return after two minutes; praying at a shrine resets them sooner. The four quest slimes at the village well stay defeated.</li>
      <li>Return the first Ember Shard to Hermit Fen to receive the Pegasus Boots. High Jump can cross the broken bridge.</li>
    </ul>
    <button type="button">Close (? / Esc)</button>
  </div>`
  panel.querySelector('button').onclick = toggleHelp
  document.body.appendChild(panel)

  const hint = document.createElement('div')
  hint.id = 'help-hint'
  hint.innerHTML = 'Press <kbd>?</kbd> for help'
  document.body.appendChild(hint)
}

export function toggleHelp() {
  open = !open
  panel.style.display = open ? 'flex' : 'none'
  if (open) panel.querySelector('button').focus()
}

export function isHelpOpen() {
  return open
}
