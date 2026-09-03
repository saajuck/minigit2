import { isTauri } from "@tauri-apps/api/core";

/** Opens a URL in the user's default browser. Inside the packaged desktop app, a plain
 * `<a target="_blank">` does nothing — the Tauri webview (WebKitGTK/WebView2) doesn't spawn an
 * external browser for that on its own — so this routes through the shell plugin's `open`
 * command there instead. In a regular browser tab (dev server, `npm start`), a normal anchor
 * already does the right thing, so this just falls back to `window.open`. */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
