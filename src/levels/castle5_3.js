import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_3Level() {
  const cols = 240;
  const rows = 18;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);

  const floorY = groundY - 1;
  fillGround(put, cols, floorY);

  function lavaPool(start, width, depth = 1) {
    for (let x = start; x < start + width; x++) {
      // Keep a solid floor under lava so Forge Core can traverse through it.
      put(x, groundY, "#");
      for (let d = 0; d < depth; d++) put(x, groundY - 1 - d, "L");
    }
  }

  function platform(start, end, y, tile = "#") {
    for (let x = start; x <= end; x++) put(x, y, tile);
  }

  function coinLine(start, end, y, step = 2) {
    for (let x = start; x <= end; x += step) put(x, y, "o");
  }

  // Castle roof shell.
  for (let x = 0; x < cols; x++) put(x, 1, "#");
  for (let x = 0; x < cols; x++) {
    if (x % 2 === 0 || x % 5 === 0) put(x, 2, "#");
  }

  // Spawn and launch lane.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 20, 11);
  put(17, rows - 3, "r");
  put(22, rows - 3, "p");

  // Vertical room 1: chainlift intro.
  lavaPool(28, 10, 1);
  platform(28, 33, 13);
  put(35, 12, "|");
  platform(38, 43, 11);
  put(45, 10, "|");
  platform(48, 54, 10);
  put(55, 7, "v");
  put(55, 8, "v");
  put(55, 9, "v");
  put(55, 10, "v");
  put(55, 11, "v");
  put(55, 12, "v");
  put(55, 13, "v");
  put(55, 14, "v");
  put(59, 9, "W");
  platform(57, 64, 11);
  coinLine(28, 64, 9);
  put(40, 10, "r");
  put(52, 9, "b");
  put(44, 10, "F");

  // Catacomb tunnels with low/high route merge.
  platform(68, 80, 12);
  lavaPool(82, 7, 1);
  platform(82, 88, 13);
  put(85, 13, "~");
  platform(90, 101, 11);
  platform(92, 99, 8, "B");
  put(95, 6, "*");
  put(102, rows - 3, "^");
  platform(106, 118, 12);
  coinLine(68, 118, 10);
  coinLine(90, 101, 7);
  put(72, rows - 3, "r");
  put(86, rows - 3, "p");
  put(98, 10, "b");
  put(114, rows - 3, "r");
  put(112, 11, "F");

  // Vertical room 2: repeated lifts and ledges.
  lavaPool(122, 10, 1);
  platform(122, 126, 13);
  put(129, 12, "|");
  platform(132, 137, 11);
  put(140, 10, "|");
  platform(143, 148, 10);
  put(151, 11, "|");
  platform(154, 160, 11);
  platform(162, 170, 12);
  put(166, 10, "M");
  put(141, 8, "v");
  put(141, 9, "v");
  put(141, 10, "v");
  put(141, 11, "v");
  put(141, 12, "v");
  put(141, 13, "v");
  put(141, 14, "v");
  coinLine(122, 170, 9);
  put(134, 10, "p");
  put(146, 9, "r");
  put(164, rows - 3, "b");
  put(148, 9, "F");

  // Crossfire bridge with staggered hazards.
  lavaPool(174, 8, 1);
  lavaPool(185, 7, 1);
  platform(174, 180, 12);
  put(183, 12, "~");
  platform(185, 191, 12);
  platform(194, 201, 11);
  coinLine(174, 201, 10);
  put(178, rows - 3, "r");
  put(188, rows - 3, "b");
  put(197, rows - 3, "p");
  put(180, 10, "F");
  put(194, 10, "F");

  // Exit tower and door.
  const stairBaseX = cols - 36;
  for (let i = 0; i < 8; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 3 - y, "#");
  }
  put(cols - 32, rows - 3, "r");
  put(cols - 25, rows - 3, "b");
  put(cols - 18, rows - 3, "p");
  put(cols - 13, 8, "F");
  coinLine(cols - 34, cols - 10, 11);

  put(cols - 6, rows - 3, "D");

  return toMap();
}
