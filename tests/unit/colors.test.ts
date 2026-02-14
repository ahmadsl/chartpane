import { describe, it, expect } from "vitest";
import { assignColors, getColor } from "../../shared/colors.js";

describe("getColor", () => {
  it("returns a color string for index 0", () => {
    expect(getColor(0)).toBe("#4e79a7");
  });

  it("wraps around at palette length", () => {
    expect(getColor(12)).toBe(getColor(0));
    expect(getColor(13)).toBe(getColor(1));
  });
});

describe("assignColors", () => {
  it("assigns one color per dataset for bar chart", () => {
    const datasets = [
      { label: "A", data: [1, 2, 3] },
      { label: "B", data: [4, 5, 6] },
    ];
    const colors = assignColors("bar", datasets);
    expect(colors).toHaveLength(2);
    expect(colors[0]).toEqual([getColor(0)]);
    expect(colors[1]).toEqual([getColor(1)]);
  });

  it("assigns per-slice colors for pie chart", () => {
    const datasets = [{ label: "Sales", data: [10, 20, 30] }];
    const colors = assignColors("pie", datasets);
    expect(colors).toHaveLength(1);
    expect(colors[0]).toHaveLength(3);
    expect(colors[0][0]).toBe(getColor(0));
    expect(colors[0][1]).toBe(getColor(1));
    expect(colors[0][2]).toBe(getColor(2));
  });

  it("assigns per-slice colors for polarArea chart", () => {
    const datasets = [{ label: "Activity", data: [12, 8, 15] }];
    const colors = assignColors("polarArea", datasets);
    expect(colors[0]).toHaveLength(3);
    expect(colors[0][0]).toBe(getColor(0));
    expect(colors[0][1]).toBe(getColor(1));
    expect(colors[0][2]).toBe(getColor(2));
  });

  it("assigns per-slice colors for doughnut chart", () => {
    const datasets = [{ label: "Sales", data: [10, 20] }];
    const colors = assignColors("doughnut", datasets);
    expect(colors[0]).toHaveLength(2);
  });

  it("returns distinct colors for up to 12 datasets", () => {
    const datasets = Array.from({ length: 12 }, (_, i) => ({
      label: `DS${i}`,
      data: [i],
    }));
    const colors = assignColors("line", datasets);
    const flat = colors.map((c) => c[0]);
    const unique = new Set(flat);
    expect(unique.size).toBe(12);
  });

  it("wraps around for 13+ datasets", () => {
    const datasets = Array.from({ length: 14 }, (_, i) => ({
      label: `DS${i}`,
      data: [i],
    }));
    const colors = assignColors("bar", datasets);
    expect(colors[12][0]).toBe(colors[0][0]);
    expect(colors[13][0]).toBe(colors[1][0]);
  });

  it("uses dataset color when provided", () => {
    const datasets = [
      { label: "A", data: [1], color: "#ff0000" },
      { label: "B", data: [2] },
    ];
    const colors = assignColors("bar", datasets);
    expect(colors[0]).toEqual(["#ff0000"]);
    expect(colors[1]).toEqual([getColor(1)]);
  });

  it("uses chart-level colors as palette override", () => {
    const datasets = [
      { label: "A", data: [1] },
      { label: "B", data: [2] },
    ];
    const colors = assignColors("line", datasets, ["#aa0000", "#bb0000"]);
    expect(colors[0]).toEqual(["#aa0000"]);
    expect(colors[1]).toEqual(["#bb0000"]);
  });

  it("dataset color takes priority over chart-level colors", () => {
    const datasets = [
      { label: "A", data: [1], color: "#ff0000" },
      { label: "B", data: [2] },
    ];
    const colors = assignColors("bar", datasets, ["#aa0000", "#bb0000"]);
    expect(colors[0]).toEqual(["#ff0000"]);
    expect(colors[1]).toEqual(["#bb0000"]);
  });

  it("falls back to palette when chart-level colors array is shorter", () => {
    const datasets = [
      { label: "A", data: [1] },
      { label: "B", data: [2] },
      { label: "C", data: [3] },
    ];
    const colors = assignColors("bar", datasets, ["#aa0000"]);
    expect(colors[0]).toEqual(["#aa0000"]);
    expect(colors[1]).toEqual([getColor(1)]);
    expect(colors[2]).toEqual([getColor(2)]);
  });

  it("uses chart-level colors for pie slice colors", () => {
    const datasets = [{ label: "Sales", data: [10, 20, 30] }];
    const colors = assignColors("pie", datasets, ["#ff0000", "#00ff00", "#0000ff"]);
    expect(colors[0]).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });

  it("falls back to palette for remaining pie slices", () => {
    const datasets = [{ label: "Sales", data: [10, 20, 30] }];
    const colors = assignColors("doughnut", datasets, ["#ff0000"]);
    expect(colors[0]).toEqual(["#ff0000", getColor(1), getColor(2)]);
  });
});
