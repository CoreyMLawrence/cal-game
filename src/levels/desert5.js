import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildDesert5Level() {
  const cols = 256;
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

  // Citadel approach gaps.
  pit(28, 5);
  pit(54, 6);
  pit(84, 6);
  pit(116, 7);
  pit(150, 6);
  pit(182, 7);
  pit(216, 6);

  // Spawn + loadout.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  put(16, 11, "Z");
  for (let x = 8; x <= 20; x += 2) putCoin(x, 14);

  // Trial 1.
  platform(28, 34, 13, "~");
  platform(37, 45, 12, "#");
  platform(48, 53, 12, "~");
  coinLine(28, 53, 11);
  put(40, rows - 2, "t");
  put(51, rows - 2, "p");

  // Trial 2.
  platform(54, 61, 12, "#");
  put(64, rows - 2, "^");
  platform(67, 74, 11, "#");
  platform(76, 83, 10, "#");
  put(70, 9, "W");
  put(79, 8, "S");
  coinLine(54, 83, 9);
  put(59, rows - 2, "r");
  put(73, rows - 2, "t");
  put(82, rows - 2, "b");

  // Trial 3: split route over deep dunes.
  platform(84, 90, 13, "#");
  platform(92, 97, 12, "#");
  platform(101, 107, 13, "#");

  platform(86, 93, 10, "B");
  platform(96, 102, 9, "B");
  platform(105, 112, 8, "B");
  put(99, 7, "*");
  put(108, 6, "Z");

  coinLine(84, 113, 11);
  coinLine(86, 112, 7);
  put(94, rows - 2, "t");
  put(104, rows - 2, "r");
  put(112, rows - 2, "p");

  // Trial 4: convoy lane.
  platform(116, 121, 13, "~");
  platform(124, 131, 12, "#");
  platform(134, 139, 12, "~");
  platform(142, 149, 11, "#");
  coinLine(116, 149, 10);
  put(127, rows - 2, "t");
  put(138, rows - 2, "b");
  put(146, rows - 2, "r");

  // Trial 5: final storm pressure.
  platform(150, 156, 13, "~");
  platform(159, 165, 12, "#");
  platform(168, 174, 12, "~");
  platform(177, 181, 11, "#");
  coinLine(150, 181, 10);
  put(161, rows - 2, "p");
  put(170, rows - 2, "t");
  put(179, rows - 2, "b");

  // Trial 6: throne-antechamber stairs.
  platform(182, 188, 13, "#");
  platform(191, 197, 12, "#");
  platform(200, 206, 11, "#");
  platform(209, 215, 10, "#");
  put(194, 10, "I");
  put(203, 9, "Z");
  coinLine(182, 215, 9);
  put(196, rows - 2, "t");
  put(207, rows - 2, "r");
  put(214, rows - 2, "p");

  // Final ascent and boss door.
  const stairBaseX = cols - 40;
  for (let i = 0; i < 10; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 25, rows - 2, "t");
  put(cols - 18, rows - 2, "b");
  put(cols - 12, rows - 2, "r");
  put(cols - 6, rows - 2, "D");
  for (let x = cols - 34; x <= cols - 10; x += 2) putCoin(x, 13);

  return toMap();
}
