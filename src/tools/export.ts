import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAllGames,
  listGames,
  listCategories,
  getAllGameCategories,
} from "../db/queries.js";
import { readGameConfig } from "../config/reader.js";

export function registerExportTools(server: McpServer) {
  server.tool(
    "export_library",
    "Export the Lutris library as JSON (games, categories, associations). Supports filtering by category, runner, and installed status, and optionally includes each game's YAML config.",
    {
      category: z.string().optional().describe("Only export games in this category"),
      runner: z.string().optional().describe("Only export games with this runner"),
      installed: z.boolean().optional().describe("Only export installed games"),
      include_configs: z.boolean().optional().default(false).describe("Include each game's YAML config in the export"),
    },
    async (params) => {
      try {
        const hasFilters = params.category !== undefined ||
          params.runner !== undefined ||
          params.installed !== undefined;

        let games;
        if (hasFilters) {
          const result = listGames({
            category: params.category,
            runner: params.runner,
            installed: params.installed,
            limit: 100000,
            offset: 0,
            sort_by: "name",
            sort_order: "asc",
          });
          games = result.games;
        } else {
          games = getAllGames();
        }

        const categories = listCategories();
        const gameCategories = getAllGameCategories();

        // If filters are active, restrict game_categories to matched game IDs
        const gameIds = new Set(games.map((g) => g.id));
        const filteredGameCategories = hasFilters
          ? gameCategories.filter((gc) => gameIds.has(gc.game_id))
          : gameCategories;

        let exportedGames: unknown[] = games;
        if (params.include_configs) {
          exportedGames = games.map((g) => ({
            ...g,
            config: readGameConfig(g.configpath),
          }));
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              exported_at: new Date().toISOString(),
              total_games: games.length,
              total_categories: categories.length,
              games: exportedGames,
              categories,
              game_categories: filteredGameCategories,
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
