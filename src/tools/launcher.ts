import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spawn } from "child_process";
import { existsSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { getGameById, getGameBySlug } from "../db/queries.js";

export function registerLauncherTools(server: McpServer) {
  server.tool(
    "launch_game",
    "Launch an installed game via Lutris",
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
        if (!game.installed) {
          return { content: [{ type: "text", text: `"${game.name}" is not installed.` }], isError: true };
        }

        const child = spawn("lutris", [`lutris:rungame/${game.slug}`], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: `Launched "${game.name}"`, pid: child.pid }, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  server.tool(
    "install_game",
    "Install a game via Lutris (from installer slug or local setup executable)",
    {
      installer_slug: z.string().optional().describe("Lutris installer slug (for web installers)"),
      id: z.coerce.number().optional().describe("Game ID (uses its installer_slug)"),
      slug: z.string().optional().describe("Game slug (uses its installer_slug)"),
      setup_exe: z.string().optional().describe("Path to a local setup executable (e.g. setup.exe for Wine games)"),
      name: z.string().optional().describe("Game name (required with setup_exe)"),
      runner: z.enum(["wine", "linux"]).default("wine").describe("Runner for local installs"),
      exe: z.string().optional().describe("Game executable path relative to $GAMEDIR (e.g. drive_c/Program Files/Game/game.exe). If omitted, configure later via write_game_config."),
      install_dir: z.string().optional().describe("Wine install directory (default: C:\\\\game). Only used with wine runner."),
      args: z.string().optional().describe("Arguments to pass to the installer executable"),
    },
    async (params) => {
      try {
        // Mode 1: Local installer via setup_exe
        if (params.setup_exe) {
          const setupPath = resolve(params.setup_exe);
          if (!existsSync(setupPath)) {
            return { content: [{ type: "text", text: `Setup file not found: ${setupPath}` }], isError: true };
          }

          const gameName = params.name || basename(dirname(setupPath));
          const gameSlug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

          const gameBlock = params.exe
            ? [`  game:`, `    exe: $GAMEDIR/${params.exe}`, `    prefix: $GAMEDIR`]
            : [`  game:`, `    prefix: $GAMEDIR`];

          const installDir = params.install_dir || "C:\\\\game";
          const wineArgs = [`/DIR=${installDir}`, ...(params.args ? [params.args] : [])].join(" ");

          const yaml = [
            `name: ${gameName}`,
            `game_slug: ${gameSlug}`,
            `version: Local Install`,
            `slug: ${gameSlug}-local`,
            `runner: ${params.runner}`,
            ``,
            `script:`,
            ...gameBlock,
            `  installer:`,
            params.runner === "wine"
              ? [
                  `  - task:`,
                  `      name: create_prefix`,
                  `      arch: win64`,
                  `      prefix: $GAMEDIR`,
                  `      install_gecko: false`,
                  `      install_mono: false`,
                  `  - task:`,
                  `      name: wineexec`,
                  `      executable: ${setupPath}`,
                  `      prefix: $GAMEDIR`,
                  `      args: ${wineArgs}`,
                ].join("\n")
              : [
                  `  - execute:`,
                  `      file: ${setupPath}`,
                  ...(params.args ? [`      args: ${params.args}`] : []),
                ].join("\n"),
          ].join("\n");

          const tmpDir = mkdtempSync(join(tmpdir(), "lutris-mcp-"));
          const yamlPath = join(tmpDir, "installer.yml");
          writeFileSync(yamlPath, yaml, "utf-8");

          const child = spawn("lutris", ["-i", yamlPath], {
            detached: true,
            stdio: "ignore",
          });
          child.unref();

          const response: Record<string, unknown> = {
            message: `Installing "${gameName}" from local setup`,
            pid: child.pid,
            installer_yaml: yamlPath,
          };
          if (!params.exe) {
            response.note = "No exe path was set. After install, use write_game_config to set the game executable.";
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(response, null, 2),
            }],
          };
        }

        // Mode 2: Lutris web installer slug
        let installerSlug = params.installer_slug;

        if (!installerSlug) {
          if (!params.id && !params.slug) {
            return { content: [{ type: "text", text: "Provide installer_slug, setup_exe, or id/slug to look up the installer." }], isError: true };
          }
          const game = params.id ? getGameById(params.id) : getGameBySlug(params.slug!);
          if (!game) {
            return { content: [{ type: "text", text: "Game not found." }], isError: true };
          }
          if (!game.installer_slug) {
            return { content: [{ type: "text", text: `"${game.name}" has no installer slug.` }], isError: true };
          }
          installerSlug = game.installer_slug;
        }

        const child = spawn("lutris", [`lutris:install/${installerSlug}`], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: `Installing "${installerSlug}"`, pid: child.pid }, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
