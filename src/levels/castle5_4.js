import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_4Level() {
  const cols = 252;
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

  // Spawn and sparse support.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 18, 11);
  put(18, rows - 3, "r");
  put(24, rows - 3, "b");

  // Reactor cycle 1.
  lavaPool(30, 11, 1);
  platform(30, 35, 13);
  put(38, 13, "~");
  platform(41, 46, 12);
  platform(48, 52, 12);
  put(33, 11, "F");
  put(44, 11, "F");
  put(50, rows - 3, "p");
  coinLine(30, 52, 11);

  // Reactor cycle 2.
  lavaPool(54, 11, 1);
  lavaPool(70, 9, 1);
  platform(54, 59, 13);
  put(62, 12, "|");
  platform(65, 69, 11);
  put(73, 11, "~");
  platform(76, 82, 12);
  coinLine(54, 82, 10);
  put(60, rows - 3, "r");
  put(72, rows - 3, "b");
  put(82, rows - 3, "p");
  put(58, 10, "F");
  put(79, 11, "F");

  // Recovery hall with optional wing route.
  platform(86, 102, 12);
  platform(90, 98, 9);
  put(94, 7, "W");
  platform(104, 112, 11);
  coinLine(86, 112, 10);
  put(90, rows - 3, "r");
  put(101, rows - 3, "p");
  put(110, rows - 3, "b");

  // Reactor cycle 3.
  lavaPool(116, 11, 1);
  lavaPool(130, 10, 1);
  lavaPool(143, 8, 1);
  platform(116, 120, 13);
  put(123, 12, "~");
  platform(126, 129, 12);
  put(133, 11, "|");
  platform(136, 140, 11);
  put(144, 11, "~");
  platform(147, 152, 12);
  put(151, 10, "M");
  coinLine(116, 152, 10);
  put(121, rows - 3, "r");
  put(131, rows - 3, "p");
  put(140, rows - 3, "b");
  put(149, rows - 3, "r");
  put(129, 10, "F");
  put(145, 10, "F");

  // Reactor cycle 4.
  lavaPool(154, 11, 1);
  lavaPool(168, 11, 1);
  platform(154, 158, 13);
  put(161, 12, "|");
  platform(164, 167, 12);
  put(171, 12, "~");
  platform(174, 179, 11);
  coinLine(154, 179, 10);
  put(160, rows - 3, "b");
  put(172, rows - 3, "p");
  put(176, 10, "F");

  // Endurance closeout with chained lava pockets.
  lavaPool(182, 8, 1);
  lavaPool(192, 8, 1);
  lavaPool(202, 7, 1);
  platform(182, 189, 13);
  put(186, 13, "~");
  platform(192, 199, 12);
  put(196, 12, "~");
  platform(202, 208, 13);
  put(205, 13, "~");
  platform(210, 213, 12);
  coinLine(182, 213, 11);
  put(188, rows - 3, "r");
  put(198, rows - 3, "b");
  put(209, rows - 3, "p");
  put(194, 10, "F");
  put(206, 10, "F");

  // Exit tower and door.
  const stairBaseX = cols - 38;
  for (let i = 0; i < 9; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 3 - y, "#");
  }
  put(cols - 34, rows - 3, "r");
  put(cols - 28, rows - 3, "b");
  put(cols - 21, rows - 3, "p");
  put(cols - 16, rows - 3, "b");
  put(cols - 14, 8, "F");
  coinLine(cols - 36, cols - 10, 11);

  put(cols - 6, rows - 3, "D");

  return toMap();
}
