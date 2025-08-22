use tauri::tray::TrayIconBuilder;
use tauri::{
    menu::{Menu, MenuItem}, Emitter, Manager
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

// Common update check function
async fn check_for_updates_with_dialog(app_handle: tauri::AppHandle, show_no_update_dialog: bool) {
    match tauri_plugin_updater::UpdaterExt::updater(&app_handle) {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    app_log!(info, "Update available: {} -> {}", app_handle.package_info().version, update.version);
                    
                    // Native dialog for update prompt
                    let current = app_handle.package_info().version.to_string();
                    let latest = update.version.clone();
                    app_handle.dialog()
                        .message(format!("Update available: {} → {}", current, latest))
                        .title("Update Available")
                        .buttons(MessageDialogButtons::OkCancelCustom("Update now".to_string(), "Later".to_string()))
                        .show(move |result| {
                            if result {
                                let app_handle_clone = app_handle.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = install_update(app_handle_clone).await;
                                });
                            }
                        });
                }
                Ok(None) => {
                    app_log!(info, "No updates available");
                    if show_no_update_dialog {
                        // Native message dialog for up-to-date
                        let current = app_handle.package_info().version.to_string();
                        app_handle.dialog()
                            .message(format!("You are using the latest version of vmix-utility!\nCurrent version: {}", current))
                            .kind(MessageDialogKind::Info)
                            .title("Up to Date")
                            .blocking_show();
                    }
                }
                Err(e) => {
                    app_log!(error, "Failed to check for updates: {}", e);
                }
            }
        }
        Err(e) => {
            app_log!(error, "Failed to get updater instance: {}", e);
        }
    }
}

// Module declarations
pub mod types;
pub mod logging;
pub mod http_client;
pub mod tcp_manager;
pub mod state;
pub mod commands;
pub mod network_scanner;

// Re-export commonly used types
pub use state::AppState;
pub use logging::{init_logging, LOGGING_CONFIG};

// Import all commands
use commands::*;

// (no helpers)

#[cfg(debug_assertions)]
fn prevent_default() -> tauri::plugin::TauriPlugin<tauri::Wry> {
  use tauri_plugin_prevent_default::Flags;

  tauri_plugin_prevent_default::Builder::new()
    .with_flags(Flags::all().difference(Flags::DEV_TOOLS | Flags::RELOAD))
    .build()
}

#[cfg(not(debug_assertions))]
fn prevent_default() -> tauri::plugin::TauriPlugin<tauri::Wry> {
  tauri_plugin_prevent_default::init()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize env_logger for console output
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance is launched, focus the existing window
            let _ = app.get_webview_window("main").expect("no main window").set_focus();
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(prevent_default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // ウィンドウを閉じる代わりに非表示にする
                    window.hide().unwrap();
                    api.prevent_close();
                }
                _ => {}
            }
        })
        .setup(|app| {
            // Initialize logging system
            if let Err(e) = init_logging(&app.handle()) {
                eprintln!("Failed to initialize logging: {}", e);
            }
            
            app_log!(info, "Application starting up");

            let app_handle = app.handle().clone();
            let app_handle_clone = app_handle.clone();
            let app_handle_refresh = app_handle.clone();
            let app_handle_update = app_handle.clone();

            // system tray icon
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let check_update_i = MenuItem::with_id(app, "check_update", "Check Update", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &check_update_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    match event {
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "check_update" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            check_for_updates_with_dialog(app_handle, true).await;
                        });
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            
            // Initialize app state and load config synchronously
            tauri::async_runtime::block_on(async move {
                let app_state = app_handle.state::<AppState>();
                
                // Initialize configuration and wait for completion
                if let Err(e) = app_state.initialize(&app_handle).await {
                    println!("Failed to initialize app state: {}", e);
                }
            });
            
            // Start auto-refresh background task after initialization
            tauri::async_runtime::spawn(async move {
                let app_state = app_handle_clone.state::<AppState>();
                app_state.start_auto_refresh_task(app_handle_refresh);
            });
            
            // Check for updates on startup
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await; // Wait 3 seconds after startup
                check_for_updates_with_dialog(app_handle_update, false).await;
            });
            
            Ok(())
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            connect_vmix,
            disconnect_vmix,
            get_vmix_status,
            get_vmix_statuses,
            send_vmix_function,
            get_vmix_inputs,
            get_vmix_video_lists,
            select_video_list_item,
            open_list_manager_window,
            open_video_list_window,
            get_video_list_windows_diagnostic,
            set_auto_refresh_config,
            get_auto_refresh_config,
            get_all_auto_refresh_configs,
            update_connection_label,
            get_connection_labels,
            save_settings,
            set_logging_config,
            get_logging_config,
            save_app_settings,
            get_app_settings,
            get_app_info,
            open_logs_directory,
            check_for_updates,
            install_update,
            get_network_interfaces_command,
            scan_network_for_vmix_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}