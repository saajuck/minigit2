import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// Separate from vite.config.ts (which also carries the dev-server proxy, irrelevant to tests) —
// same react() plugin so .tsx test files get the same JSX transform as the real app.
// Mirrors vite.config.ts's define so anything importing src/version.ts also builds under test.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
