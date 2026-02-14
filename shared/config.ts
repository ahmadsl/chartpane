import type { ChartConfiguration } from "chart.js";
import type { ChartInput } from "./types.js";
import { assignColors } from "./colors.js";

/** Append alpha to a hex color: "#4e79a7" + 0.15 → "rgba(78,121,167,0.15)" */
export function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function buildChartConfig(input: ChartInput): ChartConfiguration {
  const { type, title, data, stacked, horizontal } = input;

  // Map our type to Chart.js type
  const chartJsType = type === "area" ? "line" : type;

  // Assign colors (custom colors override default palette)
  const colorSets = assignColors(type, data.datasets, input.colors);

  // Build Chart.js datasets
  const isRadar = type === "radar";
  const datasets = data.datasets.map((ds, i) => {
    const colors = colorSets[i];
    const isPieOrDoughnut = type === "pie" || type === "doughnut" || type === "polarArea";

    return {
      label: ds.label,
      data: ds.data,
      // Pie/doughnut: array of colors (per slice). Others: single color.
      backgroundColor: isPieOrDoughnut
        ? colors
        : isRadar
          ? hexAlpha(colors[0], 0.15)
          : colors[0],
      borderColor: isPieOrDoughnut ? colors : colors[0],
      // Radar: thin outlines, subtle fill, small points
      ...(isRadar
        ? { borderWidth: 2, pointRadius: 3, pointBackgroundColor: colors[0], fill: true }
        : {}),
      // Area chart: fill under the line
      ...(type === "area" ? { fill: true } : {}),
      // Line/area: smooth curves
      ...(type === "line" || type === "area"
        ? { tension: 0.3 }
        : {}),
    };
  });

  // Build scales (not applicable for pie/doughnut/radar)
  const noScales =
    type === "pie" || type === "doughnut" || type === "polarArea" || type === "radar";
  const scales = noScales
    ? undefined
    : {
        x: {
          ...(stacked ? { stacked: true } : {}),
          ...(type === "scatter" || type === "bubble" ? { type: "linear" as const } : {}),
        },
        y: {
          ...(stacked ? { stacked: true } : {}),
          ...(type === "bar" ? { beginAtZero: true } : {}),
        },
      };

  // Legend: hidden for single dataset (except pie/doughnut)
  const showLegend =
    type === "pie" || type === "doughnut" || type === "polarArea" || data.datasets.length > 1;

  const config: ChartConfiguration = {
    type: chartJsType as ChartConfiguration["type"],
    data: {
      ...(data.labels ? { labels: data.labels } : {}),
      datasets: datasets as ChartConfiguration["data"]["datasets"],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Horizontal bar
      ...(horizontal ? { indexAxis: "y" as const } : {}),
      plugins: {
        title: {
          display: true,
          text: title,
        },
        legend: {
          display: showLegend,
        },
      },
      ...(scales ? { scales } : {}),
      // Radar: cleaner scale
      ...(isRadar
        ? { scales: { r: { beginAtZero: true, ticks: { stepSize: 2 } } } }
        : {}),
    },
  };

  return config;
}
