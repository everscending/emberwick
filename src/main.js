import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { toonVertexColored } from './materials.js'
import { groundHeight, groundSlope, WATER_LEVEL } from './ground.js'
import { updateFlora } from './flora.js'
import { buildWorld, updateRegions, restoreGreatEmber } from './regions.js'
import { createMinimap, updateMinimap } from './minimap.js'
import { updateGates } from './gates.js'
import { endFrame, pressed } from './input.js'
import { stats, createPlayer, updatePlayer } from './player.js'
import { createHUD, updateHUD, setObjective } from './hud.js'
import { createNPC, updateNPCs, cycler } from './npc.js'
import { updateProps } from './props.js'
import { currentObjective, elderDialogue, hermitDialogue, questState } from './quests.js'
import { createInventoryUI, toggleInventory, isInventoryOpen, itemCount } from './inventory.js'
import { setupStoneCircle } from './circle.js'
import { setupRuins } from './ruins.js'
import { setupKeep, updateKeep } from './keep.js'
import { spawnSlime, spawnThornback, spawnDrownedSentinel, spawnAshKnight, updateEnemies } from './enemies.js'
import { createDialogueUI, updateDialogue, isDialogueOpen, advanceDialogue, say } from './dialogue.js'
import { createInteractUI, updateInteract, hidePrompt } from './interact.js'
import { createShrine, scatterEnvironment, updateWorld, createAmbient, updateAmbient } from './world.js'
import { createHelpUI, toggleHelp, isHelpOpen } from './help.js'
import { createEndingUI, showEnding, isEndingOpen } from './ending.js'
import { createDamageDebugUI, toggleDamageDebug, isDamageDebugOpen, updateDamageDebug } from './debugfx.js'

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
const CAM_OFFSET = new THREE.Vector3(14, 18, 14)

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
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220),
  new THREE.MeshLambertMaterial({ color: 0x2e6a8a, transparent: true, opacity: 0.72, emissive: 0x0a2836 })
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
spawnAshKnight(scene, 8, -87, () => {
  questState.q4 = 2
  restoreGreatEmber()
  scene.background.setHex(0x4b2d2c)
  scene.fog.color.setHex(0x4b2d2c)
  say(
    [
      { name: 'Ash Knight', text: 'I kept it alive so long… I had forgotten what warmth was.' },
      { text: 'The two shards lift from my satchel. For one breath, the whole Keep holds still.' },
      { text: 'Then the Great Ember catches — not like a weapon, but like a hearth.' },
    ],
    () => showEnding(itemCount('sketch') >= 3)
  )
})
createShrine(scene, 44, 8, player) // ruins shrine past the broken bridge

createAmbient(scene)

createNPC(scene, { x: -8.6, z: 9.6, name: 'Elder Maren', robeColor: 0x664466, dialogue: elderDialogue })
createNPC(scene, { x: -80, z: 36, name: 'Hermit Fen', robeColor: 0x4a6b45, dialogue: hermitDialogue })
createNPC(scene, {
  x: 8.2, z: 8, name: 'Millie', robeColor: 0x7a5a3a,
  dialogue: cycler('Millie', [
    'You cleared the well? Bless your quick paws — I can wash linens again without something gnawing the bucket.',
    'My gran swore the stream runs down from the Keep itself. Said it used to run warm as bathwater.',
    'Mind the woods, little knight. Fen’s been out there alone so long he talks to stones. …They say the stones answer.',
  ]),
})
createNPC(scene, {
  x: 4.5, z: -2.5, name: 'Tam', robeColor: 0x4a5a7a,
  dialogue: cycler('Tam', [
    'That gloom sitting on the north ridge? Been there a year. That’s not weather, friend.',
    'If you make it across what’s left of the bridge, mind the pools. They hold the sky a little too well.',
    'We keep the windows lit for you. Someone out there ought to see a warm thing now and then.',
  ]),
})
createShrine(scene, -84, 30, player) // forest shrine at the hermit's clearing
createShrine(scene, 0, -72, player) // Keep checkpoint before the glyph gate

// quest 1: the slimes that took the old well, south of the village
spawnSlime(scene, -10, 49, { respawn: false, questTarget: true })
spawnSlime(scene, -4, 54, { respawn: false, questTarget: true })
spawnSlime(scene, -11, 55, { respawn: false, questTarget: true })
spawnSlime(scene, -3, 49, { respawn: false, questTarget: true })
spawnSlime(scene, -14, 40) // stragglers on the road south
spawnSlime(scene, -2, 38)
// forest dwellers along the quest routes
spawnSlime(scene, -48, 8)
spawnThornback(scene, -62, 30)
spawnSlime(scene, -74, 24)
spawnThornback(scene, -64, 2)
spawnThornback(scene, -80, -6)
spawnSlime(scene, -70, -12)
// ruins prowlers
spawnSlime(scene, 52, 10)
spawnDrownedSentinel(scene, 60, -12)
spawnDrownedSentinel(scene, 74, -6)
spawnSlime(scene, 64, 20)
spawnDrownedSentinel(scene, 84, 8)

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
  if (pressed('Digit4')) player.group.position.set(-82, groundHeight(-82, 32), 32)
  if (pressed('Digit5')) player.group.position.set(46, groundHeight(46, 10), 10)
  dt *= timeScale
  if (attackLoop >= 0 && player.state === 'move') {
    player.state = 'attack'
    player.stateTime = 0
    player.hitThisSwing.clear()
    player.comboIndex = attackLoop
  }

  let menuChanged = false
  if (pressed('Help') && !isDialogueOpen() && !isInventoryOpen() && !isDamageDebugOpen() && !isEndingOpen()) {
    toggleHelp()
    menuChanged = true
  }
  if (pressed('Escape') && isHelpOpen()) {
    toggleHelp()
    menuChanged = true
  }
  if (pressed('Digit6') && !isDialogueOpen() && !isInventoryOpen() && !isHelpOpen() && !isEndingOpen()) {
    toggleDamageDebug()
    menuChanged = true
  }
  if (pressed('Escape') && isDamageDebugOpen()) {
    toggleDamageDebug()
    menuChanged = true
  }
  if (pressed('Tab') && !isDialogueOpen() && !isHelpOpen() && !isDamageDebugOpen()) {
    toggleInventory()
    menuChanged = true
  }

  if (isDamageDebugOpen()) {
    hidePrompt()
    updatePlayer(player, dt)
  } else if (menuChanged || isInventoryOpen() || isHelpOpen() || isEndingOpen()) {
    hidePrompt() // world freezes while a panel is open
  } else if (isDialogueOpen()) {
    // world freezes while text is up
    hidePrompt()
    if (pressed('Space')) advanceDialogue(true)
    else if (pressed('KeyE') || pressed('Mouse0')) advanceDialogue()
  } else {
    updatePlayer(player, dt)
    updateGates(player, clock.elapsedTime)
    updateEnemies(scene, player, dt)
    updateInteract(player)
  }
  updateDialogue(dt)
  updateWorld(clock.elapsedTime)
  updateAmbient(clock.elapsedTime, player.group.position.x, player.group.position.z)
  water.position.y = WATER_LEVEL + Math.sin(clock.elapsedTime * 0.7) * 0.03 // gentle lapping
  updateNPCs(clock.elapsedTime)
  updateFlora(clock.elapsedTime)
  updateRegions(clock.elapsedTime)
  updateKeep(dt)
  updateProps(clock.elapsedTime)
  updateDamageDebug(rawDt)
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
