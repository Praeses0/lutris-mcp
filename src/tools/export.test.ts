import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
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
});
