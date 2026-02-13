import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_2Level() {
  const cols = 244;
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

  // Spawn and setup.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 18, 11);
  put(18, rows - 3, "r");
  put(23, rows - 3, "b");

  // Foundry basin one.
  lavaPool(28, 23, 1);
  platform(28, 33, 13);
  put(36, 13, "~");
  platform(39, 44, 12);
  put(47, 12, "~");
  platform(50, 56, 12);
  coinLine(28, 56, 11);
  put(35, 11, "F");
  put(46, 10, "F");
  put(55, rows - 3, "p");

  // Furnace corridor.
  platform(60, 72, 12);
  platform(75, 84, 11);
  put(78, 10, "S");
  put(86, rows - 3, "^");
  platform(88, 96, 11);
  put(90, 10, "W");
  lavaPool(98, 5, 1);
  platform(98, 102, 13);
  platform(104, 108, 12);
  coinLine(60, 108, 10);
  put(70, rows - 3, "r");
  put(79, rows - 3, "b");
  put(93, rows - 3, "p");
  put(104, rows - 3, "r");
  put(74, 11, "F");
  put(88, 10, "F");

  // Foundry basin two.
  lavaPool(112, 12, 1);
  lavaPool(127, 12, 1);
  lavaPool(142, 10, 1);
  platform(112, 117, 13);
  put(120, 13, "~");
  platform(124, 126, 12);
  platform(127, 132, 12);
  put(130, 12, "~");
  platform(135, 141, 11);
  put(144, 11, "|");
  platform(147, 151, 11);
  platform(154, 160, 12);
  put(157, 10, "M");
  coinLine(112, 160, 10);
  put(126, 10, "r");
  put(138, rows - 3, "p");
  put(156, rows - 3, "b");
  put(120, 10, "F");
  put(146, 10, "F");

  // Crucible lift lane.
  lavaPool(164, 8, 1);
  lavaPool(175, 8, 1);
  lavaPool(186, 7, 1);
  platform(164, 168, 13);
  put(171, 13, "~");
  platform(173, 174, 12);
  put(177, 12, "|");
  platform(180, 182, 12);
  put(186, 12, "~");
  platform(189, 193, 11);
  put(196, 11, "~");
  platform(199, 203, 12);
  put(205, rows - 3, "^");
  coinLine(164, 205, 10);
  put(184, rows - 3, "r");
  put(191, rows - 3, "b");
  put(201, rows - 3, "p");

  // Exit tower.
  const stairBaseX = cols - 36;
  for (let i = 0; i < 8; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 3 - y, "#");
  }
  put(cols - 32, rows - 3, "r");
  put(cols - 26, rows - 3, "b");
  put(cols - 19, rows - 3, "p");
  put(cols - 14, 9, "F");
  coinLine(cols - 34, cols - 10, 11);

  put(cols - 6, rows - 3, "D");

  return toMap();
}
