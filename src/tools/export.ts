import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAllGames,
  listCategories,
  getAllGameCategories,
} from "../db/queries.js";

export function registerExportTools(server: McpServer) {
  server.tool(
    "export_library",
    "Export the full Lutris library as JSON (games, categories, associations)",
    {},
    async () => {
      try {
        const games = getAllGames();
        const categories = listCategories();
        const gameCategories = getAllGameCategories();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              exported_at: new Date().toISOString(),
              total_games: games.length,
              total_categories: categories.length,
              games,
              categories,
              game_categories: gameCategories,
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
