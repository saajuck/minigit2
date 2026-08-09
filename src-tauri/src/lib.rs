use std::net::TcpStream;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const SERVER_PORT: u16 = 4300;
const SERVER_READY_TIMEOUT: Duration = Duration::from_secs(15);

/// Holds the spawned server sidecar so it can be killed when the app exits — Tauri doesn't do
/// this automatically, and a lingering Node process would otherwise keep the port occupied. Stays
/// `None` if we found (and are reusing) another instance's already-running server instead of
/// spawning our own — in that case exiting must not kill a server we don't own.
struct ServerHandle(Mutex<Option<CommandChild>>);

fn is_server_up() -> bool {
    TcpStream::connect(("127.0.0.1", SERVER_PORT)).is_ok()
}

fn open_main_window(app_handle: &AppHandle) {
    let url = format!("http://127.0.0.1:{SERVER_PORT}")
        .parse()
        .expect("server URL is always valid");
    WebviewWindowBuilder::new(app_handle, "main", WebviewUrl::External(url))
        .title("minigit2")
        .inner_size(1200.0, 800.0)
        .build()
        .expect("failed to create main window");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Best-effort: relies on a session D-Bus, which desktop Linux always has but a minimal
        // or sandboxed environment might not. The port check in `setup` below is the real
        // safety net if this silently fails to dedupe.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .manage(ServerHandle(Mutex::new(None)))
        .setup(|app| {
            // Always on (not just debug builds) — this is our only window into a packaged
            // AppImage's behavior, since there's no attached terminal to eyeball otherwise.
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // A previous instance (or an unrelated process) may already be serving this port —
            // don't spawn a second server that would just crash on EADDRINUSE. Reuse it instead.
            if is_server_up() {
                eprintln!("[minigit2] a server is already running on port {SERVER_PORT}, reusing it");
                open_main_window(&app.handle().clone());
                return Ok(());
            }

            let client_dist = app
                .path()
                .resolve("client-dist", tauri::path::BaseDirectory::Resource)
                .expect("failed to resolve bundled client-dist resource path");
            eprintln!("[minigit2] client dist resolved to {}", client_dist.display());

            eprintln!("[minigit2] preparing server sidecar…");
            let (mut rx, child) = app
                .shell()
                .sidecar("minigit2-server")
                .expect("failed to prepare minigit2-server sidecar command")
                .env("MINIGIT2_CLIENT_DIST", client_dist.to_string_lossy().to_string())
                .spawn()
                .expect("failed to spawn minigit2-server sidecar");
            eprintln!("[minigit2] server sidecar spawned, pid {}", child.pid());

            app.state::<ServerHandle>()
                .0
                .lock()
                .expect("server handle mutex poisoned")
                .replace(child);

            // The shell plugin buffers stdout/stderr into this channel; draining it also
            // gives us the server's logs for free when debugging a packaged build.
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            eprintln!("[server] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[server:err] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Error(err) => {
                            eprintln!("[server:spawn-error] {err}");
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[server] exited: {payload:?}");
                        }
                        _ => {}
                    }
                }
            });

            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let deadline = Instant::now() + SERVER_READY_TIMEOUT;
                while Instant::now() < deadline {
                    if is_server_up() {
                        open_main_window(&app_handle);
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(150));
                }
                eprintln!("[minigit2] server did not become ready within the timeout");
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(child) = app_handle
                .state::<ServerHandle>()
                .0
                .lock()
                .expect("server handle mutex poisoned")
                .take()
            {
                if let Err(err) = child.kill() {
                    eprintln!("[minigit2] failed to kill server sidecar on exit: {err}");
                }
            }
        }
    });
}
