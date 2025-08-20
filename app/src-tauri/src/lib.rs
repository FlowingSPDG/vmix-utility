use tauri::tray::TrayIconBuilder;
use tauri::{
    menu::{Menu, MenuItem}, Emitter, Manager
};

// Module declarations
pub mod types;
pub mod logging;
pub mod http_client;
pub mod tcp_manager;
pub mod state;
pub mod commands;
pub mod network_scanner;

// Re-export commonly used types
pub use types::UpdateInfo;
pub use state::AppState;
pub use logging::{init_logging, LOGGING_CONFIG};

// Import all commands
use commands::*;

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
                            match tauri_plugin_updater::UpdaterExt::updater(&app_handle) {
                                Ok(updater) => {
                                    match updater.check().await {
                                        Ok(Some(update)) => {
                                            app_log!(info, "Update available from tray: {} -> {}", app_handle.package_info().version, update.version);
                                            
                                            let update_info = UpdateInfo {
                                                available: true,
                                                current_version: app_handle.package_info().version.to_string(),
                                                latest_version: Some(update.version.clone()),
                                                body: update.body.clone(),
                                            };
                                            let _ = app_handle.emit("update-available", &update_info);
                                            
                                            // Show main window when update is found
                                            if let Some(window) = app_handle.get_webview_window("main") {
                                                let _ = window.show();
                                                let _ = window.set_focus();
                                            }
                                        }
                                        Ok(None) => {
                                            app_log!(info, "No updates available from tray check");
                                            let update_info = UpdateInfo {
                                                available: false,
                                                current_version: app_handle.package_info().version.to_string(),
                                                latest_version: None,
                                                body: None,
                                            };
                                            let _ = app_handle.emit("update-checked", &update_info);
                                        }
                                        Err(e) => {
                                            app_log!(error, "Failed to check for updates from tray: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    app_log!(error, "Failed to get updater instance from tray: {}", e);
                                }
                            }
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
                
                match tauri_plugin_updater::UpdaterExt::updater(&app_handle_update) {
                    Ok(updater) => {
                        match updater.check().await {
                            Ok(Some(update)) => {
                                app_log!(info, "Update available on startup: {} -> {}", app_handle_update.package_info().version, update.version);
                                
                                // Emit event to frontend about available update
                                let update_info = UpdateInfo {
                                    available: true,
                                    current_version: app_handle_update.package_info().version.to_string(),
                                    latest_version: Some(update.version.clone()),
                                    body: update.body.clone(),
                                };
                                let _ = app_handle_update.emit("update-available", &update_info);
                            }
                            Ok(None) => {
                                app_log!(info, "No updates available on startup");
                            }
                            Err(e) => {
                                app_log!(error, "Failed to check for updates on startup: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        app_log!(error, "Failed to get updater instance on startup: {}", e);
                    }
                }
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