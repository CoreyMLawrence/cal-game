import { createLevelGrid, fillGround } from "./common.js";

export function buildBoss2Level() {
  const cols = 120;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);

  fillGround(put, cols, groundY);

  // Arena side walls.
  for (let y = 8; y <= groundY; y++) {
    put(0, y, "#");
    put(1, y, "#");
    put(cols - 2, y, "#");
    put(cols - 1, y, "#");
  }

  // Desert floor cuts for movement pressure.
  function pit(start, end) {
    for (let x = start; x <= end; x++) put(x, groundY, " ");
  }
  pit(18, 22);
  pit(38, 43);
  pit(58, 62);
  pit(76, 81);
  pit(96, 101);

  // Sandstone jump towers.
  for (let x = 14; x <= 20; x++) put(x, 12, "#");
  for (let x = 30; x <= 36; x++) put(x, 11, "#");
  for (let x = 50; x <= 56; x++) put(x, 12, "#");
  for (let x = 70; x <= 74; x++) put(x, 11, "#");
  for (let x = 88; x <= 94; x++) put(x, 12, "#");

  // Heat vents.
  put(26, 10, "F");
  put(46, 10, "F");
  put(66, 10, "F");
  put(86, 10, "F");

  // Power opportunities during boss cycles.
  put(33, 9, "Z");
  put(73, 9, "*");

  // Spawn and boss marker.
  put(6, rows - 3, "@");
  put(Math.floor(cols / 2), 5, "U");

  return toMap();
}
