# EMBERWICK — Build Plan

Deadline: **Thursday 2026-08-27 at 9:00 PM**. Status markers: ✅ done · 🔨 in progress · ⬜ not started · ⏸ deferred.

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
- ✅ XP progression: 25 XP per enemy; Level 2 at 150 XP raises sword damage to 25; Level 3 at 250 XP unlocks Charged Slash
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

## Phase 5 — Enemies & bosses ✅

- ✅ Second and third basic enemy types balanced: Thornback 140 HP with canine joint rig/gait; Drowned Sentinel 180 HP with articulated walking gait, opposing arm swing, detailed ruin-golem model, motes, and layered slam effects; shrine-based roaming-enemy respawn (well quest slimes remain defeated)
- ✅ Ash Knight final boss: telegraphed sword sweep, rushing charge, ember slam, 1.25-second punish window, wobble/collapse defeat, and dedicated Ganon Defeated cue
- ⏸ Ember drops from enemies (+10 HP pickups) — new pickup behavior is outside the deadline scope

## Phase 6 — Audio ✅

- ✅ Minimal audio: Zelda cues for combat/item feedback, selected CC0 samples for player actions, and procedural WebAudio for ambience
- ✅ Functional SFX first: Zelda Hit/Kill/Life Lost/Ganon Defeated/Item 2 cues; CC0 Swing Woosh, Drink / Drinking Liquid, Physical Launch, Dialogue Voice, and Soft Confirm Reverb for sword, flask, High Jump, typewriter dialogue, and UI feedback
- ✅ One procedural ambient motif with 4 lightweight regional variations
- ⏸ Additional combat and boss music layers unless the required SFX, shell, save, and dry run are complete

## Phase 7 — Shell & persistence ✅

- ✅ One-slot localStorage autosave/load: stats, XP/level, abilities, quest state, inventory, checkpoint/position, completed puzzles, boss/ending state; no save-slot UI
- ✅ Title screen: New Game, Continue, four quest presets, and a direct Ash Knight preset
- ✅ Ending screen / credits with complete/incomplete mural variant and Continue Exploring

## Phase 7.5 — Four-region compression pass ✅

Scope lock: **Village, Whispering Forest, Sunken Ruins, and Ashen Keep only.** Reuse the existing map, enemies, props, puzzles, NPCs, and state systems. No new region, enemy family, faction, side quest, skill tree, crafting system, or collectible set before submission.

### P0 — required gameplay fixes ✅

- ✅ Fix the Keep gate so all 3 Mural Sketches are always required; warning throttle is separate from the item guard
- ✅ Preserve the mural answer in the inventory description (`▲ ◆ ●`) so the gate tests recall instead of hidden state
- ✅ Give Level 2 a real effect: raise sword damage from 20 to 25
- ✅ Re-cluster the 6 existing forest enemies into 3 encounters on the forest mouth → Fen → stone circle route so 4 well kills + 6 forest kills guarantee Level 3 before the ruins without grinding
- ✅ Increase Ash Knight recovery from 0.8s to 1.25s so the advertised swing → charge → Charged Slash punish fits the opening
- ✅ Locked damage feedback grammar: light hero damage = flash/recoil/knockback/Hit; 28+ heavy hero damage adds skid dust + camera kick; 20%-or-lower HP adds a persistent pulse; enemy damage = flash/hit-stop/sparks/Hit; Spirit Displacement = Ash Knight only; hero death = wobble/fall + Life Lost → shrine respawn; Ash Knight death = wobble/fall + Ganon Defeated → ending

### P1 — high-impact compression ✅

- ✅ Keep a 20% closer standard camera after browser QA confirmed combat spacing and major landmarks remain readable
- ✅ Open two removable rows in the existing tree-wall corridor after completing the stone circle, creating a direct return to Fen without a new forest location
- ✅ Reposition the 3 existing murals beside the 3-mirror beam route so ruins combat, lore, navigation, and puzzle solving form one processional loop
- ✅ Add one visible reaction per shard using existing rendering/state hooks: Shard 1 warms/lights the forest circle; Shard 2 warms the water and wakes ember lights along the Keep approach
- ✅ Replace Millie and Tam's unconditional dialogue cycling with short quest-state reactions; no dialogue choices or new NPCs
- ✅ Re-cluster the existing ruins walls, debris, urns, and columns around the beam route without increasing their counts

## Phase 3.5 — Hi-fidelity visual overhaul ✅ (Mon night)

- ✅ CC0 asset pipeline: Kenney Nature/Fantasy Town/Graveyard packs (public/assets), GLTF loader with toon conversion, wind shader support, per-model instanced scatter (props.js)
- ✅ Re-dressed all active regions with real models: pines/oaks/fall trees, mushroom rings, stumps, fallen logs, bushes, rocks, lilies; modular kit cottages (walls/roofs/doors), market stall, cart, lantern posts, real crop garden + fences, signs; traveler camp, waystone, windmill (tower + kit blades), watermill; ruins colonnade + broken stone walls + urns + debris + columns; keep rebuilt (stone walls, obelisk gate, fire baskets, open altar sanctum + dim Ember, gravestone field, lightposts)
- ✅ Placement validators + clearings (circle/hermit), verified via in-browser screenshot QA loop
- ✅ Mood batch: warm fresnel rim light on all characters, region ambient particles (pollen/leaf/mist/ash follow the player), water lapping motion, warm violet dusk fog

## Phase 8 — Polish & ship ⬜

- ⬜ Look-and-feel iteration round 2 (user has explicit asks pending; start only after Phase 6/7 and P0)
- ⏸ Visual leftovers: shore foam, water sparkle, light shafts, glowing mushrooms, tilt-shift DOF, cottage corner pieces
- ⏸ Particle leftovers beyond the chosen damage grammar: footstep dust, High Jump landing dust, cape cloth-lag
- ✅ Balance/tuning playthrough: fresh-save browser pass confirmed progression, stamina/High Jump, death recovery, and a winnable low-level boss; moved the bridge objective marker to its safe west approach and removed obsolete shield copy
- ✅ Temporary damage-effects lab (`6`): walkable overlay with individual and checkbox-selected combined triggers for flash, recoil, knockback, sparks, camera reactions, hitstop, Zelda Hit, foot skid/dust, low-health pulse, Ember Shatter, Ink Impact, Spirit Displacement, and Ground Smash
- ✅ Gameplay damage feedback: light/heavy hero hits, persistent low-health pulse, enemy hits/kills, Ash Knight-only Spirit Displacement/death, and sound-gated hero death now follow the locked P0 grammar
- ✅ Browser-assisted New Game → ending progression test (all quest handoffs, puzzles, inventory locks, boss death, ending, and persistence)
- ⬜ 5-minute human demo dry run
- ⬜ Ship: build `dist/` and produce the submission package first; deploy only if hosting is already ready and cannot delay submission

## Optional post-deadline expansion ⏸

- ⏸ Hollow Dark region and cave entrance
- ⏸ Ember Lantern story beat and darkness bubble
- ⏸ Brazier-order rite, Gravewarden mini-boss, Bone Key, and third Ember Shard
- ⏸ Rusted Key forest camera-angle secret → village well chest → Heart Relic (+25 max HP)
- ⏸ Revisit a larger skill tree only if the three-level XP progression feels too shallow after shipping

## Schedule guardrail

- **Tue:** Lock reduced scope; finish Q4 and Ash Knight
- **Wed:** Audio, title/chapter select, save
- **Thu:** P0 compression fixes, Phase 8 verification, final build by **7:00 PM**, submit before **9:00 PM**
- **Hard freeze:** no fifth region or new system before submission; unfinished P1 work loses to a complete build, save/chapter select, audio feedback, debug removal, and the 5-minute dry run
