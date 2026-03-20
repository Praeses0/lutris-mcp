import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getGameMediaPaths } from "./media.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("getGameMediaPaths", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "lutris-media-"));
    mkdirSync(path.join(tempDir, "coverart"), { recursive: true });
    mkdirSync(path.join(tempDir, "banners"), { recursive: true });
    mkdirSync(path.join(tempDir, "icons"), { recursive: true });
    process.env.LUTRIS_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LUTRIS_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns nulls for null slug", () => {
    const media = getGameMediaPaths(null);
    expect(media).toEqual({ coverart: null, banner: null, icon: null });
  });

  it("returns nulls when no media files exist", () => {
    const media = getGameMediaPaths("nonexistent");
    expect(media).toEqual({ coverart: null, banner: null, icon: null });
  });

  it("finds jpg coverart", () => {
    writeFileSync(path.join(tempDir, "coverart", "test-game.jpg"), "fake");
    const media = getGameMediaPaths("test-game");
    expect(media.coverart).toBe("file://" + path.join(tempDir, "coverart", "test-game.jpg"));
    expect(media.banner).toBeNull();
  });

  it("finds png banner", () => {
    writeFileSync(path.join(tempDir, "banners", "test-game.png"), "fake");
    const media = getGameMediaPaths("test-game");
    expect(media.banner).toBe("file://" + path.join(tempDir, "banners", "test-game.png"));
  });

  it("prefers jpg over png", () => {
    writeFileSync(path.join(tempDir, "coverart", "test-game.jpg"), "fake");
    writeFileSync(path.join(tempDir, "coverart", "test-game.png"), "fake");
    const media = getGameMediaPaths("test-game");
    expect(media.coverart).toContain(".jpg");
  });

  it("finds all media types", () => {
    writeFileSync(path.join(tempDir, "coverart", "game.jpg"), "fake");
    writeFileSync(path.join(tempDir, "banners", "game.jpg"), "fake");
    writeFileSync(path.join(tempDir, "icons", "game.png"), "fake");
    const media = getGameMediaPaths("game");
    expect(media.coverart).not.toBeNull();
    expect(media.banner).not.toBeNull();
    expect(media.icon).not.toBeNull();
  });
});
