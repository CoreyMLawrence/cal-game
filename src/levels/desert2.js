import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildDesert2Level() {
  const cols = 224;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);
  const putCoin = createCoinPlacer({ put, rows, groundY });

  fillGround(put, cols, groundY);

  function pit(start, width) {
    for (let x = start; x < start + width; x++) put(x, groundY, " ");
  }

  function platform(start, end, y, tile = "=") {
    for (let x = start; x <= end; x++) put(x, y, tile);
  }

  function coinLine(start, end, y, step = 2) {
    for (let x = start; x <= end; x += step) put(x, y, "o");
  }

  // Dune gaps and caravan spacing.
  pit(28, 4);
  pit(54, 5);
  pit(82, 5);
  pit(112, 6);
  pit(144, 5);
  pit(172, 6);
  pit(198, 5);

  // Spawn + first desert-exclusive powerup intro.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  put(16, 11, "Z");
  for (let x = 8; x <= 20; x += 2) putCoin(x, 14);

  // Caravan crossing 1.
  platform(28, 31, 13, "~");
  platform(34, 40, 12);
  platform(43, 47, 12, "~");
  platform(50, 53, 11);
  coinLine(28, 53, 11);
  put(38, rows - 2, "r");
  put(46, rows - 2, "p");

  // Ruin plateau + first stack walkers.
  platform(60, 76, 13, "#");
  platform(64, 70, 10, "#");
  put(68, 8, "S");
  put(61, 12, "I");
  put(75, 12, "I");
  coinLine(60, 76, 9);
  put(66, rows - 2, "t");
  put(73, rows - 2, "b");

  // Caravan crossing 2.
  platform(82, 85, 13, "~");
  platform(88, 93, 12);
  put(96, rows - 2, "^");
  platform(99, 107, 12);
  coinLine(82, 108, 11);
  put(90, rows - 2, "r");
  put(104, rows - 2, "p");

  // Sun-baked ruins with vertical movers.
  platform(112, 120, 13, "#");
  platform(123, 126, 11, "|");
  platform(128, 135, 10, "#");
  platform(137, 140, 11, "|");
  platform(142, 143, 10, "#");
  put(130, 8, "W");
  put(138, 9, "Z");
  coinLine(112, 143, 9);
  put(118, rows - 2, "t");
  put(133, rows - 2, "r");
  put(141, rows - 2, "b");

  // End lane: mixed movers and pressure.
  platform(144, 148, 13, "~");
  platform(151, 157, 12);
  platform(160, 165, 12, "~");
  platform(168, 171, 11);
  platform(172, 176, 13, "~");
  platform(180, 186, 12);
  coinLine(146, 186, 11);
  put(154, rows - 2, "p");
  put(166, rows - 2, "t");
  put(183, rows - 2, "b");

  // Final staircase + goal.
  const stairBaseX = cols - 30;
  for (let i = 0; i < 6; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 11, rows - 2, "t");
  put(cols - 6, 10, "!");
  put(cols - 15, 7, "h");
  for (let x = cols - 26; x <= cols - 12; x += 2) putCoin(x, 13);

  return toMap();
}
