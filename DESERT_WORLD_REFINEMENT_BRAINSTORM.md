# Desert World Refinement Brainstorm

## Objective
Rebuild World 2 so it has a full identity arc instead of a single level. Keep `desert1` exactly as-is, then design a complete desert campaign with new layouts, new setpieces, a desert-only powerup, and a new enemy archetype (3-high robot stacks).

This document captures:
- What makes great desert platforming worlds memorable.
- How those ideas translate to Cal vs. the Robo-Empire.
- New recurring level structures for World 2.
- New powerup + enemy concepts and implementation direction.

## Desert Level DNA (What We Should Borrow)

### 1) Rhythm from emptiness and spacing
Great desert levels use distance and sparse landmarks to create tension. Large open lanes become meaningful when traversal timing and landing discipline are tested.

Design translation for Cal:
- Use wider pit spacing than World 1.
- Alternate open "runway" segments with ruin-platform pockets.
- Keep coin lanes readable so jumps feel intentional, not blind.

### 2) Ruin geometry as precision checks
Desert worlds feel distinct when ancient structures create vertical and diagonal movement patterns (stairs, broken roofs, pillars, chamber segments).

Design translation for Cal:
- Build repeated ruin motifs with `#`, `B`, `|`, and springs.
- Use short multi-height chambers where one missed jump costs position, not instant death.
- Place power/reward blocks in upper ruin lanes.

### 3) Environmental pressure over raw enemy spam
Desert stages are strongest when enemy pressure complements traversal rather than replacing it.

Design translation for Cal:
- Use stacks and mixed robots as lane-control tools.
- Keep pressure highest at landings after moving-platform chains.
- Keep recovery windows after hard chains.

### 4) Distinct pre-boss ritual
Worlds feel complete when the final level has a clear build-up ritual before boss entry.

Design translation for Cal:
- Make final desert level a citadel approach with escalating trials.
- End with a desert fortress door sequence into boss.

## New Desert-Specific Additions

### A) New powerup: Sandstorm Core
Working name: **Sandstorm Core**

Gameplay effect:
- Duration target: 10 seconds.
- Activates a sandstorm aura around Cal.
- Nearby enemies are shredded automatically in short pulses.
- Enemy contact becomes offense (you clear enemies on touch while active).
- Hazard immunity is **not** included, so platforming still matters.

Why this fits desert:
- It expresses sand/wind fantasy directly.
- It rewards aggressive routing through enemy-dense sections.
- It feels distinct from `charged`, `winged`, and `forged`.

### B) New enemy composition: 3-high robot stack
Working name: **Totem Stack**

Behavior target:
- 3 robots high.
- Bottom unit handles pathing/movement.
- Entire stack moves as one body.
- One stomp on the top clears the full stack.

Why this fits desert:
- Reads as a marching totem/column silhouette against dunes.
- Adds lane denial without requiring a brand-new AI model.

### C) New world art accents
New art direction for added content:
- Sand Core sprite.
- Sand-themed question block.
- Desert obelisk prop for ruins.

## Recurring Room Archetypes for World 2

1. Caravan Bridge Lane
- Long gaps crossed with moving platforms and short stable pads.

2. Sunken Ruin Chamber
- Multi-height blocks and vertical movers with reward lines above danger.

3. Stack Convoy Corridor
- Tight lanes where 3-high stacks force timing and spacing decisions.

4. Storm Trial Gauntlet
- Consecutive pit-platform sequences with little downtime.

5. Citadel Ascent
- Stair-step final corridor into a boss door ritual.

## Level Arc Targets (World 2)

- `desert1`: unchanged baseline opener.
- `desert2`: introduce Sandstorm Core + first stack encounters.
- `desert3`: ruin-heavy precision map with vertical movement.
- `desert4`: sustained sandstorm trial with tighter enemy pressure.
- `desert5`: full-mechanic mastery test + boss door.
- `boss2`: desert boss arena that transitions cleanly to cloud world.

## QA Focus

1. Confirm `desert1` content unchanged.
2. Validate all new level transitions in order.
3. Verify stack enemy stomp region lands at top of stack.
4. Verify stack visuals stay locked to moving base unit.
5. Verify Sandstorm Core only appears in desert levels.
6. Verify sandstorm power expiry transitions cleanly with HUD/audio.
7. Verify cloud world unlock now depends on `boss2` clear.
