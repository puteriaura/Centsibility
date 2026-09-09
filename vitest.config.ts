import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/server/**", "src/lib/**"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
