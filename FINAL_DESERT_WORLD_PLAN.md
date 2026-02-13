# Final World Plan: Scorched Desert World

## Goal
Create a complete, fully-authored World 2 with desert identity from start to finish while preserving the current `desert1` layout exactly as-is.

## Scope Commitments

- Keep `src/levels/desert1.js` map design unchanged.
- Add all remaining World 2 levels as new content.
- Add one desert-only powerup not used by other worlds.
- Add 3-high moving robot stacks as a new enemy composition type.
- Add new desert art assets without modifying existing art files.

## World Structure

| Order | Level ID | Title | Core Focus | Target Feel |
|---|---|---|---|---|
| 1 | `desert1` | SUNSCORCH RUN | Existing opener preserved | Intro pacing |
| 2 | `desert2` | CARAVAN STRIDE | Sandstorm intro + first stacks | Fresh mechanical reveal |
| 3 | `desert3` | SUNKEN RUINS | Vertical ruin movement | Precision routing |
| 4 | `desert4` | DUSTSTORM TRIALS | Endurance platform gauntlet | Sustained execution |
| 5 | `desert5` | SOLAR CITADEL GATE | Combined mechanics + door finale | Pre-boss ritual |
| 6 | `boss2` | DUNE OVERSEER | Desert arena boss | World capstone |

## New Desert-Only Powerup

### Sandstorm Core

Mechanics:
- Triggered from `Z` question blocks (desert placement only).
- Duration: 10 seconds (level override-ready).
- Emits pulse damage around player to clear nearby enemies.
- Enemy contact during effect defeats enemies instead of hurting player.
- Does not grant hazard immunity.

Presentation:
- New sprite: `assets/sand-core.svg`.
- New block art: `assets/question-sand.svg`.
- Distinct HUD label and aura color.
- Dedicated activation + expiry SFX.

## New Enemy Type (Composition)

### 3-High Robot Stack (`t`)

Behavior spec:
- Bottom robot handles walk logic.
- Two top robots are visual followers locked to base movement.
- Entire stack collides as one tall enemy body.
- Stomp zone is moved to the top of the stack.
- Defeating base destroys the full stack.

## New Art Assets

- `assets/sand-core.svg`: desert power core pickup.
- `assets/question-sand.svg`: sand-themed question block.
- `assets/desert-obelisk.svg`: ruin prop for desert level dressing.

## Progression + Map Wiring

World 2 chain:
- `desert1 -> desert2 -> desert3 -> desert4 -> desert5 -> boss2`

Cross-world handoff:
- `boss2 -> cloud1`

World map requirements:
- World 2 nodes now include all 6 stages.
- World 3 (`cloud1`) unlock requires `boss2` completion.

## Implementation Touchpoints

- `src/levels/desert2.js`: new level.
- `src/levels/desert3.js`: new level.
- `src/levels/desert4.js`: new level.
- `src/levels/desert5.js`: new level (door to boss).
- `src/levels/boss2.js`: new boss arena.
- `src/levels/index.js`: export all new builders.
- `src/game/core.js`: level registry, progression, run power model, asset loading.
- `src/game/scenes/game.js`: sandstorm gameplay logic, new tile mappings (`Z`, `t`, `I`), stack enemy behavior.
- `src/game/audio.js`: sandstorm SFX hooks.
- `src/worlds/index.js`: world2 node graph + world3 unlock gate.

## Gameplay QA Checklist

1. Beat `desert1` and confirm transition to `desert2`.
2. Clear world2 end-to-end and confirm `boss2 -> cloud1` handoff.
3. Collect `Z` and verify sandstorm timer, HUD, aura, and auto-enemy clearing.
4. Verify sandstorm expiry SFX and state reset.
5. Verify stack enemy top-stomp consistency from both standing and falling jumps.
6. Verify stack followers remain synced while turning and at ledges.
7. Verify desert obelisk props render without collision side effects.
