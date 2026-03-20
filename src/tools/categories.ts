import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listCategories,
  createCategory,
  getCategoryByName,
  assignCategory,
  unassignCategory,
  getGameById,
} from "../db/queries.js";

function handleError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error ? (error as any).code : "";
  if (code === "SQLITE_CONSTRAINT_UNIQUE" || msg.includes("UNIQUE constraint failed")) {
    return { content: [{ type: "text" as const, text: "Category already exists." }], isError: true };
  }
  if (code === "SQLITE_BUSY" || msg.includes("SQLITE_BUSY")) {
    return { content: [{ type: "text" as const, text: "Database locked — Lutris may be busy." }], isError: true };
  }
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

export function registerCategoryTools(server: McpServer) {
  server.tool(
    "list_categories",
    "List all categories with game counts",
    {},
    async () => {
      try {
        const categories = listCategories();
        return {
          content: [{ type: "text", text: JSON.stringify(categories, null, 2) }],
        };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "create_category",
    "Create a new game category",
    {
      name: z.string().describe("Category name"),
    },
    async (params) => {
      try {
        const category = createCategory(params.name);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ message: "Category created", category }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "assign_category",
    "Add a game to a category",
    {
      game_id: z.coerce.number().describe("Game ID"),
      category_name: z.string().describe("Category name"),
    },
    async (params) => {
      try {
        const game = getGameById(params.game_id);
        if (!game) {
          return {
            content: [{ type: "text", text: `Game with id ${params.game_id} not found.` }],
            isError: true,
          };
        }

        let category = getCategoryByName(params.category_name);
        if (!category) {
          category = createCategory(params.category_name);
        }

        assignCategory(params.game_id, category.id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { message: `"${game.name}" assigned to "${category.name}".` },
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
    "unassign_category",
    "Remove a game from a category",
    {
      game_id: z.coerce.number().describe("Game ID"),
      category_name: z.string().describe("Category name"),
    },
    async (params) => {
      try {
        const category = getCategoryByName(params.category_name);
        if (!category) {
          return {
            content: [{ type: "text", text: `Category "${params.category_name}" not found.` }],
            isError: true,
          };
        }

        const removed = unassignCategory(params.game_id, category.id);
        if (!removed) {
          return {
            content: [
              { type: "text", text: "Game was not in that category." },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { message: `Game removed from "${category.name}".` },
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
