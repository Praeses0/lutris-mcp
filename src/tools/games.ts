import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listGames,
  getGameById,
  getGameBySlug,
  getGameCategories,
  insertGame,
  updateGame,
  deleteGame,
} from "../db/queries.js";
import { readGameConfig } from "../config/reader.js";
import { generateSlug } from "../util/slug.js";

function handleError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error ? (error as any).code : "";
  if (code === "SQLITE_CONSTRAINT_UNIQUE" || msg.includes("UNIQUE constraint failed")) {
    return { content: [{ type: "text" as const, text: "A game with that slug already exists." }], isError: true };
  }
  if (code === "SQLITE_BUSY" || msg.includes("SQLITE_BUSY")) {
    return { content: [{ type: "text" as const, text: "Database locked — Lutris may be busy. Try again shortly." }], isError: true };
  }
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

export function registerGameTools(server: McpServer) {
  server.tool(
    "list_games",
    "List and filter games in the Lutris library with pagination",
    {
      runner: z.string().optional().describe("Filter by runner (e.g. steam, wine, linux)"),
      platform: z.string().optional().describe("Filter by platform"),
      installed: z.boolean().optional().describe("Filter by installed status"),
      category: z.string().optional().describe("Filter by category name"),
      search: z.string().optional().describe("Search by name or slug"),
      service: z.string().optional().describe("Filter by service (e.g. steam)"),
      limit: z.coerce.number().min(1).max(200).default(50).describe("Results per page"),
      offset: z.coerce.number().min(0).default(0).describe("Offset for pagination"),
      sort_by: z
        .enum(["name", "sortname", "playtime", "lastplayed", "installed_at", "year", "updated"])
        .default("name")
        .describe("Sort column"),
      sort_order: z.enum(["asc", "desc"]).default("asc").describe("Sort direction"),
    },
    async (params) => {
      try {
        const result = listGames(params);
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
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_game",
    "Get full details for a specific game including categories and YAML config",
    {
      id: z.coerce.number().optional().describe("Game ID"),
      slug: z.string().optional().describe("Game slug"),
    },
    async (params) => {
      try {
        if (!params.id && !params.slug) {
          return {
            content: [{ type: "text", text: "Provide either id or slug." }],
            isError: true,
          };
        }

        const game = params.id ? getGameById(params.id) : getGameBySlug(params.slug!);
        if (!game) {
          return {
            content: [{ type: "text", text: `Game not found.` }],
            isError: true,
          };
        }

        const categories = getGameCategories(game.id);
        const config = readGameConfig(game.configpath);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...game, categories, config }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "add_game",
    "Add a new game to the Lutris library",
    {
      name: z.string().describe("Game name"),
      runner: z.string().describe("Runner (e.g. linux, wine, steam)"),
      platform: z.string().optional().describe("Platform"),
      directory: z.string().optional().describe("Install directory"),
      executable: z.string().optional().describe("Executable path"),
      year: z.coerce.number().optional().describe("Release year"),
      service: z.string().optional().describe("Service (e.g. steam)"),
      service_id: z.string().optional().describe("Service ID"),
      slug: z.string().optional().describe("Custom slug (auto-generated if omitted)"),
      installed: z.boolean().default(false).describe("Mark as installed"),
    },
    async (params) => {
      try {
        const gameData: Record<string, unknown> = {
          name: params.name,
          runner: params.runner,
          slug: params.slug || generateSlug(params.name),
          installed: params.installed ? 1 : 0,
        };

        if (params.platform) gameData.platform = params.platform;
        if (params.directory) gameData.directory = params.directory;
        if (params.executable) gameData.executable = params.executable;
        if (params.year) gameData.year = params.year;
        if (params.service) gameData.service = params.service;
        if (params.service_id) gameData.service_id = params.service_id;

        const game = insertGame(gameData);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ message: "Game added successfully", game }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "update_game",
    "Update fields on an existing game",
    {
      id: z.coerce.number().describe("Game ID to update"),
      name: z.string().optional(),
      slug: z.string().optional(),
      runner: z.string().optional(),
      platform: z.string().optional(),
      directory: z.string().optional(),
      executable: z.string().optional(),
      year: z.coerce.number().optional(),
      service: z.string().optional(),
      service_id: z.string().optional(),
      installed: z.boolean().optional(),
      sortname: z.string().optional(),
      discord_id: z.string().optional(),
    },
    async (params) => {
      try {
        const { id, installed, ...rest } = params;
        const existing = getGameById(id);
        if (!existing) {
          return {
            content: [{ type: "text", text: `Game with id ${id} not found.` }],
            isError: true,
          };
        }

        const updates: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) updates[k] = v;
        }
        if (installed !== undefined) updates.installed = installed ? 1 : 0;

        const game = updateGame(id, updates);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ message: "Game updated", game }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "remove_game",
    "Remove a game from the Lutris database (does not delete files)",
    {
      id: z.coerce.number().describe("Game ID to remove"),
      confirm: z.boolean().describe("Must be true to confirm deletion"),
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return {
            content: [
              { type: "text", text: "Set confirm to true to delete the game." },
            ],
            isError: true,
          };
        }

        const game = getGameById(params.id);
        if (!game) {
          return {
            content: [{ type: "text", text: `Game with id ${params.id} not found.` }],
            isError: true,
          };
        }

        deleteGame(params.id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { message: `Removed "${game.name}" (id: ${game.id}) from library.` },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return handleError(error);
      }
    }
  );
}
