import { createServer } from "./server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import cors from "cors";

const server = createServer();

if (process.argv.includes("--stdio")) {
  // stdio mode for Claude Desktop
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else {
  // HTTP mode
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  app.listen(PORT, () => {
    console.log(`ChartPane MCP server running at http://localhost:${PORT}/mcp`);
  });
}
