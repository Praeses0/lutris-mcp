import { describe, it, expect } from "vitest";
import { deepMerge } from "./deep-merge.js";

describe("deepMerge", () => {
  it("merges flat objects", () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("overwrites existing keys", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("recursively merges nested objects", () => {
    const target = { game: { exe: "/bin/game", prefix: "/home" } };
    const source = { game: { exe: "/bin/new" } };
    expect(deepMerge(target, source)).toEqual({
      game: { exe: "/bin/new", prefix: "/home" },
    });
  });

  it("deletes keys set to null", () => {
    const target = { a: 1, b: 2 };
    const source = { b: null };
    expect(deepMerge(target, source as any)).toEqual({ a: 1 });
  });

  it("deletes nested keys set to null", () => {
    const target = { game: { exe: "/bin/game", prefix: "/home" } };
    const source = { game: { prefix: null } };
    expect(deepMerge(target, source as any)).toEqual({
      game: { exe: "/bin/game" },
    });
  });

  it("does not mutate target", () => {
    const target = { a: 1 };
    deepMerge(target, { b: 2 });
    expect(target).toEqual({ a: 1 });
  });

  it("replaces arrays (no merge)", () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });

  it("handles empty source", () => {
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
  });
});
