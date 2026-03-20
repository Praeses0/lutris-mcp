import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGameById, getGameBySlug } from "../db/queries.js";
import { readGameConfig } from "../config/reader.js";
import { writeGameConfig } from "../config/writer.js";
import { deepMerge } from "../util/deep-merge.js";

export function registerConfigTools(server: McpServer) {
  server.tool(
    "read_game_config",
    "Read a game's YAML configuration file",
    {
      id: z.coerce.number().optional().describe("Game ID"),
      slug: z.string().optional().describe("Game slug"),
    },
    async (params) => {
      try {
        if (!params.id && !params.slug) {
          return { content: [{ type: "text", text: "Provide either id or slug." }], isError: true };
        }

        const game = params.id ? getGameById(params.id) : getGameBySlug(params.slug!);
        if (!game) {
          return { content: [{ type: "text", text: "Game not found." }], isError: true };
        }
        if (!game.configpath) {
          return { content: [{ type: "text", text: `"${game.name}" has no config file.` }], isError: true };
        }

        const config = readGameConfig(game.configpath);
        if (!config) {
          return { content: [{ type: "text", text: `Config file not found for "${game.name}".` }], isError: true };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ game: game.name, configpath: game.configpath, config }, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  server.tool(
    "write_game_config",
    "Update a game's YAML configuration (deep-merged with existing config)",
    {
      id: z.coerce.number().optional().describe("Game ID"),
      slug: z.string().optional().describe("Game slug"),
      config: z.record(z.unknown()).describe("Config object to merge (set keys to null to remove them)"),
    },
    async (params) => {
      try {
        if (!params.id && !params.slug) {
          return { content: [{ type: "text", text: "Provide either id or slug." }], isError: true };
        }

        const game = params.id ? getGameById(params.id) : getGameBySlug(params.slug!);
        if (!game) {
          return { content: [{ type: "text", text: "Game not found." }], isError: true };
        }
        if (!game.configpath) {
          return { content: [{ type: "text", text: `"${game.name}" has no config file.` }], isError: true };
        }

        const existing = readGameConfig(game.configpath) || {};
        const merged = deepMerge(existing, params.config);
        writeGameConfig(game.configpath, merged);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: `Config updated for "${game.name}"`, config: merged }, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
