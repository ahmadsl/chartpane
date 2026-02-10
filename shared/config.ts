import type { ChartConfiguration } from "chart.js";
import type { ChartInput } from "./types.js";
import { assignColors } from "./colors.js";

export function buildChartConfig(input: ChartInput): ChartConfiguration {
  const { type, title, data, stacked, horizontal } = input;

  // Map our type to Chart.js type
  const chartJsType = type === "area" ? "line" : type;

  // Assign colors (custom colors override default palette)
  const colorSets = assignColors(type, data.datasets, input.colors);

  // Build Chart.js datasets
  const datasets = data.datasets.map((ds, i) => {
    const colors = colorSets[i];
    const isPieOrDoughnut = type === "pie" || type === "doughnut";

    return {
      label: ds.label,
      data: ds.data,
      // Pie/doughnut: array of colors (per slice). Others: single color.
      backgroundColor: isPieOrDoughnut ? colors : colors[0],
      borderColor: isPieOrDoughnut ? colors : colors[0],
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
    type === "pie" || type === "doughnut" || type === "radar";
  const scales = noScales
    ? undefined
    : {
        x: {
          ...(stacked ? { stacked: true } : {}),
          ...(type === "scatter" ? { type: "linear" as const } : {}),
        },
        y: {
          ...(stacked ? { stacked: true } : {}),
          ...(type === "bar" ? { beginAtZero: true } : {}),
        },
      };

  // Legend: hidden for single dataset (except pie/doughnut)
  const showLegend =
    type === "pie" || type === "doughnut" || data.datasets.length > 1;

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
    },
  };

  return config;
}
