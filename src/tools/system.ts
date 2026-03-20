import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execSync } from "child_process";
import { getGameById, getGameBySlug } from "../db/queries.js";

function findGameProcess(pattern: string): { running: boolean; pid?: number; command?: string } {
  try {
    const output = execSync(`pgrep -af "${pattern}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (!output) return { running: false };

    const firstLine = output.split("\n")[0];
    const pid = parseInt(firstLine.split(/\s+/)[0], 10);
    return { running: true, pid, command: firstLine };
  } catch {
    return { running: false };
  }
}

export function registerSystemTools(server: McpServer) {
  server.tool(
    "check_game_running",
    "Check if a game is currently running",
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

        // Try matching by directory first (most reliable for wine games), then executable
        let result = { running: false } as ReturnType<typeof findGameProcess>;
        if (game.directory) {
          result = findGameProcess(game.directory);
        }
        if (!result.running && game.executable) {
          result = findGameProcess(game.executable);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              game: game.name,
              running: result.running,
              ...(result.pid ? { pid: result.pid } : {}),
            }, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_runners",
    "List available Lutris runners or Wine versions",
    {
      type: z.enum(["runners", "wine"]).default("runners").describe("List runners or wine versions"),
    },
    async (params) => {
      try {
        const flag = params.type === "wine" ? "--list-wine-versions" : "--list-runners";
        const output = execSync(`lutris ${flag}`, {
          encoding: "utf-8",
          timeout: 15000,
        }).trim();

        let data: unknown;
        if (params.type === "wine") {
          // Lutris outputs Python dict syntax (single quotes, True/False/None)
          data = output.split("\n").filter(Boolean).map((line) => {
            const json = line
              .replace(/'/g, '"')
              .replace(/\bTrue\b/g, "true")
              .replace(/\bFalse\b/g, "false")
              .replace(/\bNone\b/g, "null");
            return JSON.parse(json);
          });
        } else {
          // Plain text, one runner name per line
          data = output.split("\n").filter(Boolean);
        }

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
