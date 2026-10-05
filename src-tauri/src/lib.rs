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

/// The AppImage carries its own GLib/GIO, built on the distro the release runner uses. The GTK
/// hook linuxdeploy generates only ever exports `GIO_EXTRA_MODULES`, which *adds* to the module
/// search path, so GIO still scans the host's `gio/modules` and tries to load the host's modules
/// into our older GLib. On a host newer than the build machine those modules need symbols our
/// GLib doesn't export (`g_variant_builder_init_static`, on Ubuntu 26) and every launch prints a
/// wall of `undefined symbol` / `Failed to load module` noise. `GIO_MODULE_DIR` *replaces* the
/// scanned directory, so pointing it at the bundle leaves only the modules we actually shipped.
///
/// Confined to AppImage runs (`APPDIR` is set) and never overrides a value set by the user, so
/// `GIO_MODULE_DIR=/usr/lib/x86_64-linux-gnu/gio/modules` restores the old behavior. The bundle
/// only ships `libgiognutls.so`, so this does cost our process the host's dconf GSettings
/// backend, GVfs and proxy resolution — none of which this app uses: it opens no native file
/// dialog and only ever talks to 127.0.0.1, and the theme lookup that matters happens in the
/// hook's own `gsettings` call, in a host process we don't touch (verified under strace).
#[cfg(target_os = "linux")]
fn confine_gio_modules_to_bundle() {
    if std::env::var_os("GIO_MODULE_DIR").is_some() {
        return;
    }
    let Ok(appdir) = std::env::var("APPDIR") else {
        return;
    };

    // The bundled module directory is architecture-dependent, and linuxdeploy's hook has already
    // worked it out — reuse its value rather than hardcoding a target triple here. It is a
    // `:`-separated list in principle, so take the first entry that really lives in the bundle.
    let bundled = std::env::var("GIO_EXTRA_MODULES").ok().and_then(|list| {
        list.split(':')
            .find(|path| !path.is_empty() && path.starts_with(&appdir))
            .map(str::to_owned)
    });

    // Nothing recognizable to point at (the hook changed shape): leave the environment alone and
    // put up with the noise rather than guessing a path that would silence working modules.
    if let Some(bundled) = bundled {
        std::env::set_var("GIO_MODULE_DIR", bundled);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    confine_gio_modules_to_bundle();

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
