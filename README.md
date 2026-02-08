# Cal vs. The Robo-Empire (Sneak Peek)

A tiny Mario-style side scroller built with plain **HTML + CSS + JavaScript** and **Kaboom.js** (vendored in `vendor/` so you can run it without installing anything).

## Run it

- Open `index.html` in a browser.
  - If your browser blocks loading local assets from `file://`, run a simple local server instead:
    - VS Code: “Live Server” extension, or
    - Terminal: `python3 -m http.server` and open `http://localhost:8000`

## Controls

- Move: Arrow keys or `A` / `D`
- Jump: Space (or Up / `W`)
- Run: Hold `Shift`
- Pause: `Esc` or `P`
- Enter: advance menus
- `R`: restart level
- `M`: mute / unmute

DualShock / standard gamepad:

- Move: D-pad or left stick
- Jump: Cross (`X`) / Circle (`O`) or `L2` / `R2`
- Run: Square / Triangle or `L1` / `R1`
- Enter / confirm: Options / Start (jump buttons also confirm in menus)
- Restart level: Share / Select
- Mute / unmute: Home / PS button (if the browser exposes it)

## Gameplay notes

- `*` blocks can drop a **battery** that makes Cal **CHARGED** (break `B` bricks + take 1 hit safely).
- `W` blocks can drop **wings** that let Cal fly for 30 seconds.
- In cloud levels, red robots (`r`) fly in sweeping patterns.
- Background music is generated with the Web Audio API (no music files needed).
- Best score/time are saved in your browser via `localStorage`.

## Level editing

- Levels are generated in `src/levels/*.js` (for example `src/levels/cloud1.js`).
- Training hints are configured in `LEVELS.training.tutorialSteps` in `src/main.js`.

- **Ground** is the bottom row filled with `=`
- **Pits** are defined by `pits: [{ start, width }]` and remove ground tiles
- **Blocks**:
  - `#` = solid block
  - `B` = breakable brick (breakable only when **CHARGED**)
  - `?` = question block (coin)
  - `*` = question block (power-up)
  - `W` = question block (wing power-up)
  - `~` = moving platform
  - `|` = vertical moving platform
  - `c` = crumble cloud platform
  - `^` = springboard
  - `v` = climbable vine
- **Coins**:
  - `o` = collectible coin
- **Enemies**:
  - `r` = red robot
  - `b` = blue robot
  - `p` = pink robot
- **Markers**:
  - `@` = player spawn
  - `!` = goal pole (end)
  - `U` = boss (visual-only for Level 1)

Tip: keep enemies on the row **above** the ground (the code does this by default).

## Swapping art (super easy)

All art is loaded from `assets/`. To change the look, just replace the files (keep the same filenames):

- `assets/cal.svg` (player) — recommended: 32×32
- `assets/robot-red.svg`, `assets/robot-blue.svg`, `assets/robot-pink.svg` — recommended: 32×32
- `assets/ground.svg`, `assets/block.svg`, `assets/question.svg`, `assets/used-block.svg` — recommended: 32×32
- `assets/coin.svg`, `assets/battery.svg`, `assets/wing.svg`, `assets/spring.svg`, `assets/vine.svg` — recommended: 32×32
- `assets/heart.svg` — recommended: 16×16 (or 32×32 is fine too)
- `assets/ufo-boss.svg` — recommended: 64×48
- `assets/pole.svg` — recommended: 16×192
- `assets/flag-robot.svg`, `assets/flag-c.svg` — recommended: 32×32

You can replace SVG with PNGs at any time (e.g. `cal.png`) — just update the paths in `src/main.js` under `ASSETS`.

## Sprite creation workflow (kid-friendly)

- Draw pixel art in a browser tool like **Piskel** (export as PNG).
- Keep sprites in a simple grid size (start with **32×32** for characters).
- If you start from a drawing/photo:
  - use an online “pixelate” tool to reduce it to pixel art, then
  - remove the background, and
  - resize to 32×32 (nearest-neighbor / “pixelated” scaling).

## What’s next (easy upgrades)

- Add more characters to `CHARACTERS` (character select already exists).
- Add a real boss fight (boss is currently visual-only).
