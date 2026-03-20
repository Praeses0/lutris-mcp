import { describe, it, expect } from "vitest";
import { formatPlaytime } from "./format.js";

describe("formatPlaytime", () => {
  it("returns null for null", () => {
    expect(formatPlaytime(null)).toBeNull();
  });

  it("formats zero hours", () => {
    expect(formatPlaytime(0)).toBe("0m");
  });

  it("formats fractional hours as minutes only", () => {
    expect(formatPlaytime(0.5)).toBe("30m");
  });

  it("formats whole hours", () => {
    expect(formatPlaytime(2)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatPlaytime(1.5)).toBe("1h 30m");
  });

  it("converts fractional hours to minutes correctly", () => {
    expect(formatPlaytime(5.46)).toBe("5h 28m");
  });

  it("handles large values", () => {
    expect(formatPlaytime(120.5)).toBe("120h 30m");
  });

  it("handles whole large values", () => {
    expect(formatPlaytime(100)).toBe("100h");
  });
});
