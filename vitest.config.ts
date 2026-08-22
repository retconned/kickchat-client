import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/types/**",
        "src/index.ts",
      ],
      thresholds: {
        statements: 88,
        branches: 80,
        functions: 88,
        lines: 88,
      },
    },
  },
});
