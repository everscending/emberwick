export const keys = {}
const justPressed = new Set()

// the browser eats keyup events when focus is lost (context menu, alt-tab),
// which would leave movement keys stuck down forever
function releaseAll() {
  for (const k in keys) keys[k] = false
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
}

// true once per physical key press; call endFrame() after each update
export function pressed(code) {
  return justPressed.has(code)
}

export function endFrame() {
  justPressed.clear()
}
