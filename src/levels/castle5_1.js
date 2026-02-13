import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_1Level() {
  const cols = 236;
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

  // SECTION A: Spawn Vault.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 20, 11);
  platform(19, 23, 12);
  put(18, rows - 3, "r");
  put(24, rows - 3, "p");
  put(22, 11, "F");

  // SECTION B: First Magma Walk.
  lavaPool(29, 7, 1);
  lavaPool(41, 7, 1);
  platform(29, 35, 13);
  put(32, 13, "~");
  platform(38, 40, 12);
  platform(41, 47, 12);
  put(44, 12, "~");
  platform(50, 56, 12);
  coinLine(29, 57, 11);
  put(39, rows - 3, "b");
  put(47, rows - 3, "r");
  put(56, rows - 3, "p");
  put(44, 11, "F");

  // SECTION C: Fire Corridor.
  platform(60, 70, 12);
  put(72, rows - 3, "^");
  platform(74, 84, 12);
  lavaPool(86, 5, 1);
  platform(86, 90, 13);
  put(88, 13, "~");
  platform(92, 95, 12);
  coinLine(60, 95, 11);
  put(62, rows - 3, "r");
  put(67, rows - 3, "b");
  put(80, rows - 3, "p");
  put(93, rows - 3, "b");
  put(63, 11, "F");
  put(68, 11, "F");
  put(78, 11, "F");
  put(83, 11, "F");

  // SECTION D: Split Route Room.
  lavaPool(98, 7, 1);
  lavaPool(112, 7, 1);

  // Low route (safer).
  platform(98, 104, 13);
  platform(106, 111, 12);
  platform(112, 118, 13);
  platform(120, 126, 12);
  platform(128, 133, 12);

  // High route (faster + rewards).
  platform(96, 103, 10);
  platform(106, 112, 9);
  platform(115, 121, 10);
  platform(124, 130, 9);
  platform(108, 111, 7, "B");
  put(109, 5, "*");
  put(118, 8, "W");
  put(127, 10, "h");

  coinLine(96, 132, 9);
  coinLine(98, 132, 11);
  put(101, rows - 3, "r");
  put(111, 8, "p");
  put(121, rows - 3, "b");
  put(132, rows - 3, "r");

  // SECTION E: Moving Crucible (now with regular staging islands).
  platform(135, 138, 12);
  put(136, 10, "M");
  lavaPool(139, 9, 1);
  lavaPool(151, 9, 1);
  lavaPool(163, 9, 1);
  lavaPool(175, 9, 1);

  put(142, 13, "~");
  put(146, 13, "~");
  platform(148, 150, 13);

  put(154, 12, "~");
  put(157, 12, "|");
  platform(160, 162, 13);

  put(166, 13, "~");
  put(169, 12, "|");
  platform(172, 174, 13);

  put(178, 13, "~");
  put(181, 13, "~");
  platform(184, 188, 12);
  platform(190, 193, 12);

  coinLine(140, 193, 11);
  put(150, rows - 3, "r");
  put(162, rows - 3, "p");
  put(174, rows - 3, "b");
  put(188, rows - 3, "r");
  put(169, 10, "F");

  // SECTION F: Tower Lock.
  const stairBaseX = 194;
  for (let i = 0; i < 11; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 3 - y, "#");
  }
  put(194, rows - 3, "b");
  put(198, rows - 3, "r");
  put(203, rows - 3, "p");
  put(209, rows - 3, "b");
  put(220, rows - 3, "r");
  put(206, 10, "F");
  put(214, 9, "F");
  put(225, 9, "F");
  coinLine(194, 228, 11);

  put(cols - 6, rows - 3, "D");

  return toMap();
}
