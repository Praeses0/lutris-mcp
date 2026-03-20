import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

import { registerBulkTools } from "./bulk.js";
import { getGameCategories, getGameById } from "../db/queries.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerBulkTools(mockServer as any);
  return tools;
}

describe("bulk tools", () => {
  let tools: Map<string, Function>;

  beforeEach(() => {
    teardownTestDb();
    setupTestDb();
    seedData();
    tools = captureTools();
  });

  function parseResult(result: any) {
    return JSON.parse(result.content[0].text);
  }

  describe("bulk_assign_category", () => {
    it("assigns multiple games to category", async () => {
      const result = await tools.get("bulk_assign_category")!({
        game_ids: [2, 5, 6],
        category_name: "RPG",
      });
      const data = parseResult(result);
      expect(data.new_assignments).toBe(3);
      expect(getGameCategories(2).some((c) => c.name === "RPG")).toBe(true);
    });

    it("auto-creates category", async () => {
      const result = await tools.get("bulk_assign_category")!({
        game_ids: [1],
        category_name: "NewCategory",
      });
      const data = parseResult(result);
      expect(data.new_assignments).toBe(1);
    });

    it("skips already-assigned games", async () => {
      const result = await tools.get("bulk_assign_category")!({
        game_ids: [1, 2],
        category_name: "Favorites",
      });
      const data = parseResult(result);
      expect(data.new_assignments).toBe(1); // game 1 already in Favorites
    });
  });

  describe("bulk_update_games", () => {
    it("updates field on multiple games", async () => {
      const result = await tools.get("bulk_update_games")!({
        game_ids: [1, 2, 3],
        field: "platform",
        value: "windows",
      });
      const data = parseResult(result);
      expect(data.updated).toBe(3);
      expect(getGameById(1)!.platform).toBe("windows");
    });
  });
});
