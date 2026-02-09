import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../server.js";

describe("MCP Server", () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer({
      htmlLoader: () => Promise.resolve("<html>test</html>"),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" });

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  it("lists 2 tools", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain("render_chart");
    expect(names).toContain("render_dashboard");
  });

  it("render_chart returns confirmation text and structuredContent", async () => {
    const result = await client.callTool({
      name: "render_chart",
      arguments: {
        type: "bar",
        title: "Test Bar",
        data: {
          labels: ["A", "B", "C"],
          datasets: [{ label: "Values", data: [10, 20, 30] }],
        },
      },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("bar chart");
    expect(text).toContain("Test Bar");
    expect(text).toContain("1 dataset");
    expect(text).toContain("3 data points");

    const structured = result.structuredContent as any;
    expect(structured.mode).toBe("chart");
    expect(structured.chart.type).toBe("bar");
    expect(structured.chart.title).toBe("Test Bar");
  });

  it("render_dashboard returns confirmation text and structuredContent", async () => {
    const result = await client.callTool({
      name: "render_dashboard",
      arguments: {
        title: "Test Dashboard",
        charts: [
          {
            type: "line",
            title: "Line Chart",
            data: {
              labels: ["X", "Y"],
              datasets: [{ label: "DS", data: [1, 2] }],
            },
          },
          {
            type: "pie",
            title: "Pie Chart",
            data: {
              labels: ["A", "B"],
              datasets: [{ label: "DS", data: [60, 40] }],
            },
          },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Test Dashboard");
    expect(text).toContain("2 charts");
    expect(text).toContain("line, pie");

    const structured = result.structuredContent as any;
    expect(structured.mode).toBe("dashboard");
    expect(structured.title).toBe("Test Dashboard");
    expect(structured.charts).toHaveLength(2);
    expect(structured.columns).toBe(2);
  });

  it("render_chart returns isError for invalid input", async () => {
    const result = await client.callTool({
      name: "render_chart",
      arguments: {
        type: "pie",
        title: "Bad Pie",
        data: {
          labels: ["A", "B"],
          datasets: [
            { label: "DS1", data: [1, 2] },
            { label: "DS2", data: [3, 4] },
          ],
        },
      },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Validation error");
  });

  it("render_dashboard returns isError for invalid chart inside", async () => {
    const result = await client.callTool({
      name: "render_dashboard",
      arguments: {
        title: "Bad Dashboard",
        charts: [
          {
            type: "scatter",
            title: "Bad Scatter",
            data: {
              datasets: [{ label: "DS", data: [1, 2, 3] }],
            },
          },
        ],
      },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Validation error");
  });

  it("registers the UI resource", async () => {
    const { resources } = await client.listResources();
    expect(resources.length).toBeGreaterThanOrEqual(1);
    const uiResource = resources.find((r) =>
      r.uri.includes("chartpane"),
    );
    expect(uiResource).toBeDefined();
  });
});
