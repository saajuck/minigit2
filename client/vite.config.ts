import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The repo root package.json is the single source of truth for the app version (the release
// workflow tags "v" + this field) — inlined here so the client can show it without a runtime
// fetch or a second copy to keep in sync.
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4300",
    },
  },
});
