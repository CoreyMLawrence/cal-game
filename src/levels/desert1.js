import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildDesert1Level() {
  const cols = 192;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);
  const putCoin = createCoinPlacer({ put, rows, groundY });

  fillGround(put, cols, groundY);

  // Wider desert pits.
  const pits = [
    { start: 22, width: 3 },
    { start: 46, width: 4 },
    { start: 74, width: 4 },
    { start: 102, width: 5 },
    { start: 132, width: 4 },
    { start: 160, width: 5 },
  ];
  for (const pit of pits) {
    for (let x = pit.start; x < pit.start + pit.width; x++) put(x, groundY, " ");
  }

  // Spawn.
  put(3, rows - 3, "@");

  // Early intro tools.
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  for (let x = 8; x <= 18; x += 2) putCoin(x, 14);

  // First crossing sequence.
  for (let x = 22; x <= 26; x++) put(x, 13, "~");
  for (let x = 30; x <= 38; x++) put(x, 12, "=");
  put(41, rows - 2, "^");
  for (let x = 28; x <= 44; x += 2) putCoin(x, 13);

  // Mid-map: mixed ledges and moving blocks.
  for (let x = 56; x <= 64; x++) put(x, 13, "#");
  for (let x = 68; x <= 72; x++) put(x, 12, "=");
  for (let x = 74; x <= 79; x++) put(x, 13, "~");
  for (let x = 56; x <= 84; x += 3) putCoin(x, 14);

  // Second challenge lane.
  for (let x = 92; x <= 99; x++) put(x, 12, "=");
  put(108, rows - 2, "^");
  for (let x = 111; x <= 121; x++) put(x, 12, "=");
  for (let x = 90; x <= 124; x += 2) putCoin(x, 13);

  // Late challenge.
  for (let x = 132; x <= 136; x++) put(x, 13, "~");
  for (let x = 144; x <= 152; x++) put(x, 12, "=");
  for (let x = 160; x <= 165; x++) put(x, 13, "~");
  for (let x = 134; x <= 170; x += 2) putCoin(x, 14);

  // Final staircase to goal.
  const stairBaseX = cols - 34;
  for (let i = 0; i < 6; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }

  // Enemy patrols (around World 1 Level 2 difficulty).
  const enemies = [
    [16, "r"],
    [28, "p"],
    [36, "b"],
    [52, "r"],
    [66, "p"],
    [84, "b"],
    [98, "r"],
    [116, "p"],
    [126, "b"],
    [142, "r"],
    [172, "b"],
    [180, "p"],
  ];
  for (const [x, kind] of enemies) put(x, rows - 2, kind);

  // End setup.
  put(cols - 6, 10, "!");
  put(cols - 13, 6, "U");

  // End reward lane.
  for (let x = cols - 26; x <= cols - 14; x += 2) putCoin(x, 13);

  return toMap();
}
