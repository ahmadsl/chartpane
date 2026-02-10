import { describe, it, expect } from "vitest";
import { buildChartConfig } from "../../shared/config.js";
import { getColor } from "../../shared/colors.js";
import type { ChartInput } from "../../shared/types.js";

const barInput: ChartInput = {
  type: "bar",
  title: "Sales",
  data: {
    labels: ["Jan", "Feb", "Mar"],
    datasets: [{ label: "Revenue", data: [100, 200, 300] }],
  },
};

describe("buildChartConfig", () => {
  it("produces a bar config with correct type", () => {
    const config = buildChartConfig(barInput);
    expect(config.type).toBe("bar");
  });

  it("sets title in plugins", () => {
    const config = buildChartConfig(barInput);
    const opts = config.options as any;
    expect(opts.plugins.title.display).toBe(true);
    expect(opts.plugins.title.text).toBe("Sales");
  });

  it("sets responsive and no aspect ratio", () => {
    const config = buildChartConfig(barInput);
    const opts = config.options as any;
    expect(opts.responsive).toBe(true);
    expect(opts.maintainAspectRatio).toBe(false);
  });

  it("hides legend for single dataset (non-pie)", () => {
    const config = buildChartConfig(barInput);
    const opts = config.options as any;
    expect(opts.plugins.legend.display).toBe(false);
  });

  it("shows legend for multiple datasets", () => {
    const input: ChartInput = {
      ...barInput,
      data: {
        labels: ["A", "B"],
        datasets: [
          { label: "X", data: [1, 2] },
          { label: "Y", data: [3, 4] },
        ],
      },
    };
    const config = buildChartConfig(input);
    const opts = config.options as any;
    expect(opts.plugins.legend.display).toBe(true);
  });

  it("shows legend for pie even with single dataset", () => {
    const input: ChartInput = {
      type: "pie",
      title: "Pie",
      data: {
        labels: ["A", "B", "C"],
        datasets: [{ label: "DS", data: [10, 20, 30] }],
      },
    };
    const config = buildChartConfig(input);
    const opts = config.options as any;
    expect(opts.plugins.legend.display).toBe(true);
  });

  it("maps area to line with fill", () => {
    const input: ChartInput = {
      type: "area",
      title: "Area",
      data: {
        labels: ["A", "B"],
        datasets: [{ label: "DS", data: [1, 2] }],
      },
    };
    const config = buildChartConfig(input);
    expect(config.type).toBe("line");
    expect((config.data.datasets[0] as any).fill).toBe(true);
  });

  it("sets tension for line charts", () => {
    const input: ChartInput = {
      type: "line",
      title: "Line",
      data: {
        labels: ["A", "B"],
        datasets: [{ label: "DS", data: [1, 2] }],
      },
    };
    const config = buildChartConfig(input);
    expect((config.data.datasets[0] as any).tension).toBe(0.3);
  });

  it("sets tension for area charts", () => {
    const input: ChartInput = {
      type: "area",
      title: "Area",
      data: {
        labels: ["A", "B"],
        datasets: [{ label: "DS", data: [1, 2] }],
      },
    };
    const config = buildChartConfig(input);
    expect((config.data.datasets[0] as any).tension).toBe(0.3);
  });

  it("does not set tension for bar charts", () => {
    const config = buildChartConfig(barInput);
    expect((config.data.datasets[0] as any).tension).toBeUndefined();
  });

  it("sets horizontal indexAxis for bar", () => {
    const input: ChartInput = { ...barInput, horizontal: true };
    const config = buildChartConfig(input);
    const opts = config.options as any;
    expect(opts.indexAxis).toBe("y");
  });

  it("does not set indexAxis without horizontal", () => {
    const config = buildChartConfig(barInput);
    const opts = config.options as any;
    expect(opts.indexAxis).toBeUndefined();
  });

  it("sets stacked scales", () => {
    const input: ChartInput = { ...barInput, stacked: true };
    const config = buildChartConfig(input);
    const opts = config.options as any;
    expect(opts.scales.x.stacked).toBe(true);
    expect(opts.scales.y.stacked).toBe(true);
  });

  it("does not set scales for pie", () => {
    const input: ChartInput = {
      type: "pie",
      title: "Pie",
      data: {
        labels: ["A", "B"],
        datasets: [{ label: "DS", data: [10, 20] }],
      },
    };
    const config = buildChartConfig(input);
    const opts = config.options as any;
    expect(opts.scales).toBeUndefined();
  });

  it("passes scatter data through", () => {
    const input: ChartInput = {
      type: "scatter",
      title: "Scatter",
      data: {
        datasets: [
          {
            label: "Points",
            data: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
          },
        ],
      },
    };
    const config = buildChartConfig(input);
    expect(config.type).toBe("scatter");
    expect(config.data.datasets[0].data).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it("assigns distinct colors to datasets", () => {
    const input: ChartInput = {
      ...barInput,
      data: {
        labels: ["A"],
        datasets: [
          { label: "X", data: [1] },
          { label: "Y", data: [2] },
          { label: "Z", data: [3] },
        ],
      },
    };
    const config = buildChartConfig(input);
    const bgs = config.data.datasets.map(
      (ds: any) => ds.backgroundColor,
    );
    expect(new Set(bgs).size).toBe(3);
  });

  it("assigns per-slice colors for pie", () => {
    const input: ChartInput = {
      type: "pie",
      title: "Pie",
      data: {
        labels: ["A", "B", "C"],
        datasets: [{ label: "DS", data: [10, 20, 30] }],
      },
    };
    const config = buildChartConfig(input);
    const bg = (config.data.datasets[0] as any).backgroundColor;
    expect(Array.isArray(bg)).toBe(true);
    expect(bg).toHaveLength(3);
    expect(bg[0]).toBe(getColor(0));
    expect(bg[1]).toBe(getColor(1));
    expect(bg[2]).toBe(getColor(2));
  });

  it("uses dataset color when provided", () => {
    const input: ChartInput = {
      type: "bar",
      title: "Custom",
      data: {
        labels: ["A", "B"],
        datasets: [
          { label: "X", data: [1, 2], color: "#ff0000" },
          { label: "Y", data: [3, 4] },
        ],
      },
    };
    const config = buildChartConfig(input);
    expect((config.data.datasets[0] as any).backgroundColor).toBe("#ff0000");
    expect((config.data.datasets[1] as any).backgroundColor).toBe(getColor(1));
  });

  it("uses chart-level colors for pie slices", () => {
    const input: ChartInput = {
      type: "pie",
      title: "Custom Pie",
      colors: ["#ff0000", "#00ff00", "#0000ff"],
      data: {
        labels: ["A", "B", "C"],
        datasets: [{ label: "DS", data: [10, 20, 30] }],
      },
    };
    const config = buildChartConfig(input);
    const bg = (config.data.datasets[0] as any).backgroundColor;
    expect(bg).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });

  it("uses chart-level colors as palette for datasets", () => {
    const input: ChartInput = {
      type: "line",
      title: "Custom Palette",
      colors: ["#aa0000", "#bb0000"],
      data: {
        labels: ["A", "B"],
        datasets: [
          { label: "X", data: [1, 2] },
          { label: "Y", data: [3, 4] },
        ],
      },
    };
    const config = buildChartConfig(input);
    expect((config.data.datasets[0] as any).backgroundColor).toBe("#aa0000");
    expect((config.data.datasets[1] as any).backgroundColor).toBe("#bb0000");
  });
});
