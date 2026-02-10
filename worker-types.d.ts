// Bridge type mismatch between our @modelcontextprotocol/sdk (1.26.0) and
// the copy bundled inside the agents package (1.25.2). The agents package
// pins an older SDK version, causing duplicate McpServer types with
// incompatible private fields. This declaration widens the input type so
// our McpServer is accepted by createMcpHandler.
declare module "agents/mcp" {
  import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

  interface McpAuthContext {
    props: Record<string, unknown>;
  }

  export function createMcpHandler(
    server: McpServer,
    options?: Record<string, unknown>,
  ): (
    req: Request,
    env: unknown,
    ctx: ExecutionContext,
  ) => Promise<Response>;

  export function getMcpAuthContext(): McpAuthContext | undefined;
}
