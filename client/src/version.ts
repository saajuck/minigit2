/** The app version, injected at build time from the repo root `package.json` (see the
 * `__APP_VERSION__` define in vite.config.ts / vitest.config.ts) — the same field the release
 * workflow turns into the `v<version>` tag, so what the UI shows matches the published release. */
declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;
