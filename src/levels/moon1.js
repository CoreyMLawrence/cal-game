import { createLevelGrid, fillGround } from "./common.js";

export function buildMoon1Level() {
  const cols = 216;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);

  fillGround(put, cols, groundY);

  // Spawn and quick tool blocks.
  put(4, rows - 3, "@");
  put(11, 12, "?");
  put(12, 12, "*");
  put(13, 12, "?");
  for (let x = 8; x <= 18; x += 2) put(x, 11, "o");

  // Obstacle 1: a wall that expects a moon jump.
  for (let x = 24; x <= 25; x++) {
    for (let y = groundY - 1; y >= groundY - 3; y--) put(x, y, "#");
  }
  for (let x = 28; x <= 32; x++) put(x, groundY - 1, "#");
  for (let x = 29; x <= 31; x += 2) put(x, groundY - 3, "o");

  // Obstacle 2: moon craters with wide asteroid jumps.
  for (let x = 34; x <= 157; x++) put(x, groundY, " ");

  const asteroidPlatforms = [
    [34, 13],
    [41, 12],
    [48, 11],
    [56, 12],
    [65, 10],
    [74, 11],
    [83, 12],
    [92, 10],
    [101, 11],
    [110, 9],
    [119, 10],
    [128, 11],
    [137, 12],
    [146, 10],
    [154, 11],
  ];
  // Asteroid hops are now 3-block platforms to be more readable in low gravity.
  for (const [x, y] of asteroidPlatforms) {
    for (let dx = -1; dx <= 1; dx++) put(x + dx, y, "#");
  }
  for (let i = 0; i < asteroidPlatforms.length; i++) {
    if (i % 2 !== 0) continue;
    const [x, y] = asteroidPlatforms[i];
    put(x, y - 1, "o");
  }

  // Hover-bots guarding jumps.
  const hoverBots = [
    [45, 9],
    [69, 8],
    [97, 8],
    [124, 9],
    [150, 8],
  ];
  for (const [x, y] of hoverBots) put(x, y, "f");

  // Astro-robots on stable moon rock.
  const astroBots = [
    [19, groundY - 1],
    [166, groundY - 1],
    [182, groundY - 1],
  ];
  for (const [x, y] of astroBots) put(x, y, "a");

  // End section: moon-rock pedestal and goal.
  for (let x = 170; x <= 173; x++) put(x, groundY, " ");
  for (let x = 188; x <= 195; x++) put(x, groundY - 1, "#");
  for (let x = 190; x <= 193; x++) put(x, groundY - 2, "#");
  for (let x = 191; x <= 192; x++) put(x, groundY - 3, "#");
  put(cols - 8, 10, "!");

  // End reward lane.
  for (let x = cols - 24; x <= cols - 12; x += 2) put(x, 11, "o");

  return toMap();
}
