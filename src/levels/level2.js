import { createCoinPlacer, createLevelGrid, fillGround } from "./common.js";

export function buildLevel2() {
  const cols = 210;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);
  const putCoin = createCoinPlacer({ put, rows, groundY });

  // Base ground.
  fillGround(put, cols, groundY);

  // Wider and more frequent pits.
  const pits = [
    { start: 26, width: 3 },
    { start: 48, width: 4 },
    { start: 72, width: 4 },
    { start: 99, width: 5 },
    { start: 128, width: 4 },
    { start: 156, width: 5 },
    { start: 184, width: 4 },
  ];
  for (const pit of pits) {
    for (let x = pit.start; x < pit.start + pit.width; x++) put(x, groundY, " ");
  }

  // Player spawn.
  put(3, rows - 3, "@");

  // Early resource section.
  put(10, 12, "?");
  put(11, 12, "*");
  put(12, 12, "?");
  put(13, 12, "B");
  put(14, 12, "B");
  for (let x = 8; x <= 16; x += 2) putCoin(x, 13);

  // Platform chain over first pits.
  for (let x = 24; x <= 30; x++) put(x, 13, "~");
  for (let x = 46; x <= 53; x++) put(x, 12, "=");
  for (let x = 70; x <= 76; x++) put(x, 13, "~");
  for (let x = 24; x <= 76; x += 4) putCoin(x, 12);

  // Mid-level block clusters and coins.
  for (let x = 86; x <= 94; x++) put(x, 13, "#");
  for (let x = 100; x <= 111; x++) put(x, 12, "=");
  for (let x = 114; x <= 122; x++) put(x, 13, "#");
  for (let x = 88; x <= 122; x += 3) putCoin(x, 11);

  // Spring challenge into busy enemy lane.
  put(134, rows - 2, "^");
  for (let x = 138; x <= 150; x++) put(x, 12, "=");
  for (let x = 139; x <= 149; x += 2) putCoin(x, 11);

  // Late-game moving platforms and coin arcs.
  for (let x = 156; x <= 161; x++) put(x, 13, "~");
  for (let x = 174; x <= 179; x++) put(x, 13, "~");
  putCoin(154, 14);
  putCoin(156, 13);
  putCoin(158, 12);
  putCoin(160, 12);
  putCoin(162, 13);
  putCoin(164, 14);
  putCoin(172, 14);
  putCoin(174, 13);
  putCoin(176, 12);
  putCoin(178, 12);
  putCoin(180, 13);
  putCoin(182, 14);

  // Strategic enemy placements: platform guards, double-stomp chains, and spring targets.
  const enemies = [
    [18, rows - 2, "r"],
    [22, rows - 2, "b"],
    // Elevated guard on middle pit crossing ledge
    [49, 11, "p"],
    // Ground double bounce combo
    [62, rows - 2, "r"],
    [65, rows - 2, "r"],
    // Mid-level platform guards
    [90, 12, "r"],
    [105, 11, "b"],
    [118, 12, "p"],
    // Springboard reward: landing stomp on elevated tower
    [144, 11, "t"],
    // Late sequence runners & double bounce
    [166, rows - 2, "r"],
    [169, rows - 2, "r"],
    // Pre-goal dash
    [188, rows - 2, "b"],
    [194, rows - 2, "t"],
  ];
  for (const [x, y, kind] of enemies) put(x, y, kind);

  // Bonus strip before finish.
  for (let x = 186; x <= 200; x += 2) putCoin(x, 13);

  // End area.
  put(cols - 6, 10, "!");
  put(cols - 12, 6, "U");
  put(cols - 24, 12, "*");
  for (let x = cols - 34; x <= cols - 28; x++) put(x, 12, "B");

  // Final staircase.
  const stairBaseX = cols - 40;
  for (let i = 0; i < 7; i++) {
    for (let y = 0; y <= i; y++) put(stairBaseX + i, rows - 2 - y, "#");
  }

  return toMap();
}
