import { z } from "zod";

export const ChartTypeSchema = z.enum([
  "bar",
  "line",
  "area",
  "pie",
  "doughnut",
  "scatter",
  "radar",
]);

export type ChartType = z.infer<typeof ChartTypeSchema>;

const ScatterPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const DatasetSchema = z.object({
  label: z.string(),
  data: z.union([z.array(z.number()), z.array(ScatterPointSchema)]),
});

export type Dataset = z.infer<typeof DatasetSchema>;

export const ChartDataSchema = z.object({
  labels: z.array(z.string()).optional(),
  datasets: z.array(DatasetSchema).min(1),
});

export type ChartData = z.infer<typeof ChartDataSchema>;

export const ChartInputSchema = z.object({
  type: ChartTypeSchema,
  title: z.string(),
  data: ChartDataSchema,
  stacked: z.boolean().optional(),
  horizontal: z.boolean().optional(),
});

export type ChartInput = z.infer<typeof ChartInputSchema>;

export const DashboardInputSchema = z.object({
  title: z.string(),
  charts: z.array(ChartInputSchema).min(1),
  columns: z.number().int().min(1).max(4).optional(),
});

export type DashboardInput = z.infer<typeof DashboardInputSchema>;

export type RenderResult =
  | { mode: "chart"; chart: ChartInput }
  | { mode: "dashboard"; title: string; charts: ChartInput[]; columns: number };
