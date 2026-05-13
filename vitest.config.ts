import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["mcp_servers/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["mcp_servers/**/*.ts"],
      exclude: ["mcp_servers/**/*.test.ts", "mcp_servers/**/synthetic.ts"],
    },
  },
});
