import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

import { registerCategoryTools } from "./categories.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerCategoryTools(mockServer as any);
  return tools;
}

describe("category tools", () => {
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

  describe("list_categories", () => {
    it("returns categories with game_count", async () => {
      const result = await tools.get("list_categories")!({});
      const data = parseResult(result);
      expect(data).toHaveLength(3);
      const fps = data.find((c: any) => c.name === "FPS");
      expect(fps.game_count).toBe(2);
    });
  });

  describe("create_category", () => {
    it("creates category", async () => {
      const result = await tools.get("create_category")!({ name: "RPG" });
      const data = parseResult(result);
      expect(data.category.name).toBe("RPG");
      expect(data.message).toContain("created");
    });

    it("errors on duplicate", async () => {
      const result = await tools.get("create_category")!({ name: "Favorites" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("already exists");
    });
  });

  describe("assign_category", () => {
    it("assigns game to category", async () => {
      const result = await tools.get("assign_category")!({ game_id: 2, category_name: "Favorites" });
      const data = parseResult(result);
      expect(data.message).toContain("The Witcher 3");
      expect(data.message).toContain("Favorites");
    });

    it("auto-creates missing category", async () => {
      const result = await tools.get("assign_category")!({ game_id: 1, category_name: "NewCat" });
      const data = parseResult(result);
      expect(data.message).toContain("NewCat");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("assign_category")!({ game_id: 999, category_name: "FPS" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("unassign_category", () => {
    it("removes game from category", async () => {
      const result = await tools.get("unassign_category")!({ game_id: 1, category_name: "Favorites" });
      const data = parseResult(result);
      expect(data.message).toContain("removed");
    });

    it("errors when category not found", async () => {
      const result = await tools.get("unassign_category")!({ game_id: 1, category_name: "Nonexistent" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("errors when game not in category", async () => {
      const result = await tools.get("unassign_category")!({ game_id: 2, category_name: "FPS" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not in that category");
    });
  });
});
