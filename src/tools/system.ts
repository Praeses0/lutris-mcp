import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import path from "path";
import { getGameById, getGameBySlug } from "../db/queries.js";
import type { Game } from "../db/types.js";

interface ProcessResult {
  running: boolean;
  pid?: number;
  command?: string;
  match_method?: string;
}

function isLutrisGuiRunning(): boolean {
  try {
    const output = execSync('pgrep -af "lutris"', {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (!output) return false;

    // Filter out our own MCP process, CLI invocations (--list-runners, --list-wine-versions), and the pgrep command itself
    const lines = output.split("\n").filter((line) => {
      if (line.includes("pgrep")) return false;
      if (line.includes("lutris-mcp")) return false;
      if (line.includes("--list-runners")) return false;
      if (line.includes("--list-wine-versions")) return false;
      // Match the Lutris GUI process: typically "python" running "lutris" or just "/usr/bin/lutris"
      return true;
    });

    return lines.length > 0;
  } catch {
    return false;
  }
}

/**
 * Run pgrep with a pattern and return the result.
 * Filters out lines that contain "pgrep" to avoid matching the pgrep command itself.
 */
function pgrepSearch(pattern: string): ProcessResult {
  try {
    const output = execSync(`pgrep -af "${pattern}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (!output) return { running: false };

    // Filter out lines matching the pgrep command itself
    const lines = output.split("\n").filter(
      (line) => !line.includes("pgrep") && line.trim().length > 0
    );

    if (lines.length === 0) return { running: false };

    const firstLine = lines[0];
    const pid = parseInt(firstLine.split(/\s+/)[0], 10);
    return { running: true, pid, command: firstLine };
  } catch {
    return { running: false };
  }
}

/**
 * Build an array of search patterns for a game, ordered from most specific to least.
 */
export function buildSearchPatterns(game: Game): { pattern: string; method: string }[] {
  const patterns: { pattern: string; method: string }[] = [];

  // 1. Match by directory path (most specific for wine/proton games)
  if (game.directory) {
    patterns.push({ pattern: game.directory, method: "directory" });
  }

  // 2. Match by full executable path
  if (game.executable) {
    patterns.push({ pattern: game.executable, method: "executable" });
  }

  // 3. Match by executable basename (e.g., "hl2.exe", "Balatro.exe")
  if (game.executable) {
    const basename = path.basename(game.executable);
    if (basename !== game.executable) {
      patterns.push({ pattern: basename, method: "executable_basename" });
    }
  }

  // 4. For Steam games, check for steam running with the app ID
  if (game.service === "steam" && game.service_id) {
    patterns.push({ pattern: `steam.*AppId.*${game.service_id}`, method: "steam_appid" });
    patterns.push({ pattern: `SteamLaunch AppId=${game.service_id}`, method: "steam_launch" });
  }

  // 5. Match by Wine/Proton process patterns using the game name
  if (game.runner === "wine" || game.runner === "steam") {
    const safeName = game.name?.replace(/[^a-zA-Z0-9]/g, ".*") ?? "";
    if (safeName) {
      patterns.push({ pattern: `wine.*${safeName}`, method: "wine_process" });
      patterns.push({ pattern: `proton.*${safeName}`, method: "proton_process" });
    }
  }

  // 6. Match by slug as a process pattern (general fallback)
  if (game.slug) {
    patterns.push({ pattern: game.slug, method: "slug" });
  }

  return patterns;
}

/**
 * Try multiple search patterns to find a running game process.
 * Returns as soon as a match is found.
 */
function findGameProcess(game: Game): ProcessResult {
  const patterns = buildSearchPatterns(game);

  for (const { pattern, method } of patterns) {
    const result = pgrepSearch(pattern);
    if (result.running) {
      return { ...result, match_method: method };
    }
  }

  return { running: false };
}

export function getLogDir(): string {
  return (
    process.env.LUTRIS_LOG_DIR ||
    path.join(homedir(), ".local", "share", "lutris", "logs")
  );
}

/**
 * Find log files for a game by slug. Returns paths sorted by modification time
 * (most recent first).
 */
export function findGameLogFiles(slug: string): string[] {
  const logDir = getLogDir();
  if (!existsSync(logDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(logDir);
  } catch {
    return [];
  }

  // Match files that start with the slug (e.g., "half-life-2.log", "half-life-2-2024-01-15.log")
  const matching = entries
    .filter((f) => f.startsWith(slug) && f.endsWith(".log"))
    .map((f) => path.join(logDir, f));

  // Sort by modification time, most recent first
  matching.sort((a, b) => {
    try {
      return statSync(b).mtimeMs - statSync(a).mtimeMs;
    } catch {
      return 0;
    }
  });

  return matching;
}

/**
 * Read the last N lines of a file.
 */
export function readLastLines(filePath: string, lines: number): string {
  const content = readFileSync(filePath, "utf-8");
  const allLines = content.split("\n");
  // Take the last N lines (filter trailing empty line from trailing newline)
  const trimmed = allLines.length > 0 && allLines[allLines.length - 1] === ""
    ? allLines.slice(0, -1)
    : allLines;
  return trimmed.slice(-lines).join("\n");
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

        const result = findGameProcess(game);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              game: game.name,
              running: result.running,
              ...(result.pid ? { pid: result.pid } : {}),
              ...(result.match_method ? { match_method: result.match_method } : {}),
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
        if (isLutrisGuiRunning()) {
          return {
            content: [{ type: "text", text: "Lutris GUI is currently running. Close it to use this tool." }],
            isError: true,
          };
        }

        const flag = params.type === "wine" ? "--list-wine-versions" : "--list-runners";
        const output = execSync(`lutris ${flag}`, {
          encoding: "utf-8",
          timeout: 15000,
        }).trim();

        if (!output) {
          return {
            content: [{ type: "text", text: "No runners returned. Lutris may not be configured or no runners are installed." }],
            isError: true,
          };
        }

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

  server.tool(
    "view_game_log",
    "Read the last launch log for a game",
    {
      id: z.coerce.number().optional().describe("Game ID"),
      slug: z.string().optional().describe("Game slug"),
      lines: z.coerce.number().min(1).max(500).default(100).describe("Number of lines to return (default 100, max 500)"),
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

        if (!game.slug) {
          return { content: [{ type: "text", text: "Game has no slug; cannot locate log files." }], isError: true };
        }

        const logFiles = findGameLogFiles(game.slug);
        if (logFiles.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                game: game.name,
                log_dir: getLogDir(),
                error: "No log files found for this game.",
              }, null, 2),
            }],
            isError: true,
          };
        }

        const logPath = logFiles[0];
        const lineCount = params.lines ?? 100;
        const content = readLastLines(logPath, lineCount);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              game: game.name,
              log_file: logPath,
              total_log_files: logFiles.length,
              lines: lineCount,
              content,
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
