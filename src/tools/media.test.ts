import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupTestDb, seedData, teardownTestDb, getTestDb } from "../__fixtures__/seed.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";

vi.mock("../db/connection.js", () => ({
  getDatabase: () => getTestDb(),
  getDbPath: () => ":memory:",
}));

import { registerMediaTools } from "./media.js";

function captureTools() {
  const tools = new Map<string, Function>();
  const mockServer = {
    tool: vi.fn((...args: unknown[]) => {
      tools.set(args[0] as string, args[args.length - 1] as Function);
    }),
  };
  registerMediaTools(mockServer as any);
  return tools;
}

describe("media tools", () => {
  let tools: Map<string, Function>;
  let tempDir: string;

  beforeEach(() => {
    teardownTestDb();
    setupTestDb();
    seedData();
    tools = captureTools();

    tempDir = mkdtempSync(path.join(tmpdir(), "lutris-media-test-"));
    mkdirSync(path.join(tempDir, "coverart"), { recursive: true });
    mkdirSync(path.join(tempDir, "banners"), { recursive: true });
    mkdirSync(path.join(tempDir, "icons"), { recursive: true });
    process.env.LUTRIS_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LUTRIS_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function parseResult(result: any) {
    return JSON.parse(result.content[0].text);
  }

  // ─── set_game_cover ──────────────────────────────────────────────────────

  describe("set_game_cover", () => {
    it("copies a coverart file by game id", async () => {
      const srcFile = path.join(tempDir, "source.jpg");
      writeFileSync(srcFile, "fake-image-data");

      const result = await tools.get("set_game_cover")!({
        id: 1,
        type: "coverart",
        source_path: srcFile,
      });
      const data = parseResult(result);
      expect(data.message).toContain("coverart");
      expect(data.message).toContain("Half-Life 2");
      expect(data.path).toContain("coverart");
      expect(data.path).toContain("half-life-2.jpg");
      expect(existsSync(data.path)).toBe(true);
    });

    it("copies a banner file by game slug", async () => {
      const srcFile = path.join(tempDir, "banner.png");
      writeFileSync(srcFile, "fake-banner-data");

      const result = await tools.get("set_game_cover")!({
        slug: "celeste",
        type: "banner",
        source_path: srcFile,
      });
      const data = parseResult(result);
      expect(data.message).toContain("banner");
      expect(data.message).toContain("Celeste");
      expect(data.path).toContain("banners");
      expect(data.path).toContain("celeste.png");
      expect(existsSync(data.path)).toBe(true);
    });

    it("copies an icon file", async () => {
      const srcFile = path.join(tempDir, "icon.png");
      writeFileSync(srcFile, "fake-icon");

      const result = await tools.get("set_game_cover")!({
        id: 4,
        type: "icon",
        source_path: srcFile,
      });
      const data = parseResult(result);
      expect(data.message).toContain("icon");
      expect(data.message).toContain("Portal 2");
      expect(data.path).toContain("icons");
      expect(existsSync(data.path)).toBe(true);
    });

    it("creates destination directory if missing", async () => {
      // Remove the coverart dir so it must be re-created
      rmSync(path.join(tempDir, "coverart"), { recursive: true });

      const srcFile = path.join(tempDir, "source.jpg");
      writeFileSync(srcFile, "data");

      const result = await tools.get("set_game_cover")!({
        id: 1,
        type: "coverart",
        source_path: srcFile,
      });
      expect(result.isError).toBeUndefined();
      const data = parseResult(result);
      expect(existsSync(data.path)).toBe(true);
    });

    it("errors when neither id nor slug provided", async () => {
      const result = await tools.get("set_game_cover")!({
        type: "coverart",
        source_path: "/tmp/fake.jpg",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Provide either id or slug");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("set_game_cover")!({
        id: 999,
        type: "coverart",
        source_path: "/tmp/fake.jpg",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("errors when source file does not exist", async () => {
      const result = await tools.get("set_game_cover")!({
        id: 1,
        type: "coverart",
        source_path: "/tmp/nonexistent-image-12345.jpg",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Source file not found");
    });

    it("updates the database flag for coverart", async () => {
      const srcFile = path.join(tempDir, "img.jpg");
      writeFileSync(srcFile, "data");

      await tools.get("set_game_cover")!({
        id: 1,
        type: "coverart",
        source_path: srcFile,
      });

      const db = getTestDb();
      const row = db.prepare("SELECT has_custom_coverart_big FROM games WHERE id = 1").get() as any;
      expect(row.has_custom_coverart_big).toBe(1);
    });

    it("updates the database flag for banner", async () => {
      const srcFile = path.join(tempDir, "img.jpg");
      writeFileSync(srcFile, "data");

      await tools.get("set_game_cover")!({
        id: 1,
        type: "banner",
        source_path: srcFile,
      });

      const db = getTestDb();
      const row = db.prepare("SELECT has_custom_banner FROM games WHERE id = 1").get() as any;
      expect(row.has_custom_banner).toBe(1);
    });

    it("updates the database flag for icon", async () => {
      const srcFile = path.join(tempDir, "img.png");
      writeFileSync(srcFile, "data");

      await tools.get("set_game_cover")!({
        id: 1,
        type: "icon",
        source_path: srcFile,
      });

      const db = getTestDb();
      const row = db.prepare("SELECT has_custom_icon FROM games WHERE id = 1").get() as any;
      expect(row.has_custom_icon).toBe(1);
    });
  });

  // ─── get_game_media ────────────────────────────────────────────────────

  describe("get_game_media", () => {
    it("returns media info by game id with no files", async () => {
      const result = await tools.get("get_game_media")!({ id: 1 });
      const data = parseResult(result);
      expect(data.game_id).toBe(1);
      expect(data.game_name).toBe("Half-Life 2");
      expect(data.slug).toBe("half-life-2");
      expect(data.media.coverart.exists).toBe(false);
      expect(data.media.banner.exists).toBe(false);
      expect(data.media.icon.exists).toBe(false);
    });

    it("returns media info by slug", async () => {
      const result = await tools.get("get_game_media")!({ slug: "celeste" });
      const data = parseResult(result);
      expect(data.game_name).toBe("Celeste");
    });

    it("detects existing media files", async () => {
      writeFileSync(path.join(tempDir, "coverart", "half-life-2.jpg"), "img");
      writeFileSync(path.join(tempDir, "banners", "half-life-2.jpg"), "img");

      const result = await tools.get("get_game_media")!({ id: 1 });
      const data = parseResult(result);
      expect(data.media.coverart.exists).toBe(true);
      expect(data.media.coverart.path).toContain("half-life-2.jpg");
      expect(data.media.banner.exists).toBe(true);
      expect(data.media.icon.exists).toBe(false);
    });

    it("errors when neither id nor slug provided", async () => {
      const result = await tools.get("get_game_media")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Provide either id or slug");
    });

    it("errors when game not found", async () => {
      const result = await tools.get("get_game_media")!({ id: 999 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });
});
