import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_1Level() {
  const cols = 236;
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

  // SECTION A: Spawn Vault.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 20, 11);
  platform(19, 23, 12);
  put(18, rows - 2, "r");
  put(24, rows - 2, "p");
  put(22, 11, "F");

  // SECTION B: First Magma Walk.
  lavaPool(29, 6, 1);
  lavaPool(40, 7, 1);
  platform(29, 35, 13);
  put(32, 13, "~");
  platform(40, 46, 12);
  put(43, 12, "~");
  coinLine(28, 48, 12);
  put(38, rows - 2, "b");
  put(47, rows - 2, "r");
  put(56, rows - 2, "p");
  put(44, 11, "F");

  // SECTION C: Fire Corridor.
  platform(60, 70, 12);
  put(72, rows - 2, "^");
  platform(74, 84, 12);
  lavaPool(86, 5, 1);
  platform(86, 90, 13);
  put(88, 13, "~");
  coinLine(60, 93, 11);
  put(62, rows - 2, "r");
  put(67, rows - 2, "b");
  put(80, rows - 2, "p");
  put(92, rows - 2, "b");
  put(63, 11, "F");
  put(68, 11, "F");
  put(78, 11, "F");
  put(83, 11, "F");

  // SECTION D: Split Route Room.
  lavaPool(98, 6, 1);
  lavaPool(110, 7, 1);
  platform(98, 104, 13);
  platform(110, 116, 13);
  platform(96, 103, 10);
  platform(106, 112, 9);
  platform(115, 122, 10);
  platform(124, 132, 12);
  platform(108, 111, 7, "B");
  put(109, 6, "*");
  put(118, 8, "W");
  put(124, 10, "h");
  coinLine(96, 132, 9);
  coinLine(98, 118, 12);
  put(101, rows - 2, "r");
  put(111, 8, "p");
  put(121, rows - 2, "b");
  put(132, rows - 2, "r");

  // SECTION E: Moving Crucible.
  lavaPool(139, 10, 1);
  lavaPool(152, 12, 1);
  lavaPool(167, 11, 1);
  lavaPool(181, 8, 1);
  platform(149, 151, 13);
  platform(164, 166, 12);
  platform(178, 180, 13);
  platform(188, 191, 12);
  put(141, 13, "~");
  put(144, 12, "|");
  put(147, 13, "~");
  put(154, 12, "~");
  put(158, 11, "|");
  put(162, 12, "~");
  put(169, 13, "~");
  put(173, 12, "|");
  put(176, 13, "~");
  put(183, 12, "~");
  put(187, 11, "|");
  coinLine(140, 191, 11);
  put(150, rows - 2, "r");
  put(165, rows - 2, "p");
  put(165, 11, "r");
  put(179, rows - 2, "b");
  put(189, rows - 2, "r");
  put(174, 10, "F");

  // SECTION F: Tower Lock.
  const stairBaseX = 194;
  for (let i = 0; i < 11; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(194, rows - 2, "b");
  put(198, rows - 2, "r");
  put(203, rows - 2, "p");
  put(209, rows - 2, "b");
  put(220, rows - 2, "r");
  put(206, 10, "F");
  put(214, 9, "F");
  put(225, 9, "F");
  coinLine(194, 228, 11);

  put(cols - 6, rows - 2, "D");

  return toMap();
}
