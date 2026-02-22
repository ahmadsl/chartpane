import {
  Chart,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  ScatterController,
  RadarController,
  PolarAreaController,
  BubbleController,
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
  PolarAreaController,
  BubbleController,
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
  const isPie = type === "pie" || type === "doughnut" || type === "polarArea";

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
      ...(type === "scatter" || type === "bubble" ? { type: "linear" } : {}),
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

// Real Examples fixtures
const exampleCharts = [
  {
    id: "example-growth",
    input: {
      type: "line",
      title: "Revenue Growth",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [{ label: "Revenue ($k)", data: [10, 15, 22, 31, 44, 58] }],
      },
    },
  },
  {
    id: "example-portfolio",
    input: {
      type: "doughnut",
      title: "Portfolio Allocation",
      data: {
        labels: ["Stocks", "Bonds", "Real Estate", "Cash"],
        datasets: [{ label: "Allocation", data: [40, 30, 20, 10] }],
      },
    },
  },
  {
    id: "example-comparison",
    input: {
      type: "bar",
      title: "Q4 Sales by Region",
      data: {
        labels: ["North", "South", "East", "West"],
        datasets: [{ label: "Sales ($k)", data: [340, 280, 195, 410] }],
      },
    },
  },
];

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
  {
    id: "gallery-stacked",
    input: {
      type: "bar",
      title: "Revenue by Channel",
      stacked: true,
      data: {
        labels: ["Q1", "Q2", "Q3", "Q4"],
        datasets: [
          { label: "Direct", data: [80, 100, 120, 150] },
          { label: "Organic", data: [60, 70, 90, 110] },
          { label: "Paid", data: [40, 50, 60, 80] },
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
// Chart type page demos (rendered on /charts/*.html pages)
// ──────────────────────────────────────────────────────────────

const chartPageDemos = [
  {
    id: "chartpage-bar",
    input: {
      type: "bar",
      title: "Monthly Active Users by Platform",
      data: {
        labels: ["iOS", "Android", "Web", "Desktop", "API"],
        datasets: [
          { label: "2024", data: [8200, 12400, 6800, 3100, 1500] },
          { label: "2025", data: [9400, 14100, 8500, 4200, 2300] },
        ],
      },
    },
  },
  {
    id: "chartpage-line",
    input: {
      type: "line",
      title: "Daily Temperature — San Francisco vs New York",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          { label: "San Francisco (°F)", data: [58, 61, 59, 63, 65, 62, 60] },
          { label: "New York (°F)", data: [42, 38, 35, 40, 45, 48, 44] },
        ],
      },
    },
  },
  {
    id: "chartpage-area",
    input: {
      type: "area",
      title: "Server Memory Usage (24h)",
      data: {
        labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "23:59"],
        datasets: [
          { label: "Used (GB)", data: [4.2, 3.8, 6.1, 11.5, 13.2, 9.8, 5.4] },
        ],
      },
    },
  },
  {
    id: "chartpage-pie",
    input: {
      type: "pie",
      title: "Programming Language Popularity (2025)",
      data: {
        labels: ["Python", "JavaScript", "TypeScript", "Java", "Go", "Other"],
        datasets: [{ label: "Usage", data: [28, 22, 15, 12, 8, 15] }],
      },
    },
  },
  {
    id: "chartpage-doughnut",
    input: {
      type: "doughnut",
      title: "Monthly Expenses Breakdown",
      data: {
        labels: ["Rent", "Food", "Transport", "Utilities", "Entertainment"],
        datasets: [{ label: "Spending", data: [1800, 650, 320, 240, 180] }],
      },
    },
  },
  {
    id: "chartpage-scatter",
    input: {
      type: "scatter",
      title: "Study Hours vs Test Scores",
      data: {
        datasets: [
          {
            label: "Students",
            data: [
              { x: 2, y: 55 }, { x: 3, y: 62 }, { x: 4, y: 68 }, { x: 5, y: 74 },
              { x: 6, y: 78 }, { x: 7, y: 85 }, { x: 8, y: 88 }, { x: 3.5, y: 60 },
              { x: 5.5, y: 72 }, { x: 6.5, y: 82 }, { x: 9, y: 92 }, { x: 1, y: 45 },
            ],
          },
        ],
      },
    },
  },
  {
    id: "chartpage-radar",
    input: {
      type: "radar",
      title: "Framework Comparison",
      data: {
        labels: ["Performance", "Ease of Use", "Ecosystem", "Documentation", "Community", "Learning Curve"],
        datasets: [
          { label: "React", data: [85, 70, 95, 90, 95, 65] },
          { label: "Vue", data: [80, 90, 75, 85, 80, 85] },
        ],
      },
    },
  },
  {
    id: "chartpage-stacked",
    input: {
      type: "bar",
      title: "Revenue by Channel",
      stacked: true,
      data: {
        labels: ["Q1", "Q2", "Q3", "Q4"],
        datasets: [
          { label: "Direct Sales", data: [120, 150, 180, 220] },
          { label: "Online Store", data: [80, 110, 140, 170] },
          { label: "Partners", data: [40, 60, 80, 100] },
        ],
      },
    },
  },
];

// ──────────────────────────────────────────────────────────────
// Example page demos (rendered on /examples/*.html pages)
// ──────────────────────────────────────────────────────────────

const salesDashboardCharts = [
  {
    id: "sales-revenue",
    input: {
      type: "line",
      title: "Monthly Revenue (H1)",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [{ label: "Revenue ($K)", data: [420, 385, 510, 475, 550, 610] }],
      },
    },
  },
  {
    id: "sales-products",
    input: {
      type: "bar",
      title: "Revenue by Product",
      data: {
        labels: ["Platform", "API", "Support", "Training"],
        datasets: [{ label: "Revenue ($K)", data: [1800, 680, 320, 150] }],
      },
    },
  },
  {
    id: "sales-regions",
    input: {
      type: "doughnut",
      title: "Revenue by Region",
      data: {
        labels: ["North America", "Europe", "APAC", "LATAM"],
        datasets: [{ label: "Share", data: [52, 28, 15, 5] }],
      },
    },
  },
  {
    id: "sales-channels",
    input: {
      type: "bar",
      title: "Sales by Channel (Q1 vs Q2)",
      stacked: true,
      data: {
        labels: ["Direct", "Partner", "Self-serve"],
        datasets: [
          { label: "Q1", data: [580, 380, 290] },
          { label: "Q2", data: [720, 510, 370] },
        ],
      },
    },
  },
];

const surveyResultsCharts = [
  {
    id: "survey-satisfaction",
    input: {
      type: "bar",
      title: "Satisfaction by Role",
      indexAxis: "y",
      data: {
        labels: ["Executives", "Engineers", "Designers", "PMs"],
        datasets: [{ label: "Satisfaction %", data: [88, 82, 76, 71] }],
      },
    },
  },
  {
    id: "survey-distribution",
    input: {
      type: "doughnut",
      title: "Overall Satisfaction",
      data: {
        labels: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
        datasets: [{ label: "Responses", data: [38, 31, 18, 9, 4] }],
      },
    },
  },
  {
    id: "survey-categories",
    input: {
      type: "radar",
      title: "Category Scores (out of 10)",
      data: {
        labels: ["Ease of Use", "Performance", "Documentation", "Support", "Pricing", "Features"],
        datasets: [{ label: "Avg Score", data: [8.2, 7.5, 6.8, 7.9, 6.3, 8.0] }],
      },
    },
  },
];

const budgetTrackerCharts = [
  {
    id: "budget-breakdown",
    input: {
      type: "doughnut",
      title: "Spending Breakdown",
      data: {
        labels: ["Housing", "Food", "Transport", "Entertainment", "Utilities", "Healthcare", "Savings"],
        datasets: [{ label: "Actual ($)", data: [1850, 720, 380, 310, 175, 95, 500] }],
      },
    },
  },
  {
    id: "budget-vs-actual",
    input: {
      type: "bar",
      title: "Budget vs Actual",
      indexAxis: "y",
      data: {
        labels: ["Housing", "Food", "Transport", "Entertainment", "Utilities", "Healthcare", "Savings"],
        datasets: [
          { label: "Budgeted ($)", data: [1800, 600, 400, 200, 180, 120, 700] },
          { label: "Actual ($)", data: [1850, 720, 380, 310, 175, 95, 500] },
        ],
      },
    },
  },
  {
    id: "budget-trend",
    input: {
      type: "area",
      title: "Monthly Spending (Jan–Jun)",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [{ label: "Total Spending ($)", data: [4950, 5100, 4780, 5230, 5120, 4830] }],
      },
    },
  },
];

// Examples hub thumbnail
const examplesHubCharts = [
  {
    id: "exhub-sales",
    input: salesDashboardCharts[0].input,
  },
  {
    id: "exhub-survey",
    input: surveyResultsCharts[1].input,
  },
  {
    id: "exhub-budget",
    input: budgetTrackerCharts[0].input,
  },
];

// Hub page thumbnails — reuse gallery chart data
const hubCharts = galleryCharts.map(c => ({
  id: c.id.replace("gallery-", "hub-"),
  input: c.input,
}));

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

  // Real Examples
  for (const item of exampleCharts) {
    renderChart(item.id, item.input);
  }

  // Gallery
  for (const item of galleryCharts) {
    renderChart(item.id, item.input);
  }

  // Dashboard
  for (const item of dashboardCharts) {
    renderChart(item.id, item.input);
  }

  // Chart type pages
  for (const item of chartPageDemos) {
    renderChart(item.id, item.input);
  }

  // Hub page thumbnails
  for (const item of hubCharts) {
    renderChart(item.id, item.input);
  }

  // Example pages
  for (const item of salesDashboardCharts) {
    renderChart(item.id, item.input);
  }
  for (const item of surveyResultsCharts) {
    renderChart(item.id, item.input);
  }
  for (const item of budgetTrackerCharts) {
    renderChart(item.id, item.input);
  }
  for (const item of examplesHubCharts) {
    renderChart(item.id, item.input);
  }
}

// ──────────────────────────────────────────────────────────────
// Install tabs + copy buttons
// ──────────────────────────────────────────────────────────────

function copyText(text, btn) {
  // Use data attributes for translated labels (set by generate-i18n.mjs build script)
  const label = btn.dataset.copyLabel || btn.textContent;
  const copiedLabel = btn.dataset.copiedLabel || "Copied!";
  try {
    navigator.clipboard.writeText(text);
    btn.textContent = copiedLabel;
    setTimeout(() => { btn.textContent = label; }, 2000);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    btn.textContent = copiedLabel;
    setTimeout(() => { btn.textContent = label; }, 2000);
  }
}

function initInstallSection() {
  const tabConnector = document.getElementById("tab-connector");
  const tabMcpRemote = document.getElementById("tab-mcp-remote");
  const panelConnector = document.getElementById("panel-connector");
  const panelMcpRemote = document.getElementById("panel-mcp-remote");
  const copyInstallBtn = document.getElementById("copy-install-btn");
  const copyUrlBtn = document.getElementById("copy-url-btn");
  const copyConfigBtn = document.getElementById("copy-config-btn");

  if (!tabConnector || !tabMcpRemote) return;

  let activeTab = "connector";

  const btnLabel = copyInstallBtn?.querySelector(".btn-label");
  // Capture translated labels at init time (data attrs set by generate-i18n.mjs)
  const ctaOriginalLabel = btnLabel?.textContent?.trim() || "Get Started Free";
  const copyConfigLabel = btnLabel?.dataset?.labelCopyConfig || "Copy Config";

  function switchTab(tab) {
    activeTab = tab;
    if (tab === "connector") {
      tabConnector.classList.add("install-tab-active");
      tabMcpRemote.classList.remove("install-tab-active");
      panelConnector.classList.remove("hidden");
      panelMcpRemote.classList.add("hidden");
      if (btnLabel) btnLabel.textContent = ctaOriginalLabel;
    } else {
      tabMcpRemote.classList.add("install-tab-active");
      tabConnector.classList.remove("install-tab-active");
      panelMcpRemote.classList.remove("hidden");
      panelConnector.classList.add("hidden");
      if (btnLabel) btnLabel.textContent = copyConfigLabel;
    }
  }

  tabConnector.addEventListener("click", () => switchTab("connector"));
  tabMcpRemote.addEventListener("click", () => switchTab("mcp-remote"));

  // Individual copy buttons
  copyUrlBtn?.addEventListener("click", () => {
    copyText(document.getElementById("connector-url").textContent, copyUrlBtn);
  });
  copyConfigBtn?.addEventListener("click", () => {
    copyText(document.getElementById("config-code").textContent, copyConfigBtn);
  });

  // Main CTA button — use the label span so the SVG icon is preserved
  copyInstallBtn?.addEventListener("click", () => {
    const text = activeTab === "connector"
      ? document.getElementById("connector-url").textContent
      : document.getElementById("config-code").textContent;
    const target = btnLabel || copyInstallBtn;
    const original = target.textContent;
    // Use translated "Copied!" from the btn's data attribute if available
    const copiedText = (copyInstallBtn.dataset?.copiedLabel) || "Copied!";
    navigator.clipboard.writeText(text).then(() => {
      target.textContent = copiedText;
      setTimeout(() => { target.textContent = original; }, 2000);
    }).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      target.textContent = copiedText;
      setTimeout(() => { target.textContent = original; }, 2000);
    });
  });
}

// ──────────────────────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// Scroll reveal animations
// ──────────────────────────────────────────────────────────────

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

  document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
}

// ──────────────────────────────────────────────────────────────
// Language switcher
// ──────────────────────────────────────────────────────────────

function initLangSwitcher() {
  const trigger = document.getElementById("lang-trigger");
  const dropdown = document.getElementById("lang-dropdown");
  if (!trigger || !dropdown) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    dropdown.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(!isOpen));
  });

  // Close on outside click
  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  });

  // Set lang cookie on language select, then navigate via href
  for (const opt of dropdown.querySelectorAll("[data-lang]")) {
    opt.addEventListener("click", () => {
      const lang = opt.getAttribute("data-lang");
      if (lang) {
        // Set persistent lang cookie (1 year)
        document.cookie = `lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
      }
      // Navigation follows the anchor href naturally
    });
  }
}

renderAll();
initInstallSection();
initScrollAnimations();
initLangSwitcher();

// Re-render on theme change
darkMq.addEventListener("change", () => {
  renderAll();
});
