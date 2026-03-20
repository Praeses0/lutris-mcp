import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import path from "path";
import { getGameById, getGameBySlug, updateGame } from "../db/queries.js";
import { getGameMediaPaths } from "../util/media.js";

function getDataDir(): string {
  return (
    process.env.LUTRIS_DATA_DIR ||
    path.join(homedir(), ".local", "share", "lutris")
  );
}

const MEDIA_TYPE_MAP: Record<string, { dir: string; dbField: string }> = {
  coverart: { dir: "coverart", dbField: "has_custom_coverart_big" },
  banner: { dir: "banners", dbField: "has_custom_banner" },
  icon: { dir: "icons", dbField: "has_custom_icon" },
};

function handleError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${msg}` }],
    isError: true,
  };
}

export function registerMediaTools(server: McpServer) {
  server.tool(
    "set_game_cover",
    "Set a game's cover art, banner, or icon from a local file path",
    {
      id: z.coerce.number().optional().describe("Game ID"),
      slug: z.string().optional().describe("Game slug"),
      type: z
        .enum(["coverart", "banner", "icon"])
        .describe("Media type: coverart, banner, or icon"),
      source_path: z.string().describe("Absolute path to the source image file"),
    },
    async (params) => {
      try {
        if (!params.id && !params.slug) {
          return {
            content: [{ type: "text", text: "Provide either id or slug." }],
            isError: true,
          };
        }

        const game = params.id
          ? getGameById(params.id)
          : getGameBySlug(params.slug!);
        if (!game) {
          return {
            content: [{ type: "text", text: "Game not found." }],
            isError: true,
          };
        }

        if (!game.slug) {
          return {
            content: [{ type: "text", text: "Game has no slug set." }],
            isError: true,
          };
        }

        if (!existsSync(params.source_path)) {
          return {
            content: [
              {
                type: "text",
                text: `Source file not found: ${params.source_path}`,
              },
            ],
            isError: true,
          };
        }

        const mediaInfo = MEDIA_TYPE_MAP[params.type];
        const dataDir = getDataDir();
        const destDir = path.join(dataDir, mediaInfo.dir);

        // Ensure the destination directory exists
        mkdirSync(destDir, { recursive: true });

        // Determine extension from source file
        const ext = path.extname(params.source_path).toLowerCase() || ".jpg";
        const destPath = path.join(destDir, `${game.slug}${ext}`);

        copyFileSync(params.source_path, destPath);

        // Update the database flag
        updateGame(game.id, { [mediaInfo.dbField]: 1 } as any);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Set ${params.type} for "${game.name}"`,
                  path: destPath,
                },
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
    "get_game_media",
    "Get all media paths for a game and whether they exist",
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

        const game = params.id
          ? getGameById(params.id)
          : getGameBySlug(params.slug!);
        if (!game) {
          return {
            content: [{ type: "text", text: "Game not found." }],
            isError: true,
          };
        }

        const media = getGameMediaPaths(game.slug);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  game_id: game.id,
                  game_name: game.name,
                  slug: game.slug,
                  media: {
                    coverart: {
                      path: media.coverart,
                      exists: media.coverart !== null,
                    },
                    banner: {
                      path: media.banner,
                      exists: media.banner !== null,
                    },
                    icon: {
                      path: media.icon,
                      exists: media.icon !== null,
                    },
                  },
                },
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
