import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

import { registerServiceGameTools } from "./service-games.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerServiceGameTools(mockServer as any);
  return tools;
}

describe("service game tools", () => {
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

  it("returns steam results", async () => {
    const result = await tools.get("search_service_games")!({
      service: "steam",
      limit: 25,
      offset: 0,
    });
    const data = parseResult(result);
    expect(data.total).toBe(3);
    expect(data.games).toHaveLength(3);
  });

  it("filters by query", async () => {
    const result = await tools.get("search_service_games")!({
      service: "steam",
      query: "Portal",
      limit: 25,
      offset: 0,
    });
    const data = parseResult(result);
    expect(data.total).toBe(2);
  });

  it("returns empty for unknown service", async () => {
    const result = await tools.get("search_service_games")!({
      service: "epic",
      limit: 25,
      offset: 0,
    });
    const data = parseResult(result);
    expect(data.total).toBe(0);
    expect(data.games).toHaveLength(0);
  });
});
