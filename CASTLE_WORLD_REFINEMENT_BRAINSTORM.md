# Castle World Refinement Brainstorm

## Objective
Refine World 5 so the castle run feels memorable in the same way classic Mario castles do: high tension, clear trap language, layered hazards, and a strong end-of-level ritual.

This document captures:
- What makes Mario castles feel special.
- How to translate those traits to Cal vs. the Robo-Empire.
- New level elements to add.
- A new castle-specific powerup concept and implementation plan.

## Mario Castle DNA (What We Should Borrow)

### 1) Route pressure + readable deception
In classic SMB castle stages, route choice matters: wrong paths loop you back, correct paths advance, and hidden helpers unlock progress or safer lines.

How this appears in source material:
- `World 4-4` uses split paths and loops, with wrong choices returning to earlier sections.
- `World 8-4` uses room transitions and loop logic, and includes a hidden block used as a practical traversal aid.

Design translation for Cal:
- Add 1-2 deliberate fork rooms in each late castle level.
- Wrong route should cost time and add enemy pressure, not hard-reset progress.
- Keep coin trails as readability guides so players can infer correct flow.

### 2) Hazard layering (not single-mechanic spam)
Mario castles feel dangerous because hazards are stacked in combinations, not isolated:
- Jump timing threat (lava bursts / bubbles)
- Rotating or cycling hazard threat (fire bars)
- Enemy pressure at landing zones

Design translation for Cal:
- Combine `L` + `F` + enemy placement so each jump asks for two decisions (timing + landing).
- Use repeated motifs that evolve across a level (same hazard family, tighter spacing later).

### 3) Strong end ritual and boss adjacency
Classic castles escalate into a distinct finale interaction (e.g., bridge/axe sequence tied to Bowser encounters).

Design translation for Cal:
- Keep door-based castle finishes (`D`) but stage them like a ritual: short "final corridor" + visual climax + clear transition to boss arena.
- In pre-boss stages, make the final room feel authored (not just another platform gap).

### 4) Multiple completion routes in final fortress
SMW Bowser fortress structure includes front/back route identity and skip potential.

Design translation for Cal:
- Add optional "fast risky route" and "slow safe route" patterns in late World 5 levels.
- Reward route mastery with score/coin benefits, not mandatory power gating.

## Castle Elements To Add In This World

### A) Recurring room archetypes
Use a shared castle language so players recognize structure:
- Magma Bridge Room: short moving-platform chain over lava.
- Fire Corridor: narrow hall with timed `F` posts.
- Chainlift Shaft: vertical section with `|` and fallback ledges.
- Collapse Sprint: short lane where momentum matters more than combat.
- Throne Stair: dense enemy + hazard staircase into `D`.

### B) Intentional risk/reward package
- Place `W`, `S`, and hidden `h` assists in high path variants.
- Keep one guaranteed recovery powerup (`*`) before each major gauntlet.
- Add a small number of high-value optional pickups (`O`) in hard lines.

### C) Castle identity props (using current systems)
Without new mechanics, reinforce identity via layout motifs:
- Symmetric lava basins with different traversal methods.
- Repeated torch/fire cadence near transitions.
- Staging ledges before every long gap to reduce cheap deaths.

## New Castle-Specific Powerup Concept

### Working name: Forge Core
Goal: a powerup that is specifically useful in lava-heavy castle play.

### Player effect (proposed)
- Duration: 8 seconds.
- Grants heat shielding:
  - Ignore lava/fire contact damage.
  - Keep normal enemy damage behavior (so combat still matters).
- Distinct HUD state + aura color to communicate timer urgency.

Why this is good for World 5:
- It supports castle-specific mistakes (hazard timing) without invalidating platforming.
- It encourages aggressive route choices through lava-adjacent lines.
- It creates high-skill optimization windows in boss approach levels.

### Implementation plan from existing powerup architecture

1. `Assets`
- Add `assets/forge-core.svg`.

2. `Sprite loading` (`src/game/core.js`)
- Add `ASSETS.forgeCore` path.
- Add `loadSprite("forge-core", ASSETS.forgeCore)`.

3. `Powerup state model`
- Extend run power states from `normal|charged|winged` to include `forged`.
- Add `run.forgeSecondsLeft` timer in core run state.

4. `Tile + question block support` (`src/game/scenes/game.js`)
- Add tile mapping, e.g. `M: () => questionBlockTile("forge")`.
- Add `POWERUP_SPECS.forge` with sprite, text, color, and apply behavior.

5. `Damage logic` (`src/game/scenes/game.js`)
- In hazard collision (`player.onCollide("hazard")`), ignore hazard hits while forged timer > 0.
- Keep enemy collisions unchanged.

6. `HUD + aura`
- Add forged HUD mode text (e.g., `POWER FORGE 8s...`).
- Add orange/red aura variant.

7. `Level placement strategy`
- Place forge block before hardest lava chambers, not at spawn.
- Do not stack with guaranteed wing in the same micro-section.

8. `QA checks`
- Verify forged does not trivialize boss.
- Verify timer expiration transitions cleanly.
- Verify hazard immunity does not suppress fall death.

## Current QA Pass Applied (What Was Refined Now)

- Removed stacked lava-depth visuals from World 5 maps.
- Repositioned moving-platform chains to more reliable vertical bands.
- Added more static staging islands between long lava jumps.
- Preserved difficulty while reducing soft-lock / impossible-jump risk.
- Set wing powerup duration to **5 seconds** for World 5 castle levels.

## Next Refinement Backlog

1. Playtest each World 5 level with no powerups and record deaths by section.
2. Tune enemy density around landing zones only after jump flow is finalized.
3. Add one signature setpiece per level (distinct room identity).
4. Implement Forge Core in a small vertical slice (`castle5_2` only), then expand.

## Sources
- World 4-4 (SMB): https://www.mariowiki.com/World_4-4_%28Super_Mario_Bros.%29
- World 8-4 (SMB): https://www.mariowiki.com/World_8-4_%28Super_Mario_Bros.%29
- Axe (bridge-cut castle ritual): https://www.mariowiki.com/Axe
- Front Door (SMW final fortress route): https://www.mariowiki.com/Front_Door
- Back Door (SMW alternate skip route): https://www.mariowiki.com/Back_Door
- Bowser Castle overview (multi-route structure): https://www.mariowiki.com/Bowser_Castle
- Lava Bubble (castle-lava hazard lineage): https://www.mariowiki.com/Lava_Bubble
