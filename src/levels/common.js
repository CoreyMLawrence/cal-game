export function createLevelGrid(cols, rows) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(" "));

  function put(x, y, ch) {
    if (y < 0 || y >= rows) return;
    if (x < 0 || x >= cols) return;
    grid[y][x] = ch;
  }

  function toMap() {
    return grid.map((row) => row.join(""));
  }

  return { cols, rows, put, toMap };
}

export function fillGround(put, cols, groundY, tile = "=") {
  for (let x = 0; x < cols; x++) put(x, groundY, tile);
}

export function createCoinPlacer({ put, rows, groundY }) {
  const defaultCoinY = Math.max(0, Math.min(rows - 1, groundY - 1));

  return function putCoin(x, y = null) {
    const targetY = y != null ? Math.max(0, Math.min(rows - 1, y)) : defaultCoinY;
    put(x, targetY, "o");
  };
}
