import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

import { registerDuplicateTools } from "./duplicates.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerDuplicateTools(mockServer as any);
  return tools;
}

describe("duplicate tools", () => {
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

  it("finds duplicate groups", async () => {
    const result = await tools.get("find_duplicates")!({});
    const data = parseResult(result);
    expect(data.total_groups).toBeGreaterThan(0);
    const dirGroup = data.duplicates.find((g: any) => g.reason.includes("Same directory"));
    expect(dirGroup).toBeDefined();
    expect(dirGroup.games).toHaveLength(2);
  });
});
