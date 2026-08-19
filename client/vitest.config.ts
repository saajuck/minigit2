import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts (which also carries the dev-server proxy, irrelevant to tests) —
// same react() plugin so .tsx test files get the same JSX transform as the real app.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
