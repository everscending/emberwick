# EMBERWICK — Build Plan

Deadline: **Thursday 2026-08-27 at midnight**. Status markers: ✅ done · 🔨 in progress · ⬜ not started · ⏸ deferred.

## Phase 0 — Foundation ✅

- ✅ Vite project, build pipeline (`npm run dev` / `npm run build`)
- ✅ Scene, isometric follow camera, lighting, renderer (ACES, soft shadows, bloom)
- ✅ Input system (WASD screen-relative, mouse, stuck-key/blur fix, context-menu suppression)

## Phase 1 — Player ✅

- ✅ Red panda knight model (chibi, dao, cape, jointed tail, paws, elbows)
- ✅ Movement: walk + bounce, smooth 8-way turning with head-lead
- ✅ High Jump (Pegasus Boots unlock, i-frames, head-first leap and mid-air tuck)
- ✅ Stamina system
- ✅ Idle life: breathing, sway, glances, blinks, tail curl drift + walk bounce
- ✅ Combat: slash/chop combo, horizontal-blade enforcement, Charged Slash (Level 3 XP unlock)
- ✅ Juice: trail, hit-stop, camera shake, lunge

## Phase 2 — Core systems ✅

- ✅ HP / flasks / hurt / death-respawn
- ✅ Dialogue (typewriter, NPC + inner monologue), interaction prompts (E)
- ✅ Quest framework + objective HUD tracker
- ✅ Help menu (`?`) with controls and progression guidance
- ✅ XP progression: 25 XP per enemy; Level 2 at 150 XP; Level 3 at 250 XP unlocks Charged Slash
- ✅ Enemies: slime (AI, wobble, solid body, splatter death); enemy hit framework
- ✅ Collision (circle colliders) + terrain height (shared analytic ground)
- ✅ Flora system: instanced tree archetypes + GPU wind, instanced grass
- ✅ Shrine (checkpoint/heal/refill), Elder Maren NPC, Quest 1 end-to-end

## Phase 3 — World build-out ✅

- ✅ Expand terrain to 220×220: north plateau + cliff with ramp corridor, NW rocky rise, east basin with pools, winding stream (carved bed + water plane), flat village, region-painted vertex colors (slope→rock, shore→sand, per-region moods)
- ✅ Slope-blocking (cliffs are walls, slide along them), shadow window follows player
- ✅ Region planting: dense west forest with mouth, village blobs+flowers, south meadows, ruins dead trees, burnt keep sentinels, stream reeds, 500 grass
- ✅ Landmarks: broken stream bridge, village well, stone circle site, ruins columns (standing/fallen), Ashen Keep silhouette (walls/towers/dim ember)
- ✅ Region gates: forest (q1), broken bridge (q2 + High Jump), keep ramp (2 shards) — push-back + monologue; forest border tree wall; deep water blocks movement
- ✅ Village dressing round 2: 3 cottages (lit windows, animated chimney smoke), vegetable garden, villagers Millie + Tam with rotating flavor/hint lines
- ✅ Forest: Hermit Fen NPC + forest shrine
- ✅ Ruins: sunstone + 3 mirrors + vault, 3 mural walls, ruins shrine, arrival trigger
- ✅ Keep: ▲ ◆ ● rotating-glyph gate, rising stone door, and cleared/scorched boss arena interior
- ✅ Performance check at full scale — Village 107 fps / 1,184 calls; Forest 103 / 443; Ruins 103 / 481; Keep 121 / 277 (in-app browser, 2026-08-25)

## Phase 4 — Quests, puzzles, items ✅

- ✅ Inventory system (Tab satchel panel, key items)
- ✅ Q2: Hermit Fen riddle → stone circle puzzle (wake small-to-great, wrong = reset) → Shard 1
- ✅ Q2 crossing: return the first shard to Fen, receive the Pegasus Boots, then High Jump across the narrowed broken bridge
- ✅ Q3: arrival beat → mirror-beam puzzle (8-way mirrors, progressive beam feedback) → vault opens → Shard 2; 3 murals tell the Ash Knight story and yield Mural Sketches (▲ ◆ ● sequence for the Keep gate)
- ✅ Q4: glyph gate → Ash Knight boss → restored Great Ember → mural-count ending

## Phase 5 — Enemies & bosses 🔨

- ✅ Second and third basic enemy types balanced: Thornback 140 HP with canine joint rig/gait; Drowned Sentinel 180 HP with articulated walking gait, opposing arm swing, detailed ruin-golem model, motes, and layered slam effects; shrine-based roaming-enemy respawn (well quest slimes remain defeated)
- ✅ Ash Knight final boss: telegraphed sword sweep, rushing charge, ember slam, and punishable recovery windows
- ⬜ Ember drops from enemies (+10 HP pickups)

## Phase 6 — Audio ⬜

- ⬜ WebAudio engine (procedural, no files)
- ⬜ SFX: sword, hit, High Jump, pickup, UI, flask
- ⬜ Ambient music per region + combat/boss layers

## Phase 7 — Shell & persistence 🔨

- ⬜ localStorage save/load (stats, XP/level, quests, inventory, position)
- ⬜ Title screen: New Game + chapter select (preset saves) — demo requirement
- ✅ Ending screen / credits with complete/incomplete mural variant and Continue Exploring

## Phase 3.5 — Hi-fidelity visual overhaul ✅ (Mon night)

- ✅ CC0 asset pipeline: Kenney Nature/Fantasy Town/Graveyard packs (public/assets), GLTF loader with toon conversion, wind shader support, per-model instanced scatter (props.js)
- ✅ Re-dressed all active regions with real models: pines/oaks/fall trees, mushroom rings, stumps, fallen logs, bushes, rocks, lilies; modular kit cottages (walls/roofs/doors), market stall, cart, lantern posts, real crop garden + fences, signs; traveler camp, waystone, windmill (tower + kit blades), watermill; ruins colonnade + broken stone walls + urns + debris + columns; keep rebuilt (stone walls, obelisk gate, fire baskets, crypt sanctum, altar + dim ember, gravestone field, lightposts)
- ✅ Placement validators + clearings (circle/hermit), verified via in-browser screenshot QA loop
- ✅ Mood batch: warm fresnel rim light on all characters, region ambient particles (pollen/leaf/mist/ash follow the player), water lapping motion, warm violet dusk fog

## Phase 8 — Polish & ship ⬜

- ⬜ Look-and-feel iteration round 2 (user has explicit asks pending)
- ⬜ Visual leftovers: shore foam, water sparkle, light shafts, glowing mushrooms, tilt-shift DOF, cottage corner pieces
- ⬜ Particle pass: footstep dust, High Jump landing dust, impact sparks, cape cloth-lag
- ⬜ Balance/tuning playthrough (damage, stamina, boss)
- ✅ Temporary damage-effects lab (`6`): walkable overlay with individual and checkbox-selected combined triggers for flash, recoil, knockback, sparks, camera reactions, hitstop, impact grunt, foot skid/dust, low-health pulse, Ember Shatter, Ink Impact, Spirit Displacement, and Ground Smash
- ✅ Gameplay damage feedback: hero hits use whole-body flash, recoil, directional knockback, impact grunt, and skid dust; enemy hits add Spirit Displacement
- ⬜ Remove debug keys (` 1 2 3 4 5 6); 4/5 forest/ruins travel added ✅
- ⬜ Full playthrough test + 5-minute demo dry run
- ⬜ Ship: build `dist/`, host (Railway option) or zip for submission

## Optional post-deadline expansion ⏸

- ⏸ Hollow Dark region and cave entrance
- ⏸ Ember Lantern story beat and darkness bubble
- ⏸ Brazier-order rite, Gravewarden mini-boss, Bone Key, and third Ember Shard
- ⏸ Rusted Key forest camera-angle secret → village well chest → Heart Relic (+25 max HP)
- ⏸ Revisit a larger skill tree only if the three-level XP progression feels too shallow after shipping

## Schedule guardrail

- **Tue:** Lock reduced scope; finish Q4 and Ash Knight
- **Wed:** Audio, title/chapter select, save
- **Thu:** Phase 8, submit before midnight
