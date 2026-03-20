import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findDuplicates } from "../db/queries.js";

export function registerDuplicateTools(server: McpServer) {
  server.tool(
    "find_duplicates",
    "Find potential duplicate games (same directory or similar slugs)",
    {},
    async () => {
      try {
        const groups = findDuplicates();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_groups: groups.length,
              duplicates: groups,
            }, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
