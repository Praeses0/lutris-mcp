import { describe, it, expect } from "vitest";
import { generateSlug } from "./slug.js";

describe("generateSlug", () => {
  it("converts basic name to slug", () => {
    expect(generateSlug("Half-Life 2")).toBe("half-life-2");
  });

  it("strips special characters", () => {
    expect(generateSlug("Sid Meier's Civ VI")).toBe("sid-meiers-civ-vi");
  });

  it("collapses multiple hyphens", () => {
    expect(generateSlug("Game - - Edition")).toBe("game-edition");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateSlug("--game--")).toBe("game");
  });

  it("returns empty for all special chars", () => {
    expect(generateSlug("@#$%")).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(generateSlug("")).toBe("");
  });

  it("is idempotent on already-slugged input", () => {
    expect(generateSlug("my-game")).toBe("my-game");
  });

  it("preserves numbers", () => {
    expect(generateSlug("2048 Game 3D")).toBe("2048-game-3d");
  });

  it("collapses multiple spaces", () => {
    expect(generateSlug("Game    Title")).toBe("game-title");
  });
});
