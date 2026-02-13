import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_2Level() {
  const cols = 244;
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

  // Spawn and setup.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 18, 11);
  put(18, rows - 2, "r");
  put(23, rows - 2, "b");

  // Foundry basin one: deep magma and moving chains.
  lavaPool(28, 22, 2);
  platform(28, 33, 13);
  put(36, 12, "~");
  platform(40, 44, 11);
  put(48, 12, "|");
  platform(52, 56, 11);
  platform(58, 61, 12);
  coinLine(28, 61, 10);
  put(35, 11, "F");
  put(46, 10, "F");
  put(58, rows - 2, "p");

  // Furnace corridor.
  platform(68, 82, 12);
  platform(86, 96, 11);
  lavaPool(98, 5, 1);
  platform(98, 102, 13);
  put(90, 10, "W");
  coinLine(68, 104, 10);
  put(70, rows - 2, "r");
  put(78, rows - 2, "b");
  put(90, rows - 2, "p");
  put(96, rows - 2, "r");
  put(74, 11, "F");
  put(88, 10, "F");

  // Foundry basin two: longer mover rhythm with safe stones.
  lavaPool(110, 20, 2);
  lavaPool(134, 17, 2);
  platform(110, 114, 13);
  put(118, 12, "~");
  put(122, 11, "|");
  platform(125, 128, 10);
  put(132, 12, "~");
  platform(136, 140, 11);
  put(144, 12, "|");
  platform(148, 152, 11);
  platform(155, 158, 12);
  coinLine(110, 158, 9);
  put(126, 9, "r");
  put(138, 10, "p");
  put(156, rows - 2, "b");
  put(120, 10, "F");
  put(146, 10, "F");

  // Crucible lift lane.
  lavaPool(164, 18, 1);
  put(166, 12, "|");
  put(170, 11, "~");
  put(174, 10, "|");
  put(178, 11, "~");
  platform(182, 186, 10);
  platform(188, 194, 12);
  put(196, rows - 2, "^");
  coinLine(164, 198, 9);
  put(184, rows - 2, "r");
  put(190, rows - 2, "b");
  put(198, rows - 2, "p");

  // Exit tower.
  const stairBaseX = cols - 36;
  for (let i = 0; i < 8; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 32, rows - 2, "r");
  put(cols - 26, rows - 2, "b");
  put(cols - 19, rows - 2, "p");
  put(cols - 14, 9, "F");
  coinLine(cols - 34, cols - 10, 11);

  put(cols - 6, rows - 2, "D");

  return toMap();
}
