import {
  Chart,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  ScatterController,
  RadarController,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

Chart.register(
  BarController,
  LineController,
  PieController,
  DoughnutController,
  ScatterController,
  RadarController,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  Title,
);

// ──────────────────────────────────────────────────────────────
// Palette (duplicated from shared/colors.ts — landing is self-contained)
// ──────────────────────────────────────────────────────────────
const PALETTE = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948",
  "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac", "#af7aa1", "#86bcb6",
];

function getColor(i) {
  return PALETTE[i % PALETTE.length];
}

// ──────────────────────────────────────────────────────────────
// Simplified buildChartConfig (from shared/config.ts)
// ──────────────────────────────────────────────────────────────
function buildChartConfig(input) {
  const { type, title, data, stacked, horizontal } = input;
  const chartJsType = type === "area" ? "line" : type;
  const isPie = type === "pie" || type === "doughnut";

  const datasets = data.datasets.map((ds, i) => {
    const color = isPie
      ? ds.data.map((_, j) => getColor(j))
      : getColor(i);

    return {
      label: ds.label,
      data: ds.data,
      backgroundColor: color,
      borderColor: color,
      ...(type === "area" ? { fill: true } : {}),
      ...(type === "line" || type === "area" ? { tension: 0.3 } : {}),
    };
  });

  const noScales = isPie || type === "radar";
  const scales = noScales ? undefined : {
    x: {
      ...(stacked ? { stacked: true } : {}),
      ...(type === "scatter" ? { type: "linear" } : {}),
    },
    y: {
      ...(stacked ? { stacked: true } : {}),
      ...(type === "bar" ? { beginAtZero: true } : {}),
    },
  };

  const showLegend = isPie || data.datasets.length > 1;

  return {
    type: chartJsType,
    data: {
      ...(data.labels ? { labels: data.labels } : {}),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...(horizontal ? { indexAxis: "y" } : {}),
      plugins: {
        title: { display: true, text: title },
        legend: { display: showLegend },
      },
      ...(scales ? { scales } : {}),
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Chart fixtures
// ──────────────────────────────────────────────────────────────

const heroChart = {
  type: "bar",
  title: "Monthly Revenue",
  data: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [{ label: "Revenue ($k)", data: [42, 45, 52, 48, 55, 61] }],
  },
};

const galleryCharts = [
  {
    id: "gallery-bar",
    input: {
      type: "bar",
      title: "Quarterly Sales",
      data: {
        labels: ["Q1", "Q2", "Q3", "Q4"],
        datasets: [
          { label: "Product A", data: [120, 190, 150, 210] },
          { label: "Product B", data: [90, 130, 170, 140] },
        ],
      },
    },
  },
  {
    id: "gallery-line",
    input: {
      type: "line",
      title: "Website Traffic",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          { label: "Visitors", data: [1200, 1900, 3000, 2500, 2200, 800, 600] },
          { label: "Page Views", data: [3600, 5700, 9000, 7500, 6600, 2400, 1800] },
        ],
      },
    },
  },
  {
    id: "gallery-area",
    input: {
      type: "area",
      title: "CPU Usage Over Time",
      data: {
        labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
        datasets: [{ label: "CPU %", data: [15, 12, 45, 78, 62, 30] }],
      },
    },
  },
  {
    id: "gallery-pie",
    input: {
      type: "pie",
      title: "Market Share",
      data: {
        labels: ["Chrome", "Safari", "Firefox", "Edge", "Other"],
        datasets: [{ label: "Share", data: [65, 19, 4, 4, 8] }],
      },
    },
  },
  {
    id: "gallery-doughnut",
    input: {
      type: "doughnut",
      title: "Budget Allocation",
      data: {
        labels: ["Engineering", "Marketing", "Sales", "Operations"],
        datasets: [{ label: "Budget", data: [40, 25, 20, 15] }],
      },
    },
  },
  {
    id: "gallery-scatter",
    input: {
      type: "scatter",
      title: "Height vs Weight",
      data: {
        datasets: [
          {
            label: "Male",
            data: [
              { x: 170, y: 70 }, { x: 175, y: 80 }, { x: 180, y: 85 },
              { x: 165, y: 65 }, { x: 185, y: 90 }, { x: 178, y: 75 },
            ],
          },
          {
            label: "Female",
            data: [
              { x: 155, y: 50 }, { x: 160, y: 55 }, { x: 165, y: 60 },
              { x: 158, y: 52 }, { x: 170, y: 65 }, { x: 162, y: 58 },
            ],
          },
        ],
      },
    },
  },
  {
    id: "gallery-radar",
    input: {
      type: "radar",
      title: "Skill Assessment",
      data: {
        labels: ["JavaScript", "Python", "Design", "DevOps", "Communication", "Leadership"],
        datasets: [
          { label: "Alice", data: [90, 70, 60, 80, 85, 75] },
          { label: "Bob", data: [75, 85, 40, 90, 70, 65] },
        ],
      },
    },
  },
];

const dashboardCharts = [
  {
    id: "dashboard-1",
    input: {
      type: "line",
      title: "Revenue Trend",
      data: {
        labels: ["Jan", "Feb", "Mar"],
        datasets: [{ label: "Revenue", data: [4000, 4500, 5200] }],
      },
    },
  },
  {
    id: "dashboard-2",
    input: {
      type: "pie",
      title: "Revenue by Region",
      data: {
        labels: ["US", "EU", "Asia"],
        datasets: [{ label: "Revenue", data: [5000, 3000, 2000] }],
      },
    },
  },
  {
    id: "dashboard-3",
    input: {
      type: "bar",
      title: "Top Products",
      data: {
        labels: ["Widget A", "Widget B", "Widget C"],
        datasets: [{ label: "Units Sold", data: [1200, 900, 750] }],
      },
    },
  },
  {
    id: "dashboard-4",
    input: {
      type: "doughnut",
      title: "Customer Segments",
      data: {
        labels: ["Enterprise", "SMB", "Consumer"],
        datasets: [{ label: "Customers", data: [35, 45, 20] }],
      },
    },
  },
];

// ──────────────────────────────────────────────────────────────
// Theme detection & Chart.js defaults
// ──────────────────────────────────────────────────────────────

const darkMq = window.matchMedia("(prefers-color-scheme: dark)");

function isDark() {
  return darkMq.matches;
}

function applyChartDefaults() {
  const dark = isDark();
  Chart.defaults.color = dark ? "#9ca3af" : "#6b7280";
  Chart.defaults.borderColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
}

// ──────────────────────────────────────────────────────────────
// Chart instance management
// ──────────────────────────────────────────────────────────────

const instances = new Map();

function renderChart(canvasId, input) {
  // Destroy existing instance
  if (instances.has(canvasId)) {
    instances.get(canvasId).destroy();
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const config = buildChartConfig(input);
  const chart = new Chart(canvas, config);
  instances.set(canvasId, chart);
}

function renderAll() {
  applyChartDefaults();

  // Hero
  renderChart("hero-chart", heroChart);

  // Gallery
  for (const item of galleryCharts) {
    renderChart(item.id, item.input);
  }

  // Dashboard
  for (const item of dashboardCharts) {
    renderChart(item.id, item.input);
  }
}

// ──────────────────────────────────────────────────────────────
// Copy button
// ──────────────────────────────────────────────────────────────

function initCopyButton() {
  const btn = document.getElementById("copy-btn");
  const code = document.getElementById("config-code");
  if (!btn || !code) return;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    } catch {
      // Fallback for older browsers
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("copy");
      sel.removeAllRanges();
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    }
  });
}

// ──────────────────────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────────────

renderAll();
initCopyButton();

// Re-render on theme change
darkMq.addEventListener("change", () => {
  renderAll();
});
