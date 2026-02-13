import { createLevelGrid, fillGround } from "./common.js";

export function buildBoss5Level() {
  const cols = 128;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);

  fillGround(put, cols, groundY);

  // Castle roof shell.
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

  // Lava-cut floor pockets force repositioning during boss dives.
  for (let x = 18; x <= 24; x++) put(x, groundY, "L");
  for (let x = 40; x <= 46; x++) put(x, groundY, "L");
  for (let x = 62; x <= 68; x++) put(x, groundY, "L");
  for (let x = 84; x <= 90; x++) put(x, groundY, "L");
  for (let x = 104; x <= 110; x++) put(x, groundY, "L");

  // Jump-assist platforms for stomp setups.
  for (let x = 14; x <= 20; x++) put(x, 12, "#");
  for (let x = 30; x <= 36; x++) put(x, 11, "#");
  for (let x = 52; x <= 58; x++) put(x, 12, "#");
  for (let x = 74; x <= 80; x++) put(x, 11, "#");
  for (let x = 96; x <= 102; x++) put(x, 12, "#");

  // Fire posts add pressure without blocking movement options.
  put(26, 10, "F");
  put(48, 10, "F");
  put(70, 10, "F");
  put(92, 10, "F");

  // Spawn and boss marker.
  put(6, rows - 3, "@");
  put(cols / 2, 5, "U");

  return toMap();
}
