import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildDesert3Level() {
  const cols = 236;
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

  // Sunken-temple floor breaks.
  pit(24, 5);
  pit(48, 4);
  pit(72, 6);
  pit(103, 5);
  pit(130, 6);
  pit(162, 5);
  pit(193, 6);

  // Spawn + setup.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  for (let x = 8; x <= 18; x += 2) putCoin(x, 14);

  // Entry ruins.
  platform(24, 31, 13, "#");
  platform(33, 40, 12, "#");
  platform(42, 47, 11, "#");
  put(30, 11, "I");
  put(39, 10, "I");
  put(45, 9, "Z");
  coinLine(24, 47, 10);
  put(29, rows - 2, "r");
  put(41, rows - 2, "t");

  // Collapsed chambers.
  platform(48, 54, 13, "~");
  platform(57, 63, 12, "#");
  platform(66, 71, 12, "~");
  put(64, rows - 2, "^");
  coinLine(48, 71, 10);
  put(58, rows - 2, "p");
  put(70, rows - 2, "b");

  // Vertical ruin shaft with moving lifts.
  platform(72, 78, 13, "#");
  platform(81, 83, 12, "|");
  platform(86, 92, 10, "#");
  platform(95, 97, 12, "|");
  platform(99, 103, 9, "#");
  put(88, 8, "S");
  put(96, 7, "W");
  coinLine(72, 103, 8);
  put(76, rows - 2, "t");
  put(91, rows - 2, "r");
  put(102, rows - 2, "p");

  // Temple roof run.
  platform(108, 121, 12, "#");
  platform(110, 117, 9, "B");
  put(113, 7, "*");
  platform(124, 129, 11, "#");
  coinLine(108, 129, 8);
  put(116, rows - 2, "b");
  put(126, rows - 2, "t");

  // Sand channels and convoy lane.
  platform(130, 134, 13, "~");
  platform(137, 142, 12, "#");
  platform(145, 150, 12, "~");
  platform(153, 161, 11, "#");
  coinLine(130, 161, 10);
  put(139, rows - 2, "p");
  put(149, rows - 2, "r");
  put(159, rows - 2, "t");

  // Final temple approach.
  platform(162, 168, 13, "#");
  platform(171, 177, 12, "#");
  platform(180, 186, 11, "#");
  platform(189, 192, 10, "#");
  put(175, 9, "Z");
  put(184, 8, "I");
  coinLine(162, 192, 9);
  put(173, rows - 2, "b");
  put(186, rows - 2, "t");

  // Exit.
  const stairBaseX = cols - 34;
  for (let i = 0; i < 7; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 15, rows - 2, "r");
  put(cols - 11, rows - 2, "t");
  put(cols - 6, 9, "!");
  for (let x = cols - 26; x <= cols - 12; x += 2) putCoin(x, 13);

  return toMap();
}
