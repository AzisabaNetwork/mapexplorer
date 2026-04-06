export function serializeMapGridLayout(cells: Array<Array<number | null>>) {
  return cells
    .map((row) => row.map((cell) => (cell === null ? "_" : String(cell))).join(","))
    .join("\n");
}
