import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

const mockUnref = vi.fn();
const mockSpawn = vi.fn(() => ({ pid: 12345, unref: mockUnref }));
vi.mock("child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

import { registerLauncherTools } from "./launcher.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerLauncherTools(mockServer as any);
  return tools;
}

describe("launcher tools", () => {
  let tools: Map<string, Function>;

  beforeEach(() => {
    teardownTestDb();
    setupTestDb();
    seedData();
    tools = captureTools();
    mockSpawn.mockClear();
    mockUnref.mockClear();
  });

  function parseResult(result: any) {
    return JSON.parse(result.content[0].text);
  }

  describe("launch_game", () => {
    it("launches installed game", async () => {
      const result = await tools.get("launch_game")!({ id: 1 });
      const data = parseResult(result);
      expect(data.message).toContain("Half-Life 2");
      expect(data.pid).toBe(12345);
      expect(mockSpawn).toHaveBeenCalledWith(
        "lutris",
        ["lutris:rungame/half-life-2"],
        expect.objectContaining({ detached: true })
      );
      expect(mockUnref).toHaveBeenCalled();
    });

    it("errors when game not installed", async () => {
      const result = await tools.get("launch_game")!({ id: 3 }); // Celeste, installed=0
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not installed");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("launch_game")!({ id: 999 });
      expect(result.isError).toBe(true);
    });

    it("errors when no id or slug", async () => {
      const result = await tools.get("launch_game")!({});
      expect(result.isError).toBe(true);
    });
  });

  describe("install_game", () => {
    it("installs with direct installer_slug", async () => {
      const result = await tools.get("install_game")!({ installer_slug: "my-game-setup" });
      const data = parseResult(result);
      expect(data.message).toContain("my-game-setup");
      expect(mockSpawn).toHaveBeenCalledWith(
        "lutris",
        ["lutris:install/my-game-setup"],
        expect.objectContaining({ detached: true })
      );
    });

    it("errors when no installer_slug available", async () => {
      const result = await tools.get("install_game")!({ id: 3 }); // Celeste has no installer_slug
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("no installer slug");
    });

    it("errors when no params", async () => {
      const result = await tools.get("install_game")!({});
      expect(result.isError).toBe(true);
    });

    describe("local setup_exe", () => {
      let tmpDir: string;
      let setupPath: string;

      beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "launcher-test-"));
        setupPath = join(tmpDir, "setup.exe");
        writeFileSync(setupPath, "fake-setup");
      });

      it("installs from local setup_exe", async () => {
        const result = await tools.get("install_game")!({
          setup_exe: setupPath,
          name: "My Test Game",
          runner: "wine",
        });
        const data = parseResult(result);
        expect(data.message).toContain("My Test Game");
        expect(data.pid).toBe(12345);
        expect(data.installer_yaml).toBeDefined();
        expect(mockSpawn).toHaveBeenCalledWith(
          "lutris",
          ["-i", expect.stringContaining("installer.yml")],
          expect.objectContaining({ detached: true })
        );
      });

      it("derives game name from directory when name omitted", async () => {
        const gameDir = join(tmpDir, "Cool Game");
        mkdirSync(gameDir);
        const exe = join(gameDir, "setup.exe");
        writeFileSync(exe, "fake");
        const result = await tools.get("install_game")!({ setup_exe: exe, runner: "wine" });
        const data = parseResult(result);
        expect(data.message).toContain("Cool Game");
      });

      it("errors when setup_exe not found", async () => {
        const result = await tools.get("install_game")!({
          setup_exe: "/nonexistent/setup.exe",
          name: "Bad Game",
          runner: "wine",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("not found");
      });

      afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
      });
    });
  });
});
