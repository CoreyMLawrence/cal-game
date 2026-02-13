import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_3Level() {
  const cols = 240;
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

  // Spawn and launch lane.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 20, 11);
  put(17, rows - 2, "r");
  put(22, rows - 2, "p");

  // Vertical room 1: climb via chainlift platforms.
  lavaPool(28, 10, 1);
  platform(28, 33, 13);
  put(35, 12, "|");
  platform(38, 43, 11);
  put(46, 10, "|");
  platform(49, 55, 9);
  put(57, 8, "W");
  platform(58, 64, 10);
  coinLine(28, 64, 8);
  put(40, 10, "r");
  put(52, 8, "b");
  put(44, 10, "F");

  // Catacomb tunnels with low/high route merge.
  platform(68, 80, 12);
  lavaPool(82, 7, 1);
  platform(82, 88, 13);
  platform(90, 101, 11);
  platform(92, 99, 8, "B");
  put(95, 7, "*");
  put(102, rows - 2, "^");
  platform(106, 118, 12);
  coinLine(68, 118, 10);
  coinLine(90, 101, 7);
  put(72, rows - 2, "r");
  put(86, rows - 2, "p");
  put(98, 10, "b");
  put(114, rows - 2, "r");
  put(112, 11, "F");

  // Vertical room 2: repeated lifts and ledges.
  lavaPool(122, 12, 1);
  platform(122, 126, 13);
  put(129, 12, "|");
  platform(132, 137, 11);
  put(140, 10, "|");
  platform(143, 148, 9);
  put(151, 8, "|");
  platform(154, 159, 9);
  platform(162, 170, 11);
  coinLine(122, 170, 8);
  put(134, 10, "p");
  put(146, 8, "r");
  put(164, 10, "b");
  put(148, 8, "F");

  // Crossfire bridge with staggered hazards.
  lavaPool(174, 14, 1);
  platform(174, 180, 12);
  put(183, 11, "~");
  platform(186, 190, 12);
  platform(192, 199, 11);
  coinLine(174, 199, 10);
  put(178, rows - 2, "r");
  put(188, rows - 2, "b");
  put(197, rows - 2, "p");
  put(180, 10, "F");
  put(194, 10, "F");

  // Exit tower and door.
  const stairBaseX = cols - 36;
  for (let i = 0; i < 8; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 32, rows - 2, "r");
  put(cols - 25, rows - 2, "b");
  put(cols - 18, rows - 2, "p");
  put(cols - 13, 8, "F");
  coinLine(cols - 34, cols - 10, 11);

  put(cols - 6, rows - 2, "D");

  return toMap();
}
