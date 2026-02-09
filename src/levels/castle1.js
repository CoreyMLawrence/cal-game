import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildCastle1Level() {
  const cols = 224;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);
  const putCoin = createCoinPlacer({ put, rows, groundY });

  fillGround(put, cols, groundY);

  // Castle tunnel roof.
  for (let x = 0; x < cols; x++) put(x, 1, "#");
  for (let x = 0; x < cols; x++) {
    if (x % 2 === 0 || x % 5 === 0) put(x, 2, "#");
  }

  function lavaPool(start, width, depth = 1) {
    for (let x = start; x < start + width; x++) {
      for (let d = 0; d < depth; d++) put(x, groundY - d, "L");
    }
  }

  // Spawn zone.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  for (let x = 8; x <= 16; x += 2) putCoin(x, 12);

  // Opening pressure lane with tight robot spacing.
  put(18, rows - 2, "r");
  put(22, rows - 2, "b");
  put(26, rows - 2, "p");
  put(20, rows - 2, "F");

  // Lava trench 1 with an easier bridge.
  lavaPool(30, 6, 1);
  for (let x = 30; x <= 35; x++) put(x, 13, "#");
  put(32, 13, "~");
  for (let x = 30; x <= 36; x += 2) putCoin(x, 12);

  // Stone room + overhead hazards.
  for (let x = 42; x <= 56; x++) put(x, 12, "#");
  for (let x = 46; x <= 53; x += 2) putCoin(x, 12);
  put(45, rows - 2, "r");
  put(52, rows - 2, "b");
  put(48, 11, "F");
  put(55, 11, "F");

  // Lava trench 2 with continuous bridge and hazard timing.
  lavaPool(60, 8, 1);
  for (let x = 60; x <= 67; x++) put(x, 12, "#");
  put(63, 11, "F");
  put(66, 11, "F");
  for (let x = 60; x <= 68; x += 2) putCoin(x, 12);

  // Mid castle climb with enemies and spring.
  put(75, rows - 2, "^");
  for (let x = 79; x <= 90; x++) put(x, 12, "#");
  for (let x = 92; x <= 99; x++) put(x, 11, "#");
  put(83, rows - 2, "p");
  put(89, rows - 2, "r");
  put(95, rows - 2, "b");
  for (let x = 80; x <= 98; x += 2) putCoin(x, 12);

  // Central lava gauntlet (still dangerous but now more traversable).
  lavaPool(104, 10, 1);
  for (let x = 104; x <= 113; x++) put(x, 12, "#");
  put(108, 12, "~");
  put(111, 12, "~");
  put(108, 11, "F");
  put(112, 11, "F");
  for (let x = 104; x <= 114; x += 2) putCoin(x, 12);

  // Brick choke point.
  for (let x = 124; x <= 132; x++) put(x, 12, "B");
  put(127, rows - 2, "r");
  put(131, rows - 2, "b");
  for (let x = 124; x <= 132; x += 2) putCoin(x, 12);

  // Final hazard run before the tower.
  lavaPool(138, 8, 1);
  for (let x = 138; x <= 145; x++) put(x, 13, "#");
  put(141, 13, "~");
  put(143, 13, "~");
  for (let x = 147; x <= 150; x++) put(x, 12, "#");
  put(141, 11, "F");
  put(145, 11, "F");
  put(149, rows - 2, "p");
  put(151, rows - 2, "r");
  for (let x = 138; x <= 152; x += 2) putCoin(x, 12);

  // End tower stairs with dense enemies.
  const stairBaseX = cols - 40;
  for (let i = 0; i < 9; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }
  put(cols - 42, rows - 2, "r");
  put(cols - 36, rows - 2, "b");
  put(cols - 30, rows - 2, "p");
  put(cols - 24, rows - 2, "b");
  put(cols - 18, rows - 2, "r");

  for (let x = cols - 43; x <= cols - 15; x += 2) putCoin(x, 12);
  put(cols - 17, 9, "F");

  // End door (replaces flag for this castle finale).
  put(cols - 6, rows - 2, "D");

  return toMap();
}
