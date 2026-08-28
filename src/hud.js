import { LEVEL_XP, MAX_LEVEL, levelReward } from './progression.js'

const css = `
#hud { position: fixed; top: 16px; left: 16px; font-family: monospace; user-select: none; }
.bar { width: 220px; height: 14px; background: #222; border: 2px solid #111; margin-bottom: 6px; }
.bar > div { height: 100%; transition: width 0.1s; }
#hp > div { background: #c0392b; }
#stam > div { background: #27ae60; }
#xpbar { width: 220px; height: 5px; background: #222; border: 1px solid #111; margin-top: 7px; }
#xpbar > div { height: 100%; background: #ddaa44; transition: width 0.2s; }
#xptext { margin-top: 2px; color: #ddaa44; font: 11px Georgia, serif; text-shadow: 0 1px 3px #000; }
#flasks { display: flex; gap: 5px; margin-top: 2px; }
#flasks span { width: 12px; height: 16px; border-radius: 40% 40% 50% 50%; background: #333; border: 1px solid #111; }
#flasks span.full { background: #e67e22; }
#levelup { position: fixed; left: 50%; top: 18%; transform: translateX(-50%); display: none;
  padding: 10px 18px; border: 2px solid #ddaa44; border-radius: 6px; background: rgba(10,10,20,.9);
  color: #ffe0a0; font: 16px Georgia, serif; text-shadow: 0 1px 3px #000; }
#obj {
  position: fixed; top: 16px; right: 16px; max-width: 280px; text-align: right;
  font-family: Georgia, serif; font-size: 15px; color: #e8e0cc;
  text-shadow: 0 1px 3px #000; user-select: none;
}
#obj::before { content: '◆ '; color: #ddaa44; }
`

let hpFill, stamFill, xpFill, xpText, flaskRow, objEl, levelUpEl, lastLevel = 1, levelUpTimer

export function setObjective(text) {
  if (objEl.textContent !== text) objEl.textContent = text
}

export function createHUD() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)

  const hud = document.createElement('div')
  hud.id = 'hud'
  hud.innerHTML = `<div class="bar" id="hp"><div></div></div><div class="bar" id="stam"><div></div></div><div id="flasks"></div><div id="xpbar"><div></div></div><div id="xptext"></div>`
  document.body.appendChild(hud)

  hpFill = hud.querySelector('#hp > div')
  stamFill = hud.querySelector('#stam > div')
  xpFill = hud.querySelector('#xpbar > div')
  xpText = hud.querySelector('#xptext')
  flaskRow = hud.querySelector('#flasks')

  objEl = document.createElement('div')
  objEl.id = 'obj'
  document.body.appendChild(objEl)

  levelUpEl = document.createElement('div')
  levelUpEl.id = 'levelup'
  document.body.appendChild(levelUpEl)
}

export function updateHUD(stats) {
  // bar length grows with the max stat (2.2px per point); fill shows current
  hpFill.parentElement.style.width = stats.hpMax * 2.2 + 'px'
  stamFill.parentElement.style.width = stats.stamMax * 2.2 + 'px'
  hpFill.style.width = (stats.hp / stats.hpMax) * 100 + '%'
  stamFill.style.width = (stats.stam / stats.stamMax) * 100 + '%'

  if (flaskRow.children.length !== stats.flaskMax) {
    flaskRow.innerHTML = '<span></span>'.repeat(stats.flaskMax)
  }
  for (let i = 0; i < flaskRow.children.length; i++) {
    flaskRow.children[i].className = i < stats.flasks ? 'full' : ''
  }

  const floor = LEVEL_XP[stats.level - 1]
  const ceiling = LEVEL_XP[stats.level] ?? LEVEL_XP.at(-1)
  const maxed = stats.level === MAX_LEVEL
  xpFill.style.width = maxed ? '100%' : `${((stats.xp - floor) / (ceiling - floor)) * 100}%`
  xpText.textContent = maxed ? `Level ${MAX_LEVEL} · Maximum` : `Level ${stats.level} · ${stats.xp} / ${ceiling} XP`

  if (stats.level > lastLevel) {
    levelUpEl.textContent = `Level ${stats.level} — ${levelReward(stats.level)}`
    levelUpEl.style.display = 'block'
    clearTimeout(levelUpTimer)
    levelUpTimer = setTimeout(() => (levelUpEl.style.display = 'none'), 3500)
  }
  lastLevel = stats.level
}
