import { createLevelGrid, fillGround } from "./common.js";

export function buildCastle5_4Level() {
  const cols = 252;
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

  // Spawn and sparse support.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  coinLine(8, 18, 11);
  put(18, rows - 2, "r");
  put(24, rows - 2, "b");

  // Reactor cycle 1.
  lavaPool(30, 12, 1);
  platform(30, 35, 13);
  put(38, 12, "~");
  platform(41, 46, 12);
  put(33, 11, "F");
  put(44, 11, "F");
  put(48, rows - 2, "p");
  coinLine(30, 50, 11);

  // Reactor cycle 2.
  lavaPool(54, 13, 1);
  platform(54, 59, 13);
  put(62, 12, "|");
  platform(65, 70, 11);
  put(73, 12, "~");
  platform(76, 80, 12);
  put(58, 10, "F");
  put(68, 10, "F");
  put(79, 11, "F");
  coinLine(54, 82, 10);
  put(60, rows - 2, "r");
  put(72, rows - 2, "b");
  put(82, rows - 2, "p");

  // Recovery hall with optional wing route.
  platform(86, 102, 12);
  platform(90, 98, 9);
  put(94, 8, "W");
  platform(104, 112, 11);
  coinLine(86, 112, 10);
  put(90, rows - 2, "r");
  put(101, rows - 2, "p");
  put(110, rows - 2, "b");

  // Reactor cycle 3 (longer).
  lavaPool(116, 15, 1);
  lavaPool(134, 14, 1);
  platform(116, 120, 13);
  put(123, 12, "~");
  platform(126, 130, 12);
  put(133, 11, "|");
  platform(136, 140, 10);
  put(143, 11, "~");
  platform(146, 150, 12);
  coinLine(116, 150, 9);
  put(121, rows - 2, "r");
  put(131, rows - 2, "p");
  put(140, 9, "b");
  put(148, rows - 2, "r");
  put(129, 10, "F");
  put(144, 10, "F");

  // Reactor cycle 4 (tight exits).
  lavaPool(154, 15, 1);
  platform(154, 158, 13);
  put(161, 12, "|");
  platform(164, 168, 11);
  put(171, 12, "~");
  platform(174, 178, 11);
  coinLine(154, 178, 9);
  put(160, rows - 2, "b");
  put(172, rows - 2, "p");
  put(176, 10, "F");

  // Endurance closeout with chained lava pockets.
  lavaPool(182, 8, 1);
  lavaPool(192, 8, 1);
  lavaPool(202, 7, 1);
  platform(182, 189, 13);
  platform(192, 199, 12);
  platform(202, 208, 13);
  put(186, 13, "~");
  put(196, 12, "~");
  put(205, 13, "~");
  coinLine(182, 210, 11);
  put(188, rows - 2, "r");
  put(198, rows - 2, "b");
  put(209, rows - 2, "p");
  put(194, 10, "F");
  put(206, 10, "F");

  // Exit tower and door.
  const stairBaseX = cols - 38;
  for (let i = 0; i < 9; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 34, rows - 2, "r");
  put(cols - 28, rows - 2, "b");
  put(cols - 21, rows - 2, "p");
  put(cols - 16, rows - 2, "b");
  put(cols - 14, 8, "F");
  coinLine(cols - 36, cols - 10, 11);

  put(cols - 6, rows - 2, "D");

  return toMap();
}
