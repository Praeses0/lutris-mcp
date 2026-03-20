import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeGameConfig } from "./writer.js";
import { readGameConfig } from "./reader.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("writeGameConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "lutris-writer-"));
    process.env.LUTRIS_GAMES_CONFIG_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LUTRIS_GAMES_CONFIG_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes a config that can be read back", () => {
    const config = { game: { exe: "/bin/test", prefix: "/home" }, system: { env: { FOO: "bar" } } };
    writeGameConfig("test-game", config);
    const result = readGameConfig("test-game");
    expect(result).toEqual(config);
  });

  it("overwrites existing config", () => {
    writeGameConfig("test-game", { a: 1 });
    writeGameConfig("test-game", { b: 2 });
    const result = readGameConfig("test-game");
    expect(result).toEqual({ b: 2 });
  });
});
