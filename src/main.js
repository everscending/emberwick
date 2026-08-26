import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { toonVertexColored } from './materials.js'
import { groundHeight, groundSlope, walkableHeight, WATER_LEVEL } from './ground.js'
import { updateFlora } from './flora.js'
import { buildWorld, updateRegions, restoreGreatEmber } from './regions.js'
import { createMinimap, updateMinimap } from './minimap.js'
import { updateGates } from './gates.js'
import { endFrame, pressed } from './input.js'
import { stats, createPlayer, updatePlayer, syncProgression } from './player.js'
import { createHUD, updateHUD, setObjective } from './hud.js'
import { createNPC, updateNPCs } from './npc.js'
import { updateProps } from './props.js'
import { currentObjective, elderDialogue, hermitDialogue, millieDialogue, tamDialogue, questState } from './quests.js'
import { createInventoryUI, toggleInventory, isInventoryOpen, itemCount, inventorySnapshot, restoreInventory } from './inventory.js'
import { setupStoneCircle, stoneCircleSnapshot, restoreStoneCircle } from './circle.js'
import { setupRuins, ruinsSnapshot, restoreRuins } from './ruins.js'
import { setupKeep, updateKeep, keepSnapshot, restoreKeep } from './keep.js'
import { spawnSlime, spawnThornback, spawnDrownedSentinel, spawnAshKnight, updateEnemies, restoreEnemyProgress, bossSnapshot, restoreBoss } from './enemies.js'
import { createDialogueUI, updateDialogue, isDialogueOpen, advanceDialogue, say } from './dialogue.js'
import { createInteractUI, updateInteract, hidePrompt } from './interact.js'
import { createShrine, scatterEnvironment, updateWorld, createAmbient, updateAmbient } from './world.js'
import { createHelpUI, toggleHelp, isHelpOpen } from './help.js'
import { createEndingUI, showEnding, isEndingOpen } from './ending.js'
import { createDamageDebugUI, toggleDamageDebug, isDamageDebugOpen, updateDamageDebug } from './debugfx.js'
import { createTitleScreen, isTitleOpen, readSave, writeSave, clearSave } from './save.js'

const uiConfirmSound = new Audio('/assets/audio/ui-confirm.mp3')
uiConfirmSound.preload = 'auto'
uiConfirmSound.volume = 0.45
function playUiConfirm() {
  uiConfirmSound.currentTime = 0
  uiConfirmSound.play().catch(() => {})
}
document.addEventListener('click', event => {
  if (event.target.closest?.('button')) playUiConfirm()
})

// --- renderer / scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
document.body.appendChild(renderer.domElement)

// warm dusk: the world lit by a dying flame
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x2a2230)
scene.fog = new THREE.Fog(0x2a2230, 32, 72) // warm violet dusk haze

// --- isometric-style camera ---
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200)
const CAM_OFFSET = new THREE.Vector3(11.2, 14.4, 11.2)

// --- lights ---
const hemi = new THREE.HemisphereLight(0x8a93c4, 0x3a2f28, 0.75)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffd9a8, 1.35)
sun.position.set(20, 30, 10)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = sun.shadow.camera.bottom = -45
sun.shadow.camera.right = sun.shadow.camera.top = 45
scene.add(sun)
scene.add(sun.target) // shadow window follows the player across the big map

// --- ground: 220x220, vertex-painted by region, slope, and water line ---
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const sstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const groundGeo = new THREE.PlaneGeometry(220, 220, 160, 160)
{
  const pos = groundGeo.attributes.position
  const colors = []
  const c = new THREE.Color()
  const meadow = new THREE.Color(0x3d6339)
  const meadowB = new THREE.Color(0x4d7a42)
  const forest = new THREE.Color(0x2a4d2e)
  const ruins = new THREE.Color(0x4a6b58)
  const ash = new THREE.Color(0x55504a)
  const rock = new THREE.Color(0x5f5a4e)
  const sand = new THREE.Color(0x8a7a5a)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const wz = -pos.getY(i) // plane-local y -> world z
    const h = groundHeight(x, wz)
    pos.setZ(i, h)
    // base meadow mottling
    const n = Math.sin(x * 0.53 + 2) * Math.sin(wz * 0.47) * 0.5 + 0.5
    c.copy(meadow).lerp(meadowB, n * 0.6)
    // region moods
    c.lerp(forest, sstep(30, 48, -x)) // west woods darken
    c.lerp(ruins, sstep(38, 58, x)) // east goes mossy stone
    c.lerp(ash, sstep(50, 62, -wz)) // north plateau is ash
    // cliffsides read as bare rock, shores as sand
    c.lerp(rock, sstep(0.65, 1.1, groundSlope(x, wz)))
    c.lerp(sand, sstep(-0.15, -0.38, h))
    colors.push(c.r, c.g, c.b)
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  groundGeo.computeVertexNormals()
}
const ground = new THREE.Mesh(groundGeo, toonVertexColored())
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// --- water: one translucent plane; anywhere the terrain dips below it becomes stream or pool ---
const waterCold = new THREE.Color(0x2e6a8a)
const waterWarm = new THREE.Color(0x367fa3)
const waterEmissiveCold = new THREE.Color(0x0a2836)
const waterEmissiveWarm = new THREE.Color(0x0d3446)
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220),
  new THREE.MeshLambertMaterial({ color: waterCold, transparent: true, opacity: 0.72, emissive: waterEmissiveCold })
)
water.rotation.x = -Math.PI / 2
water.position.y = WATER_LEVEL
scene.add(water)

// --- player / HUD ---
const player = createPlayer(scene)
createHUD()
createDialogueUI()
createInteractUI()
createInventoryUI()
createHelpUI()
createEndingUI()
createMinimap()
createDamageDebugUI(scene, player)

createShrine(scene, -4, 4, player)
scatterEnvironment(scene)
buildWorld(scene)
setupStoneCircle(scene)
setupRuins(scene)
setupKeep(scene)
createShrine(scene, 44, 8, player) // ruins shrine past the broken bridge

createAmbient(scene)

createNPC(scene, { x: -8.6, z: 9.6, name: 'Elder Maren', robeColor: 0x664466, dialogue: elderDialogue })
createNPC(scene, { x: -80, z: 36, name: 'Hermit Fen', robeColor: 0x4a6b45, dialogue: hermitDialogue })
createNPC(scene, { x: 8.2, z: 8, name: 'Millie', robeColor: 0x7a5a3a, dialogue: millieDialogue })
createNPC(scene, { x: 4.5, z: -2.5, name: 'Tam', robeColor: 0x4a5a7a, dialogue: tamDialogue })
createShrine(scene, -84, 30, player) // forest shrine at the hermit's clearing
createShrine(scene, 0, -72, player) // Keep checkpoint before the glyph gate

// quest 1: the slimes that took the old well, south of the village
spawnSlime(scene, -10, 49, { respawn: false, questTarget: true })
spawnSlime(scene, -4, 54, { respawn: false, questTarget: true })
spawnSlime(scene, -11, 55, { respawn: false, questTarget: true })
spawnSlime(scene, -3, 49, { respawn: false, questTarget: true })
spawnSlime(scene, -14, 40) // stragglers on the road south
spawnSlime(scene, -2, 38)
// three two-enemy encounters along the required route: forest mouth → Fen → circle
spawnSlime(scene, -48, 8)
spawnThornback(scene, -53, 14)
spawnSlime(scene, -62, 27)
spawnThornback(scene, -68, 27)
spawnThornback(scene, -80, -6)
spawnSlime(scene, -78, -14)
// ruins prowlers
spawnSlime(scene, 52, 10)
spawnDrownedSentinel(scene, 60, -12)
spawnDrownedSentinel(scene, 74, -6)
spawnSlime(scene, 64, 20)
spawnDrownedSentinel(scene, 84, 8)

const whole = (value, fallback, min, max) => Number.isFinite(value) ? THREE.MathUtils.clamp(Math.round(value), min, max) : fallback
const number = (value, fallback, min, max) => Number.isFinite(value) ? THREE.MathUtils.clamp(value, min, max) : fallback
const object = (value) => value && typeof value === 'object' ? value : {}

function restorePosition(target, saved) {
  if (!Array.isArray(saved)) return
  const x = number(saved[0], target.x, -103, 103)
  const z = number(saved[2], target.z, -103, 103)
  target.set(x, walkableHeight(x, z), z)
}

function applyGameState(value) {
  const saved = object(value)
  const quests = object(saved.quests)
  for (const [key, max] of Object.entries({ q1: 2, q2: 3, q3: 2, q4: 2, shards: 2, slimesKilled: 4 })) {
    questState[key] = whole(quests[key], questState[key], 0, max)
  }

  stats.xp = whole(saved.stats?.xp, stats.xp, 0, 250)
  syncProgression()
  stats.hp = whole(saved.stats?.hp, stats.hpMax, 1, stats.hpMax)
  stats.stam = whole(saved.stats?.stam, stats.stamMax, 0, stats.stamMax)
  stats.flasks = whole(saved.stats?.flasks, stats.flaskMax, 0, stats.flaskMax)
  stats.abilities.highJump = Boolean(saved.stats?.abilities?.highJump) || questState.q2 === 3

  restoreInventory(object(saved.items))
  restorePosition(player.group.position, saved.player?.position)
  restorePosition(player.spawnPoint, saved.player?.shrine)
  restoreStoneCircle(object(saved.circle), scene)
  restoreRuins(object(saved.ruins), scene)
  restoreKeep(object(saved.keep))
  restoreEnemyProgress()

  if (questState.q4 === 2 || saved.ending) {
    questState.q4 = 2
    restoreGreatEmber()
    scene.background.setHex(0x4b2d2c)
    scene.fog.color.setHex(0x4b2d2c)
  }
}

function gameSnapshot() {
  return {
    stats: { hp: stats.hp, stam: stats.stam, flasks: stats.flasks, xp: stats.xp, abilities: { highJump: stats.abilities.highJump } },
    quests: { ...questState },
    items: inventorySnapshot(),
    player: { position: player.group.position.toArray(), shrine: player.spawnPoint.toArray() },
    circle: stoneCircleSnapshot(),
    ruins: ruinsSnapshot(),
    keep: keepSnapshot(),
    boss: bossSnapshot(),
    ending: questState.q4 === 2,
  }
}

let gameStarted = false
let bossSpawned = false

function persist() {
  if (!gameStarted || player.state === 'dead') return
  writeSave(gameSnapshot())
}

function finishBoss() {
  questState.q4 = 2
  restoreGreatEmber()
  scene.background.setHex(0x4b2d2c)
  scene.fog.color.setHex(0x4b2d2c)
  persist()
  say(
    [
      { name: 'Ash Knight', text: 'I kept it alive so long… I had forgotten what warmth was.' },
      { text: 'The two shards lift from my satchel. For one breath, the whole Keep holds still.' },
      { text: 'Then the Great Ember catches — not like a weapon, but like a hearth.' },
    ],
    () => showEnding(itemCount('sketch') >= 3)
  )
}

function startGame(saved, resetSave) {
  if (resetSave) clearSave()
  applyGameState(saved)
  if (questState.q4 < 2 && !bossSpawned) {
    bossSpawned = true
    spawnAshKnight(scene, 8, -87, finishBoss)
    restoreBoss(saved?.boss)
  }
  gameStarted = true
  persist()
}

createTitleScreen(readSave(), startGame)
setInterval(persist, 5000)
addEventListener('beforeunload', persist)
document.addEventListener('visibilitychange', () => { if (document.hidden) persist() })

// --- debug: ` = slow-mo, 1/2 = attacks, 3 = camera, 4/5 = regions, 6 = damage FX ---
let timeScale = 1
let attackLoop = -1
let closeCam = false

// --- post-processing: bloom makes embers, runes, and fireflies glow ---
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.7, 0.8))

// debug handle for QA (console: EW.player.group.position.set(x, 0, z))
window.EW = { player }

// --- loop ---
const clock = new THREE.Clock()

function tick() {
  const rawDt = Math.min(clock.getDelta(), 0.05)
  let dt = rawDt
  if (player.hitstop > 0) {
    player.hitstop -= rawDt
    dt = 0
  }

  if (pressed('Backquote')) timeScale = timeScale === 1 ? 0.15 : 1
  if (pressed('Digit1')) attackLoop = attackLoop === 0 ? -1 : 0
  if (pressed('Digit2')) attackLoop = attackLoop === 1 ? -1 : 1
  if (pressed('Digit3')) closeCam = !closeCam
  if (pressed('Digit4')) player.group.position.set(-72, groundHeight(-72, -18), -18)
  if (pressed('Digit5')) player.group.position.set(64, groundHeight(64, 2), 2)
  dt *= timeScale
  if (attackLoop >= 0 && player.state === 'move') {
    player.state = 'attack'
    player.stateTime = 0
    player.hitThisSwing.clear()
    player.comboIndex = attackLoop
  }

  let menuChanged = false
  if (pressed('Help') && !isTitleOpen() && !isDialogueOpen() && !isInventoryOpen() && !isDamageDebugOpen() && !isEndingOpen()) {
    toggleHelp()
    menuChanged = true
  }
  if (pressed('Escape') && isHelpOpen()) {
    toggleHelp()
    menuChanged = true
  }
  if (pressed('Digit6') && !isTitleOpen() && !isDialogueOpen() && !isInventoryOpen() && !isHelpOpen() && !isEndingOpen()) {
    toggleDamageDebug()
    menuChanged = true
  }
  if (pressed('Escape') && isDamageDebugOpen()) {
    toggleDamageDebug()
    menuChanged = true
  }
  if (pressed('Tab') && !isTitleOpen() && !isDialogueOpen() && !isHelpOpen() && !isDamageDebugOpen()) {
    toggleInventory()
    menuChanged = true
  }
  if (menuChanged) playUiConfirm()

  if (isTitleOpen()) {
    hidePrompt()
  } else if (isDamageDebugOpen()) {
    hidePrompt()
    updatePlayer(player, dt)
  } else if (menuChanged || isInventoryOpen() || isHelpOpen() || isEndingOpen()) {
    hidePrompt() // world freezes while a panel is open
  } else if (isDialogueOpen()) {
    // world freezes while text is up
    hidePrompt()
    if (pressed('Space')) {
      advanceDialogue(true)
    } else if (pressed('KeyE') || pressed('Mouse0')) {
      advanceDialogue()
    }
  } else {
    updatePlayer(player, dt)
    if (player.state !== 'dead') {
      updateGates(player, clock.elapsedTime)
      updateEnemies(scene, player, dt)
      updateInteract(player)
    }
  }
  updateDialogue(dt)
  updateWorld(clock.elapsedTime)
  updateAmbient(clock.elapsedTime, player.group.position.x, player.group.position.z)
  water.position.y = WATER_LEVEL + Math.sin(clock.elapsedTime * 0.7) * 0.03 // gentle lapping
  water.material.color.lerp(questState.shards >= 2 ? waterWarm : waterCold, 0.025)
  water.material.emissive.lerp(questState.shards >= 2 ? waterEmissiveWarm : waterEmissiveCold, 0.025)
  updateNPCs(clock.elapsedTime)
  updateFlora(clock.elapsedTime)
  updateRegions(clock.elapsedTime, questState.shards)
  updateKeep(dt)
  updateProps(clock.elapsedTime)
  updateDamageDebug(rawDt, stats.hp, stats.hpMax)
  setObjective(currentObjective())
  updateMinimap(player, clock.elapsedTime)
  updateHUD(stats)

  sun.position.copy(player.group.position).add(new THREE.Vector3(20, 30, 10))
  sun.target.position.copy(player.group.position)

  const camOff = closeCam ? CAM_OFFSET.clone().multiplyScalar(0.4) : CAM_OFFSET
  camera.position.copy(player.group.position).add(camOff)
  camera.lookAt(player.group.position)
  if (player.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * player.shake
    camera.position.y += (Math.random() - 0.5) * player.shake
    player.shake = Math.max(0, player.shake - rawDt * 0.9)
  }

  composer.render()
  endFrame()
  requestAnimationFrame(tick)
}
tick()

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})
