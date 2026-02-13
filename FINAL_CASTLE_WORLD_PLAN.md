# Final World Plan: Infernal Castle World

## Goal
Build a new **final world** that is entirely castle-themed, lava-heavy, and dungeon-like.

This plan is grounded in how `src/levels/castle1.js` is built, then scales that style into a complete endgame world. We start by implementing only the first level of this world, while designing the full roadmap up front.

## What World 1 Castle Already Does Well (Reference)
`castle1` establishes a strong template we should preserve:

- Consistent castle identity: enclosed roof (`#` rows), lava (`L`), fire hazards (`F`), door finish (`D`), castle music/style.
- Sectioned pacing: hazard lane, room, trench, climb, gauntlet, tower.
- Readable risk/reward: coins over danger, power block near risk points.
- Mixed traversal in one level: flat pressure lanes, moving platforms (`~`), spring jumps (`^`), staircase finale.
- Enemy variety with recognizable roles: `r` (pressure), `b` (faster punish), `p` (timing disruptor).

Use this as the baseline, then increase complexity and execution precision world-over-world.

## Final World Vision
Working name: **WORLD 5 - INFERNAL STRONGHOLD**

Design pillars:

1. Lava is the default threat, not an occasional obstacle.
2. Each level is a fortress segment (outer wall -> foundry -> catacombs -> reactor -> throne).
3. Encounters combine environmental hazard timing + enemy pressure.
4. Endgame difficulty comes from composition and route planning, not unfair blind jumps.
5. Every lethal section has a readable safe option (slower route or staging tile).

## World Structure (Full Plan)

| Order | Level ID | Title | Primary Focus | Target Size | Target Time | Build Phase |
|---|---|---|---|---|---|---|
| 1 | `castle5_1` | ASH GATE BREACH | Reintroduce castle rules at endgame pace | 236x17 | base + 50s | Build now |
| 2 | `castle5_2` | MAGMA FOUNDRY | Moving-platform chains over deep lava | 244x17 | base + 55s | Later |
| 3 | `castle5_3` | CHAINLIFT CATACOMBS | Vertical navigation + crossfire hazards | 240x17 | base + 60s | Later |
| 4 | `castle5_4` | OBSIDIAN REACTOR | Endurance gauntlet with sparse recovery windows | 252x17 | base + 65s | Later |
| 5 | `castle5_5` | THRONE APPROACH | Multi-mechanic mastery test before boss | 260x17 | base + 70s | Later |
| 6 | `boss5` | EMPEROR CORE | Final boss arena with lava-integrated pressure | 128x17 | base + 75s | Later |

`base` above means `CONFIG.timeLimit` in `src/game/core.js`.

## Immediate Build Scope (Now)
Implement only:

- World shell for final world
- Level `castle5_1`
- Route into this world from `level-4-1`

Keep `castle5_1.nextLevelId = null` for first delivery, then wire subsequent levels later.

## Detailed Spec: `castle5_1` (Build First)

### Intent
`castle5_1` should feel like the first room of the final exam: harder than `castle1`, but still fair and legible.

### Core Metrics

- Grid: `cols = 236`, `rows = 17`, `groundY = 16`
- Style: castle (`levelStyle: "castle"`, `music: "overworld-castle"`)
- End condition: door `D`
- Hazards: frequent `L` and `F`
- Enemy density target: ~16-20 total enemies

### Section-by-Section Layout Plan

| Section | X Range | Purpose | Geometry and Hazard Plan | Enemy Plan |
|---|---|---|---|---|
| A: Spawn Vault | 0-26 | Safe setup + warmup | `@` near x=3; starter blocks `? * ?`; low ceiling castle roof from row 1-2 | 2 enemies (`r`, `p`) to establish pace |
| B: First Magma Walk | 27-58 | Teach final-world lava rhythm | Two lava trenches (`L`) with bridge tiles `#` and one moving tile `~`; coins arc above safe path | 3 enemies timed between trenches |
| C: Fire Corridor | 59-94 | Horizontal pressure | Narrow walkways, overhead `F` timing points, one spring `^` bailout line | 4 enemies with mixed spacing (`r`,`b`,`p`) |
| D: Split Route Room | 95-138 | Risk/reward pathing | Low path: safer but longer. High path: `B` + `*` reward and tighter jumps. Hidden block `h` assist near merge | 3 enemies; one guarding each route + merge pressure |
| E: Moving Crucible | 139-190 | Execution check | Alternating `~`/`|` over lava channels; short safe islands every ~12 tiles | 5 enemies, mostly landing-zone pressure |
| F: Tower Lock | 191-235 | Finale climb to door | Dense stair/tower `#`, two fire posts `F`, final sprint to `D` | 3-4 enemies in tower layers |

### Powerup and Coin Economy

- Place one guaranteed battery `*` early (Section A) to keep flow.
- Place one optional reward `W` in high-risk path (Section D or E).
- Maintain coin breadcrumb lines through safe trajectory; add higher-value arc over hard route.
- End-of-level reward lane before `D` to reinforce completion.

### Implementation Skeleton (`src/levels/castle5_1.js`)

1. Create grid and fill ground.
2. Apply castle roof pattern (same style as `castle1`).
3. Add helper functions:
   - `lavaPool(start, width, depth = 1)`
   - `coinLine(start, end, y, step = 2)`
   - optional `platform(start, end, y, tile = "#")`
4. Build six sections in order with comment headers.
5. Place `D` near `cols - 6`.
6. Return `toMap()`.

## Full World Level Concepts (Later Levels)

### `castle5_2` - MAGMA FOUNDRY

- Theme: industrial furnace lanes.
- Gameplay: longer moving-platform chains (`~` and `|`) across lava basins.
- Twist: frequent "staging stones" to reduce unfair deaths while preserving tension.
- Visual rhythm: repeated foundry chambers separated by short choke hallways.

### `castle5_3` - CHAINLIFT CATACOMBS

- Theme: vertical fortress interior.
- Gameplay: stacked corridors, climb-and-drop loops, cross-lane enemy pressure.
- Twist: route reads as maze-like but remains linear with clear coin guidance.
- Difficulty increase: stricter jump windows and denser enemy overlap than `castle5_2`.

### `castle5_4` - OBSIDIAN REACTOR

- Theme: unstable core chamber.
- Gameplay: long endurance run with sparse recovery and fewer powerups.
- Twist: repeated lava/fire patterns that evolve (same motif, tighter spacing each cycle).
- Goal: make consistency and patience matter more than speed.

### `castle5_5` - THRONE APPROACH

- Theme: final ascent to the ruler chamber.
- Gameplay: combines all prior castle mechanics in one long level.
- Twist: dual-lane finale (safe low route, faster high-risk route).
- Exit: castle door into `boss5`.

### `boss5` - EMPEROR CORE

- Arena baseline: reuse `boss1` enclosed castle format, but larger and with lava segmentation.
- Boss pressure goals:
  - More positional checks than pure stomp timing.
  - Better anti-camping behavior.
  - Clear telegraphs before high-danger attacks.
- Victory flow: final world clear + credits/game-clear scene trigger.

## World Map and Progression Plan

### Node Layout (Target Final)

| Node | Label | Position |
|---|---|---|
| `castle5_1` | 1 | `(160, 326)` |
| `castle5_2` | 2 | `(334, 286)` |
| `castle5_3` | 3 | `(506, 250)` |
| `castle5_4` | 4 | `(678, 214)` |
| `castle5_5` | 5 |  `(836, 176)` |
| `boss5` | C | `(914, 120)` |

### Unlock Rules (Target Final)

- `castle5_1` requires `level-4-1`
- `castle5_2` requires `castle5_1`
- `castle5_3` requires `castle5_2`
- `castle5_4` requires `castle5_3`
- `castle5_5` requires `castle5_4`
- `boss5` requires `castle5_5`

### First Delivery Map State

- Add `world5` now with only `castle5_1` node active.
- Keep future node coordinates documented (above), but do not expose unfinished nodes yet.

## Required Code Touchpoints

### For first delivery (`castle5_1` only)

- `src/levels/castle5_1.js`: new level builder.
- `src/levels/index.js`: export `buildCastle5_1Level`.
- `src/game/core.js`:
  - import level builder,
  - add `LEVELS.castle5_1`,
  - set `level-4-1.nextLevelId = "castle5_1"`.
- `src/worlds/index.js`:
  - add `world5` entry,
  - set theme and nodes for first release.

### For full world rollout

- `src/game/core.js`: add `castle5_2` ... `castle5_5`, `boss5`, and next-level chain.
- `src/worlds/index.js`: complete world5 nodes and bezier connections.
- `src/game/scenes/worldMap.js`: add dedicated castle map background branch (`theme.mapStyle === "castle"`) and choose castle map music.

## Difficulty and QA Targets

### Gameplay targets per level

- No blind lethal jump without at least one readable cue (coins, silhouette, or platform preview).
- Every long lava segment includes at least one bailout tile or alternate route.
- Enemy clusters should challenge timing, not create unavoidable collision boxes.

### Playtest checklist (each level)

- 3 runs with normal power only.
- 3 runs with battery-assisted route.
- 1 run collecting high-path rewards.
- Verify door/goal transition and world-map unlocks.
- Verify timer feels tight but not punitive.

## Milestone Plan

1. **Milestone A (now):** implement `castle5_1` + `world5` shell and progression handoff from `level-4-1`.
2. **Milestone B:** implement `castle5_2` and `castle5_3`, tune enemy density.
3. **Milestone C:** implement `castle5_4` and `castle5_5`, full world-map path.
4. **Milestone D:** implement `boss5` and final clear flow.
5. **Milestone E:** global difficulty pass across all world5 levels.

## Notes on Scope Discipline

To keep delivery stable, world5 should first reuse the existing tile/enemy system (`L`, `F`, `~`, `|`, `r`, `b`, `p`, etc.).
Add brand-new mechanics only after all planned levels are playable end-to-end.
