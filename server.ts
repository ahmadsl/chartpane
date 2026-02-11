import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { ChartInputSchema, DashboardInputSchema } from "./shared/types.js";
import type { ChartInput, RenderResult } from "./shared/types.js";
import { validateChartInput, validateDashboardInput } from "./shared/validation.js";
import { calculateColumns } from "./shared/grid.js";

const RESOURCE_URI = "ui://chartpane/mcp-app.html";

export interface ServerOptions {
  htmlLoader: () => Promise<string>;
  onLog?: (entry: Record<string, unknown>) => void;
  userId?: string;
}

function createLogRequest(
  onLog?: (entry: Record<string, unknown>) => void,
  userId?: string,
) {
  return function logRequest(tool: string, data: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      tool,
      ...(userId && { userId }),
      ...data,
    };
    console.log(JSON.stringify(entry));
    onLog?.(entry);
  };
}

export function createServer(options: ServerOptions): McpServer {
  const logRequest = createLogRequest(options.onLog, options.userId);
  const server = new McpServer({
    name: "ChartPane",
    version: "1.0.0",
  });

  // Register render_chart tool
  registerAppTool(
    server,
    "render_chart",
    {
      title: "Render Chart",
      description:
        "Renders a single chart inline. Supports bar, line, area, pie, doughnut, scatter, and radar chart types. Provide structured data with labels and datasets.",
      inputSchema: ChartInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args) => {
      const validation = validateChartInput(args);
      if (!validation.success) {
        logRequest("render_chart", { status: "error", error: validation.error });
        return {
          content: [{ type: "text", text: `Validation error: ${validation.error}` }],
          isError: true,
        };
      }

      const input = validation.data;
      const dataPoints = input.data.datasets.reduce(
        (sum, ds) => sum + ds.data.length,
        0,
      );

      logRequest("render_chart", {
        status: "ok",
        chartType: input.type,
        title: input.title,
        datasets: input.data.datasets.length,
        dataPoints,
        stacked: input.stacked ?? false,
        horizontal: input.horizontal ?? false,
      });

      const structuredContent: RenderResult = {
        mode: "chart",
        chart: input,
      };

      return {
        content: [
          {
            type: "text",
            text: `Rendered ${input.type} chart: "${input.title}" with ${input.data.datasets.length} dataset(s) and ${dataPoints} data points.`,
          },
        ],
        structuredContent,
      };
    },
  );

  // Register render_dashboard tool
  registerAppTool(
    server,
    "render_dashboard",
    {
      title: "Render Dashboard",
      description:
        "Renders multiple charts in a grid layout. Each chart can be any supported type (bar, line, area, pie, doughnut, scatter, radar). Optionally specify the number of grid columns.",
      inputSchema: DashboardInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args) => {
      const validation = validateDashboardInput(args);
      if (!validation.success) {
        logRequest("render_dashboard", { status: "error", error: validation.error });
        return {
          content: [{ type: "text", text: `Validation error: ${validation.error}` }],
          isError: true,
        };
      }

      const input = validation.data;
      const columns = calculateColumns(input.charts.length, input.columns);
      const chartTypes = input.charts.map((c: ChartInput) => c.type).join(", ");

      logRequest("render_dashboard", {
        status: "ok",
        title: input.title,
        chartCount: input.charts.length,
        chartTypes: input.charts.map((c: ChartInput) => c.type),
        columns,
      });

      const structuredContent: RenderResult = {
        mode: "dashboard",
        title: input.title,
        charts: input.charts,
        columns,
      };

      return {
        content: [
          {
            type: "text",
            text: `Rendered dashboard: "${input.title}" with ${input.charts.length} charts (${chartTypes}).`,
          },
        ],
        structuredContent,
      };
    },
  );

  // Register UI resource
  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await options.htmlLoader();
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                permissions: { clipboardWrite: {} },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}
