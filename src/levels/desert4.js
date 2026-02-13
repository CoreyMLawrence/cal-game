import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildDesert4Level() {
  const cols = 248;
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

  // Brutal wind-cut gaps.
  pit(26, 5);
  pit(50, 6);
  pit(80, 6);
  pit(110, 7);
  pit(144, 6);
  pit(174, 7);
  pit(208, 6);

  // Spawn.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  put(16, 11, "Z");
  for (let x = 8; x <= 20; x += 2) putCoin(x, 14);

  // Storm lane one.
  platform(26, 32, 13, "~");
  platform(35, 43, 12, "#");
  platform(46, 49, 12, "~");
  coinLine(26, 49, 11);
  put(36, rows - 2, "t");
  put(45, rows - 2, "p");

  // Ruin choke and spring redirect.
  platform(50, 57, 12, "#");
  put(60, rows - 2, "^");
  platform(63, 70, 11, "#");
  platform(72, 79, 10, "#");
  put(66, 9, "W");
  put(74, 8, "S");
  coinLine(50, 79, 9);
  put(58, rows - 2, "r");
  put(69, rows - 2, "t");
  put(78, rows - 2, "b");

  // Storm lane two.
  platform(80, 86, 13, "~");
  platform(89, 95, 12, "#");
  platform(98, 104, 12, "~");
  platform(107, 109, 11, "#");
  coinLine(80, 109, 10);
  put(90, rows - 2, "p");
  put(103, rows - 2, "t");

  // Sand temple stacks.
  platform(110, 119, 13, "#");
  platform(122, 125, 12, "|");
  platform(128, 136, 11, "#");
  platform(138, 143, 10, "#");
  put(130, 9, "I");
  put(134, 8, "Z");
  coinLine(110, 143, 9);
  put(116, rows - 2, "t");
  put(126, rows - 2, "r");
  put(141, rows - 2, "b");

  // Storm lane three.
  platform(144, 149, 13, "~");
  platform(152, 159, 12, "#");
  platform(162, 167, 12, "~");
  platform(170, 173, 11, "#");
  coinLine(144, 173, 10);
  put(154, rows - 2, "p");
  put(165, rows - 2, "t");

  // Endurance gauntlet.
  platform(174, 180, 13, "~");
  platform(183, 189, 12, "#");
  platform(192, 198, 12, "~");
  platform(201, 207, 11, "#");
  coinLine(174, 207, 10);
  put(184, rows - 2, "t");
  put(195, rows - 2, "r");
  put(205, rows - 2, "b");

  // Final stair + reward lane.
  const stairBaseX = cols - 36;
  for (let i = 0; i < 8; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 22, 8, "Z");
  put(cols - 16, rows - 2, "t");
  put(cols - 10, rows - 2, "r");
  put(cols - 6, 9, "!");
  for (let x = cols - 30; x <= cols - 12; x += 2) putCoin(x, 13);

  return toMap();
}
