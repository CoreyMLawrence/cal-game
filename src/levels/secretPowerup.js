import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildSecretPowerupLevel() {
  const cols = 56;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);
  const putCoin = createCoinPlacer({ put, rows, groundY });

  fillGround(put, cols, groundY);

  // Spawn.
  put(3, rows - 3, "@");

  // Bonus chamber with 3 special boxes:
  // battery, wing, and a super coin that grants an instant 1UP.
  put(20, 12, "*");
  put(24, 12, "W");
  put(28, 12, "S");

  // Support blocks and a few regular coins.
  for (let x = 19; x <= 29; x++) put(x, 14, "#");
  for (let x = 14; x <= 34; x += 2) putCoin(x, 11);

  // Safe clear pole at the end so players can exit back to progression.
  put(cols - 6, 10, "!");

  return toMap();
}
