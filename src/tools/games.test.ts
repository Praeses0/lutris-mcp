import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

vi.mock("../config/reader.js", () => ({
  readGameConfig: vi.fn(() => null),
}));

vi.mock("../util/media.js", () => ({
  getGameMediaPaths: vi.fn(() => ({ coverart: null, banner: null, icon: null })),
}));

import { registerGameTools } from "./games.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerGameTools(mockServer as any);
  return tools;
}

describe("game tools", () => {
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

  // ─── list_games ─────────────────────────────────────────────────────────

  describe("list_games", () => {
    it("returns structured response with total/count/games and playtime_formatted", async () => {
      const result = await tools.get("list_games")!({ limit: 50, offset: 0, sort_by: "name", sort_order: "asc" });
      const data = parseResult(result);
      expect(data.total).toBe(8);
      expect(data.count).toBe(8);
      expect(data.games).toHaveLength(8);
      expect(data.games[0]).toHaveProperty("playtime_formatted");
      expect(result.content[0].type).toBe("text");
    });

    it("applies filters", async () => {
      const result = await tools.get("list_games")!({
        runner: "steam",
        installed: true,
        limit: 50,
        offset: 0,
        sort_by: "name",
        sort_order: "asc",
      });
      const data = parseResult(result);
      expect(data.total).toBe(3);
    });
  });

  // ─── get_game ───────────────────────────────────────────────────────────

  describe("get_game", () => {
    it("returns game by id with categories, media, and playtime_formatted", async () => {
      const result = await tools.get("get_game")!({ id: 1 });
      const data = parseResult(result);
      expect(data.name).toBe("Half-Life 2");
      expect(data.categories).toHaveLength(2);
      expect(data).toHaveProperty("config");
      expect(data).toHaveProperty("media");
      expect(data).toHaveProperty("playtime_formatted");
      expect(data.playtime_formatted).toBe("2h 1m");
    });

    it("returns game by slug", async () => {
      const result = await tools.get("get_game")!({ slug: "celeste" });
      const data = parseResult(result);
      expect(data.name).toBe("Celeste");
    });

    it("errors when neither id nor slug provided", async () => {
      const result = await tools.get("get_game")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Provide either id or slug");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("get_game")!({ id: 999 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  // ─── add_game ───────────────────────────────────────────────────────────

  describe("add_game", () => {
    it("auto-generates slug", async () => {
      const result = await tools.get("add_game")!({
        name: "New Amazing Game",
        runner: "linux",
        installed: false,
      });
      const data = parseResult(result);
      expect(data.game.slug).toBe("new-amazing-game");
      expect(data.message).toContain("added");
    });

    it("uses explicit slug", async () => {
      const result = await tools.get("add_game")!({
        name: "Custom",
        runner: "wine",
        slug: "my-custom-slug",
        installed: false,
      });
      const data = parseResult(result);
      expect(data.game.slug).toBe("my-custom-slug");
    });

    it("errors on duplicate slug", async () => {
      const result = await tools.get("add_game")!({
        name: "Dupe",
        runner: "linux",
        slug: "half-life-2",
        installed: false,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("already exists");
    });
  });

  // ─── update_game ────────────────────────────────────────────────────────

  describe("update_game", () => {
    it("updates fields", async () => {
      const result = await tools.get("update_game")!({ id: 1, name: "HL2 Remastered" });
      const data = parseResult(result);
      expect(data.game.name).toBe("HL2 Remastered");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("update_game")!({ id: 999, name: "x" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  // ─── remove_game ────────────────────────────────────────────────────────

  describe("remove_game", () => {
    it("removes with confirm=true", async () => {
      const result = await tools.get("remove_game")!({ id: 1, confirm: true });
      const data = parseResult(result);
      expect(data.message).toContain("Half-Life 2");
      expect(data.message).toContain("Removed");
    });

    it("errors with confirm=false", async () => {
      const result = await tools.get("remove_game")!({ id: 1, confirm: false });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("confirm");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("remove_game")!({ id: 999, confirm: true });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });
});
