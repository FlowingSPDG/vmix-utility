use crate::types::{
    AppInfo, AppSettings, AutoRefreshConfig, ConnectionType, LoggingConfig,
    UpdateInfo, VmixConnection, VmixInput,
};
use crate::http_client::VmixClientWrapper;
use crate::tcp_manager::TcpVmixManager;
use crate::state::AppState;
use crate::logging::LOGGING_CONFIG;
use crate::app_log;
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State};

// Additional Tauri command for sending vMix functions
#[tauri::command]
pub async fn send_vmix_function(
    state: State<'_, AppState>, 
    host: String, 
    port: Option<u16>, 
    function_name: String, 
    params: Option<HashMap<String, String>>
) -> Result<String, String> {
    let params_map = params.unwrap_or_default();
    
    app_log!(info, "Sending vMix function command: {} to host: {}", function_name, host);
    
    // First check if connection exists (HTTP or TCP)
    let http_connection = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    
    let tcp_connection = {
        let tcp_connections = state.tcp_connections.lock().unwrap();
        tcp_connections.iter().find(|c| c.host() == host).cloned()
    };
    
    if let Some(vmix) = http_connection {
        // Use existing HTTP connection
        match vmix.send_function(&function_name, &params_map).await {
            Ok(_) => {
                app_log!(info, "vMix function command sent successfully via HTTP: {}", function_name);
                Ok("Function sent successfully".to_string())
            }
            Err(e) => {
                app_log!(error, "Failed to send vMix function command via HTTP: {} - {}", function_name, e);
                Err(e.to_string())
            }
        }
    } else if let Some(tcp) = tcp_connection {
        // Use existing TCP connection
        match tcp.send_function(&function_name, &params_map).await {
            Ok(_) => {
                app_log!(info, "vMix function command sent successfully via TCP: {}", function_name);
                Ok("Function sent successfully".to_string())
            }
            Err(e) => {
                app_log!(error, "Failed to send vMix function command via TCP: {} - {}", function_name, e);
                Err(e.to_string())
            }
        }
    } else {
        // No existing connection, create new HTTP connection (default)
        let port = port.unwrap_or(8088);
        let new_vmix = VmixClientWrapper::new(&host, port);
        match new_vmix.send_function(&function_name, &params_map).await {
            Ok(_) => {
                app_log!(info, "vMix function command sent successfully to new HTTP connection: {}", function_name);
                Ok("Function sent successfully".to_string())
            }
            Err(e) => {
                app_log!(error, "Failed to send vMix function command to new HTTP connection: {} - {}", function_name, e);
                Err(e.to_string())
            }
        }
    }
}

// Command to get vMix inputs
#[tauri::command]
pub async fn get_vmix_inputs(
    state: State<'_, AppState>, 
    host: String, 
    port: Option<u16>
) -> Result<Vec<VmixInput>, String> {
    // Find existing HTTP connection
    let http_vmix = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    
    // For TCP connections, use cached data
    let tcp_exists = {
        let tcp_connections = state.tcp_connections.lock().unwrap();
        tcp_connections.iter().any(|c| c.host() == host)
    };
    
    if tcp_exists {
        // TCP接続の場合はキャッシュから取得
        let cached_inputs = {
            let inputs_cache = state.inputs_cache.lock().unwrap();
            inputs_cache.get(&host).cloned().unwrap_or_default()
        };
        return Ok(cached_inputs);
    }
    
    let vmix_data = match http_vmix {
        Some(vmix) => vmix.get_vmix_data().await.map_err(|e| e.to_string())?,
        None => {
            // Try to establish new HTTP connection
            let port = port.unwrap_or(8088);
            let vmix = VmixClientWrapper::new(&host, port);
            vmix.get_vmix_data().await.map_err(|e| e.to_string())?
        }
    };
    
    let inputs: Vec<VmixInput> = vmix_data.inputs.input.iter().map(|input| {
        VmixInput {
            key: input.key.clone(),
            number: input.number.parse().unwrap_or(0),
            title: input.title.clone(),
            input_type: input.input_type.clone().unwrap_or_else(|| "Unknown".to_string()),
            state: input.state.clone().unwrap_or_else(|| "Unknown".to_string()),
        }
    }).collect();
    
    Ok(inputs)
}

#[tauri::command]
pub async fn connect_vmix(
    state: State<'_, AppState>, 
    app_handle: AppHandle, 
    host: String, 
    port: Option<u16>, 
    connection_type: ConnectionType
) -> Result<VmixConnection, String> {
    let port = port.unwrap_or(8088);
    app_log!(info, "Attempting to connect to vMix at {}:{} via {:?}", host, port, connection_type);
    
    match connection_type {
        ConnectionType::Http => {
            let vmix = VmixClientWrapper::new(&host, port);
            let _status = vmix.get_status().await.map_err(|e| {
                app_log!(error, "Failed to establish HTTP connection to {}: {}", host, e);
                e.to_string()
            })?;
            
            let status = vmix.get_status().await.unwrap_or(false);
            
            if status {
                app_log!(info, "Successfully connected to vMix at {} via HTTP", host);
            } else {
                app_log!(warn, "Failed to connect to vMix at {} via HTTP", host);
            }
            
            // Check if this host is already connected (HTTP)
            {
                let mut http_connections = state.http_connections.lock().unwrap();
                
                if let Some(existing_index) = http_connections.iter().position(|c| c.host() == host) {
                    // Replace existing connection (for reconnection)
                    http_connections[existing_index] = vmix;
                    app_log!(debug, "Replaced existing HTTP connection for {}", host);
                } else {
                    // Add new connection
                    http_connections.push(vmix);
                    app_log!(debug, "Added new HTTP connection for {}", host);
                }
            }
        },
        ConnectionType::Tcp => {
            let tcp_manager = TcpVmixManager::new(&host, port).await.map_err(|e| {
                app_log!(error, "Failed to establish TCP connection to {}: {}", host, e);
                e.to_string()
            })?;
            
            if tcp_manager.is_connected() {
                app_log!(info, "Successfully connected to vMix at {} via TCP", host);
            } else {
                app_log!(warn, "Failed to connect to vMix at {} via TCP", host);
                return Err("TCP connection failed".to_string());
            }
            
            // Start monitoring task
            tcp_manager.start_monitoring(app_handle.clone(), state.clone());
            
            // Check if this host is already connected (TCP)
            {
                let mut tcp_connections = state.tcp_connections.lock().unwrap();
                
                if let Some(existing_index) = tcp_connections.iter().position(|c| c.host() == host) {
                    // Shutdown existing connection and replace
                    tcp_connections[existing_index].shutdown();
                    tcp_connections[existing_index] = tcp_manager;
                    app_log!(debug, "Replaced existing TCP connection for {}", host);
                } else {
                    // Add new connection
                    tcp_connections.push(tcp_manager);
                    app_log!(debug, "Added new TCP connection for {}", host);
                }
            }
        }
    }
    
    // Get connection info based on type
    let (active_input, preview_input, status) = match connection_type {
        ConnectionType::Http => {
            let info_vmix = VmixClientWrapper::new(&host, port);
            let active = info_vmix.get_active_input().await.unwrap_or(0);
            let preview = info_vmix.get_preview_input().await.unwrap_or(0);
            let status = info_vmix.get_status().await.unwrap_or(false);
            (active, preview, status)
        },
        ConnectionType::Tcp => {
            // TCPの場合はバックグラウンドタスクで状態更新されるので初期値を返す
            (1, 1, true)
        }
    };
    
    // Initialize or update auto-refresh config
    {
        let mut configs = state.auto_refresh_configs.lock().unwrap();
        if !configs.contains_key(&host) {
            configs.insert(host.clone(), AutoRefreshConfig::default());
        }
    }
    
    let label = {
        let labels = state.connection_labels.lock().unwrap();
        let default_label = match connection_type {
            ConnectionType::Http => format!("{} (HTTP)", host),
            ConnectionType::Tcp => format!("{} (TCP)", host),
        };
        labels.get(&host).cloned().unwrap_or(default_label)
    };
    
    // Save configuration after connection change
    let _ = state.save_config(&app_handle).await;
    
    Ok(VmixConnection {
        host: host.clone(),
        port,
        label,
        status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
        active_input,
        preview_input,
        connection_type: connection_type,
    })
}

#[tauri::command]
pub async fn disconnect_vmix(
    state: State<'_, AppState>, 
    app_handle: AppHandle, 
    host: String
) -> Result<(), String> {
    // Disconnect from HTTP connections
    {
        let mut http_connections = state.http_connections.lock().unwrap();
        http_connections.retain(|c| c.host() != host);
    }
    // Disconnect from TCP connections
    {
        let mut tcp_connections = state.tcp_connections.lock().unwrap();
        if let Some(pos) = tcp_connections.iter().position(|c| c.host() == host) {
            tcp_connections[pos].shutdown();
            tcp_connections.remove(pos);
        }
    }
    {
        let mut configs = state.auto_refresh_configs.lock().unwrap();
        configs.remove(&host);
    }
    {
        let mut cache = state.last_status_cache.lock().unwrap();
        cache.remove(&host);
    }
    
    // Save configuration after disconnection
    let _ = state.save_config(&app_handle).await;
    
    Ok(())
}

#[tauri::command]
pub async fn get_vmix_status(
    state: State<'_, AppState>, 
    host: String, 
    port: Option<u16>
) -> Result<VmixConnection, String> {
    let port = port.unwrap_or(8088);
    
    // Try to find in HTTP connections first
    let http_result = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    
    // Try to find in TCP connections
    let tcp_result = {
        let tcp_connections = state.tcp_connections.lock().unwrap();
        tcp_connections.iter().find(|c| c.host() == host).map(|c| (c.is_connected(), ConnectionType::Tcp))
    };
    
    let (status, active_input, preview_input, conn_type) = if let Some(vmix) = http_result {
        let status = vmix.get_status().await.map_err(|e| e.to_string())?;
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        (status, active_input, preview_input, ConnectionType::Http)
    } else if let Some((tcp_status, conn_type)) = tcp_result {
        // TCPの場合はキャッシュから取得
        let cached_connection = {
            let cache = state.last_status_cache.lock().unwrap();
            cache.get(&host).cloned()
        };
        
        if let Some(cached) = cached_connection {
            (tcp_status, cached.active_input, cached.preview_input, conn_type)
        } else {
            (tcp_status, 1, 1, conn_type)
        }
    } else {
        // 既存接続がない場合は新しいHTTP接続でテスト
        let vmix = VmixClientWrapper::new(&host, port);
        let status = vmix.get_status().await.map_err(|e| e.to_string())?;
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        (status, active_input, preview_input, ConnectionType::Http)
    };
    
    let label = {
        let labels = state.connection_labels.lock().unwrap();
        labels.get(&host).cloned().unwrap_or_else(|| host.clone())
    };
    
    Ok(VmixConnection {
        host: host.clone(),
        port,
        label,
        status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
        active_input,
        preview_input,
        connection_type: conn_type,
    })
}

#[tauri::command]
pub async fn get_vmix_statuses(state: State<'_, AppState>) -> Result<Vec<VmixConnection>, String> {
    let http_connections = {
        let guard = state.http_connections.lock().unwrap();
        guard.clone()
    };
    let tcp_connections = {
        let guard = state.tcp_connections.lock().unwrap();
        guard.iter().map(|c| (c.host().to_string(), c.port(), c.is_connected())).collect::<Vec<_>>()
    };
    let mut statuses = Vec::new();

    // Process HTTP connections
    for vmix in http_connections.iter() {
        let status = vmix.get_status().await.unwrap_or(false);
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        let host = vmix.host().to_string();
        
        let label = {
            let labels = state.connection_labels.lock().unwrap();
            labels.get(&host).cloned().unwrap_or_else(|| format!("{} (HTTP)", host))
        };
        
        statuses.push(VmixConnection {
            host,
            port: vmix.port(),
            label,
            status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
            active_input,
            preview_input,
            connection_type: ConnectionType::Http,
        });
    }
    
    // Process TCP connections
    for (host, port, tcp_status) in tcp_connections {
        let label = {
            let labels = state.connection_labels.lock().unwrap();
            labels.get(&host).cloned().unwrap_or_else(|| format!("{} (TCP)", host))
        };
        
        // TCPの詳細情報はキャッシュから取得
        let (active_input, preview_input) = {
            let cache = state.last_status_cache.lock().unwrap();
            if let Some(cached) = cache.get(&host) {
                (cached.active_input, cached.preview_input)
            } else {
                (1, 1)
            }
        };
        
        statuses.push(VmixConnection {
            host,
            port,
            label,
            status: if tcp_status { "Connected".to_string() } else { "Disconnected".to_string() },
            active_input,
            preview_input,
            connection_type: ConnectionType::Tcp,
        });
    }

    Ok(statuses)
}

#[tauri::command]
pub async fn set_auto_refresh_config(
    state: State<'_, AppState>, 
    host: String, 
    config: AutoRefreshConfig
) -> Result<(), String> {
    state.auto_refresh_configs.lock().unwrap()
        .insert(host, config);
    Ok(())
}

#[tauri::command]
pub async fn get_auto_refresh_config(
    state: State<'_, AppState>, 
    host: String
) -> Result<AutoRefreshConfig, String> {
    Ok(state.auto_refresh_configs.lock().unwrap()
        .get(&host)
        .cloned()
        .unwrap_or_default())
}

#[tauri::command]
pub async fn get_all_auto_refresh_configs(
    state: State<'_, AppState>
) -> Result<HashMap<String, AutoRefreshConfig>, String> {
    Ok(state.auto_refresh_configs.lock().unwrap().clone())
}

#[tauri::command]
pub async fn update_connection_label(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    host: String,
    label: String
) -> Result<(), String> {
    state.connection_labels.lock().unwrap()
        .insert(host, label);
    
    // Automatically save settings after label update
    state.save_config(&app_handle).await?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_connection_labels(
    state: State<'_, AppState>
) -> Result<HashMap<String, String>, String> {
    Ok(state.connection_labels.lock().unwrap().clone())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    app_handle: AppHandle
) -> Result<(), String> {
    state.save_config(&app_handle).await
}

#[tauri::command]
pub async fn set_logging_config(level: String, save_to_file: bool) -> Result<(), String> {
    println!("Setting logging configuration - level: {}, save_to_file: {}", level, save_to_file);
    
    {
        let mut config = LOGGING_CONFIG.lock().unwrap();
        config.level = level.clone();
        config.save_to_file = save_to_file;
    } // ここでlockを解放
    
    println!("Logging configuration updated successfully");
    
    Ok(())
}

#[tauri::command]
pub async fn get_logging_config() -> Result<LoggingConfig, String> {
    let config = LOGGING_CONFIG.lock().unwrap();
    Ok(config.clone())
}

#[tauri::command]
pub async fn save_app_settings(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    settings: AppSettings
) -> Result<(), String> {
    app_log!(info, "Saving app settings: {:?}", settings);
    
    // Update app settings in state
    {
        let mut app_settings = state.app_settings.lock().unwrap();
        *app_settings = settings;
    }
    
    // Save to config file
    match state.save_config(&app_handle).await {
        Ok(_) => {
            app_log!(info, "App settings saved successfully");
            Ok(())
        }
        Err(e) => {
            app_log!(error, "Failed to save app settings: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.app_settings.lock().unwrap();
    Ok(settings.clone())
}

#[tauri::command]
pub async fn get_app_info(app_handle: AppHandle) -> Result<AppInfo, String> {
    let version = app_handle.package_info().version.to_string();
    let git_commit_hash = env!("GIT_COMMIT_HASH").to_string();
    let git_branch = env!("GIT_BRANCH").to_string();
    let build_timestamp = env!("BUILD_TIMESTAMP").to_string();
    
    Ok(AppInfo {
        version,
        git_commit_hash,
        git_branch,
        build_timestamp,
    })
}

#[tauri::command]
pub async fn open_logs_directory(app_handle: AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_data_dir.join("logs");
    
    // Create logs directory if it doesn't exist
    if !logs_dir.exists() {
        std::fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    }
    
    // Use tauri-plugin-opener to open the directory
    tauri_plugin_opener::open_path(&logs_dir, None::<&str>).map_err(|e| e.to_string())?;
    
    println!("Opened logs directory: {:?}", logs_dir);
    
    Ok(())
}

#[tauri::command]
pub async fn check_for_updates(app_handle: AppHandle) -> Result<UpdateInfo, String> {
    app_log!(info, "Checking for updates...");
    
    let current_version = app_handle.package_info().version.to_string();
    
    match tauri_plugin_updater::UpdaterExt::updater(&app_handle) {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    app_log!(info, "Update available: {} -> {}", current_version, update.version);
                    Ok(UpdateInfo {
                        available: true,
                        current_version,
                        latest_version: Some(update.version.clone()),
                        body: update.body.clone(),
                    })
                }
                Ok(None) => {
                    app_log!(info, "No updates available");
                    Ok(UpdateInfo {
                        available: false,
                        current_version,
                        latest_version: None,
                        body: None,
                    })
                }
                Err(e) => {
                    app_log!(error, "Failed to check for updates: {}", e);
                    Err(format!("Failed to check for updates: {}", e))
                }
            }
        }
        Err(e) => {
            app_log!(error, "Failed to get updater instance: {}", e);
            Err(format!("Failed to get updater instance: {}", e))
        }
    }
}

#[tauri::command]
pub async fn install_update(app_handle: AppHandle) -> Result<(), String> {
    app_log!(info, "Starting update installation...");
    
    match tauri_plugin_updater::UpdaterExt::updater(&app_handle) {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    app_log!(info, "Installing update: {}", update.version);
                    match update.download_and_install(|chunk_length, content_length| {
                        app_log!(debug, "Downloaded {} of {} bytes", chunk_length, content_length.unwrap_or(0));
                    }, || {
                        app_log!(info, "Update downloaded successfully, restarting application...");
                    }).await {
                        Ok(_) => {
                            app_log!(info, "Update installed successfully");
                            Ok(())
                        }
                        Err(e) => {
                            app_log!(error, "Failed to install update: {}", e);
                            Err(format!("Failed to install update: {}", e))
                        }
                    }
                }
                Ok(None) => {
                    Err("No update available".to_string())
                }
                Err(e) => {
                    app_log!(error, "Failed to check for updates during installation: {}", e);
                    Err(format!("Failed to check for updates: {}", e))
                }
            }
        }
        Err(e) => {
            app_log!(error, "Failed to get updater instance for installation: {}", e);
            Err(format!("Failed to get updater instance: {}", e))
        }
    }
}