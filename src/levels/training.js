import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildTrainingLevel() {
  const cols = 120;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);
  const putCoin = createCoinPlacer({ put, rows, groundY });

  // Flat ground (very easy).
  fillGround(put, cols, groundY);

  // Player spawn.
  put(3, rows - 3, "@");

  // A few coins to introduce collecting.
  for (let x = 8; x <= 14; x++) putCoin(x, rows - 3);

  // Question blocks (coins) + power block (battery).
  put(18, 12, "?");
  put(19, 12, "?");
  put(20, 12, "?");
  for (let x = 18; x <= 20; x++) putCoin(x, 11);

  put(28, 12, "*");
  for (let x = 32; x <= 35; x++) put(x, 12, "B"); // breakable bricks (only when CHARGED)

  // Springboard to a safe high ledge with coins.
  put(44, rows - 2, "^");
  for (let x = 47; x <= 56; x++) put(x, 12, "=");
  for (let x = 48; x <= 55; x++) putCoin(x, 11);

  // Tiny pit + moving platform demo (still forgiving).
  for (let x = 66; x <= 68; x++) put(x, groundY, " ");
  for (let x = 64; x <= 67; x++) put(x, 13, "~");
  for (let x = 63; x <= 70; x += 2) putCoin(x, 12);

  // One slow enemy to practice stomping.
  put(82, rows - 2, "p");

  // Goal pole at the end.
  put(cols - 6, 10, "!");
  // Hidden step to hop above the pole if discovered.
  put(cols - 7, 8, "h");

  return toMap();
}
