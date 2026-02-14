import { describe, it, expect } from "vitest";
import {
  validateChartInput,
  validateDashboardInput,
} from "../../shared/validation.js";

const validBar = {
  type: "bar",
  title: "Test",
  data: {
    labels: ["A", "B"],
    datasets: [{ label: "DS", data: [1, 2] }],
  },
};

const validScatter = {
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

describe("validateChartInput", () => {
  it("accepts a valid bar chart", () => {
    const result = validateChartInput(validBar);
    expect(result.success).toBe(true);
  });

  it("accepts a valid scatter chart", () => {
    const result = validateChartInput(validScatter);
    expect(result.success).toBe(true);
  });

  it("rejects missing type", () => {
    const result = validateChartInput({ title: "X", data: validBar.data });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = validateChartInput({ ...validBar, type: "histogram" });
    expect(result.success).toBe(false);
  });

  it("rejects empty datasets", () => {
    const result = validateChartInput({
      ...validBar,
      data: { labels: ["A"], datasets: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects scatter with number data", () => {
    const result = validateChartInput({
      type: "scatter",
      title: "Bad Scatter",
      data: {
        datasets: [{ label: "DS", data: [1, 2, 3] }],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Scatter");
    }
  });

  it("rejects non-scatter without labels", () => {
    const result = validateChartInput({
      type: "bar",
      title: "No Labels",
      data: {
        datasets: [{ label: "DS", data: [1, 2] }],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("labels");
    }
  });

  it("rejects pie with multiple datasets", () => {
    const result = validateChartInput({
      type: "pie",
      title: "Bad Pie",
      data: {
        labels: ["A", "B"],
        datasets: [
          { label: "DS1", data: [1, 2] },
          { label: "DS2", data: [3, 4] },
        ],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("pie");
    }
  });

  it("rejects polarArea with multiple datasets", () => {
    const result = validateChartInput({
      type: "polarArea",
      title: "Bad Polar",
      data: {
        labels: ["A", "B"],
        datasets: [
          { label: "DS1", data: [1, 2] },
          { label: "DS2", data: [3, 4] },
        ],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("polarArea");
    }
  });

  it("rejects doughnut with multiple datasets", () => {
    const result = validateChartInput({
      type: "doughnut",
      title: "Bad Doughnut",
      data: {
        labels: ["A", "B"],
        datasets: [
          { label: "DS1", data: [1, 2] },
          { label: "DS2", data: [3, 4] },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid bubble chart", () => {
    const result = validateChartInput({
      type: "bubble",
      title: "Bubble",
      data: {
        datasets: [
          {
            label: "Points",
            data: [
              { x: 1, y: 2, r: 10 },
              { x: 3, y: 4, r: 5 },
            ],
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects bubble with number data", () => {
    const result = validateChartInput({
      type: "bubble",
      title: "Bad Bubble",
      data: {
        datasets: [{ label: "DS", data: [1, 2, 3] }],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Bubble");
    }
  });

  it("rejects bubble without r on data points", () => {
    const result = validateChartInput({
      type: "bubble",
      title: "Bad Bubble",
      data: {
        datasets: [
          {
            label: "DS",
            data: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
          },
        ],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("r");
    }
  });

  it("rejects horizontal on non-bar chart", () => {
    const result = validateChartInput({
      type: "line",
      title: "Horizontal Line",
      data: {
        labels: ["A", "B"],
        datasets: [{ label: "DS", data: [1, 2] }],
      },
      horizontal: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("horizontal");
    }
  });

  it("accepts stacked bar", () => {
    const result = validateChartInput({ ...validBar, stacked: true });
    expect(result.success).toBe(true);
  });

  it("accepts horizontal bar", () => {
    const result = validateChartInput({ ...validBar, horizontal: true });
    expect(result.success).toBe(true);
  });
});

describe("validateDashboardInput", () => {
  it("accepts a valid dashboard", () => {
    const result = validateDashboardInput({
      title: "Dashboard",
      charts: [validBar],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty charts array", () => {
    const result = validateDashboardInput({
      title: "Empty",
      charts: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects dashboard with invalid chart inside", () => {
    const result = validateDashboardInput({
      title: "Bad",
      charts: [
        {
          type: "scatter",
          title: "Bad Scatter",
          data: {
            datasets: [{ label: "DS", data: [1, 2, 3] }],
          },
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Chart 1");
    }
  });

  it("accepts dashboard with explicit columns", () => {
    const result = validateDashboardInput({
      title: "Dashboard",
      charts: [validBar, validBar],
      columns: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects columns > 4", () => {
    const result = validateDashboardInput({
      title: "Dashboard",
      charts: [validBar],
      columns: 5,
    });
    expect(result.success).toBe(false);
  });
});
