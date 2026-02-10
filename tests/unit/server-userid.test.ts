import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../server.js";

const CHART_ARGS = {
  type: "bar",
  title: "Test",
  data: {
    labels: ["A", "B"],
    datasets: [{ label: "V", data: [1, 2] }],
  },
};

async function setup(userId?: string) {
  const onLog = vi.fn();
  const server = createServer({
    htmlLoader: () => Promise.resolve("<html>test</html>"),
    onLog,
    ...(userId !== undefined && { userId }),
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return { client, onLog };
}

describe("userId in log entries", () => {
  it("includes userId when provided", async () => {
    const { client, onLog } = await setup("u-123");
    await client.callTool({ name: "render_chart", arguments: CHART_ARGS });

    expect(onLog).toHaveBeenCalledOnce();
    const entry = onLog.mock.calls[0][0];
    expect(entry.userId).toBe("u-123");
  });

  it("omits userId when not provided", async () => {
    const { client, onLog } = await setup();
    await client.callTool({ name: "render_chart", arguments: CHART_ARGS });

    expect(onLog).toHaveBeenCalledOnce();
    const entry = onLog.mock.calls[0][0];
    expect(entry).not.toHaveProperty("userId");
  });

  it("omits userId when explicitly undefined", async () => {
    const { client, onLog } = await setup(undefined);
    await client.callTool({ name: "render_chart", arguments: CHART_ARGS });

    expect(onLog).toHaveBeenCalledOnce();
    const entry = onLog.mock.calls[0][0];
    expect(entry).not.toHaveProperty("userId");
  });

  it("includes userId in dashboard log entries", async () => {
    const { client, onLog } = await setup("u-456");
    await client.callTool({
      name: "render_dashboard",
      arguments: {
        title: "Dashboard",
        charts: [CHART_ARGS],
      },
    });

    expect(onLog).toHaveBeenCalledOnce();
    const entry = onLog.mock.calls[0][0];
    expect(entry.userId).toBe("u-456");
  });

  it("includes userId in error log entries", async () => {
    const { client, onLog } = await setup("u-789");
    await client.callTool({
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

    expect(onLog).toHaveBeenCalledOnce();
    const entry = onLog.mock.calls[0][0];
    expect(entry.userId).toBe("u-789");
    expect(entry.status).toBe("error");
  });
});
