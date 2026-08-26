use crate::types::{
    AppInfo, AppSettings, AutoRefreshConfig, CachedUpdateStatus, ConnectionType, LoggingConfig,
    UpdateInfo, VmixConnection, VmixInput, VmixVideoListInput, VmixVideoListItem,
};
use crate::http_client::VmixClientWrapper;
use crate::state::AppState;
use crate::logging::LOGGING_CONFIG;
use crate::app_log;
use crate::network_scanner::{get_network_interfaces, scan_network_for_vmix, NetworkInterface, VmixScanResult};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, Emitter};
use chrono::{DateTime, Duration, Utc};


// Shared builder function to build VideoList inputs from vmix-rs model
pub fn build_video_lists_from_vmix(vmix_state: &vmix_rs::models::Vmix) -> Vec<VmixVideoListInput> {
    vmix_state.inputs.input.iter()
        .filter(|input| input.input_type.to_lowercase() == "videolist")
        .map(|input| {
            // Get the selected index from the input level (if available)
            let input_selected_index = input.selected_index.as_ref()
                .and_then(|s| s.parse::<i32>().ok())
                .map(|i| if i > 0 { i - 1 } else { 0 }); // Convert from 1-based to 0-based
            
            // Extract items from the list if available
            let items: Vec<VmixVideoListItem> = if let Some(ref list) = input.list {
                list.item.iter().enumerate().map(|(index, item)| {
                    // Parse enabled: Handle vmix-rs quirks - None, empty, or anything except "false" → true
                    let enabled = match item.enabled.as_ref() {
                        Some(s) => {
                            let trimmed = s.trim().to_lowercase();
                            // Handle empty strings as None (vmix-rs might return empty instead of None)
                            if trimmed.is_empty() {
                                true  // Default to enabled if empty
                            } else {
                                trimmed != "false"
                            }
                        },
                        None => true, // Default to enabled if enabled attribute is not present
                    };
                    
                    // For selected state, prioritize item-level selected attribute over input-level selected_index
                    let selected = match item.selected.as_ref() {
                        Some(s) => s.trim().to_lowercase() == "true",
                        None => {
                            // Fall back to input-level selected_index if item-level is not specified
                            if let Some(selected_idx) = input_selected_index {
                                index == selected_idx as usize
                            } else {
                                false
                            }
                        }
                    };
                    
                    app_log!(debug, "VideoList item {}: text='{}', enabled_attr={:?} -> {}, selected_attr={:?}, input_selected_index={:?}, final_selected={}", 
                        index, 
                        item.text.as_deref().unwrap_or(""), 
                        item.enabled.as_deref(), enabled,
                        item.selected.as_deref(),
                        input_selected_index,
                        selected
                    );
                    
                    VmixVideoListItem {
                        key: format!("{}_{}", input.key, index),
                        number: 0, // VideoList items don't have input numbers
                        title: item.text.clone().unwrap_or_default(),
                        input_type: "VideoListItem".to_string(),
                        state: "Available".to_string(),
                        selected,
                        enabled,
                    }
                }).collect()
            } else {
                Vec::new()
            };
            
            // Find the final selected index (0-based) for the VmixVideoListInput
            let selected_index = items.iter()
                .position(|item| item.selected)
                .map(|pos| pos as i32);
            
            VmixVideoListInput {
                key: input.key.clone(),
                number: input.number.parse().unwrap_or(0),
                title: input.title.clone(),
                input_type: input.input_type.clone(),
                state: "Running".to_string(), // Default state for VideoList
                items,
                selected_index,
            }
        })
        .collect()
}

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
    
    let http_connection = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    
    if let Some(vmix) = http_connection {
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
    } else {
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
            short_title: input.short_title.clone(),
            input_type: input.input_type.clone().unwrap_or_else(|| "Unknown".to_string()),
            state: input.state.clone().unwrap_or_else(|| "Unknown".to_string()),
        }
    }).collect();
    
    Ok(inputs)
}

// Command to get vMix VideoList inputs
#[tauri::command]
pub async fn get_vmix_video_lists(
    state: State<'_, AppState>, 
    app_handle: AppHandle,
    host: String, 
    port: Option<u16>
) -> Result<Vec<VmixVideoListInput>, String> {
    // Find existing HTTP connection
    let http_vmix = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    
    // Get raw vmix-rs state and use shared builder function
    let vmix_state = match http_vmix {
        Some(vmix) => {
            vmix.get_raw_vmix_state().await.map_err(|e| e.to_string())?
        },
        None => {
            // Try to establish new HTTP connection
            let port = port.unwrap_or(8088);
            let vmix = VmixClientWrapper::new(&host, port);
            vmix.get_raw_vmix_state().await.map_err(|e| e.to_string())?
        }
    };

    // Use shared builder function
    let video_lists = build_video_lists_from_vmix(&vmix_state);
    
    app_log!(debug, "Retrieved {} VideoLists for host: {}", video_lists.len(), host);
    
    // Check if VideoLists data has changed using cache comparison
    let video_lists_changed = {
        let mut cache_guard = state.video_lists_cache.lock().unwrap();
        let has_changed = cache_guard.get(&host)
            .map(|cached_video_lists| {
                let changed = cached_video_lists != &video_lists;
                app_log!(debug, "VideoLists comparison for {}: cached={}, new={}, changed={}", 
                    host, cached_video_lists.len(), video_lists.len(), changed);
                changed
            })
            .unwrap_or_else(|| {
                app_log!(debug, "No cached VideoLists for {}, treating as changed", host);
                true
            }); // If no cache exists, consider it as changed
        
        // Update cache with new data
        cache_guard.insert(host.clone(), video_lists.clone());
        app_log!(debug, "Updated VideoLists cache for {} with {} items", host, video_lists.len());
        has_changed
    };
    
    // Only emit update event if VideoLists have actually changed
    if video_lists_changed {
        let event_payload = serde_json::json!({
            "host": host,
            "videoLists": video_lists
        });
        
        match app_handle.emit("vmix-videolists-updated", &event_payload) {
            Ok(_) => app_log!(info, "Successfully emitted vmix-videolists-updated event for host: {} with {} lists", 
                host, video_lists.len()),
            Err(e) => app_log!(error, "Failed to emit vmix-videolists-updated event for host: {} - {}", host, e),
        }
    } else {
        app_log!(debug, "VideoLists unchanged for host: {} ({} lists), skipping event emission", 
            host, video_lists.len());
    }
    
    Ok(video_lists)
}



// Command to select VideoList item
#[tauri::command]
pub async fn select_video_list_item(
    state: State<'_, AppState>,
    host: String,
    input_number: i32,
    item_index: i32
) -> Result<(), String> {
    let params = vec![
        ("Input".to_string(), input_number.to_string()),
        ("Value".to_string(), (item_index + 1).to_string()), // Convert to 1-based index for vMix
    ].into_iter().collect();
    
    // Use the SelectIndex function to select item
    send_vmix_function(state, host, None, "SelectIndex".to_string(), Some(params)).await.map(|_| ())
}


#[tauri::command]
pub async fn connect_vmix(
    state: State<'_, AppState>, 
    app_handle: AppHandle, 
    host: String, 
    port: Option<u16>, 
) -> Result<VmixConnection, String> {
    let port = port.unwrap_or(8088);
    app_log!(info, "Attempting to connect to vMix at {}:{} via HTTP", host, port);
    
    let vmix = VmixClientWrapper::new(&host, port);
    let _status = vmix.get_status().await.map_err(|e| {
        app_log!(error, "Failed to establish HTTP connection to {}: {}", host, e);
        e.to_string()
    })?;
    
    let initial_ok = vmix.get_status().await.unwrap_or(false);
    
    if initial_ok {
        app_log!(info, "Successfully connected to vMix at {} via HTTP", host);
    } else {
        app_log!(warn, "Failed to connect to vMix at {} via HTTP", host);
    }
    
    {
        let mut http_connections = state.http_connections.lock().unwrap();
        
        if let Some(existing_index) = http_connections.iter().position(|c| c.host() == host) {
            http_connections[existing_index] = vmix;
            app_log!(debug, "Replaced existing HTTP connection for {}", host);
        } else {
            http_connections.push(vmix);
            app_log!(debug, "Added new HTTP connection for {}", host);
        }
    }
    
    let info_vmix = VmixClientWrapper::new(&host, port);
    let active_input = info_vmix.get_active_input().await.unwrap_or(0);
    let preview_input = info_vmix.get_preview_input().await.unwrap_or(0);
    let status = info_vmix.get_status().await.unwrap_or(false);
    
    let (version, edition, preset) = match info_vmix.get_vmix_data().await {
        Ok(vmix_data) => (vmix_data.version, vmix_data.edition, vmix_data.preset),
        Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None)
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
        let default_label = format!("{} (HTTP)", host);
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
        connection_type: ConnectionType::Http,
        version,
        edition,
        preset,
    })
}

#[tauri::command]
pub async fn disconnect_vmix(
    state: State<'_, AppState>, 
    app_handle: AppHandle, 
    host: String
) -> Result<(), String> {
    app_log!(info, "Disconnecting from vMix host: {}", host);
    
    
    // Disconnect from HTTP connections
    {
        let mut http_connections = state.http_connections.lock().unwrap();
        http_connections.retain(|c| c.host() != host);
    }
    
    // Clean up state
    {
        let mut configs = state.auto_refresh_configs.lock().unwrap();
        configs.remove(&host);
    }
    {
        let mut cache = state.last_status_cache.lock().unwrap();
        cache.remove(&host);
    }
    {
        let mut inputs_cache = state.inputs_cache.lock().unwrap();
        inputs_cache.remove(&host);
    }
    
    // Emit connection removal event to frontend
    let _ = app_handle.emit("vmix-connection-removed", serde_json::json!({"host": host}));
    app_log!(info, "Emitted vmix-connection-removed event for host: {}", host);
    
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
    
    let (status, active_input, preview_input, version, edition, preset) = if let Some(vmix) = http_result {
        let status = vmix.get_status().await.map_err(|e| e.to_string())?;
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        
        // Get version, edition, and preset information
        let (version, edition, preset) = match vmix.get_vmix_data().await {
            Ok(vmix_data) => (vmix_data.version, vmix_data.edition, vmix_data.preset),
            Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None)
        };
        
        (status, active_input, preview_input, version, edition, preset)
    } else {
        // 既存接続がない場合は新しいHTTP接続でテスト
        let vmix = VmixClientWrapper::new(&host, port);
        let status = vmix.get_status().await.map_err(|e| e.to_string())?;
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        
        // Get version, edition, and preset information
        let (version, edition, preset) = match vmix.get_vmix_data().await {
            Ok(vmix_data) => (vmix_data.version, vmix_data.edition, vmix_data.preset),
            Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None)
        };
        
        (status, active_input, preview_input, version, edition, preset)
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
        connection_type: ConnectionType::Http,
        version,
        edition,
        preset,
    })
}

#[tauri::command]
pub async fn get_vmix_statuses(state: State<'_, AppState>) -> Result<Vec<VmixConnection>, String> {
    let http_connections = {
        let guard = state.http_connections.lock().unwrap();
        guard.clone()
    };
    let mut statuses = Vec::new();

    // Process HTTP connections in parallel with timeout
    let http_futures: Vec<_> = http_connections.iter().map(|vmix| {
        let vmix_clone = vmix.clone();
        async move {
            let host = vmix_clone.host().to_string();
            let host_for_timeout = host.clone();
            
            // Use tokio::timeout to prevent hanging
            match tokio::time::timeout(std::time::Duration::from_millis(1000), async {
                let status = vmix_clone.get_status().await.unwrap_or(false);
                let active_input = vmix_clone.get_active_input().await.unwrap_or(0);
                let preview_input = vmix_clone.get_preview_input().await.unwrap_or(0);
                
                // Get version, edition, and preset information
                let (version, edition, preset) = match vmix_clone.get_vmix_data().await {
                    Ok(vmix_data) => (vmix_data.version, vmix_data.edition, vmix_data.preset),
                    Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None)
                };
                
                (host, status, active_input, preview_input, version, edition, preset)
            }).await {
                Ok(result) => Some(result),
                Err(_) => {
                    println!("Timeout getting status for {}", host_for_timeout);
                    None
                }
            }
        }
    }).collect();

    // Wait for all HTTP connections with timeout
    let http_results = tokio::time::timeout(
        std::time::Duration::from_millis(2000),
        futures::future::join_all(http_futures)
    ).await.unwrap_or_else(|_| vec![None; http_connections.len()]);

    // Process HTTP results — align status with last_status_cache (Reconnecting) and use cache on poll timeout
    for (i, result) in http_results.into_iter().enumerate() {
        let host = http_connections[i].host().to_string();
        let port = http_connections[i].port();
        let label = {
            let labels = state.connection_labels.lock().unwrap();
            labels
                .get(&host)
                .cloned()
                .unwrap_or_else(|| format!("{} (HTTP)", host))
        };
        let cached = {
            let cache = state.last_status_cache.lock().unwrap();
            cache.get(&host).cloned()
        };

        if let Some((_, live_ok, active_input, preview_input, version, edition, preset)) = result {
            let status_str = if live_ok {
                "Connected".to_string()
            } else if cached.as_ref().map(|c| c.status.as_str()) == Some("Reconnecting") {
                "Reconnecting".to_string()
            } else {
                "Disconnected".to_string()
            };

            statuses.push(VmixConnection {
                host,
                port,
                label,
                status: status_str,
                active_input,
                preview_input,
                connection_type: ConnectionType::Http,
                version,
                edition,
                preset,
            });
        } else if let Some(mut vmix_conn) = cached {
            vmix_conn.port = port;
            vmix_conn.label = label;
            vmix_conn.connection_type = ConnectionType::Http;
            statuses.push(vmix_conn);
        } else {
            statuses.push(VmixConnection {
                host,
                port,
                label,
                status: "Disconnected".to_string(),
                active_input: 0,
                preview_input: 0,
                connection_type: ConnectionType::Http,
                version: "Unknown".to_string(),
                edition: "Unknown".to_string(),
                preset: None,
            });
        }
    }

    Ok(statuses)
}

#[tauri::command]
pub async fn set_auto_refresh_config(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    host: String, 
    config: AutoRefreshConfig
) -> Result<(), String> {
    state.auto_refresh_configs.lock().unwrap()
        .insert(host, config);
    
    // Automatically save settings after auto refresh config update
    state.save_config(&app_handle).await?;
    
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
pub async fn set_logging_config(app_handle: AppHandle, level: String, save_to_file: bool) -> Result<(), String> {
    println!("Setting logging configuration - level: {}, save_to_file: {}", level, save_to_file);
    
    {
        let mut config = LOGGING_CONFIG.lock().unwrap();
        config.level = level.clone();
        config.save_to_file = save_to_file;
    } // ここでlockを解放
    
    // Save to config file
    let app_state = app_handle.state::<AppState>();
    app_state.save_config(&app_handle).await?;
    
    println!("Logging configuration updated and saved successfully");
    
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

// Command to open List Manager in a popup window
#[tauri::command]
pub async fn open_list_manager_window(app_handle: AppHandle) -> Result<(), String> {
    app_log!(info, "Opening List Manager popup window");
    
    // Check if window already exists
    if let Some(_) = app_handle.get_webview_window("list-manager") {
        app_log!(info, "List Manager window already exists, focusing it");
        // Focus existing window
        if let Some(window) = app_handle.get_webview_window("list-manager") {
            let _ = window.set_focus();
        }
        return Ok(());
    }
    
    // Create new List Manager window
    let webview_url = WebviewUrl::App("/list-manager".into());
    
    match WebviewWindowBuilder::new(&app_handle, "list-manager", webview_url)
        .title("List Manager")
        .inner_size(800.0, 600.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .build()
    {
        Ok(_) => {
            app_log!(info, "List Manager popup window created successfully");
            Ok(())
        }
        Err(e) => {
            app_log!(error, "Failed to create List Manager popup window: {}", e);
            Err(format!("Failed to create popup window: {}", e))
        }
    }
}

// Command to open individual VideoList in a popup window
#[tauri::command]
pub async fn open_video_list_window(
    app_handle: AppHandle,
    state: tauri::State<'_, crate::state::AppState>,
    host: String,
    list_key: String,
    list_title: String
) -> Result<(), String> {
    let start_time = std::time::Instant::now();
    app_log!(info, "🚀 Opening VideoList popup window - Host: {}, List: {} ({})", host, list_key, list_title);
    
    // Log current window registry state for debugging
    let current_windows = {
        let windows = state.video_list_windows.lock().unwrap();
        windows.len()
    };
    app_log!(debug, "📊 Current VideoList windows in registry: {}", current_windows);
    
    // Create base window ID based on host and list_key
    let base_window_id = format!("video-list-{}-{}", 
        urlencoding::encode(&host).replace("%", "").replace(".", "").replace(":", ""), 
        list_key.replace(" ", "_").replace("(", "").replace(")", ""));
    
    let mut window_id = base_window_id.clone();
    app_log!(debug, "🆔 Generated base window ID: {}", window_id);
    
    // First cleanup any stale window entries in the registry
    let cleanup_start = std::time::Instant::now();
    state.cleanup_stale_video_list_windows(&app_handle);
    app_log!(debug, "🧹 Registry cleanup completed in {:?}", cleanup_start.elapsed());
    
    // Check if window already exists and is valid
    if let Some(existing_window) = app_handle.get_webview_window(&window_id) {
        app_log!(debug, "🔍 Found existing window with ID: {}", window_id);
        
        // Verify window is also registered in our state
        let is_registered = state.get_video_list_window(&window_id).is_some();
        app_log!(debug, "�� Window {} registry status: {}", window_id, if is_registered { "✅ Registered" } else { "❌ Not registered" });
        
        // Enhanced window validity check with multiple validation methods
        let is_window_accessible = {
            // Check basic window state
            let is_visible = existing_window.is_visible().unwrap_or(false);
            let is_minimized = existing_window.is_minimized().unwrap_or(true);
            let is_closable = existing_window.is_closable().unwrap_or(false);
            let is_decorated = existing_window.is_decorated().unwrap_or(false);
            
            app_log!(debug, "🔍 Window state: visible={}, minimized={}, closable={}, decorated={}", 
                is_visible, is_minimized, is_closable, is_decorated);
            
            // Initial state checks
            let basic_state_valid = is_visible && !is_minimized && is_closable;
            
            if !basic_state_valid {
                app_log!(debug, "Window failed basic state validation");
                false
            } else {
                // Test actual window interaction to verify accessibility
                match existing_window.set_focus() {
                    Ok(_) => {
                        app_log!(debug, "Window focus test successful - window is accessible");
                        true
                    }
                    Err(e) => {
                        app_log!(warn, "Window focus test failed - window may be stale: {}", e);
                        false
                    }
                }
            }
        };
        
        if is_window_accessible {
            // Window is valid and accessible - reuse it
            let total_time = start_time.elapsed();
            app_log!(info, "✅ VideoList window already exists and is accessible, reusing window: {} (completed in {:?})", window_id, total_time);
            
            // Ensure window is properly visible and focused
            if let Err(e) = existing_window.unminimize() {
                app_log!(warn, "⚠️ Failed to unminimize existing VideoList window: {}", e);
            }
            if let Err(e) = existing_window.show() {
                app_log!(warn, "⚠️ Failed to show existing VideoList window: {}", e);
            }
            
            return Ok(());
        } else {
            // Window exists but is not accessible - try to clean it up
            app_log!(warn, "VideoList window {} exists but is not accessible, attempting cleanup", window_id);
            
            // Attempt to close the stale window
            if let Err(e) = existing_window.close() {
                app_log!(warn, "Failed to close stale window {}: {}", window_id, e);
            } else {
                app_log!(info, "Successfully closed stale window: {}", window_id);
            }
            
            // Small delay to ensure cleanup is complete
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            
            // Check if window still exists after cleanup attempt with retry logic
            let mut cleanup_attempts = 0;
            let max_cleanup_attempts = 3;
            
            while cleanup_attempts < max_cleanup_attempts {
                if app_handle.get_webview_window(&window_id).is_none() {
                    app_log!(info, "Stale window cleanup successful after {} attempts, reusing original window ID: {}", cleanup_attempts + 1, window_id);
                    break;
                }
                
                cleanup_attempts += 1;
                if cleanup_attempts < max_cleanup_attempts {
                    app_log!(warn, "Stale window {} still exists after cleanup attempt {}, retrying...", window_id, cleanup_attempts);
                    
                    // Try more aggressive cleanup
                    if let Some(stale_window) = app_handle.get_webview_window(&window_id) {
                        // Try to destroy the window more aggressively
                        let _ = stale_window.hide();
                        let _ = stale_window.close();
                    }
                    
                    // Increase delay between attempts
                    tokio::time::sleep(std::time::Duration::from_millis(200 * cleanup_attempts as u64)).await;
                } else {
                    app_log!(error, "Failed to cleanup stale window {} after {} attempts, generating new window ID", window_id, max_cleanup_attempts);
                    
                    // Generate a more robust unique window ID
                    use std::time::{SystemTime, UNIX_EPOCH};
                    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
                    let process_id = std::process::id();
                    let thread_id = std::thread::current().id();
                    let unique_suffix = format!("{:?}", thread_id).chars().filter(|c| c.is_alphanumeric()).take(4).collect::<String>();
                    window_id = format!("{}-{}-{}-{}", base_window_id, timestamp, process_id, unique_suffix);
                    app_log!(info, "Generated robust new window ID to avoid persistent stale window conflict: {}", window_id);
                    
                    // Also clean up the registry entry for the old window
                    state.unregister_video_list_window(&base_window_id);
                }
            }
        }
    } else {
        app_log!(debug, "No existing window found with ID: {}", window_id);
    }
    
    // Final validation: ensure the window ID is truly available
    if app_handle.get_webview_window(&window_id).is_some() {
        app_log!(warn, "Window ID {} still exists despite cleanup, generating final fallback ID", window_id);
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        window_id = format!("{}-fallback-{}", base_window_id, timestamp);
    }
    
    let creation_start = std::time::Instant::now();
    app_log!(info, "🏗️ Creating new VideoList window with ID: {}", window_id);
    
    // Create URL with query parameters
    let webview_url = WebviewUrl::App(format!("/list-manager?host={}&listKey={}", 
        urlencoding::encode(&host), 
        urlencoding::encode(&list_key)
    ).into());
    
    let window_title = format!("VideoList: {}", list_title);
    app_log!(debug, "🌐 Window URL: {:?}, Title: {}", webview_url, window_title);
    
    match WebviewWindowBuilder::new(&app_handle, &window_id, webview_url)
        .title(&window_title)
        .inner_size(600.0, 500.0)
        .min_inner_size(400.0, 300.0)
        .resizable(true)
        .build()
    {
        Ok(window) => {
            let creation_time = creation_start.elapsed();
            let total_time = start_time.elapsed();
            app_log!(info, "✅ VideoList popup window created successfully: {} (creation: {:?}, total: {:?})", window_title, creation_time, total_time);
            
            // Register the window in the state registry
            state.register_video_list_window(
                window_id.clone(),
                host.clone(),
                list_key.clone(),
                list_title.clone()
            );
            app_log!(debug, "📝 Window registered in state registry");
            
            // Set up window close event handling
            let app_handle_clone = app_handle.clone();
            let window_id_clone = window_id.clone();
            window.on_window_event(move |event| {
                match event {
                    tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                        app_log!(info, "🗑️ VideoList window closing/destroyed, unregistering: {}", window_id_clone);
                        // Get state from app handle to avoid lifetime issues
                        if let Some(state) = app_handle_clone.try_state::<crate::state::AppState>() {
                            state.unregister_video_list_window(&window_id_clone);
                        }
                    }
                    _ => {}
                }
            });
            app_log!(debug, "🎭 Window event handlers set up");
            
            // Log final registry state
            let final_windows = {
                let windows = state.video_list_windows.lock().unwrap();
                windows.len()
            };
            app_log!(debug, "📊 Final VideoList windows in registry: {}", final_windows);
            
            Ok(())
        }
        Err(e) => {
            let total_time = start_time.elapsed();
            app_log!(error, "❌ Failed to create VideoList popup window after {:?}: {}", total_time, e);
            app_log!(debug, "🐛 Window creation failure details - ID: {}, Host: {}, ListKey: {}", window_id, host, list_key);
            Err(format!("Failed to create popup window: {}", e))
        }
    }
}

// Diagnostic command for VideoList window troubleshooting
#[tauri::command]
pub async fn get_video_list_windows_diagnostic(
    app_handle: AppHandle,
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<serde_json::Value, String> {
    app_log!(info, "🔧 Generating VideoList windows diagnostic information");
    
    let mut diagnostic = serde_json::Map::new();
    
    // Get registry information
    let registry_info = {
        let windows = state.video_list_windows.lock().unwrap();
        let mut reg_info = serde_json::Map::new();
        
        reg_info.insert("total_registered".to_string(), serde_json::Value::Number(windows.len().into()));
        
        let mut windows_list = Vec::new();
        for (window_id, window_info) in windows.iter() {
            let mut window_data = serde_json::Map::new();
            window_data.insert("window_id".to_string(), serde_json::Value::String(window_id.clone()));
            window_data.insert("host".to_string(), serde_json::Value::String(window_info.host.clone()));
            window_data.insert("list_key".to_string(), serde_json::Value::String(window_info.list_key.clone()));
            window_data.insert("list_title".to_string(), serde_json::Value::String(window_info.list_title.clone()));
            window_data.insert("created_ago_ms".to_string(), 
                serde_json::Value::Number((window_info.created_at.elapsed().as_millis() as u64).into()));
            
            // Check if window actually exists in Tauri
            let tauri_exists = app_handle.get_webview_window(window_id).is_some();
            window_data.insert("exists_in_tauri".to_string(), serde_json::Value::Bool(tauri_exists));
            
            if let Some(tauri_window) = app_handle.get_webview_window(window_id) {
                let mut tauri_state = serde_json::Map::new();
                tauri_state.insert("visible".to_string(), serde_json::Value::Bool(tauri_window.is_visible().unwrap_or(false)));
                tauri_state.insert("minimized".to_string(), serde_json::Value::Bool(tauri_window.is_minimized().unwrap_or(false)));
                tauri_state.insert("closable".to_string(), serde_json::Value::Bool(tauri_window.is_closable().unwrap_or(false)));
                tauri_state.insert("decorated".to_string(), serde_json::Value::Bool(tauri_window.is_decorated().unwrap_or(false)));
                window_data.insert("tauri_state".to_string(), serde_json::Value::Object(tauri_state));
            }
            
            windows_list.push(serde_json::Value::Object(window_data));
        }
        
        reg_info.insert("windows".to_string(), serde_json::Value::Array(windows_list));
        reg_info
    };
    
    diagnostic.insert("registry".to_string(), serde_json::Value::Object(registry_info));
    
    // Get all Tauri windows (to identify orphaned windows)
    let tauri_windows: Vec<String> = app_handle.webview_windows()
        .into_iter()
        .filter_map(|(label, _)| {
            if label.starts_with("video-list-") {
                Some(label)
            } else {
                None
            }
        })
        .collect();
    
    diagnostic.insert("tauri_video_list_windows".to_string(), serde_json::Value::Array(
        tauri_windows.into_iter().map(|s| serde_json::Value::String(s)).collect()
    ));
    
    // System information
    let mut system_info = serde_json::Map::new();
    system_info.insert("timestamp".to_string(), serde_json::Value::String(
        chrono::Utc::now().to_rfc3339()
    ));
    system_info.insert("process_id".to_string(), serde_json::Value::Number(std::process::id().into()));
    
    diagnostic.insert("system".to_string(), serde_json::Value::Object(system_info));
    
    app_log!(debug, "🔧 VideoList diagnostic completed");
    Ok(serde_json::Value::Object(diagnostic))
}

const UPDATE_STATUS_EVENT: &str = "update-status-changed";

fn store_and_emit_update_status(app_handle: &AppHandle, status: CachedUpdateStatus) {
    let state = app_handle.state::<AppState>();
    *state.update_status.lock().unwrap() = status.clone();
    if let Err(e) = app_handle.emit(UPDATE_STATUS_EVENT, &status) {
        app_log!(error, "Failed to emit {}: {}", UPDATE_STATUS_EVENT, e);
    }
}

pub async fn perform_update_check(app_handle: &AppHandle) -> Result<UpdateInfo, String> {
    app_log!(info, "Checking for updates...");

    let current_version = app_handle.package_info().version.to_string();

    app_log!(info, "Current platform: {:?}", std::env::consts::OS);
    app_log!(info, "Current architecture: {:?}", std::env::consts::ARCH);
    app_log!(info, "Target triple: {:?}", std::env::var("TARGET").unwrap_or_else(|_| "unknown".to_string()));

    let result = match tauri_plugin_updater::UpdaterExt::updater(app_handle) {
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
    };

    match &result {
        Ok(info) => {
            store_and_emit_update_status(app_handle, CachedUpdateStatus {
                checked: true,
                info: Some(info.clone()),
                error: None,
            });
        }
        Err(e) => {
            store_and_emit_update_status(app_handle, CachedUpdateStatus {
                checked: true,
                info: None,
                error: Some(e.clone()),
            });
        }
    }

    result
}

#[tauri::command]
pub async fn check_for_updates(app_handle: AppHandle) -> Result<UpdateInfo, String> {
    perform_update_check(&app_handle).await
}

#[tauri::command]
pub async fn get_update_info(state: State<'_, AppState>) -> Result<CachedUpdateStatus, String> {
    Ok(state.update_status.lock().unwrap().clone())
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

#[tauri::command]
pub async fn get_network_interfaces_command() -> Result<Vec<NetworkInterface>, String> {
    app_log!(info, "Getting network interfaces...");
    
    match get_network_interfaces() {
        Ok(interfaces) => {
            app_log!(info, "Found {} network interfaces", interfaces.len());
            Ok(interfaces)
        }
        Err(e) => {
            app_log!(error, "Failed to get network interfaces: {}", e);
            Err(format!("Failed to get network interfaces: {}", e))
        }
    }
}

#[tauri::command]
pub async fn scan_network_for_vmix_command(
    interface_name: String,
    state: State<'_, AppState>
) -> Result<Vec<VmixScanResult>, String> {
    app_log!(info, "Starting vMix network scan for interface: {}", interface_name);
    
    // セキュリティ警告をログに記録
    app_log!(warn, "⚠️  NETWORK SCAN WARNING: Scanning network interface '{}' for vMix instances", interface_name);
    app_log!(warn, "⚠️  This operation will attempt to connect to all IP addresses in the subnet");
    
    match scan_network_for_vmix(interface_name.clone(), &state).await {
        Ok(results) => {
            let vmix_count = results.iter().filter(|r| r.is_vmix).count();
            app_log!(info, "Network scan completed for interface '{}': found {} vMix instances", interface_name, vmix_count);
            Ok(results)
        }
        Err(e) => {
            app_log!(error, "Failed to scan network for vMix: {}", e);
            Err(format!("Failed to scan network for vMix: {}", e))
        }
    }
}

#[tauri::command]
pub async fn should_show_donation_prompt(
    state: State<'_, AppState>
) -> Result<bool, String> {
    let prompt_config = state.donation_prompt.lock().unwrap();

    // If permanently dismissed, don't show
    if prompt_config.permanently_dismissed {
        app_log!(debug, "Donation prompt permanently dismissed");
        return Ok(false);
    }

    // If never shown before, show it
    if prompt_config.last_shown.is_none() {
        app_log!(info, "Donation prompt: first time, should show");
        return Ok(true);
    }

    // Check if 30 days have passed since last shown
    if let Some(ref last_shown_str) = prompt_config.last_shown {
        match DateTime::parse_from_rfc3339(last_shown_str) {
            Ok(last_shown) => {
                let now = Utc::now();
                let duration_since_last = now.signed_duration_since(last_shown.with_timezone(&Utc));

                // Show if 30 days (or more) have passed
                if duration_since_last >= Duration::days(30) {
                    app_log!(info, "Donation prompt: 30 days passed, should show");
                    Ok(true)
                } else {
                    app_log!(debug, "Donation prompt: shown {} days ago, not showing yet", duration_since_last.num_days());
                    Ok(false)
                }
            }
            Err(e) => {
                app_log!(error, "Failed to parse last_shown timestamp: {}", e);
                // If timestamp is invalid, treat as first time
                Ok(true)
            }
        }
    } else {
        Ok(true)
    }
}

#[tauri::command]
pub async fn dismiss_donation_prompt(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    permanently: bool
) -> Result<(), String> {
    app_log!(info, "Dismissing donation prompt (permanently: {})", permanently);

    {
        let mut prompt_config = state.donation_prompt.lock().unwrap();

        // Update last_shown to current time
        prompt_config.last_shown = Some(Utc::now().to_rfc3339());

        // Set permanently_dismissed flag if requested
        if permanently {
            prompt_config.permanently_dismissed = true;
            app_log!(info, "Donation prompt permanently dismissed");
        }
    }

    // Save config to persist the changes
    state.save_config(&app_handle).await?;

    Ok(())
}