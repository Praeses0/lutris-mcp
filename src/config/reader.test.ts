import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readGameConfig } from "./reader.js";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("readGameConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "lutris-test-"));
    process.env.LUTRIS_GAMES_CONFIG_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LUTRIS_GAMES_CONFIG_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null for null configpath", () => {
    expect(readGameConfig(null)).toBeNull();
  });

  it("returns null for missing file", () => {
    expect(readGameConfig("nonexistent")).toBeNull();
  });

  it("parses valid YAML correctly", () => {
    writeFileSync(
      path.join(tempDir, "test-game.yml"),
      "game:\n  name: Test Game\n  runner: linux\n"
    );
    const result = readGameConfig("test-game");
    expect(result).toEqual({ game: { name: "Test Game", runner: "linux" } });
  });

  it("returns null for invalid YAML", () => {
    writeFileSync(path.join(tempDir, "bad.yml"), ":{invalid:\nyaml: [");
    expect(readGameConfig("bad")).toBeNull();
  });

  it("parses nested structure", () => {
    writeFileSync(
      path.join(tempDir, "nested.yml"),
      "game:\n  exe: /bin/game\nsystem:\n  env:\n    WINEPREFIX: /home/user/.wine\n"
    );
    const result = readGameConfig("nested");
    expect(result).toEqual({
      game: { exe: "/bin/game" },
      system: { env: { WINEPREFIX: "/home/user/.wine" } },
    });
  });
});
