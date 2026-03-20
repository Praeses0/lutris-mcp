import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

import { registerStatsTools } from "./stats.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerStatsTools(mockServer as any);
  return tools;
}

describe("stats tools", () => {
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

  it("returns all LibraryStats fields", async () => {
    const result = await tools.get("get_library_stats")!({});
    const data = parseResult(result);
    expect(data).toHaveProperty("total_games");
    expect(data).toHaveProperty("installed_games");
    expect(data).toHaveProperty("total_playtime_hours");
    expect(data).toHaveProperty("top_games_by_playtime");
    expect(data).toHaveProperty("games_by_runner");
    expect(data).toHaveProperty("games_by_platform");
    expect(data).toHaveProperty("games_by_service");
    expect(data).toHaveProperty("recently_played");
  });

  it("values match seed data", async () => {
    const result = await tools.get("get_library_stats")!({});
    const data = parseResult(result);
    expect(data.total_games).toBe(6);
    expect(data.installed_games).toBe(3);
    expect(data.total_playtime_hours).toBe(7.43);
    expect(data.top_games_by_playtime[0].name).toBe("The Witcher 3");
  });
});
