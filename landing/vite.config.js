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
      },
    },
  },
});
