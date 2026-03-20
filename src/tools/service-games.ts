import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchServiceGames, getServiceGame, insertGame } from "../db/queries.js";
import { generateSlug } from "../util/slug.js";

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

  server.tool(
    "import_service_game",
    "Import a game from external services (Steam, GOG) into your Lutris library",
    {
      service: z.string().describe("Service name (e.g. steam, gog)"),
      appid: z.string().describe("App ID from the service"),
      runner: z.string().optional().default("steam").describe("Runner to use"),
      platform: z.string().optional().default("linux").describe("Platform"),
    },
    async (params) => {
      try {
        const sg = getServiceGame(params.service, params.appid);
        if (!sg) {
          return {
            content: [{ type: "text", text: `No service game found for ${params.service}:${params.appid}` }],
            isError: true,
          };
        }

        const game = insertGame({
          name: sg.name,
          slug: sg.slug || generateSlug(sg.name || ""),
          service: sg.service,
          service_id: sg.appid,
          runner: params.runner,
          platform: params.platform,
          installed: 0,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: `Imported "${game.name}" from ${params.service}`, game }, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("UNIQUE constraint failed")) {
          return { content: [{ type: "text", text: "A game with that slug already exists in your library." }], isError: true };
        }
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
