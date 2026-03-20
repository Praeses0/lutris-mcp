import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

vi.mock("../config/reader.js", () => ({
  readGameConfig: (configpath: string | null) => {
    if (!configpath) return null;
    // Return a fake config for known game configpaths
    const configs: Record<string, Record<string, unknown>> = {
      "half-life-2": { game: { exe: "/games/half-life-2/hl2" }, system: { gamemode: true } },
      "the-witcher-3": { game: { exe: "/games/witcher3/witcher3.exe" }, wine: { version: "lutris-7.2" } },
      "portal-2": { game: { exe: "/games/portal-2/portal2" }, system: {} },
    };
    return configs[configpath] ?? null;
  },
}));

import { registerExportTools } from "./export.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerExportTools(mockServer as any);
  return tools;
}

describe("export tools", () => {
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

  it("exports full library", async () => {
    const result = await tools.get("export_library")!({});
    const data = parseResult(result);
    expect(data).toHaveProperty("exported_at");
    expect(data.total_games).toBe(8);
    expect(data.total_categories).toBe(3);
    expect(data.games).toHaveLength(8);
    expect(data.categories).toHaveLength(3);
    expect(data.game_categories).toHaveLength(4);
  });

  describe("category filter", () => {
    it("exports only games in a specific category", async () => {
      const result = await tools.get("export_library")!({ category: "FPS" });
      const data = parseResult(result);
      // FPS category: Half-Life 2 (id 1) and Portal 2 (id 4)
      expect(data.total_games).toBe(2);
      expect(data.games).toHaveLength(2);
      const names = data.games.map((g: any) => g.name).sort();
      expect(names).toEqual(["Half-Life 2", "Portal 2"]);
    });

    it("filters game_categories to only matched games", async () => {
      const result = await tools.get("export_library")!({ category: "FPS" });
      const data = parseResult(result);
      // Only game_categories for game_ids 1 and 4 should be included
      const gameIds = new Set(data.game_categories.map((gc: any) => gc.game_id));
      expect(gameIds).toContain(1);
      expect(gameIds).toContain(4);
      // Celeste (id 3) is in Indie, not FPS — should not appear
      expect(gameIds).not.toContain(3);
    });

    it("returns empty when category has no games", async () => {
      const result = await tools.get("export_library")!({ category: "Nonexistent" });
      const data = parseResult(result);
      expect(data.total_games).toBe(0);
      expect(data.games).toHaveLength(0);
    });
  });

  describe("runner filter", () => {
    it("exports only games with the specified runner", async () => {
      const result = await tools.get("export_library")!({ runner: "steam" });
      const data = parseResult(result);
      // steam runner: Half-Life 2, Portal 2, Half-Life 2 + Trainer
      expect(data.total_games).toBe(3);
      expect(data.games).toHaveLength(3);
      for (const g of data.games) {
        expect(g.runner).toBe("steam");
      }
    });

    it("exports wine runner games", async () => {
      const result = await tools.get("export_library")!({ runner: "wine" });
      const data = parseResult(result);
      // wine runner: The Witcher 3, Final Fantasy VII
      expect(data.total_games).toBe(2);
      const names = data.games.map((g: any) => g.name).sort();
      expect(names).toEqual(["Final Fantasy VII", "The Witcher 3"]);
    });
  });

  describe("installed filter", () => {
    it("exports only installed games", async () => {
      const result = await tools.get("export_library")!({ installed: true });
      const data = parseResult(result);
      // installed=1: Half-Life 2, The Witcher 3, Portal 2, Half-Life 2 + Trainer, Final Fantasy VII
      expect(data.total_games).toBe(5);
      for (const g of data.games) {
        expect(g.installed).toBe(1);
      }
    });

    it("exports only non-installed games", async () => {
      const result = await tools.get("export_library")!({ installed: false });
      const data = parseResult(result);
      // installed=0: Celeste, Untitled Game
      expect(data.total_games).toBe(2);
      for (const g of data.games) {
        expect(g.installed).toBe(0);
      }
    });
  });

  describe("combined filters", () => {
    it("filters by runner and installed", async () => {
      const result = await tools.get("export_library")!({ runner: "linux", installed: false });
      const data = parseResult(result);
      // linux runner + not installed: Celeste, Untitled Game
      expect(data.total_games).toBe(2);
      const names = data.games.map((g: any) => g.name).sort();
      expect(names).toEqual(["Celeste", "Untitled Game"]);
    });

    it("filters by category and runner", async () => {
      const result = await tools.get("export_library")!({ category: "FPS", runner: "steam" });
      const data = parseResult(result);
      // FPS + steam: Half-Life 2, Portal 2
      expect(data.total_games).toBe(2);
      const names = data.games.map((g: any) => g.name).sort();
      expect(names).toEqual(["Half-Life 2", "Portal 2"]);
    });
  });

  describe("include_configs", () => {
    it("includes configs when include_configs is true", async () => {
      const result = await tools.get("export_library")!({ include_configs: true });
      const data = parseResult(result);
      expect(data.total_games).toBe(8);

      // Half-Life 2 has a config
      const hl2 = data.games.find((g: any) => g.slug === "half-life-2");
      expect(hl2.config).toEqual({ game: { exe: "/games/half-life-2/hl2" }, system: { gamemode: true } });

      // The Witcher 3 has a config
      const w3 = data.games.find((g: any) => g.slug === "the-witcher-3");
      expect(w3.config).toEqual({ game: { exe: "/games/witcher3/witcher3.exe" }, wine: { version: "lutris-7.2" } });

      // Celeste has no configpath, so config should be null
      const celeste = data.games.find((g: any) => g.slug === "celeste");
      expect(celeste.config).toBeNull();
    });

    it("does not include configs by default", async () => {
      const result = await tools.get("export_library")!({});
      const data = parseResult(result);
      const hl2 = data.games.find((g: any) => g.slug === "half-life-2");
      expect(hl2).not.toHaveProperty("config");
    });

    it("includes configs with filters active", async () => {
      const result = await tools.get("export_library")!({ runner: "steam", include_configs: true });
      const data = parseResult(result);
      expect(data.total_games).toBe(3);

      const hl2 = data.games.find((g: any) => g.slug === "half-life-2");
      expect(hl2.config).toEqual({ game: { exe: "/games/half-life-2/hl2" }, system: { gamemode: true } });

      const portal2 = data.games.find((g: any) => g.slug === "portal-2");
      expect(portal2.config).toEqual({ game: { exe: "/games/portal-2/portal2" }, system: {} });

      // Half-Life 2 + Trainer has no configpath
      const trainer = data.games.find((g: any) => g.slug === "half-life-2-trainer");
      expect(trainer.config).toBeNull();
    });
  });
});
