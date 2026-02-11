import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { Chart, registerables } from "chart.js";
import { buildChartConfig, hexAlpha } from "../shared/config.js";
import { getColor } from "../shared/colors.js";
import { calculateColumns } from "../shared/grid.js";
import type { RenderResult, ChartInput } from "../shared/types.js";

// Register all Chart.js components
Chart.register(...registerables);

const charts: Chart[] = [];
let lastResult: RenderResult | null = null;
let lastSingleInput: ChartInput | null = null;

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

function showError(container: HTMLElement | null, message: string): void {
  if (!container) return;
  const el = document.createElement("div");
  el.className = "chart-error";
  el.textContent = message;
  container.appendChild(el);
}

function renderSingleChart(
  input: ChartInput,
  canvas: HTMLCanvasElement,
  suppressTitle = false,
): void {
  try {
    const config = buildChartConfig(input);
    if (suppressTitle && config.options?.plugins?.title) {
      config.options.plugins.title.display = false;
    }
    const chart = new Chart(canvas, config);
    charts.push(chart);
  } catch (err) {
    console.error("Chart render error:", err);
    canvas.style.display = "none";
    showError(canvas.parentElement, err instanceof Error ? err.message : "Failed to render chart");
  }
}

function showChart(input: ChartInput): void {
  hideElement("loading");
  hideElement("dashboard-container");
  showElement("chart-container");

  lastSingleInput = input;

  // Set toolbar title (and suppress Chart.js built-in title to avoid duplication)
  const titleEl = document.getElementById("chart-title");
  if (titleEl) titleEl.textContent = input.title;

  const canvas = document.getElementById("chart-canvas") as HTMLCanvasElement;
  renderSingleChart(input, canvas, true);
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

  try {
    if (result.mode === "chart") {
      showChart(result.chart);
    } else if (result.mode === "dashboard") {
      showDashboard(result.title, result.charts, result.columns);
    }
  } catch (err) {
    console.error("Render error:", err);
    hideElement("loading");
    const container = document.getElementById("chart-container") || document.getElementById("dashboard-container");
    showElement(container?.id ?? "chart-container");
    showError(container, err instanceof Error ? err.message : "Failed to render");
  }
}

// Initialize the MCP App
const app = new App(
  { name: "ChartPane", version: "1.0.0" },
  {},
  { autoResize: true },
);

app.ontoolresult = (result) => {
  try {
    const structured = result.structuredContent as RenderResult | undefined;
    if (structured) {
      handleResult(structured);
    }
  } catch (err) {
    console.error("Tool result error:", err);
    hideElement("loading");
    showElement("chart-container");
    showError(
      document.getElementById("chart-container"),
      err instanceof Error ? err.message : "Failed to process tool result",
    );
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

// ── Color popover ──────────────────────────────────────────────

const COLOR_PRESETS = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
  "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
];

/** Get the effective color for dataset i (custom > palette default) */
function getDatasetColor(input: ChartInput, i: number): string {
  return input.data.datasets[i].color ?? input.colors?.[i] ?? getColor(i);
}

/** Apply a color change to dataset i and live-update the chart */
function applyColorChange(i: number, hex: string): void {
  if (!lastSingleInput) return;
  const chart = charts[0];
  if (!chart) return;

  // Persist into the input so re-renders keep the color
  lastSingleInput.data.datasets[i].color = hex;

  // Live-update Chart.js dataset
  const ds = chart.data.datasets[i];
  const isRadar = lastSingleInput.type === "radar";
  const isPie = lastSingleInput.type === "pie" || lastSingleInput.type === "doughnut";

  if (isPie) {
    // For pie/doughnut, we'd need per-slice — skip for now
    return;
  }

  ds.borderColor = hex;
  ds.backgroundColor = isRadar ? hexAlpha(hex, 0.15) : hex;
  if (isRadar) {
    (ds as unknown as Record<string, unknown>).pointBackgroundColor = hex;
  }
  chart.update();
}

function createChevronSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.classList.add("color-row-chevron");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M4.5 2.5l3.5 3.5-3.5 3.5");
  svg.appendChild(path);
  return svg;
}

function buildColorPopover(): void {
  const popover = document.getElementById("color-popover");
  if (!popover || !lastSingleInput) return;

  // Clear previous content
  while (popover.firstChild) popover.removeChild(popover.firstChild);

  // Header
  const header = document.createElement("div");
  header.className = "color-popover-header";
  header.textContent = "Colors";
  popover.appendChild(header);

  // One row per dataset
  lastSingleInput.data.datasets.forEach((ds, i) => {
    const currentColor = getDatasetColor(lastSingleInput!, i);

    // Divider between rows
    if (i > 0) {
      const divider = document.createElement("div");
      divider.className = "color-popover-divider";
      popover.appendChild(divider);
    }

    // Row header (clickable): Name ... [swatch] [chevron]
    const rowHeader = document.createElement("div");
    rowHeader.className = "color-row-header";

    const name = document.createElement("span");
    name.className = "color-row-name";
    name.textContent = ds.label;

    const dot = document.createElement("span");
    dot.className = "color-dot";
    dot.style.background = currentColor;

    const chevron = createChevronSvg();

    rowHeader.appendChild(name);
    rowHeader.appendChild(dot);
    rowHeader.appendChild(chevron);

    // Picker (hidden by default)
    const picker = document.createElement("div");
    picker.className = "color-picker";
    picker.style.display = "none";

    // Preset grid
    const grid = document.createElement("div");
    grid.className = "color-preset-grid";

    for (const preset of COLOR_PRESETS) {
      const swatch = document.createElement("button");
      swatch.className = "color-preset";
      swatch.style.background = preset;

      // Checkmark for selected
      if (preset === currentColor) {
        const check = document.createElement("span");
        check.className = "color-preset-check";
        check.textContent = "\u2713";
        swatch.appendChild(check);
      }

      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        applyColorChange(i, preset);
        // Rebuild popover and re-expand this row
        buildColorPopover();
        expandPopoverRow(popover, i);
      });

      grid.appendChild(swatch);
    }
    picker.appendChild(grid);

    // Hex input row
    const hexRow = document.createElement("div");
    hexRow.className = "color-hex-row";

    const hashLabel = document.createElement("span");
    hashLabel.className = "color-hex-hash";
    hashLabel.textContent = "#";

    const hexInput = document.createElement("input");
    hexInput.className = "color-hex-input";
    hexInput.type = "text";
    hexInput.maxLength = 6;
    hexInput.value = currentColor.replace("#", "").toUpperCase();
    hexInput.spellcheck = false;

    hexInput.addEventListener("input", () => {
      const val = hexInput.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
      hexInput.value = val;
      if (val.length === 6) {
        const hex = `#${val.toLowerCase()}`;
        applyColorChange(i, hex);
        dot.style.background = hex;
        // Clear all selected states
        grid.querySelectorAll(".color-preset-check").forEach((c) => c.remove());
      }
    });

    hexInput.addEventListener("click", (e) => e.stopPropagation());

    hexRow.appendChild(hashLabel);
    hexRow.appendChild(hexInput);
    picker.appendChild(hexRow);

    // Assemble
    popover.appendChild(rowHeader);
    popover.appendChild(picker);

    // Toggle expand/collapse
    rowHeader.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = picker.style.display !== "none";
      picker.style.display = isOpen ? "none" : "";
      chevron.classList.toggle("expanded", !isOpen);
    });
  });
}

function expandPopoverRow(popover: HTMLElement, rowIndex: number): void {
  const pickers = popover.querySelectorAll(".color-picker");
  const chevrons = popover.querySelectorAll(".color-row-chevron");
  const p = pickers[rowIndex] as HTMLElement | undefined;
  const c = chevrons[rowIndex] as HTMLElement | undefined;
  if (p) p.style.display = "";
  if (c) c.classList.add("expanded");
}

// Toggle color popover
const btnColors = document.getElementById("btn-colors");
const colorPopover = document.getElementById("color-popover");

btnColors?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!colorPopover || !lastSingleInput) return;
  const isOpen = colorPopover.style.display !== "none";
  if (isOpen) {
    colorPopover.style.display = "none";
    btnColors.classList.remove("active");
  } else {
    buildColorPopover();
    colorPopover.style.display = "";
    btnColors.classList.add("active");
  }
});

// Close popover on outside click
document.addEventListener("click", () => {
  if (colorPopover && colorPopover.style.display !== "none") {
    colorPopover.style.display = "none";
    btnColors?.classList.remove("active");
  }
});

// Prevent popover clicks from closing it
colorPopover?.addEventListener("click", (e) => e.stopPropagation());

// Toolbar: Copy chart image to clipboard
document.getElementById("btn-download")?.addEventListener("click", () => {
  const chart = charts[0];
  if (!chart) return;
  const canvas = chart.canvas;
  canvas.toBlob((blob) => {
    if (!blob) return;
    navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => {
      const btn = document.getElementById("btn-download");
      if (!btn) return;
      const iconImage = btn.querySelector(".icon-image") as HTMLElement;
      const iconCheck = btn.querySelector(".icon-check") as HTMLElement;
      if (iconImage) iconImage.style.display = "none";
      if (iconCheck) iconCheck.style.display = "";
      btn.classList.add("copied");
      setTimeout(() => {
        if (iconImage) iconImage.style.display = "";
        if (iconCheck) iconCheck.style.display = "none";
        btn.classList.remove("copied");
      }, 1500);
    });
  }, "image/png");
});

// Toolbar: Copy data as CSV
document.getElementById("btn-copy")?.addEventListener("click", () => {
  if (!lastSingleInput) return;
  const { data, type } = lastSingleInput;
  const isScatter = type === "scatter";
  let csv: string;

  if (isScatter) {
    const headers = data.datasets.flatMap((ds) => [`${ds.label}_x`, `${ds.label}_y`]);
    const maxLen = Math.max(...data.datasets.map((ds) => ds.data.length));
    const rows = [headers.join(",")];
    for (let i = 0; i < maxLen; i++) {
      const cells = data.datasets.flatMap((ds) => {
        const pt = ds.data[i] as { x: number; y: number } | undefined;
        return pt ? [String(pt.x), String(pt.y)] : ["", ""];
      });
      rows.push(cells.join(","));
    }
    csv = rows.join("\n");
  } else {
    const headers = ["Label", ...data.datasets.map((ds) => ds.label)];
    const labels = data.labels ?? data.datasets[0].data.map((_, i) => String(i + 1));
    const rows = [headers.join(",")];
    for (let i = 0; i < labels.length; i++) {
      const cells = [labels[i], ...data.datasets.map((ds) => ds.data[i] ?? "")];
      rows.push(cells.join(","));
    }
    csv = rows.join("\n");
  }

  navigator.clipboard.writeText(csv).then(() => {
    const btn = document.getElementById("btn-copy");
    if (!btn) return;
    const iconCopy = btn.querySelector(".icon-copy") as HTMLElement;
    const iconCheck = btn.querySelector(".icon-check") as HTMLElement;
    if (iconCopy) iconCopy.style.display = "none";
    if (iconCheck) iconCheck.style.display = "";
    btn.classList.add("copied");
    setTimeout(() => {
      if (iconCopy) iconCopy.style.display = "";
      if (iconCheck) iconCheck.style.display = "none";
      btn.classList.remove("copied");
    }, 1500);
  });
});

await app.connect();
const initialCtx = app.getHostContext();
if (initialCtx) applyHostContext(initialCtx);
