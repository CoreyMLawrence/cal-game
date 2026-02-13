import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_5Level() {
  const cols = 260;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);

  fillGround(put, cols, groundY);

  function lavaPool(start, width, depth = 1) {
    for (let x = start; x < start + width; x++) {
      for (let d = 0; d < depth; d++) put(x, groundY - d, "L");
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
  put(19, rows - 2, "r");
  put(25, rows - 2, "p");

  // Trial 1: opening magma lanes.
  lavaPool(30, 10, 1);
  lavaPool(43, 9, 1);
  platform(30, 36, 13);
  put(34, 13, "~");
  platform(43, 48, 12);
  put(46, 12, "~");
  platform(52, 58, 12);
  coinLine(30, 58, 11);
  put(40, rows - 2, "b");
  put(50, rows - 2, "r");
  put(56, 11, "F");

  // Trial 2: climb pocket and pressure room.
  platform(62, 72, 12);
  put(74, rows - 2, "^");
  platform(76, 84, 11);
  platform(86, 94, 10);
  put(89, 9, "W");
  lavaPool(96, 6, 1);
  platform(96, 101, 13);
  coinLine(62, 102, 9);
  put(66, rows - 2, "r");
  put(78, rows - 2, "p");
  put(90, 9, "b");
  put(100, rows - 2, "r");
  put(82, 10, "F");
  put(94, 9, "F");

  // Trial 3: dual route chamber.
  lavaPool(106, 14, 1);
  lavaPool(124, 12, 1);
  platform(106, 112, 13); // low safe route
  platform(114, 118, 12);
  platform(124, 129, 13); // low safe route continuation
  platform(132, 136, 12);

  platform(108, 115, 10); // high fast route
  platform(118, 123, 9);
  platform(126, 132, 8, "B");
  put(129, 7, "*");
  put(136, 8, "h");

  coinLine(106, 136, 11);
  coinLine(108, 132, 7);
  put(112, rows - 2, "r");
  put(121, rows - 2, "b");
  put(130, rows - 2, "p");
  put(122, 8, "F");

  // Trial 4: chained movers over long magma.
  lavaPool(140, 24, 1);
  put(142, 13, "~");
  put(146, 12, "|");
  put(150, 11, "~");
  put(154, 10, "|");
  put(158, 11, "~");
  platform(162, 166, 10);
  platform(168, 172, 11);
  coinLine(140, 172, 9);
  put(163, 9, "r");
  put(170, 10, "b");
  put(156, 10, "F");

  // Trial 5: final gauntlet lanes.
  lavaPool(176, 11, 1);
  lavaPool(190, 10, 1);
  lavaPool(203, 9, 1);
  platform(176, 182, 13);
  put(180, 13, "~");
  platform(190, 196, 12);
  put(194, 12, "~");
  platform(203, 208, 13);
  put(206, 13, "~");
  platform(212, 220, 12);
  coinLine(176, 220, 11);
  put(184, rows - 2, "r");
  put(197, rows - 2, "p");
  put(210, rows - 2, "b");
  put(219, rows - 2, "r");
  put(196, 10, "F");
  put(208, 10, "F");

  // Throne approach tower.
  const stairBaseX = cols - 40;
  for (let i = 0; i < 10; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 36, rows - 2, "r");
  put(cols - 30, rows - 2, "b");
  put(cols - 24, rows - 2, "p");
  put(cols - 18, rows - 2, "b");
  put(cols - 12, rows - 2, "r");
  put(cols - 16, 8, "F");
  coinLine(cols - 38, cols - 10, 11);

  put(cols - 6, rows - 2, "D");

  return toMap();
}
