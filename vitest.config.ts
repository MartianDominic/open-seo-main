import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/client/**/*.test.ts", "src/client/**/*.test.tsx"],
    restoreMocks: true,
    clearMocks: true,
  },
});
