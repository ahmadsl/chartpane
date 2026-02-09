import type { ChartType, Dataset } from "./types.js";

const PALETTE = [
  "#4e79a7", // steel blue
  "#f28e2b", // orange
  "#e15759", // red
  "#76b7b2", // teal
  "#59a14f", // green
  "#edc948", // gold
  "#b07aa1", // purple
  "#ff9da7", // pink
  "#9c755f", // brown
  "#bab0ac", // gray
  "#af7aa1", // mauve
  "#86bcb6", // seafoam
];

export function getColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function assignColors(
  type: ChartType,
  datasets: Dataset[],
): string[][] {
  if (type === "pie" || type === "doughnut") {
    // For pie/doughnut: each slice gets a different color
    return datasets.map((ds) =>
      ds.data.map((_, i) => getColor(i)),
    );
  }

  // For all other types: each dataset gets one color
  return datasets.map((_, i) => [getColor(i)]);
}
