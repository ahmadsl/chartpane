import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        privacy: resolve(__dirname, "privacy.html"),
        "what-is-an-mcp-app": resolve(__dirname, "what-is-an-mcp-app.html"),
        "getting-started": resolve(__dirname, "getting-started.html"),
        terms: resolve(__dirname, "terms.html"),
        "charts-index": resolve(__dirname, "charts/index.html"),
        "charts-bar": resolve(__dirname, "charts/bar-chart.html"),
        "charts-line": resolve(__dirname, "charts/line-chart.html"),
        "charts-area": resolve(__dirname, "charts/area-chart.html"),
        "charts-pie": resolve(__dirname, "charts/pie-chart.html"),
        "charts-doughnut": resolve(__dirname, "charts/doughnut-chart.html"),
        "charts-scatter": resolve(__dirname, "charts/scatter-plot.html"),
        "charts-radar": resolve(__dirname, "charts/radar-chart.html"),
        "charts-stacked": resolve(__dirname, "charts/stacked-chart.html"),
        "examples-index": resolve(__dirname, "examples/index.html"),
        "examples-sales-dashboard": resolve(__dirname, "examples/sales-dashboard.html"),
      },
    },
  },
});
