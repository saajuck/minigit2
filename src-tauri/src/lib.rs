use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const SERVER_READY_TIMEOUT: Duration = Duration::from_secs(15);

/// Holds the spawned server sidecar so it can be killed when the app exits — Tauri doesn't do
/// this automatically, and a lingering Node process would otherwise keep its port occupied.
struct ServerHandle(Mutex<Option<CommandChild>>);

fn open_main_window(app_handle: &AppHandle, port: u16) {
    let url = format!("http://127.0.0.1:{port}")
        .parse()
        .expect("server URL is always valid");
    WebviewWindowBuilder::new(app_handle, "main", WebviewUrl::External(url))
        .title("minigit2")
        .inner_size(1200.0, 800.0)
        .build()
        .expect("failed to create main window");
}

/// The sidecar is spawned with PORT=0 (OS-assigned) rather than a hardcoded port, so it can
/// never collide with — and silently hijack — an unrelated process already using a fixed port
/// (a developer's own `npm run dev`, another app entirely). It logs the real port once bound;
/// pull it back out of that line instead of guessing one ourselves.
fn parse_ready_port(line: &str) -> Option<u16> {
    let line = line.trim();
    if !line.contains("minigit2 server listening on") {
        return None;
    }
    line.rsplit(':').next()?.parse().ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Best-effort: relies on a session D-Bus, which desktop Linux always has but a minimal
        // or sandboxed environment might not — in that case a relaunch just opens a second,
        // independent window/server rather than crashing or hijacking anything.
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
                .env("PORT", "0")
                .spawn()
                .expect("failed to spawn minigit2-server sidecar");
            eprintln!("[minigit2] server sidecar spawned, pid {}", child.pid());

            app.state::<ServerHandle>()
                .0
                .lock()
                .expect("server handle mutex poisoned")
                .replace(child);

            let ready_port: Arc<Mutex<Option<u16>>> = Arc::new(Mutex::new(None));

            // The shell plugin buffers stdout/stderr into this channel; draining it also gives
            // us the server's logs for free when debugging a packaged build, and lets us watch
            // for the ready line carrying the actual (OS-assigned) bound port.
            let ready_port_writer = ready_port.clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let text = String::from_utf8_lossy(&line).into_owned();
                            eprintln!("[server] {text}");
                            if let Some(port) = parse_ready_port(&text) {
                                *ready_port_writer.lock().expect("ready-port mutex poisoned") = Some(port);
                            }
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
                    if let Some(port) = *ready_port.lock().expect("ready-port mutex poisoned") {
                        open_main_window(&app_handle, port);
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
