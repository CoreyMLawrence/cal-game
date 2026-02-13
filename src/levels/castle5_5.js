import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_5Level() {
  const cols = 260;
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

  // Spawn and final prep.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 20, 11);
  put(19, rows - 3, "r");
  put(25, rows - 3, "p");

  // Trial 1: opening magma lanes.
  lavaPool(30, 10, 1);
  lavaPool(43, 9, 1);
  platform(30, 36, 13);
  put(34, 13, "~");
  platform(43, 48, 12);
  put(46, 12, "~");
  platform(52, 58, 12);
  coinLine(30, 58, 11);
  put(40, rows - 3, "b");
  put(50, rows - 3, "r");
  put(56, 11, "F");

  // Trial 2: climb pocket and pressure room.
  platform(62, 72, 12);
  put(74, rows - 3, "^");
  platform(76, 84, 11);
  platform(86, 94, 10);
  put(89, 8, "W");
  put(92, 10, "S");
  lavaPool(96, 6, 1);
  platform(96, 101, 13);
  platform(103, 105, 12);
  coinLine(62, 105, 9);
  put(66, rows - 3, "r");
  put(78, rows - 3, "p");
  put(90, 9, "b");
  put(103, rows - 3, "r");
  put(82, 10, "F");
  put(94, 9, "F");

  // Trial 3: dual route chamber.
  lavaPool(106, 14, 1);
  lavaPool(124, 12, 1);

  // Low safe route.
  platform(106, 112, 13);
  platform(114, 118, 12);
  platform(124, 129, 13);
  platform(132, 137, 12);

  // High fast route.
  platform(108, 115, 10);
  platform(118, 123, 9);
  platform(126, 132, 8, "B");
  put(129, 6, "*");
  put(136, 8, "h");
  put(133, 7, "O");

  coinLine(106, 138, 11);
  coinLine(108, 132, 7);
  put(112, rows - 3, "r");
  put(121, rows - 3, "b");
  put(130, rows - 3, "p");
  put(122, 8, "F");

  // Trial 4: chained movers over long magma (with fixed bailout pads).
  lavaPool(140, 12, 1);
  lavaPool(155, 10, 1);
  lavaPool(168, 7, 1);
  put(142, 13, "~");
  platform(145, 147, 13);
  put(150, 12, "~");
  platform(152, 154, 12);
  put(158, 12, "|");
  platform(160, 164, 11);
  put(168, 11, "~");
  platform(170, 175, 11);
  put(173, 9, "M");
  coinLine(140, 175, 10);
  put(163, 10, "r");
  put(171, rows - 3, "b");
  put(156, 10, "F");

  // Trial 5: final gauntlet lanes.
  lavaPool(178, 10, 1);
  lavaPool(191, 9, 1);
  lavaPool(203, 9, 1);
  platform(178, 184, 13);
  put(182, 13, "~");
  platform(191, 196, 12);
  put(194, 12, "~");
  platform(203, 208, 13);
  put(206, 13, "~");
  platform(212, 221, 12);
  coinLine(178, 221, 11);
  put(184, rows - 3, "r");
  put(197, rows - 3, "p");
  put(210, rows - 3, "b");
  put(219, rows - 3, "r");
  put(196, 10, "F");
  put(208, 10, "F");

  // Throne approach tower.
  const stairBaseX = cols - 40;
  for (let i = 0; i < 10; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 3 - y, "#");
  }
  put(cols - 36, rows - 3, "r");
  put(cols - 30, rows - 3, "b");
  put(cols - 24, rows - 3, "p");
  put(cols - 18, rows - 3, "b");
  put(cols - 12, rows - 3, "r");
  put(cols - 16, 8, "F");
  coinLine(cols - 38, cols - 10, 11);

  put(cols - 6, rows - 3, "D");

  return toMap();
}
