import { ChartInputSchema, DashboardInputSchema } from "./types.js";
import type { ChartInput, DashboardInput } from "./types.js";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function validateChartRules(input: ChartInput): string | null {
  // Scatter charts need {x, y} data
  if (input.type === "scatter") {
    for (const ds of input.data.datasets) {
      if (
        ds.data.length > 0 &&
        typeof ds.data[0] === "number"
      ) {
        return `Scatter chart requires {x, y} data points, got numbers in dataset "${ds.label}"`;
      }
    }
  }

  // Bubble charts need {x, y, r} data
  if (input.type === "bubble") {
    for (const ds of input.data.datasets) {
      if (ds.data.length > 0 && typeof ds.data[0] === "number") {
        return `Bubble chart requires {x, y, r} data points, got numbers in dataset "${ds.label}"`;
      }
      for (const pt of ds.data) {
        if (typeof pt === "object" && (pt as { r?: number }).r == null) {
          return `Bubble chart requires "r" (radius) on every data point in dataset "${ds.label}"`;
        }
      }
    }
  }

  // Non-scatter/bubble charts need labels
  if (input.type !== "scatter" && input.type !== "bubble") {
    if (!input.data.labels || input.data.labels.length === 0) {
      return `${input.type} chart requires labels`;
    }
  }

  // Pie/doughnut should have max 1 dataset
  if (
    (input.type === "pie" || input.type === "doughnut" || input.type === "polarArea") &&
    input.data.datasets.length > 1
  ) {
    return `${input.type} chart supports at most 1 dataset, got ${input.data.datasets.length}`;
  }

  // horizontal only applies to bar
  if (input.horizontal && input.type !== "bar") {
    return `horizontal option only applies to bar charts, not ${input.type}`;
  }

  return null;
}

export function validateChartInput(
  raw: unknown,
): ValidationResult<ChartInput> {
  const parsed = ChartInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  const ruleError = validateChartRules(parsed.data);
  if (ruleError) {
    return { success: false, error: ruleError };
  }

  return { success: true, data: parsed.data };
}

export function validateDashboardInput(
  raw: unknown,
): ValidationResult<DashboardInput> {
  const parsed = DashboardInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  // Validate each chart within the dashboard
  for (let i = 0; i < parsed.data.charts.length; i++) {
    const ruleError = validateChartRules(parsed.data.charts[i]);
    if (ruleError) {
      return { success: false, error: `Chart ${i + 1}: ${ruleError}` };
    }
  }

  return { success: true, data: parsed.data };
}
