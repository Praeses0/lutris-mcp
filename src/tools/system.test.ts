import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

const mockExecSync = vi.fn();
vi.mock("child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

import { registerSystemTools } from "./system.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerSystemTools(mockServer as any);
  return tools;
}

describe("system tools", () => {
  let tools: Map<string, Function>;

  beforeEach(() => {
    teardownTestDb();
    setupTestDb();
    seedData();
    tools = captureTools();
    mockExecSync.mockReset();
  });

  function parseResult(result: any) {
    return JSON.parse(result.content[0].text);
  }

  describe("check_game_running", () => {
    it("detects running game", async () => {
      mockExecSync.mockReturnValue("12345 /games/half-life-2/hl2.exe\n");
      const result = await tools.get("check_game_running")!({ id: 1 });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.pid).toBe(12345);
    });

    it("detects not running (pgrep throws)", async () => {
      mockExecSync.mockImplementation(() => { throw new Error("exit 1"); });
      const result = await tools.get("check_game_running")!({ id: 1 });
      const data = parseResult(result);
      expect(data.running).toBe(false);
    });

    it("errors when game not found", async () => {
      const result = await tools.get("check_game_running")!({ id: 999 });
      expect(result.isError).toBe(true);
    });
  });

  describe("list_runners", () => {
    it("returns parsed runner list (plain text)", async () => {
      mockExecSync.mockReturnValue("wine\nsteam\nlinux\n");
      const result = await tools.get("list_runners")!({ type: "runners" });
      const data = parseResult(result);
      expect(data).toEqual(["wine", "steam", "linux"]);
    });

    it("returns parsed wine versions (Python dict syntax)", async () => {
      mockExecSync.mockReturnValue(
        "{'version': 'wine-ge-8-26', 'architecture': 'x86_64', 'default': False}\n" +
        "{'version': 'wine-staging-11.2', 'architecture': 'x86_64', 'default': True}\n"
      );
      const result = await tools.get("list_runners")!({ type: "wine" });
      const data = parseResult(result);
      expect(data).toHaveLength(2);
      expect(data[0].version).toBe("wine-ge-8-26");
      expect(data[0].default).toBe(false);
      expect(data[1].default).toBe(true);
    });

    it("handles error", async () => {
      mockExecSync.mockImplementation(() => { throw new Error("lutris not found"); });
      const result = await tools.get("list_runners")!({ type: "runners" });
      expect(result.isError).toBe(true);
    });
  });
});
