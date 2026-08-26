# Game Week — Spec

**Deadline:** Thursday at midnight. **Demo:** playable in under 5 minutes. **Judging:** staff + student votes.

## Locked decisions

- Fantasy action RPG, Zelda/Tunic-inspired
- Browser, three.js, Vite build (multi-file source, standard `dist/` output; assets procedural)
- Isometric camera following the player, WASD movement
- Full combat: sword, High Jump, stamina, multiple enemy types, final boss
- Three-level XP progression: enemies award 25 XP; Level 2 at 150 XP; Level 3 at 250 XP unlocks Charged Slash
- One seamless handcrafted map (4 regions), regions gated by quests and High Jump
- Story via: NPC dialogue boxes, environmental storytelling, and the hero's inner monologue when examining clues
- Puzzles woven into quests — one per region past the tutorial:
  - Q2 Whispering Forest: stone circle — activate stones in an order hinted by environmental clues
  - Q3 Sunken Ruins: light-beam mirrors — rotate mirrors to route a beam onto a target
  - Q4 Ashen Keep: glyph gate — 3 rotating glyph rings; answers spread across the 3 murals (Mural Sketches in inventory are the answer sheet)
- Inventory: key items only, Tab panel, items auto-used at their lock via E. Deadline items: Ember Shards ×2 and Mural Sketches.
- Up to 4 quests to finish the game
- HP: bar starts at 100; fixed cap of 100 for the deadline build
- Healing: hearth shrines (one per region — full heal, flask refill, respawn point), Ember flasks (Q to drink, +50, carry 3), occasional +10 ember drops from enemies
- Stamina: fixed 100, regen 40/s after 0.5s pause; costs — High Jump 35, charged slash 50; basic swings free
- Damage: sword base 20; charged slash 2.5×
- Speed: fixed 8 u/s
- Enemy hits 10–35, boss ~40 (tune in playtest)
- Enemy progression: Slime (100 HP) teaches basic pressure; forest Thornback (140 HP) telegraphs a 20-damage line charge; ruins Drowned Sentinel (180 HP) telegraphs a 28-damage radial slam and long recovery.
- Praying at a hearth shrine resets living and defeated roaming enemies to full health at their original spawns. The four Q1 well slimes never respawn.
- Death: respawn at last shrine, world state kept
- Audio: procedural WebAudio — ambient music per region + SFX (no audio files)
- Save: localStorage
- Title screen with New Game + chapter select (preset saves) so the demo can jump to any quest, including the boss

## Decisions added during build (ad-hoc)

### Title & hero
- Game title: **EMBERWICK**. Story: the Great Ember is dying; gather 2 shards, defeat the Ash Knight at the Ashen Keep.
- Hero: **red panda knight** (not a fox — deliberate distance from Tunic). Chibi proportions, rust/cream fur, near-black paws with knuckle tufts, dark limbs, moss-green tunic, leather belt + gold buckle, deep-red cape, jointed ringed tail.
- **Right-handed**: sword in the right hand; shield was removed entirely (left hand is a free paw).
- Weapon: **dao** (Chinese single-edged saber) — curved flaring blade built from segments, disc guard, cord-wrapped hilt, gold ring pommel, red tassel.

### Controls (current)
- WASD move (screen-relative) · Left-click slash/chop combo · hold click after a swing = Charged Slash wind-up (Level 3) · Space High Jump (Pegasus Boots) · Q flask · E interact/advance dialogue · Tab inventory · ? help
- Debug (remove before ship): ` slow-mo, 1/2 loop slash/chop, 3 close camera
- Context menu suppressed in-game; all keys clear on window blur (stuck-walk fix)

### Combat feel
- Slash: anticipation → whip → recovery; horizontal blade enforced by a world-space override (joints animate for body language only). Combo alternates side slash / overhead chop (0.9s window).
- Swing time 0.42s; hit window matches strike frames; range 2.3
- Charged Slash: hold ≥0.5s after a swing, 50 stamina, 360° spin, 2.5× damage, range 2.6, hits all around
- Ash Knight: 360 HP; cycles a 32-damage sword sweep, 40-damage rushing charge, and 40-damage ember slam. High Jump avoids the charge/slam; recovery windows reward Charged Slash.
- Juice: blade trail ribbon, 60ms hit-stop, camera shake, enemy flash + squash-pop + knockback, slime death = gib splatter (gravity, ground stain) — no despawn-shrink
- Slimes are solid (push-apart) with contact damage at touch range

### Character animation systems
- Smooth 8-way turning: head leads (clamped ~40°), body eases after, shortest arc
- Idle: breathing, subtle weight sway, random head glances (1.5–4.5s) with slight tilt
- Blinks every 2–6s (0.13s squash, 20% double-blink), runs in all states
- Tail: 5-joint chain; curl tightness + lean drift slowly (never curls downward, never twitches); footfall-synced bounce wave travels tip-ward while walking
- Walk: counter-phase arm swing (sword arm damped), footstep bounce + forward lean, cape billow
- High Jump: Pegasus Boots launch the hero head-first into an airborne arc; he tucks mid-flight, then opens and compresses into the landing

### XP progression
- Every standard enemy awards 25 XP.
- Level 2 requires 150 XP / 6 kills. Intended pace: 4 mandatory well slimes plus 2 forest enemies.
- Level 3 requires 250 XP / 10 kills and unlocks Charged Slash. Intended pace: clearing the village/forest combat path before the ruins; players who skip fights unlock it later in the ruins.
- Level 3 is the cap for the deadline build. XP stops at 250.

### Rendering & world tech
- Toon (cel) shading everywhere, 3-step gradient; ACES filmic tone mapping; PCF soft shadows (2048 map); warm dusk palette; hemisphere + warm sun light; bloom (UnrealBloomPass) — embers/runes/fireflies glow
- Terrain: analytic height function (`ground.js`) shared by the displaced mesh and all entities/decor — nothing floats or sinks; spawn area flat (noise fades in past r=5)
- Collision: 2D circle colliders, push-out resolution, player + slimes resolve; trees/rocks/shrine/NPCs registered
- Flora (`flora.js`): instanced archetypes (pine, tall pine, blob; more per region later) with per-instance scale/rotation/tint + GPU vertex-shader wind (height-weighted, position-phased); instanced grass shares the wind. Regions pass spot lists.
- Environment: dirt path, rocks, fireflies, shrine (stepped base, runes, brazier, flame, rising sparks), Elder Maren (layered robe, silver hair, ember staff, breathing idle)

### Region art direction ("warmth drains as you progress")
- Village: the last warm place — bright meadow, flowers, blob trees, shrine glow, most fireflies; storybook-safe. To add: cottages with lit windows, chimney smoke.
- Village layout (user-directed): oriented around the hearth shrine at (-4,4) — a flagstone plaza with four cobbled roads radiating from it: east to the broken stream bridge, south to the old well, north toward the Ashen Keep road, west to the forest mouth. Roads stay clear of props (scatter passes exclude a 2.4u corridor); lamp posts only at plaza diagonals, spaced along roads on alternating sides, and at each cottage door. Cottages face the shrine from the quadrants.
- Whispering Forest: enchanted and dim — dense dark pines, winding gaps, mossy stone circle; hidden-things energy. To add: hermit hut, light shafts, faint glowing mushrooms.
- Sunken Ruins: drowned grandeur — mossy basin, broken columns, three mirror-still pools, pale dead trees; elegiac (murals carry the tragedy). To add: mirror puzzle, mural walls, pool mist.
- Ashen Keep: the dead end of the world — all ash and charcoal, burnt tree skeletons, the Great Ember a dull red coal, the only color. Ending reverses it: plateau floods with warm light.
- Stream = the life line from the dying north; green hugs its banks in every region. Emotional arc: warm → mysterious → sad → dead → reborn.

### World layout plan (agreed)
- One seamless ~220×220 plane (bounds ±105); region footprints: village center ~50, Whispering Forest west ~70, Sunken Ruins east ~65, Ashen Keep far north ~55 on a ridge
- Regions separated by cliff lines / tree walls with one mouth each; gates = quest/ability checks with turn-back monologue. After returning the first shard to Fen, the Pegasus Boots' High Jump crosses the broken bridge.
- Travel: village→forest ~15s; full crossing ~25s

## Award targets

- Visuals: cohesive low-poly flat-color look, fog, simple bloom/lighting
- Technical: 3D, seamless world, procedural audio, save system, all in one file
- Creative/Fun: Tunic-style secrets + inner-monologue storytelling

## Optional post-deadline expansion

- Hollow Dark, Ember Lantern, brazier rite, Gravewarden, Bone Key, and a third Ember Shard are deferred.
- The old 12-node skill tree is deferred indefinitely; only revisit it if the shipped XP progression proves too shallow.
- Rusted Key forest secret, village well chest, and +25 HP Heart Relic are deferred.
