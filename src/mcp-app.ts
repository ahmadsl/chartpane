import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { Chart, registerables } from "chart.js";
import { buildChartConfig } from "../shared/config.js";
import { calculateColumns } from "../shared/grid.js";
import type { RenderResult, ChartInput } from "../shared/types.js";

// Register all Chart.js components
Chart.register(...registerables);

const charts: Chart[] = [];
let lastResult: RenderResult | null = null;

function destroyAllCharts(): void {
  for (const chart of charts) {
    chart.destroy();
  }
  charts.length = 0;
}

function showElement(id: string): void {
  const el = document.getElementById(id);
  if (el) el.style.display = "";
}

function hideElement(id: string): void {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function syncChartDefaults(): void {
  const s = getComputedStyle(document.documentElement);
  const text = s.getPropertyValue("--color-text-primary").trim();
  const border = s.getPropertyValue("--color-border-secondary").trim();
  const font = s.getPropertyValue("--font-sans").trim();

  if (text) Chart.defaults.color = text;
  if (border) Chart.defaults.borderColor = border;
  if (font) Chart.defaults.font.family = font;
}

function applyHostContext(ctx: McpUiHostContext): void {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  syncChartDefaults();
  if (lastResult) handleResult(lastResult);
}

function renderSingleChart(input: ChartInput, canvas: HTMLCanvasElement): void {
  const config = buildChartConfig(input);
  const chart = new Chart(canvas, config);
  charts.push(chart);
}

function showChart(input: ChartInput): void {
  hideElement("loading");
  hideElement("dashboard-container");
  showElement("chart-container");

  const canvas = document.getElementById("chart-canvas") as HTMLCanvasElement;
  renderSingleChart(input, canvas);
}

function showDashboard(
  title: string,
  chartInputs: ChartInput[],
  columns: number,
): void {
  hideElement("loading");
  hideElement("chart-container");
  showElement("dashboard-container");

  const titleEl = document.getElementById("dashboard-title")!;
  titleEl.textContent = title;

  const grid = document.getElementById("dashboard-grid")!;
  // Clear previous cells
  while (grid.firstChild) grid.removeChild(grid.firstChild);

  const cols = calculateColumns(chartInputs.length, columns);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (const input of chartInputs) {
    const cell = document.createElement("div");
    cell.className = "dashboard-cell";
    const canvas = document.createElement("canvas");
    cell.appendChild(canvas);
    grid.appendChild(cell);
    renderSingleChart(input, canvas);
  }
}

function handleResult(result: RenderResult): void {
  lastResult = result;
  destroyAllCharts();

  if (result.mode === "chart") {
    showChart(result.chart);
  } else if (result.mode === "dashboard") {
    showDashboard(result.title, result.charts, result.columns);
  }
}

// Initialize the MCP App
const app = new App(
  { name: "ChartPane", version: "1.0.0" },
  {},
  { autoResize: true },
);

app.ontoolresult = (result) => {
  const structured = result.structuredContent as RenderResult | undefined;
  if (structured) {
    handleResult(structured);
  }
};

app.ontoolinput = (input) => {
  // Show loading state while tool is executing
  hideElement("chart-container");
  hideElement("dashboard-container");
  showElement("loading");
  const loadingEl = document.getElementById("loading");
  if (loadingEl) loadingEl.textContent = "Rendering chart...";
};

app.onhostcontextchanged = (ctx) => {
  applyHostContext(ctx);
};

await app.connect();
const initialCtx = app.getHostContext();
if (initialCtx) applyHostContext(initialCtx);
