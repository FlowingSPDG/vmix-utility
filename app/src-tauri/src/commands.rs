use crate::types::{
    AppInfo, AppSettings, AutoRefreshConfig, ConnectionType, LoggingConfig,
    UpdateInfo, VmixConnection, VmixInput, VmixVideoListInput, VmixVideoListItem,
};
use crate::http_client::VmixClientWrapper;
use crate::tcp_manager::TcpVmixManager;
use crate::state::AppState;
use crate::logging::LOGGING_CONFIG;
use crate::app_log;
use crate::network_scanner::{get_network_interfaces, scan_network_for_vmix, NetworkInterface, VmixScanResult};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

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

                    VmixVideoListItem {
                        key: item.text.clone().unwrap_or_else(|| format!("item_{}", index)),
                        number: index as i32 + 1, // 1-based indexing for display
                        title: item.text.clone().unwrap_or_else(|| format!("Item {}", index + 1)),
                        input_type: "VideoListItem".to_string(),
                        state: "Running".to_string(), // Default state for video list items
                        selected,
                        enabled,
                    }
                }).collect()
            } else {
                Vec::new()
            };

            VmixVideoListInput {
                key: input.key.clone(),
                number: input.number.parse().unwrap_or(0),
                title: input.title.clone(),
                input_type: input.input_type.clone(),
                state: match &input.state {
                    vmix_rs::models::State::Running => "Running".to_string(),
                    vmix_rs::models::State::Paused => "Paused".to_string(),
                    vmix_rs::models::State::Completed => "Completed".to_string(),
                },
                items,
                selected_index: input_selected_index,
            }
        })
        .collect()
}

#[tauri::command]
pub async fn connect_vmix(host: String, port: u16, connection_type: ConnectionType, state: State<'_, AppState>, _app_handle: AppHandle) -> Result<(), String> {
    match connection_type {
        ConnectionType::Http => {
            let vmix_client = VmixClientWrapper::new(&host, port);
            
            match vmix_client.get_status().await {
                Ok(is_connected) => {
                    if is_connected {
                        // Add to HTTP connections
                        {
                            let mut connections = state.http_connections.lock().unwrap();
                            // Remove any existing connection to the same host
                            connections.retain(|c| c.host() != host);
                            connections.push(vmix_client);
                        }
                        
                        // Initialize auto-refresh config for this host
                        {
                            let mut auto_configs = state.auto_refresh_configs.lock().unwrap();
                            if !auto_configs.contains_key(&host) {
                                auto_configs.insert(host.clone(), AutoRefreshConfig::default());
                            }
                        }
                        
                        // Set default label for this connection
                        {
                            let mut labels = state.connection_labels.lock().unwrap();
                            if !labels.contains_key(&host) {
                                labels.insert(host.clone(), format!("{} (HTTP)", host));
                            }
                        }
                        
                        app_log!(info, "Successfully connected to vMix at {}:{} via HTTP", host, port);
                        Ok(())
                    } else {
                        Err(format!("Failed to establish HTTP connection to vMix at {}:{}", host, port))
                    }
                },
                Err(e) => Err(format!("Failed to connect to vMix via HTTP: {}", e))
            }
        },
        ConnectionType::Tcp => {
            match TcpVmixManager::new(&host, port).await {
                Ok(tcp_manager) => {
                    // Add to TCP connections first
                    {
                        let mut connections = state.tcp_connections.lock().unwrap();
                        // Remove any existing connection to the same host
                        connections.retain(|c| c.host() != host);
                        connections.push(tcp_manager.clone());
                    }
                    
                    // Initialize auto-refresh config for this host
                    {
                        let mut auto_configs = state.auto_refresh_configs.lock().unwrap();
                        if !auto_configs.contains_key(&host) {
                            auto_configs.insert(host.clone(), AutoRefreshConfig::default());
                        }
                    }
                    
                    // Set default label for this connection
                    {
                        let mut labels = state.connection_labels.lock().unwrap();
                        if !labels.contains_key(&host) {
                            labels.insert(host.clone(), format!("{} (TCP)", host));
                        }
                    }
                    
                    app_log!(info, "Successfully connected to vMix at {}:{} via TCP", host, port);
                    Ok(())
                },
                Err(e) => Err(format!("Failed to connect to vMix via TCP: {}", e))
            }
        }
    }
}

#[tauri::command]
pub async fn disconnect_vmix(host: String, state: State<'_, AppState>) -> Result<(), String> {
    app_log!(info, "Disconnecting vMix at {}", host);
    
    // Remove from HTTP connections
    {
        let mut connections = state.http_connections.lock().unwrap();
        let before_count = connections.len();
        connections.retain(|c| c.host() != host);
        let after_count = connections.len();
        if before_count != after_count {
            app_log!(info, "Removed HTTP connection for {}", host);
        }
    }
    
    // Remove from TCP connections and shutdown
    {
        let mut connections = state.tcp_connections.lock().unwrap();
        let mut to_remove = Vec::new();
        for (index, conn) in connections.iter().enumerate() {
            if conn.host() == host {
                conn.shutdown();
                to_remove.push(index);
                app_log!(info, "Shutdown TCP connection for {}", host);
            }
        }
        // Remove in reverse order to maintain indices
        for index in to_remove.iter().rev() {
            connections.remove(*index);
        }
    }
    
    // Clean up cache data
    {
        let mut cache = state.last_status_cache.lock().unwrap();
        cache.remove(&host);
    }
    {
        let mut inputs_cache = state.inputs_cache.lock().unwrap();
        inputs_cache.remove(&host);
    }
    {
        let mut video_lists_cache = state.video_lists_cache.lock().unwrap();
        video_lists_cache.remove(&host);
    }
    
    app_log!(info, "Successfully disconnected from vMix at {}", host);
    Ok(())
}

#[tauri::command]
pub async fn get_vmix_status(host: String, state: State<'_, AppState>) -> Result<Option<VmixConnection>, String> {
    // Try HTTP connection first
    let vmix = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    if let Some(vmix) = vmix {
        
        match vmix.get_status().await {
            Ok(status) => {
                if status {
                    let active_input = vmix.get_active_input().await.unwrap_or(1);
                    let preview_input = vmix.get_preview_input().await.unwrap_or(1);
                    
                    let label = {
                        let labels = state.connection_labels.lock().unwrap();
                        labels.get(&host).cloned().unwrap_or_else(|| format!("{} (HTTP)", host))
                    };
                    
                    // Get version/edition from vMix data
                    let (version, edition, preset) = match vmix.get_vmix_data().await {
                        Ok(data) => (data.version, data.edition, data.preset),
                        Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None)
                    };
                    
                    let connection = VmixConnection {
                        host: host.clone(),
                        port: vmix.port(),
                        label,
                        status: "Connected".to_string(),
                        active_input,
                        preview_input,
                        connection_type: ConnectionType::Http,
                        version,
                        edition,
                        preset,
                    };
                    
                    return Ok(Some(connection));
                } else {
                    let label = {
                        let labels = state.connection_labels.lock().unwrap();
                        labels.get(&host).cloned().unwrap_or_else(|| format!("{} (HTTP)", host))
                    };
                    
                    let connection = VmixConnection {
                        host: host.clone(),
                        port: vmix.port(),
                        label,
                        status: "Disconnected".to_string(),
                        active_input: 1,
                        preview_input: 1,
                        connection_type: ConnectionType::Http,
                        version: "Unknown".to_string(),
                        edition: "Unknown".to_string(),
                        preset: None,
                    };
                    
                    return Ok(Some(connection));
                }
            }
            Err(_) => {
                let label = {
                    let labels = state.connection_labels.lock().unwrap();
                    labels.get(&host).cloned().unwrap_or_else(|| format!("{} (HTTP)", host))
                };
                
                let connection = VmixConnection {
                    host: host.clone(),
                    port: vmix.port(),
                    label,
                    status: "Disconnected".to_string(),
                    active_input: 1,
                    preview_input: 1,
                    connection_type: ConnectionType::Http,
                    version: "Unknown".to_string(),
                    edition: "Unknown".to_string(),
                    preset: None,
                };
                
                return Ok(Some(connection));
            }
        }
    }
    
    // Try TCP connection
    let tcp_connections = state.tcp_connections.lock().unwrap();
    if let Some(tcp_manager) = tcp_connections.iter().find(|c| c.host() == host) {
        if tcp_manager.is_connected() {
            // Get cached status from state for TCP connections
            let cache = state.last_status_cache.lock().unwrap();
            if let Some(cached_connection) = cache.get(&host) {
                return Ok(Some(cached_connection.clone()));
            }
        }
        
        let label = {
            let labels = state.connection_labels.lock().unwrap();
            labels.get(&host).cloned().unwrap_or_else(|| format!("{} (TCP)", host))
        };
        
        let connection = VmixConnection {
            host: host.clone(),
            port: tcp_manager.port(),
            label,
            status: if tcp_manager.is_connected() { "Connected" } else { "Disconnected" }.to_string(),
            active_input: 1,
            preview_input: 1,
            connection_type: ConnectionType::Tcp,
            version: "Unknown".to_string(),
            edition: "Unknown".to_string(),
            preset: None,
        };
        
        return Ok(Some(connection));
    }
    
    Ok(None)
}

#[tauri::command]
pub async fn get_vmix_statuses(state: State<'_, AppState>) -> Result<Vec<VmixConnection>, String> {
    let mut statuses = Vec::new();

    // Process HTTP connections
    let http_connections = state.http_connections.lock().unwrap().clone();
    for vmix in http_connections.iter() {
        let host = vmix.host().to_string();
        
        let (status, active_input, preview_input, version, edition, preset) = match vmix.get_status().await {
            Ok(true) => {
                let active = vmix.get_active_input().await.unwrap_or(1);
                let preview = vmix.get_preview_input().await.unwrap_or(1);
                
                // Get version/edition from vMix data
                let (ver, ed, pst) = match vmix.get_vmix_data().await {
                    Ok(data) => (data.version, data.edition, data.preset),
                    Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None)
                };
                
                (true, active, preview, ver, ed, pst)
            },
            _ => (false, 1, 1, "Unknown".to_string(), "Unknown".to_string(), None)
        };
        
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
            version,
            edition,
            preset,
        });
    }
    
    // Process TCP connections
    let tcp_connections = state.tcp_connections.lock().unwrap();
    for tcp_manager in tcp_connections.iter() {
        let host = tcp_manager.host().to_string();
        let is_connected = tcp_manager.is_connected();
        
        let label = {
            let labels = state.connection_labels.lock().unwrap();
            labels.get(&host).cloned().unwrap_or_else(|| format!("{} (TCP)", host))
        };
        
        // Get detailed info from cache if available
        let (active_input, preview_input, version, edition, preset) = {
            let cache = state.last_status_cache.lock().unwrap();
            if let Some(cached) = cache.get(&host) {
                (cached.active_input, cached.preview_input, cached.version.clone(), cached.edition.clone(), cached.preset.clone())
            } else {
                (1, 1, "Unknown".to_string(), "Unknown".to_string(), None)
            }
        };
        
        statuses.push(VmixConnection {
            host,
            port: tcp_manager.port(),
            label,
            status: if is_connected { "Connected".to_string() } else { "Disconnected".to_string() },
            active_input,
            preview_input,
            connection_type: ConnectionType::Tcp,
            version,
            edition,
            preset,
        });
    }

    Ok(statuses)
}

#[tauri::command]
pub async fn send_vmix_function(host: String, function: String, params: HashMap<String, String>, state: State<'_, AppState>) -> Result<(), String> {
    // Try HTTP connection first
    let vmix = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    if let Some(vmix) = vmix {
        return vmix.send_function(&function, &params).await
            .map_err(|e| format!("HTTP function failed: {}", e));
    }
    
    // Try TCP connection
    let tcp_manager = {
        let tcp_connections = state.tcp_connections.lock().unwrap();
        tcp_connections.iter().find(|c| c.host() == host).cloned()
    };
    if let Some(tcp_manager) = tcp_manager {
        if tcp_manager.is_connected() {
            return tcp_manager.send_function(&function, &params).await
                .map_err(|e| format!("TCP function failed: {}", e));
        } else {
            return Err("TCP connection is not active".to_string());
        }
    }
    
    Err(format!("No connection found for host: {}", host))
}

#[tauri::command]
pub async fn get_vmix_inputs(host: String, state: State<'_, AppState>) -> Result<Vec<VmixInput>, String> {
    // Try to get from cache first
    {
        let cache = state.inputs_cache.lock().unwrap();
        if let Some(cached_inputs) = cache.get(&host) {
            app_log!(debug, "Retrieved {} inputs from cache for host: {}", cached_inputs.len(), host);
            return Ok(cached_inputs.clone());
        }
    }
    
    // If not in cache, try HTTP connection
    let vmix = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    if let Some(vmix) = vmix {
        
        match vmix.get_vmix_data().await {
            Ok(vmix_data) => {
                let inputs: Vec<VmixInput> = vmix_data.inputs.input.into_iter().map(|input| VmixInput {
                    key: input.key,
                    number: input.number.parse().unwrap_or(0),
                    title: input.title,
                    short_title: input.short_title,
                    input_type: input.input_type.unwrap_or_default(),
                    state: input.state.unwrap_or_default(),
                }).collect();
                
                // Cache the result
                {
                    let mut cache = state.inputs_cache.lock().unwrap();
                    cache.insert(host.clone(), inputs.clone());
                }
                
                app_log!(debug, "Retrieved {} inputs via HTTP for host: {}", inputs.len(), host);
                return Ok(inputs);
            },
            Err(e) => return Err(format!("Failed to get vMix inputs via HTTP: {}", e))
        }
    }
    
    // TCP connections use cached data only (populated by monitoring task)
    let tcp_connections = state.tcp_connections.lock().unwrap();
    if tcp_connections.iter().any(|c| c.host() == host) {
        // For TCP, return empty if not cached - the monitoring task will populate it
        app_log!(debug, "TCP connection found but no cached inputs for host: {}", host);
        return Ok(Vec::new());
    }
    
    Err(format!("No connection found for host: {}", host))
}

#[tauri::command]
pub async fn get_vmix_video_lists(host: String, state: State<'_, AppState>) -> Result<Vec<VmixVideoListInput>, String> {
    // Try to get from cache first
    {
        let cache = state.video_lists_cache.lock().unwrap();
        if let Some(cached_video_lists) = cache.get(&host) {
            app_log!(debug, "Retrieved {} VideoLists from cache for host: {}", cached_video_lists.len(), host);
            return Ok(cached_video_lists.clone());
        }
    }
    
    // If not in cache, try HTTP connection
    let vmix = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };
    if let Some(vmix) = vmix {
        
        match vmix.get_raw_vmix_state().await {
            Ok(vmix_state) => {
                // Use shared builder function for consistent VideoList parsing
                let video_lists = build_video_lists_from_vmix(&vmix_state);
                
                // Cache the result
                {
                    let mut cache = state.video_lists_cache.lock().unwrap();
                    cache.insert(host.clone(), video_lists.clone());
                }
                
                app_log!(debug, "Retrieved {} VideoLists via HTTP for host: {}", video_lists.len(), host);
                return Ok(video_lists);
            },
            Err(e) => return Err(format!("Failed to get vMix VideoLists via HTTP: {}", e))
        }
    }
    
    // TCP connections use cached data only (populated by monitoring task)
    let tcp_connections = state.tcp_connections.lock().unwrap();
    if tcp_connections.iter().any(|c| c.host() == host) {
        // For TCP, return empty if not cached - the monitoring task will populate it
        app_log!(debug, "TCP connection found but no cached VideoLists for host: {}", host);
        return Ok(Vec::new());
    }
    
    Err(format!("No connection found for host: {}", host))
}

#[tauri::command]
pub async fn select_video_list_item(host: String, input_number: i32, item_index: i32, state: State<'_, AppState>) -> Result<(), String> {
    let mut params = HashMap::new();
    params.insert("Input".to_string(), input_number.to_string());
    params.insert("SelectedIndex".to_string(), item_index.to_string());
    
    send_vmix_function(host, "SelectIndex".to_string(), params, state).await
}

#[tauri::command]
pub async fn open_list_manager_window(app_handle: AppHandle) -> Result<(), String> {
    let window_id = "list-manager";
    
    // Check if window already exists
    if app_handle.get_webview_window(window_id).is_some() {
        // Focus the existing window
        if let Some(window) = app_handle.get_webview_window(window_id) {
            let _ = window.set_focus();
            app_log!(info, "Focused existing List Manager window");
        }
        return Ok(());
    }
    
    // Create new window
    let window = WebviewWindowBuilder::new(&app_handle, window_id, WebviewUrl::App("/#/list-manager".parse().unwrap()))
        .title("vMix List Manager")
        .inner_size(1000.0, 700.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| format!("Failed to create List Manager window: {}", e))?;
    
    // Show the window
    window.show().map_err(|e| format!("Failed to show List Manager window: {}", e))?;
    
    app_log!(info, "Opened List Manager window");
    Ok(())
}

#[tauri::command]
pub async fn open_video_list_window(host: String, list_key: String, list_title: String, app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let window_id = format!("video-list-{}-{}", host, list_key);
    
    // Check if window already exists
    if app_handle.get_webview_window(&window_id).is_some() {
        // Focus the existing window
        if let Some(window) = app_handle.get_webview_window(&window_id) {
            let _ = window.set_focus();
            app_log!(info, "Focused existing VideoList window: {}", window_id);
        }
        return Ok(());
    }
    
    // Create new window with URL parameters
    let url = format!("/#/video-list?host={}&listKey={}", urlencoding::encode(&host), urlencoding::encode(&list_key));
    let window = WebviewWindowBuilder::new(&app_handle, &window_id, WebviewUrl::App(url.parse().unwrap()))
        .title(&format!("VideoList: {} - {}", host, list_title))
        .inner_size(600.0, 800.0)
        .min_inner_size(400.0, 500.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| format!("Failed to create VideoList window: {}", e))?;
    
    // Show the window
    window.show().map_err(|e| format!("Failed to show VideoList window: {}", e))?;
    
    // Register the window in state
    state.register_video_list_window(window_id.clone(), host.clone(), list_key.clone(), list_title.clone());
    
    app_log!(info, "Opened VideoList window: {} for {}:{}", window_id, host, list_key);
    Ok(())
}

#[tauri::command]
pub fn get_video_list_windows_diagnostic(state: State<'_, AppState>) -> Vec<String> {
    let windows = state.video_list_windows.lock().unwrap();
    windows.values().map(|w| format!("{}: {} - {} ({})", w.window_id, w.host, w.list_key, w.list_title)).collect()
}

#[tauri::command]
pub async fn set_auto_refresh_config(host: String, config: AutoRefreshConfig, state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
    {
        let mut configs = state.auto_refresh_configs.lock().unwrap();
        configs.insert(host.clone(), config);
    }
    
    // Save configuration
    if let Err(e) = state.save_config(&app_handle).await {
        app_log!(warn, "Failed to save config after auto-refresh update: {}", e);
    }
    
    app_log!(info, "Updated auto-refresh config for host: {}", host);
    Ok(())
}

#[tauri::command]
pub fn get_auto_refresh_config(host: String, state: State<'_, AppState>) -> AutoRefreshConfig {
    let configs = state.auto_refresh_configs.lock().unwrap();
    configs.get(&host).cloned().unwrap_or_default()
}

#[tauri::command]
pub fn get_all_auto_refresh_configs(state: State<'_, AppState>) -> HashMap<String, AutoRefreshConfig> {
    let configs = state.auto_refresh_configs.lock().unwrap();
    configs.clone()
}

#[tauri::command]
pub async fn update_connection_label(host: String, label: String, state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
    {
        let mut labels = state.connection_labels.lock().unwrap();
        labels.insert(host.clone(), label.clone());
    }
    
    // Save configuration
    if let Err(e) = state.save_config(&app_handle).await {
        app_log!(warn, "Failed to save config after label update: {}", e);
    }
    
    app_log!(info, "Updated label for host {}: {}", host, label);
    Ok(())
}

#[tauri::command]
pub fn get_connection_labels(state: State<'_, AppState>) -> HashMap<String, String> {
    let labels = state.connection_labels.lock().unwrap();
    labels.clone()
}

#[tauri::command] 
pub async fn save_settings(host: String, port: u16, state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
    // Update app settings
    {
        let mut settings = state.app_settings.lock().unwrap();
        settings.default_vmix_ip = host;
        settings.default_vmix_port = port;
    }
    
    // Save configuration
    state.save_config(&app_handle).await
}

#[tauri::command]
pub async fn set_logging_config(level: String, save_to_file: bool) -> Result<(), String> {
    let config = LoggingConfig {
        enabled: true,
        level,
        save_to_file,
        file_path: None,
    };
    
    let mut logging_config = LOGGING_CONFIG.lock().unwrap();
    *logging_config = config;
    app_log!(info, "Updated logging configuration");
    Ok(())
}

#[tauri::command]
pub fn get_logging_config() -> LoggingConfig {
    LOGGING_CONFIG.lock().unwrap().clone()
}

#[tauri::command]
pub async fn save_app_settings(settings: AppSettings, state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
    {
        let mut app_settings = state.app_settings.lock().unwrap();
        *app_settings = settings;
    }
    
    state.save_config(&app_handle).await
}

#[tauri::command]
pub fn get_app_settings(state: State<'_, AppState>) -> AppSettings {
    let settings = state.app_settings.lock().unwrap();
    settings.clone()
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_commit_hash: env!("GIT_COMMIT_HASH").to_string(),
        git_branch: env!("GIT_BRANCH").to_string(),
        build_timestamp: env!("BUILD_TIMESTAMP").to_string(),
    }
}

#[tauri::command]
pub async fn open_logs_directory(app_handle: AppHandle) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    
    // Get the app data directory where logs are stored
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let logs_dir = app_data_dir.join("logs");
    
    // Create logs directory if it doesn't exist
    if !logs_dir.exists() {
        tokio::fs::create_dir_all(&logs_dir).await
            .map_err(|e| format!("Failed to create logs directory: {}", e))?;
    }
    
    // Open the directory in file explorer  
    app_handle.shell().open(logs_dir.to_string_lossy().to_string(), None)
        .map_err(|e| format!("Failed to open logs directory: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    // This would integrate with your update checking logic
    // For now, return a placeholder
    Ok(UpdateInfo {
        available: false,
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        latest_version: None,
        body: None,
    })
}

pub async fn install_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    match tauri_plugin_updater::UpdaterExt::updater(&app_handle) {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    app_log!(info, "Installing update: {}", update.version);
                    
                    // Download and install the update
                    let mut downloaded = 0;
                    
                    // Download with progress updates
                    update.download_and_install(
                        |chunk_length, content_length| {
                            downloaded += chunk_length;
                            let progress = if let Some(total) = content_length {
                                (downloaded as f64 / total as f64 * 100.0) as u32
                            } else {
                                0
                            };
                            app_log!(debug, "Download progress: {}%", progress);
                        },
                        || {
                            app_log!(info, "Update downloaded, restarting application...");
                        }
                    ).await
                    .map_err(|e| format!("Failed to download and install update: {}", e))?;
                    
                    Ok(())
                }
                Ok(None) => Err("No updates available".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e))
            }
        }
        Err(e) => Err(format!("Failed to get updater instance: {}", e))
    }
}

#[tauri::command]
pub async fn install_update_command(app_handle: AppHandle) -> Result<(), String> {
    install_update(app_handle).await
}

// Network Scanner Commands
#[tauri::command]
pub async fn get_network_interfaces_command() -> Result<Vec<NetworkInterface>, String> {
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
pub async fn scan_network_for_vmix_command(interface_name: String, state: State<'_, AppState>) -> Result<Vec<VmixScanResult>, String> {
    app_log!(info, "Starting network scan for vMix on interface: {}", interface_name);
    
    match scan_network_for_vmix(interface_name.clone(), &*state).await {
        Ok(results) => {
            let vmix_count = results.iter().filter(|r| r.is_vmix).count();
            app_log!(info, "Network scan completed on {}: {} hosts scanned, {} vMix instances found", 
                interface_name, results.len(), vmix_count);
            Ok(results)
        }
        Err(e) => {
            app_log!(error, "Failed to scan network for vMix: {}", e);
            Err(format!("Failed to scan network for vMix: {}", e))
        }
    }
}

// Multiviewer Commands
use crate::types::MultiviewerConfig;

#[tauri::command]
pub async fn get_multiviewer_config(state: State<'_, AppState>) -> Result<MultiviewerConfig, String> {
    Ok(state.inner().get_multiviewer_config())
}

#[tauri::command]
pub async fn update_multiviewer_config(config: MultiviewerConfig, state: State<'_, AppState>) -> Result<(), String> {
    state.inner().update_multiviewer_config(config).await
        .map_err(|e| format!("Failed to update multiviewer config: {}", e))
}

#[tauri::command]
pub async fn start_multiviewer_server(_state: State<'_, AppState>) -> Result<(), String> {
    // For now just log that it would start
    app_log!(info, "Starting multiviewer server...");
    Ok(())
}

#[tauri::command]
pub async fn stop_multiviewer_server(_state: State<'_, AppState>) -> Result<(), String> {
    // For now just log that it would stop
    app_log!(info, "Stopping multiviewer server...");
    Ok(())
}

#[tauri::command]
pub async fn get_multiviewer_url(state: State<'_, AppState>) -> Result<String, String> {
    let connections = state.inner().get_connections();
    let selected_vmix = connections.first()
        .ok_or_else(|| "No vMix connection available".to_string())?;
    
    let config = state.inner().get_multiviewer_config();
    
    let url = format!("http://{}:{}/multiviewer", selected_vmix.host, config.port);
    app_log!(info, "Multiviewer URL for {}: {}", selected_vmix.host, url);
    Ok(url)
}