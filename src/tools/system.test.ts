import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

const mockExecSync = vi.fn();
vi.mock("child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

import { registerSystemTools, buildSearchPatterns } from "./system.js";
import type { Game } from "../db/types.js";

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

  /**
   * Helper: make mockExecSync respond to specific pgrep patterns.
   * patternResponses maps a substring of the pgrep command to the pgrep output.
   * Any pgrep call not matching a patternResponse throws (no match).
   */
  function setupPgrepMock(patternResponses: Record<string, string>) {
    mockExecSync.mockImplementation((cmd: string) => {
      if (!cmd.startsWith("pgrep")) {
        throw new Error(`Unexpected command: ${cmd}`);
      }
      for (const [pattern, response] of Object.entries(patternResponses)) {
        if (cmd.includes(pattern)) {
          return response;
        }
      }
      // No match: pgrep exits with code 1
      throw new Error("exit 1");
    });
  }

  describe("buildSearchPatterns", () => {
    it("builds patterns for a steam game with directory and service_id", () => {
      const game: Game = {
        id: 1, name: "Half-Life 2", slug: "half-life-2", runner: "steam",
        platform: "linux", directory: "/games/half-life-2", executable: null,
        service: "steam", service_id: "220",
        sortname: null, installer_slug: null, parent_slug: null,
        updated: null, lastplayed: null, installed: 1, installed_at: null,
        year: null, configpath: null, has_custom_banner: null,
        has_custom_icon: null, has_custom_coverart_big: null,
        playtime: null, discord_id: null,
      };

      const patterns = buildSearchPatterns(game);
      const methods = patterns.map((p) => p.method);

      expect(methods).toContain("directory");
      expect(methods).toContain("steam_appid");
      expect(methods).toContain("steam_launch");
      expect(methods).toContain("wine_process");
      expect(methods).toContain("proton_process");
      expect(methods).toContain("slug");
      // No executable set, so no executable patterns
      expect(methods).not.toContain("executable");
      expect(methods).not.toContain("executable_basename");
    });

    it("builds patterns for a wine game with executable", () => {
      const game: Game = {
        id: 2, name: "The Witcher 3", slug: "the-witcher-3", runner: "wine",
        platform: "windows", directory: "/games/witcher3",
        executable: "/games/witcher3/bin/witcher3.exe",
        service: "gog", service_id: "gog-123",
        sortname: null, installer_slug: null, parent_slug: null,
        updated: null, lastplayed: null, installed: 1, installed_at: null,
        year: null, configpath: null, has_custom_banner: null,
        has_custom_icon: null, has_custom_coverart_big: null,
        playtime: null, discord_id: null,
      };

      const patterns = buildSearchPatterns(game);
      const methods = patterns.map((p) => p.method);

      expect(methods).toContain("directory");
      expect(methods).toContain("executable");
      expect(methods).toContain("executable_basename");
      expect(methods).toContain("wine_process");
      expect(methods).toContain("proton_process");
      expect(methods).toContain("slug");
      // Not a steam game, so no steam patterns
      expect(methods).not.toContain("steam_appid");
      expect(methods).not.toContain("steam_launch");

      // Verify the basename pattern is correct
      const basenamePattern = patterns.find((p) => p.method === "executable_basename");
      expect(basenamePattern!.pattern).toBe("witcher3.exe");
    });

    it("builds patterns for a game with no directory/executable (just slug)", () => {
      const game: Game = {
        id: 3, name: "Celeste", slug: "celeste", runner: "linux",
        platform: "linux", directory: null, executable: null,
        service: null, service_id: null,
        sortname: null, installer_slug: null, parent_slug: null,
        updated: null, lastplayed: null, installed: 0, installed_at: null,
        year: null, configpath: null, has_custom_banner: null,
        has_custom_icon: null, has_custom_coverart_big: null,
        playtime: null, discord_id: null,
      };

      const patterns = buildSearchPatterns(game);
      const methods = patterns.map((p) => p.method);

      // Only slug should be present for a linux game with no dir/exec
      expect(methods).toEqual(["slug"]);
      expect(patterns[0].pattern).toBe("celeste");
    });

    it("does not add executable_basename when executable is already a basename", () => {
      const game: Game = {
        id: 99, name: "Test", slug: "test", runner: "linux",
        platform: "linux", directory: null, executable: "test-binary",
        service: null, service_id: null,
        sortname: null, installer_slug: null, parent_slug: null,
        updated: null, lastplayed: null, installed: 1, installed_at: null,
        year: null, configpath: null, has_custom_banner: null,
        has_custom_icon: null, has_custom_coverart_big: null,
        playtime: null, discord_id: null,
      };

      const patterns = buildSearchPatterns(game);
      const methods = patterns.map((p) => p.method);

      expect(methods).toContain("executable");
      expect(methods).not.toContain("executable_basename");
    });
  });

  describe("check_game_running", () => {
    it("detects running game by directory pattern", async () => {
      // Game 1 (Half-Life 2): directory=/games/half-life-2, steam game
      // The first pattern tried is directory, which matches
      setupPgrepMock({
        "/games/half-life-2": "12345 /games/half-life-2/hl2_linux\n",
      });

      const result = await tools.get("check_game_running")!({ id: 1 });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.pid).toBe(12345);
      expect(data.match_method).toBe("directory");
    });

    it("detects running game by executable basename when directory misses", async () => {
      // Game 2 (The Witcher 3): directory=/games/witcher3, executable=/games/witcher3/bin/witcher3.exe
      // Directory and full executable path miss, but basename "witcher3.exe" matches.
      // We need precise matching: the full path pattern and the basename pattern both
      // contain "witcher3.exe", so we use a custom mock that checks exact pgrep patterns.
      let pgrepCallCount = 0;
      mockExecSync.mockImplementation((cmd: string) => {
        if (!cmd.startsWith("pgrep")) throw new Error(`Unexpected: ${cmd}`);
        pgrepCallCount++;
        // First call: directory pattern
        if (cmd.includes("/games/witcher3") && !cmd.includes("witcher3.exe")) {
          throw new Error("exit 1");
        }
        // Second call: full executable path
        if (cmd.includes("/games/witcher3/bin/witcher3.exe")) {
          throw new Error("exit 1");
        }
        // Third call: basename only — this one matches
        if (cmd.includes('"witcher3.exe"')) {
          return "67890 wine /home/user/.wine/drive_c/witcher3.exe\n";
        }
        throw new Error("exit 1");
      });

      const result = await tools.get("check_game_running")!({ id: 2 });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.pid).toBe(67890);
      expect(data.match_method).toBe("executable_basename");
      // Should have been called 3 times: directory, full executable, basename
      expect(pgrepCallCount).toBe(3);
    });

    it("detects running game by slug as fallback", async () => {
      // Game 3 (Celeste): no directory, no executable, slug=celeste
      setupPgrepMock({
        celeste: "11111 /usr/bin/celeste\n",
      });

      const result = await tools.get("check_game_running")!({ slug: "celeste" });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.pid).toBe(11111);
      expect(data.match_method).toBe("slug");
    });

    it("detects running steam game by AppId pattern", async () => {
      // Game 4 (Portal 2): steam game, service_id=620, directory=/games/portal-2
      // Directory misses, but steam AppId pattern matches
      setupPgrepMock({
        "steam.*AppId.*620": "22222 steam AppId=620 SteamLaunch\n",
      });

      const result = await tools.get("check_game_running")!({ id: 4 });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.pid).toBe(22222);
      expect(data.match_method).toBe("steam_appid");
    });

    it("detects running wine game by wine process pattern", async () => {
      // Game 2 (The Witcher 3): wine runner, name="The Witcher 3"
      // Directory, executable, and basename all miss, but wine pattern matches
      setupPgrepMock({
        "wine.*The.*Witcher.*3": "33333 wine /prefix/drive_c/The Witcher 3/witcher3.exe\n",
      });

      const result = await tools.get("check_game_running")!({ id: 2 });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.pid).toBe(33333);
      expect(data.match_method).toBe("wine_process");
    });

    it("detects running game by proton process pattern", async () => {
      // Game 1 (Half-Life 2): steam runner with wine/proton patterns
      // Directory misses, then steam patterns miss, then proton matches
      setupPgrepMock({
        "proton.*Half.*Life.*2": "44444 proton run Half-Life 2\n",
      });

      const result = await tools.get("check_game_running")!({ id: 1 });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.pid).toBe(44444);
      expect(data.match_method).toBe("proton_process");
    });

    it("detects not running when all patterns miss", async () => {
      // All pgrep calls throw (no process found)
      mockExecSync.mockImplementation(() => { throw new Error("exit 1"); });

      const result = await tools.get("check_game_running")!({ id: 1 });
      const data = parseResult(result);
      expect(data.running).toBe(false);
      expect(data.pid).toBeUndefined();
      expect(data.match_method).toBeUndefined();
    });

    it("filters out pgrep's own process from results", async () => {
      // pgrep returns a line that includes "pgrep" (matching itself), plus a real match
      setupPgrepMock({
        "/games/half-life-2": "99999 pgrep -af /games/half-life-2\n12345 /games/half-life-2/hl2_linux\n",
      });

      const result = await tools.get("check_game_running")!({ id: 1 });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.pid).toBe(12345);
      // Should NOT return pid 99999 (the pgrep process)
    });

    it("returns not running when pgrep only matches itself", async () => {
      // pgrep only returns its own process line
      setupPgrepMock({
        "/games/half-life-2": "99999 pgrep -af /games/half-life-2\n",
      });

      // The remaining patterns (steam_appid, steam_launch, wine, proton, slug) will throw
      // because setupPgrepMock only has the directory key

      const result = await tools.get("check_game_running")!({ id: 1 });
      const data = parseResult(result);
      // It should fall through directory (pgrep self-match filtered) and try other patterns
      // Since no other patterns match either, running should be false
      // Unless slug "half-life-2" matches... let's check:
      // The slug pattern is the last fallback, and it's not in our mock responses, so it throws
      expect(data.running).toBe(false);
    });

    it("stops at first matching pattern (short-circuits)", async () => {
      // Both directory and slug would match, but we should stop at directory
      let pgrepCallCount = 0;
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("pgrep")) {
          pgrepCallCount++;
          if (cmd.includes("/games/half-life-2")) {
            return "12345 /games/half-life-2/hl2_linux\n";
          }
          if (cmd.includes("half-life-2")) {
            return "12345 half-life-2-process\n";
          }
          throw new Error("exit 1");
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const result = await tools.get("check_game_running")!({ id: 1 });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.match_method).toBe("directory");
      // Should have only called pgrep once (directory matched on first try)
      expect(pgrepCallCount).toBe(1);
    });

    it("errors when game not found", async () => {
      const result = await tools.get("check_game_running")!({ id: 999 });
      expect(result.isError).toBe(true);
    });

    it("errors when neither id nor slug provided", async () => {
      const result = await tools.get("check_game_running")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Provide either id or slug");
    });

    it("looks up game by slug", async () => {
      setupPgrepMock({
        "/games/half-life-2": "12345 /games/half-life-2/hl2\n",
      });

      const result = await tools.get("check_game_running")!({ slug: "half-life-2" });
      const data = parseResult(result);
      expect(data.running).toBe(true);
      expect(data.game).toBe("Half-Life 2");
    });
  });

  describe("list_runners", () => {
    it("returns parsed runner list (plain text)", async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("pgrep")) throw new Error("exit 1");
        return "wine\nsteam\nlinux\n";
      });
      const result = await tools.get("list_runners")!({ type: "runners" });
      const data = parseResult(result);
      expect(data).toEqual(["wine", "steam", "linux"]);
    });

    it("returns parsed wine versions (Python dict syntax)", async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("pgrep")) throw new Error("exit 1");
        return (
          "{'version': 'wine-ge-8-26', 'architecture': 'x86_64', 'default': False}\n" +
          "{'version': 'wine-staging-11.2', 'architecture': 'x86_64', 'default': True}\n"
        );
      });
      const result = await tools.get("list_runners")!({ type: "wine" });
      const data = parseResult(result);
      expect(data).toHaveLength(2);
      expect(data[0].version).toBe("wine-ge-8-26");
      expect(data[0].default).toBe(false);
      expect(data[1].default).toBe(true);
    });

    it("handles error", async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("pgrep")) throw new Error("exit 1");
        throw new Error("lutris not found");
      });
      const result = await tools.get("list_runners")!({ type: "runners" });
      expect(result.isError).toBe(true);
    });

    it("returns error when Lutris GUI is running", async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("pgrep")) {
          return "12345 /usr/bin/python3 /usr/bin/lutris\n";
        }
        // Should not reach the lutris CLI call
        return "";
      });
      const result = await tools.get("list_runners")!({ type: "runners" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Lutris GUI is currently running");
    });

    it("returns error when output is empty and GUI is not running", async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("pgrep")) {
          throw new Error("exit 1");
        }
        // lutris --list-runners returns empty
        return "";
      });
      const result = await tools.get("list_runners")!({ type: "runners" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No runners returned");
    });
  });

  describe("view_game_log", () => {
    let logDir: string;
    const origEnv = process.env.LUTRIS_LOG_DIR;

    beforeEach(() => {
      logDir = mkdtempSync(join(tmpdir(), "lutris-mcp-test-logs-"));
      process.env.LUTRIS_LOG_DIR = logDir;
    });

    afterAll(() => {
      if (origEnv !== undefined) {
        process.env.LUTRIS_LOG_DIR = origEnv;
      } else {
        delete process.env.LUTRIS_LOG_DIR;
      }
    });

    it("reads the most recent log file for a game", async () => {
      // Create two log files for half-life-2, with different mtimes
      const oldLog = join(logDir, "half-life-2-2024-01-01.log");
      const newLog = join(logDir, "half-life-2-2024-06-15.log");

      writeFileSync(oldLog, "old log line 1\nold log line 2\n");
      writeFileSync(newLog, "new log line 1\nnew log line 2\nnew log line 3\n");

      // Set old log to an older mtime
      const oldTime = new Date("2024-01-01");
      utimesSync(oldLog, oldTime, oldTime);

      const result = await tools.get("view_game_log")!({ id: 1 });
      const data = parseResult(result);

      expect(result.isError).toBeUndefined();
      expect(data.game).toBe("Half-Life 2");
      expect(data.log_file).toBe(newLog);
      expect(data.total_log_files).toBe(2);
      expect(data.content).toContain("new log line 1");
      expect(data.content).toContain("new log line 3");
    });

    it("limits output to requested number of lines", async () => {
      const lines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`);
      writeFileSync(join(logDir, "half-life-2.log"), lines.join("\n") + "\n");

      const result = await tools.get("view_game_log")!({ id: 1, lines: 5 });
      const data = parseResult(result);

      const outputLines = data.content.split("\n");
      expect(outputLines).toHaveLength(5);
      expect(outputLines[0]).toBe("line 196");
      expect(outputLines[4]).toBe("line 200");
    });

    it("uses default of 100 lines", async () => {
      const lines = Array.from({ length: 150 }, (_, i) => `line ${i + 1}`);
      writeFileSync(join(logDir, "half-life-2.log"), lines.join("\n") + "\n");

      const result = await tools.get("view_game_log")!({ id: 1 });
      const data = parseResult(result);

      const outputLines = data.content.split("\n");
      expect(outputLines).toHaveLength(100);
      expect(outputLines[0]).toBe("line 51");
      expect(outputLines[99]).toBe("line 150");
    });

    it("looks up game by slug", async () => {
      writeFileSync(join(logDir, "the-witcher-3.log"), "witcher log\n");

      const result = await tools.get("view_game_log")!({ slug: "the-witcher-3" });
      const data = parseResult(result);

      expect(data.game).toBe("The Witcher 3");
      expect(data.content).toContain("witcher log");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("view_game_log")!({ id: 999 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Game not found");
    });

    it("errors when neither id nor slug provided", async () => {
      const result = await tools.get("view_game_log")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Provide either id or slug");
    });

    it("errors when no log files exist for the game", async () => {
      // logDir exists but has no matching log files
      const result = await tools.get("view_game_log")!({ id: 1 });
      expect(result.isError).toBe(true);
      const data = parseResult(result);
      expect(data.error).toContain("No log files found");
      expect(data.game).toBe("Half-Life 2");
    });

    it("errors when log directory does not exist", async () => {
      process.env.LUTRIS_LOG_DIR = "/nonexistent/path/logs";

      const result = await tools.get("view_game_log")!({ id: 1 });
      expect(result.isError).toBe(true);
      const data = parseResult(result);
      expect(data.error).toContain("No log files found");
    });

    it("does not match log files for other games", async () => {
      // Create logs for a different game
      writeFileSync(join(logDir, "portal-2.log"), "portal log\n");

      const result = await tools.get("view_game_log")!({ id: 1 }); // half-life-2
      expect(result.isError).toBe(true);
      const data = parseResult(result);
      expect(data.error).toContain("No log files found");
    });

    it("handles files with fewer lines than requested", async () => {
      writeFileSync(join(logDir, "half-life-2.log"), "only one line\n");

      const result = await tools.get("view_game_log")!({ id: 1, lines: 100 });
      const data = parseResult(result);

      expect(data.content).toBe("only one line");
    });

    it("returns lines count in response", async () => {
      writeFileSync(join(logDir, "half-life-2.log"), "log data\n");

      const result = await tools.get("view_game_log")!({ id: 1, lines: 50 });
      const data = parseResult(result);

      expect(data.lines).toBe(50);
    });
  });
});
