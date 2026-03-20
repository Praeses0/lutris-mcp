import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

import { registerConfigTools } from "./config.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerConfigTools(mockServer as any);
  return tools;
}

describe("config tools", () => {
  let tools: Map<string, Function>;
  let tempDir: string;

  beforeEach(() => {
    teardownTestDb();
    setupTestDb();
    seedData();
    tools = captureTools();
    tempDir = mkdtempSync(path.join(tmpdir(), "lutris-config-test-"));
    process.env.LUTRIS_GAMES_CONFIG_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LUTRIS_GAMES_CONFIG_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function parseResult(result: any) {
    return JSON.parse(result.content[0].text);
  }

  describe("read_game_config", () => {
    it("reads existing config", async () => {
      writeFileSync(
        path.join(tempDir, "half-life-2.yml"),
        "game:\n  exe: /bin/hl2\n"
      );
      const result = await tools.get("read_game_config")!({ id: 1 });
      const data = parseResult(result);
      expect(data.config.game.exe).toBe("/bin/hl2");
    });

    it("errors when no configpath", async () => {
      const result = await tools.get("read_game_config")!({ id: 3 }); // Celeste has no configpath
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("no config");
    });

    it("errors when config file missing", async () => {
      const result = await tools.get("read_game_config")!({ id: 1 }); // configpath exists but file doesn't
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("read_game_config")!({ id: 999 });
      expect(result.isError).toBe(true);
    });
  });

  describe("write_game_config", () => {
    it("creates config and can read it back", async () => {
      // Game 1 has configpath "half-life-2" — write initial config
      writeFileSync(
        path.join(tempDir, "half-life-2.yml"),
        "game:\n  exe: /bin/hl2\n  prefix: /home\n"
      );

      const result = await tools.get("write_game_config")!({
        id: 1,
        config: { game: { exe: "/bin/hl2-updated" } },
      });
      const data = parseResult(result);
      expect(data.config.game.exe).toBe("/bin/hl2-updated");
      expect(data.config.game.prefix).toBe("/home"); // preserved from original

      // Verify read back
      const readResult = await tools.get("read_game_config")!({ id: 1 });
      const readData = parseResult(readResult);
      expect(readData.config.game.exe).toBe("/bin/hl2-updated");
    });

    it("errors when no configpath", async () => {
      const result = await tools.get("write_game_config")!({ id: 3, config: { foo: "bar" } });
      expect(result.isError).toBe(true);
    });
  });
});
