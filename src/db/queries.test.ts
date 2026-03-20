import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("./connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

import {
  listGames,
  getGameById,
  getGameBySlug,
  getGameCategories,
  insertGame,
  updateGame,
  deleteGame,
  listCategories,
  createCategory,
  getCategoryByName,
  assignCategory,
  unassignCategory,
  searchServiceGames,
  getLibraryStats,
  getServiceGame,
  getAllGames,
  getAllGameCategories,
  bulkAssignCategory,
  bulkUpdateGames,
  findDuplicates,
} from "./queries.js";

describe("queries", () => {
  beforeEach(() => {
    teardownTestDb();
    setupTestDb();
    seedData();
  });

  // ─── listGames ──────────────────────────────────────────────────────────

  describe("listGames", () => {
    const defaults = { limit: 50, offset: 0, sort_by: "name", sort_order: "asc" as const };

    it("returns all games with defaults", () => {
      const { games, total } = listGames(defaults);
      expect(total).toBe(8);
      expect(games).toHaveLength(8);
    });

    it("filters by runner", () => {
      const { games, total } = listGames({ ...defaults, runner: "steam" });
      expect(total).toBe(3);
      expect(games.every((g) => g.runner === "steam")).toBe(true);
    });

    it("filters by platform", () => {
      const { games, total } = listGames({ ...defaults, platform: "linux" });
      expect(total).toBe(5);
      expect(games.every((g) => g.platform === "linux")).toBe(true);
    });

    it("filters by installed", () => {
      const { games, total } = listGames({ ...defaults, installed: true });
      expect(total).toBe(5);
      expect(games.every((g) => g.installed === 1)).toBe(true);
    });

    it("filters by service", () => {
      const { games, total } = listGames({ ...defaults, service: "steam" });
      expect(total).toBe(2);
    });

    it("filters by search (name)", () => {
      const { games } = listGames({ ...defaults, search: "Witcher" });
      expect(games).toHaveLength(1);
      expect(games[0].name).toBe("The Witcher 3");
    });

    it("filters by search (slug)", () => {
      const { games } = listGames({ ...defaults, search: "half-life" });
      expect(games).toHaveLength(2); // half-life-2 and half-life-2-trainer
      expect(games.some((g) => g.slug === "half-life-2")).toBe(true);
    });

    it("filters by category", () => {
      const { games, total } = listGames({ ...defaults, category: "FPS" });
      expect(total).toBe(2);
      expect(games.map((g) => g.name).sort()).toEqual(["Half-Life 2", "Portal 2"]);
    });

    it("combines filters", () => {
      const { games, total } = listGames({ ...defaults, runner: "steam", installed: true });
      expect(total).toBe(3);
    });

    it("paginates with limit", () => {
      const { games } = listGames({ ...defaults, limit: 2 });
      expect(games).toHaveLength(2);
    });

    it("paginates with offset", () => {
      const all = listGames(defaults);
      const page2 = listGames({ ...defaults, limit: 2, offset: 2 });
      expect(page2.games[0].id).toBe(all.games[2].id);
    });

    it("sorts by playtime desc", () => {
      const { games } = listGames({ ...defaults, sort_by: "playtime", sort_order: "desc" });
      expect(games[0].name).toBe("The Witcher 3");
    });

    it("falls back to name for invalid sort column", () => {
      const { games } = listGames({ ...defaults, sort_by: "invalid_col" });
      // Should sort by name asc — first alphabetically
      expect(games[0].name).toBe("Celeste");
    });

    it("returns empty result set", () => {
      const { games, total } = listGames({ ...defaults, runner: "nonexistent" });
      expect(total).toBe(0);
      expect(games).toHaveLength(0);
    });
  });

  // ─── getGameById / getGameBySlug ────────────────────────────────────────

  describe("getGameById", () => {
    it("finds existing game", () => {
      const game = getGameById(1);
      expect(game).toBeDefined();
      expect(game!.name).toBe("Half-Life 2");
    });

    it("returns undefined for missing id", () => {
      expect(getGameById(999)).toBeUndefined();
    });
  });

  describe("getGameBySlug", () => {
    it("finds existing game", () => {
      const game = getGameBySlug("celeste");
      expect(game).toBeDefined();
      expect(game!.name).toBe("Celeste");
    });

    it("returns undefined for missing slug", () => {
      expect(getGameBySlug("nope")).toBeUndefined();
    });
  });

  // ─── getGameCategories ──────────────────────────────────────────────────

  describe("getGameCategories", () => {
    it("returns categories for game with multiple", () => {
      const cats = getGameCategories(1);
      expect(cats).toHaveLength(2);
      expect(cats.map((c) => c.name).sort()).toEqual(["FPS", "Favorites"]);
    });

    it("returns empty array for uncategorized game", () => {
      expect(getGameCategories(2)).toHaveLength(0);
    });

    it("returns empty array for nonexistent game", () => {
      expect(getGameCategories(999)).toHaveLength(0);
    });
  });

  // ─── insertGame ─────────────────────────────────────────────────────────

  describe("insertGame", () => {
    it("inserts and returns with auto ID", () => {
      const game = insertGame({ name: "New Game", slug: "new-game", runner: "linux", platform: "linux", installed: 1 });
      expect(game.id).toBe(9);
      expect(game.name).toBe("New Game");
      expect(game.slug).toBe("new-game");
    });

    it("inserts with minimal fields", () => {
      const game = insertGame({ name: "Bare", slug: "bare" });
      expect(game.id).toBe(9);
      expect(game.runner).toBeNull();
    });
  });

  // ─── updateGame ─────────────────────────────────────────────────────────

  describe("updateGame", () => {
    it("updates single field", () => {
      const game = updateGame(1, { name: "Half-Life 2 Updated" });
      expect(game!.name).toBe("Half-Life 2 Updated");
      expect(game!.runner).toBe("steam"); // unchanged
    });

    it("updates multiple fields", () => {
      const game = updateGame(1, { name: "HL2", platform: "windows" });
      expect(game!.name).toBe("HL2");
      expect(game!.platform).toBe("windows");
    });

    it("returns unchanged game for empty updates", () => {
      const game = updateGame(1, {});
      expect(game!.name).toBe("Half-Life 2");
    });

    it("returns undefined for missing game", () => {
      expect(updateGame(999, { name: "x" })).toBeUndefined();
    });
  });

  // ─── deleteGame ─────────────────────────────────────────────────────────

  describe("deleteGame", () => {
    it("deletes game and cascades category associations", () => {
      expect(deleteGame(1)).toBe(true);
      expect(getGameById(1)).toBeUndefined();
      // Category associations should be gone
      expect(getGameCategories(1)).toHaveLength(0);
    });

    it("returns false for missing game", () => {
      expect(deleteGame(999)).toBe(false);
    });
  });

  // ─── Categories ─────────────────────────────────────────────────────────

  describe("listCategories", () => {
    it("returns all with correct game counts", () => {
      const cats = listCategories();
      expect(cats).toHaveLength(3);
      const fav = cats.find((c) => c.name === "Favorites")!;
      expect(fav.game_count).toBe(1);
      const fps = cats.find((c) => c.name === "FPS")!;
      expect(fps.game_count).toBe(2);
    });

    it("is sorted alphabetically", () => {
      const cats = listCategories();
      const names = cats.map((c) => c.name);
      expect(names).toEqual(["FPS", "Favorites", "Indie"]);
    });
  });

  describe("createCategory", () => {
    it("creates and returns with ID", () => {
      const cat = createCategory("RPG");
      expect(cat.id).toBe(4);
      expect(cat.name).toBe("RPG");
    });

    it("throws on duplicate", () => {
      expect(() => createCategory("Favorites")).toThrow();
    });
  });

  describe("assignCategory / unassignCategory", () => {
    it("assigns successfully", () => {
      const cat = getCategoryByName("Indie")!;
      assignCategory(2, cat.id);
      const cats = getGameCategories(2);
      expect(cats.some((c) => c.name === "Indie")).toBe(true);
    });

    it("idempotent on duplicate assign", () => {
      const cat = getCategoryByName("Favorites")!;
      // game 1 is already in Favorites — should not throw
      expect(() => assignCategory(1, cat.id)).not.toThrow();
    });

    it("unassigns returns true", () => {
      const cat = getCategoryByName("Favorites")!;
      expect(unassignCategory(1, cat.id)).toBe(true);
      expect(getGameCategories(1).some((c) => c.name === "Favorites")).toBe(false);
    });

    it("unassign returns false if not assigned", () => {
      const cat = getCategoryByName("Indie")!;
      expect(unassignCategory(2, cat.id)).toBe(false);
    });
  });

  // ─── Service Games ──────────────────────────────────────────────────────

  describe("searchServiceGames", () => {
    it("filters by service", () => {
      const { games, total } = searchServiceGames({ service: "steam", limit: 25, offset: 0 });
      expect(total).toBe(3);
      expect(games).toHaveLength(3);
    });

    it("filters by query (name)", () => {
      const { games } = searchServiceGames({ service: "steam", query: "Portal", limit: 25, offset: 0 });
      expect(games).toHaveLength(2);
    });

    it("filters by query (appid)", () => {
      const { games } = searchServiceGames({ service: "steam", query: "220", limit: 25, offset: 0 });
      expect(games).toHaveLength(1);
      expect(games[0].name).toBe("Half-Life 2");
    });

    it("paginates", () => {
      const { games } = searchServiceGames({ service: "steam", limit: 1, offset: 0 });
      expect(games).toHaveLength(1);
    });

    it("returns empty for unknown service", () => {
      const { games, total } = searchServiceGames({ service: "epic", limit: 25, offset: 0 });
      expect(total).toBe(0);
      expect(games).toHaveLength(0);
    });
  });

  // ─── Library Stats ──────────────────────────────────────────────────────

  describe("getLibraryStats", () => {
    it("has correct totals", () => {
      const stats = getLibraryStats();
      expect(stats.total_games).toBe(8);
      expect(stats.installed_games).toBe(5);
    });

    it("calculates playtime hours correctly", () => {
      const stats = getLibraryStats();
      // (120.5 + 250 + 45 + 30 + 60) / 60 = 505.5 / 60 = 8.425 → rounded to 8.43
      expect(stats.total_playtime_hours).toBe(8.43);
    });

    it("orders top by playtime desc", () => {
      const stats = getLibraryStats();
      expect(stats.top_games_by_playtime[0].name).toBe("The Witcher 3");
      expect(stats.top_games_by_playtime[1].name).toBe("Half-Life 2");
    });

    it("has correct runner breakdown", () => {
      const stats = getLibraryStats();
      const steam = stats.games_by_runner.find((r) => r.runner === "steam");
      expect(steam!.count).toBe(3);
      const linux = stats.games_by_runner.find((r) => r.runner === "linux");
      expect(linux!.count).toBe(2);
    });

    it("has correct platform breakdown", () => {
      const stats = getLibraryStats();
      const linux = stats.games_by_platform.find((p) => p.platform === "linux");
      expect(linux!.count).toBe(5);
    });

    it("has correct service breakdown", () => {
      const stats = getLibraryStats();
      const steam = stats.games_by_service.find((s) => s.service === "steam");
      expect(steam!.count).toBe(2);
    });

    it("recently played only has games with lastplayed > 0", () => {
      const stats = getLibraryStats();
      // Games 1-4 have lastplayed > 0
      expect(stats.recently_played.length).toBe(4);
      expect(stats.recently_played.every((g) => g.lastplayed > 0)).toBe(true);
    });
  });

  // ─── Smart Search ───────────────────────────────────────────────────────

  describe("smart search", () => {
    const base = { limit: 50, offset: 0, sort_by: "name", sort_order: "asc" as const };

    it("splits on special chars and matches each token", () => {
      const { games } = listGames({ ...base, search: "half--life", smart_search: true });
      expect(games.some((g) => g.slug === "half-life-2")).toBe(true);
    });

    it("matches multiple word tokens", () => {
      const { games } = listGames({ ...base, search: "witcher 3", smart_search: true });
      expect(games).toHaveLength(1);
      expect(games[0].name).toBe("The Witcher 3");
    });

    it("regular search uses simple LIKE", () => {
      const { games } = listGames({ ...base, search: "fantasy", smart_search: false });
      expect(games.some((g) => g.name === "Final Fantasy VII")).toBe(true);
    });
  });

  // ─── New Query Functions ────────────────────────────────────────────────

  describe("getServiceGame", () => {
    it("finds by service and appid", () => {
      const sg = getServiceGame("steam", "220");
      expect(sg).toBeDefined();
      expect(sg!.name).toBe("Half-Life 2");
    });

    it("returns undefined for unknown", () => {
      expect(getServiceGame("epic", "999")).toBeUndefined();
    });
  });

  describe("getAllGames", () => {
    it("returns all games sorted by name", () => {
      const games = getAllGames();
      expect(games).toHaveLength(8);
      expect(games[0].name).toBe("Celeste");
    });
  });

  describe("getAllGameCategories", () => {
    it("returns all associations", () => {
      const gcs = getAllGameCategories();
      expect(gcs.length).toBe(4);
    });
  });

  describe("bulkAssignCategory", () => {
    it("assigns multiple games", () => {
      const cat = getCategoryByName("Indie")!;
      const count = bulkAssignCategory([1, 2, 4], cat.id);
      expect(count).toBe(3);
    });

    it("ignores duplicates", () => {
      const cat = getCategoryByName("Indie")!;
      // game 3 is already in Indie
      const count = bulkAssignCategory([3, 5], cat.id);
      expect(count).toBe(1); // only game 5 is new
    });
  });

  describe("bulkUpdateGames", () => {
    it("updates multiple games", () => {
      const count = bulkUpdateGames([1, 2, 3], "platform", "windows");
      expect(count).toBe(3);
      expect(getGameById(1)!.platform).toBe("windows");
      expect(getGameById(3)!.platform).toBe("windows");
    });

    it("throws on disallowed field", () => {
      expect(() => bulkUpdateGames([1], "name", "hacked")).toThrow("not allowed");
    });
  });

  describe("findDuplicates", () => {
    it("finds games with same directory", () => {
      const groups = findDuplicates();
      const dirGroup = groups.find((g) => g.reason.includes("Same directory"));
      expect(dirGroup).toBeDefined();
      expect(dirGroup!.games).toHaveLength(2);
      expect(dirGroup!.games.map((g) => g.slug).sort()).toEqual(["half-life-2", "half-life-2-trainer"]);
    });

    it("finds similar slugs", () => {
      const groups = findDuplicates();
      const slugGroup = groups.find((g) => g.reason.includes("Similar slugs") && g.reason.includes("half-life-2"));
      expect(slugGroup).toBeDefined();
    });
  });
});
