import { createLevelGrid, fillGround } from "./common.js";

export function buildBoss1Level() {
  const cols = 96;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);

  fillGround(put, cols, groundY);

  // Castle tunnel roof.
  for (let x = 0; x < cols; x++) put(x, 1, "#");
  for (let x = 0; x < cols; x++) {
    if (x % 2 === 0 || x % 5 === 0) put(x, 2, "#");
  }

  // Arena side walls.
  for (let y = 8; y <= groundY; y++) {
    put(0, y, "#");
    put(1, y, "#");
    put(cols - 2, y, "#");
    put(cols - 1, y, "#");
  }

  // Jump-assist platforms to help line up stomps.
  for (let x = 16; x <= 24; x++) put(x, 12, "#");
  for (let x = 36; x <= 44; x++) put(x, 11, "#");
  for (let x = 52; x <= 60; x++) put(x, 12, "#");
  for (let x = 72; x <= 80; x++) put(x, 11, "#");

  // Spawn and boss marker.
  put(6, rows - 3, "@");
  put(48, 5, "U");

  return toMap();
}
