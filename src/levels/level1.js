import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildLevel1() {
  const cols = 160;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);
  const putCoin = createCoinPlacer({ put, rows, groundY });

  // Ground.
  fillGround(put, cols, groundY);

  // Pits.
  const pits = [
    { start: 22, width: 3 },
    { start: 52, width: 4 },
    { start: 96, width: 4 },
  ];
  for (const pit of pits) {
    for (let x = pit.start; x < pit.start + pit.width; x++) put(x, groundY, " ");
  }

  // Player spawn.
  put(3, rows - 3, "@");

  // Early blocks + coins.
  put(12, 12, "?");
  put(13, 12, "*");
  put(14, 12, "?");
  for (let x = 12; x <= 14; x++) putCoin(x, 11);

  // Breakable bricks (breakable when CHARGED).
  for (let x = 18; x <= 21; x++) put(x, 12, "B");

  // First pit coin arc.
  putCoin(21, 14);
  putCoin(22, 13);
  putCoin(23, 12);
  putCoin(24, 12);
  putCoin(25, 13);
  putCoin(26, 14);

  // Floating blocks / platforms.
  for (let x = 28; x <= 31; x++) put(x, 13, "#");
  for (let x = 34; x <= 42; x++) put(x, 12, "=");
  for (let x = 44; x <= 48; x++) put(x, 13, "#");
  for (let x = 66; x <= 70; x++) put(x, 13, "#");

  // Moving platform over pit 2.
  for (let x = 52; x <= 55; x++) put(x, 13, "~");
  for (let x = 49; x <= 58; x += 3) putCoin(x, 12);

  // Springboard to a high grassy ledge.
  put(80, rows - 2, "^");
  for (let x = 76; x <= 86; x++) put(x, 12, "=");
  for (let x = 77; x <= 85; x++) putCoin(x, 11);

  // Enemy placements.
  put(18, rows - 2, "r");
  put(33, rows - 2, "b");
  put(58, rows - 2, "p");
  put(90, rows - 2, "r");
  put(112, rows - 2, "b");
  put(128, rows - 2, "p");

  // Mid/late coin lines (kept within allowed height range).
  for (let x = 92; x <= 108; x += 2) putCoin(x, 14);
  for (let x = 116; x <= 126; x += 2) putCoin(x, 13);

  // End-of-level set piece.
  put(cols - 6, 10, "!");
  put(cols - 12, 6, "U");

  // Staircase near the end.
  const stairBaseX = cols - 28;
  for (let i = 0; i < 6; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }

  return toMap();
}
