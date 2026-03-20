import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchServiceGames } from "../db/queries.js";

export function registerServiceGameTools(server: McpServer) {
  server.tool(
    "search_service_games",
    "Search games from external services (Steam, GOG, etc.) synced in Lutris",
    {
      query: z.string().optional().describe("Search by name or app ID"),
      service: z.string().default("steam").describe("Service to search (e.g. steam)"),
      limit: z.coerce.number().min(1).max(100).default(25).describe("Results per page"),
      offset: z.coerce.number().min(0).default(0).describe("Offset for pagination"),
    },
    async (params) => {
      try {
        const result = searchServiceGames(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { total: result.total, count: result.games.length, games: result.games },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
