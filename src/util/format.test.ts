import { describe, it, expect } from "vitest";
import { formatPlaytime } from "./format.js";

describe("formatPlaytime", () => {
  it("returns null for null", () => {
    expect(formatPlaytime(null)).toBeNull();
  });

  it("formats zero minutes", () => {
    expect(formatPlaytime(0)).toBe("0m");
  });

  it("formats minutes only", () => {
    expect(formatPlaytime(45)).toBe("45m");
  });

  it("formats hours only", () => {
    expect(formatPlaytime(120)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatPlaytime(150)).toBe("2h 30m");
  });

  it("rounds fractional minutes", () => {
    expect(formatPlaytime(120.5)).toBe("2h 1m");
  });

  it("handles large values", () => {
    expect(formatPlaytime(6000)).toBe("100h");
  });
});
