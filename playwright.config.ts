import { defineConfig } from "@playwright/test";

// Runs against the same single-process server the real app ships as: build the client once,
// then start the server, which serves both the API and the built static client on one port (see
// server/src/index.ts's resolveClientDist) — no separate dev server needed.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4300",
    // Sandbox dev environments here pre-install a fixed chromium build that can trail whatever
    // version this @playwright/test happens to pin — point at it explicitly rather than let
    // Playwright look for (and fail to find) its own expected build. Real CI runs `playwright
    // install` for a matching browser, so this only applies outside CI.
    ...(process.env.CI
      ? {}
      : { launchOptions: { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" } }),
  },
  webServer: {
    command: "npm run build -w client && npm run start -w server",
    url: "http://127.0.0.1:4300/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
