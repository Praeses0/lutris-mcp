import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getCategoryByName,
  createCategory,
  bulkAssignCategory,
  bulkUpdateGames,
} from "../db/queries.js";

export function registerBulkTools(server: McpServer) {
  server.tool(
    "bulk_assign_category",
    "Assign multiple games to a category at once",
    {
      game_ids: z.array(z.coerce.number()).describe("Array of game IDs"),
      category_name: z.string().describe("Category name (created if it doesn't exist)"),
    },
    async (params) => {
      try {
        let category = getCategoryByName(params.category_name);
        if (!category) {
          category = createCategory(params.category_name);
        }

        const count = bulkAssignCategory(params.game_ids, category.id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: `Assigned ${count} new game(s) to "${category.name}"`,
              category_id: category.id,
              new_assignments: count,
              total_requested: params.game_ids.length,
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
    "bulk_update_games",
    "Update a field on multiple games at once",
    {
      game_ids: z.array(z.coerce.number()).describe("Array of game IDs"),
      field: z.enum(["runner", "platform", "installed", "year", "service", "sortname"]).describe("Field to update"),
      value: z.union([z.string(), z.coerce.number(), z.boolean()]).describe("New value"),
    },
    async (params) => {
      try {
        const val = params.field === "installed" ? (params.value ? 1 : 0) : params.value;
        const count = bulkUpdateGames(params.game_ids, params.field, val);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: `Updated ${count} game(s): set ${params.field} = ${JSON.stringify(params.value)}`,
              updated: count,
              total_requested: params.game_ids.length,
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
