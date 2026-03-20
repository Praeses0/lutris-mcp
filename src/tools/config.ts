import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGameById, getGameBySlug, updateGame } from "../db/queries.js";
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
    "Write or update a game's YAML configuration. If the game already has a config file, the provided config is deep-merged with it. If the game has no config file yet, a new one is created.",
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

        let configpath = game.configpath;
        let finalConfig: Record<string, unknown>;

        if (configpath) {
          // Existing configpath: deep-merge with any existing file contents
          const existing = readGameConfig(configpath) || {};
          finalConfig = deepMerge(existing, params.config);
        } else {
          // No configpath: generate one and write the config directly
          configpath = `${game.slug}-${Date.now()}`;
          finalConfig = params.config;
          updateGame(game.id, { configpath });
        }

        writeGameConfig(configpath, finalConfig);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: `Config updated for "${game.name}"`, configpath, config: finalConfig }, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
