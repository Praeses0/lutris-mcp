import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    restoreMocks: true,
    exclude: ["dist/**", "node_modules/**"],
  },
});
