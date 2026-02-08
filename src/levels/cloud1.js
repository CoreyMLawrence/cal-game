import { createLevelGrid, fillGround } from "./common.js";

export function buildCloud1Level() {
  const cols = 228;
  const rows = 17;
  const groundY = rows - 1;
  const { put, toMap } = createLevelGrid(cols, rows);

  fillGround(put, cols, groundY);

  function platform(start, end, y, tile = "=") {
    for (let x = start; x <= end; x++) put(x, y, tile);
  }

  function vine(x, topY, bottomY) {
    for (let y = topY; y <= bottomY; y++) put(x, y, "v");
  }

  function coinLine(start, end, y, step = 2) {
    for (let x = start; x <= end; x += step) put(x, y, "o");
  }

  function coinArc(points) {
    for (const [x, y] of points) put(x, y, "o");
  }

  // Broad sky gaps set a clear rhythm: hop, ride, land.
  const pits = [
    { start: 24, width: 4 },
    { start: 44, width: 5 },
    { start: 64, width: 4 },
    { start: 84, width: 5 },
    { start: 108, width: 6 },
    { start: 132, width: 5 },
    { start: 156, width: 6 },
    { start: 180, width: 5 },
    { start: 202, width: 5 },
  ];
  for (const pit of pits) {
    for (let x = pit.start; x < pit.start + pit.width; x++) put(x, groundY, " ");
  }

  // Spawn and early tools.
  put(3, rows - 3, "@");
  put(10, 12, "?");
  put(11, 12, "W");
  put(12, 12, "*");
  put(13, 12, "?");
  coinLine(8, 18, 11, 2);

  // SECTION 1: simple moving-platform intro + first vine.
  platform(24, 27, 13, "~");
  platform(30, 33, 12, "~");
  platform(36, 43, 12, "=");
  vine(35, 8, 15);
  coinArc([
    [24, 12],
    [26, 11],
    [28, 10],
    [30, 10],
    [32, 11],
    [34, 12],
  ]);
  coinLine(36, 43, 11, 2);

  // SECTION 2: wider chain, optional high cloud lane, and a vine exit.
  platform(44, 47, 12, "~");
  platform(50, 53, 11, "~");
  platform(56, 63, 11, "=");
  platform(66, 70, 10, "~");
  platform(72, 75, 10, "=");
  platform(74, 77, 9, "|");
  platform(78, 82, 10, "=");

  platform(46, 54, 8, "#");
  platform(58, 62, 7, "#");
  vine(56, 6, 14);
  put(59, 6, "W");

  coinLine(44, 63, 10, 2);
  coinLine(46, 62, 6, 2);

  // SECTION 3: long horizontal mover rhythm (main flow anchor).
  platform(84, 87, 13, "~");
  platform(90, 93, 12, "~");
  platform(96, 99, 11, "~");
  platform(102, 107, 11, "=");
  platform(108, 111, 10, "~");
  platform(112, 116, 10, "=");
  platform(120, 123, 10, "~");
  platform(126, 130, 10, "=");
  vine(101, 8, 14);
  platform(104, 106, 8, "c");

  coinArc([
    [84, 12],
    [86, 11],
    [88, 10],
    [90, 10],
    [92, 11],
    [94, 12],
  ]);
  coinLine(96, 116, 9, 2);

  // SECTION 4: mid/high cloud lane with more horizontal movement.
  platform(132, 135, 12, "~");
  platform(138, 141, 11, "~");
  platform(144, 147, 10, "~");
  platform(150, 155, 10, "=");
  platform(156, 159, 9, "~");
  platform(160, 164, 9, "=");
  platform(164, 167, 8, "|");
  platform(168, 171, 9, "~");
  platform(174, 177, 9, "=");

  vine(148, 7, 14);
  put(145, 9, "W");
  put(151, 8, "*");
  coinLine(132, 164, 8, 2);

  // SECTION 5: final runway with frequent horizontal movers and safe goal landing.
  platform(180, 183, 11, "~");
  platform(186, 189, 10, "~");
  platform(192, 196, 10, "=");
  platform(198, 201, 9, "~");
  platform(204, 207, 8, "~");
  platform(210, 214, 8, "=");
  platform(216, 219, 9, "~");
  platform(222, 224, 9, "=");

  vine(188, 7, 14);
  vine(206, 5, 12);
  vine(220, 6, 12);
  coinLine(180, 224, 7, 2);

  // Goal.
  put(cols - 6, 7, "!");
  put(cols - 14, 4, "U");

  // Enemy placements: red robots are aerial in cloud levels.
  const enemies = [
    [40, 8, "r"],
    [58, 6, "r"],
    [88, 8, "r"],
    [114, 7, "r"],
    [142, 7, "r"],
    [170, 7, "r"],
    [196, 7, "r"],
    [214, 7, "r"],

    [36, 11, "b"],
    [63, 10, "p"],
    [107, 10, "b"],
    [155, 9, "p"],
    [192, 9, "b"],
    [224, 8, "p"],
  ];
  for (const [x, y, kind] of enemies) put(x, y, kind);

  return toMap();
}
