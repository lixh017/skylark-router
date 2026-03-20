use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Wraps the sidecar child process so it can be replaced on restart.
struct SidecarState(Mutex<Option<CommandChild>>);

/// Stores the port the Go backend sidecar is listening on.
static BACKEND_PORT: Mutex<Option<u16>> = Mutex::new(None);

/// Read the configured port from config.yaml at the given path.
/// Falls back to 16898 (the default) if the file is missing or unparseable.
fn read_config_port(config_path: &std::path::Path) -> u16 {
    if let Ok(content) = std::fs::read_to_string(config_path) {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("port:") {
                let value = line["port:".len()..].trim().trim_matches('"');
                if let Ok(p) = value.parse::<u16>() {
                    return p;
                }
            }
        }
    }
    16898
}

/// Try to use the configured port. If it's already in use, fall back to any
/// free port.
fn resolve_port(configured: u16) -> u16 {
    if std::net::TcpListener::bind(("0.0.0.0", configured)).is_ok() {
        return configured;
    }
    let listener =
        std::net::TcpListener::bind("0.0.0.0:0").expect("failed to bind to a free port");
    listener.local_addr().expect("no local addr").port()
}

/// Returns the config.yaml path inside the app data directory.
fn config_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
        .join("config.yaml")
}

/// Spawn the Go sidecar with the correct environment variables.
fn spawn_sidecar(
    app: &tauri::AppHandle,
    config_file: &std::path::Path,
    db_path: &std::path::Path,
) -> Result<CommandChild, Box<dyn std::error::Error>> {
    let port = read_config_port(config_file);
    let port = resolve_port(port);
    *BACKEND_PORT.lock().unwrap() = Some(port);

    let (mut rx, child) = app
        .shell()
        .sidecar("skylark-router")?
        .env("PORT", port.to_string())
        .env("DB_PATH", db_path.to_string_lossy().to_string())
        .env("CONFIG_PATH", config_file.to_string_lossy().to_string())
        .env("TAURI_APP", "1")
        .spawn()?;

    // Drain the event receiver on a background async task.
    tauri::async_runtime::spawn(async move {
        while let Some(_event) = rx.recv().await {}
    });

    Ok(child)
}

/// Tauri command: returns the port the backend sidecar is listening on.
#[tauri::command]
fn get_backend_port() -> u16 {
    BACKEND_PORT.lock().unwrap().unwrap_or(16898)
}

/// Tauri command: restart the Go sidecar (kill old, spawn new).
/// Returns the new port.
#[tauri::command]
fn restart_sidecar(app: tauri::AppHandle) -> Result<u16, String> {
    let state = app.state::<SidecarState>();
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;

    // Kill old process
    if let Some(child) = guard.take() {
        let _ = child.kill();
    }

    let cfg_path = config_path(&app);
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("skylark-router.db");

    let child = spawn_sidecar(&app, &cfg_path, &db_path).map_err(|e| e.to_string())?;
    *guard = Some(child);

    let port = BACKEND_PORT.lock().unwrap().unwrap_or(16898);
    Ok(port)
}

/// Tauri command: check whether autostart is enabled.
#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// Tauri command: enable or disable autostart.
#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let mgr = app.autolaunch();
    if enabled {
        mgr.enable().map_err(|e| e.to_string())
    } else {
        mgr.disable().map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir)?;

            let cfg_path = app_data_dir.join("config.yaml");

            // First launch: if no config.yaml in app data dir, copy from
            // the binary bundle directory (MacOS/).
            if !cfg_path.exists() {
                let binary_dir = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|d| d.to_path_buf()))
                    .unwrap_or_default();
                let bundled = binary_dir.join("config.yaml");
                if bundled.exists() {
                    let _ = std::fs::copy(&bundled, &cfg_path);
                }
            }

            let db_path = app_data_dir.join("skylark-router.db");

            let child =
                spawn_sidecar(&app.handle(), &cfg_path, &db_path).expect("failed to spawn sidecar");
            app.manage(SidecarState(Mutex::new(Some(child))));

            // Build tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Skylark Router", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Create tray icon using the app's default window icon
            let icon = app.default_window_icon().cloned()
                .expect("no default window icon set");
            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Skylark Router")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        // Kill sidecar before exiting
                        if let Some(state) = app.try_state::<SidecarState>() {
                            if let Ok(mut guard) = state.0.lock() {
                                if let Some(child) = guard.take() {
                                    let _ = child.kill();
                                }
                            }
                        }
                        app.exit(0);
                    }
                    "show" => {
                        #[cfg(target_os = "macos")]
                        let _ = app.show();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        #[cfg(target_os = "macos")]
                        let _ = app.show();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            let is_minimized = window.is_minimized().unwrap_or(false);
                            if is_visible && !is_minimized {
                                let _ = window.hide();
                            } else {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        // Hide to tray instead of quitting when the window close button is clicked
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_backend_port,
            restart_sidecar,
            is_autostart_enabled,
            set_autostart,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill sidecar on any exit path (Dock Quit, SIGTERM, etc.)
                if let Some(state) = app.try_state::<SidecarState>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
