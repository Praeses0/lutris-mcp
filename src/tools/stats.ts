import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLibraryStats } from "../db/queries.js";

export function registerStatsTools(server: McpServer) {
  server.tool(
    "get_library_stats",
    "Get aggregate statistics about the Lutris game library",
    {},
    async () => {
      try {
        const stats = getLibraryStats();
        return {
          content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
