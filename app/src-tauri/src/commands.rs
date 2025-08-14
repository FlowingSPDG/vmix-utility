use crate::types::{
    AppInfo, AppSettings, AutoRefreshConfig, ConnectionType, LoggingConfig,
    UpdateInfo, VmixConnection, VmixInput, VmixVideoListInput, VmixVideoListItem,
};
use quick_xml::Reader;
use quick_xml::events::Event;
use crate::http_client::VmixClientWrapper;
use crate::tcp_manager::TcpVmixManager;
use crate::state::AppState;
use crate::logging::LOGGING_CONFIG;
use crate::app_log;
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State, Emitter, WebviewUrl, WebviewWindowBuilder};

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
    
    // For TCP connections, use cached data
    let tcp_exists = {
        let tcp_connections = state.tcp_connections.lock().unwrap();
        tcp_connections.iter().any(|c| c.host() == host)
    };
    
    if tcp_exists {
        // TCP接続の場合はキャッシュから取得（今後実装）
        let _cached_video_lists = {
            let inputs_cache = state.inputs_cache.lock().unwrap();
            inputs_cache.get(&host).cloned().unwrap_or_default()
        };
        
        // For TCP connections, we need to get the actual vmix data to parse VideoList items
        // This is a limitation of the current caching system
        let video_lists: Vec<VmixVideoListInput> = Vec::new();
        
        return Ok(video_lists);
    }
    
    // Get both raw XML and parsed state for comparison
    let (vmix_state, raw_xml) = match http_vmix {
        Some(vmix) => {
            let state = vmix.get_raw_vmix_state().await.map_err(|e| e.to_string())?;
            let xml = vmix.get_raw_xml().await.map_err(|e| e.to_string())?;
            app_log!(info, "Raw vMix state retrieved for VideoList parsing");
            (state, xml)
        },
        None => {
            // Try to establish new HTTP connection
            let port = port.unwrap_or(8088);
            let vmix = VmixClientWrapper::new(&host, port);
            let state = vmix.get_raw_vmix_state().await.map_err(|e| e.to_string())?;
            let xml = vmix.get_raw_xml().await.map_err(|e| e.to_string())?;
            app_log!(info, "Raw vMix state retrieved from new connection for VideoList parsing");
            (state, xml)
        }
    };

    // Helper function to parse VideoList items from raw XML
    fn parse_videolist_items_from_xml_inner(xml: &str, input_key: &str) -> Vec<(String, bool, bool)> {
        let mut items = Vec::new();
        let mut reader = Reader::from_str(xml);
        let mut buf = Vec::new();
        let mut in_target_input = false;
        let mut in_list = false;
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    if e.name().as_ref() == b"input" {
                        // Check if this is our target input
                        if let Some(key_attr) = e.attributes().find(|attr| {
                            attr.as_ref().map(|a| a.key.as_ref() == b"key").unwrap_or(false)
                        }) {
                            if let Ok(attr) = key_attr {
                                if let Ok(value) = attr.unescape_value() {
                                    if value == input_key {
                                        in_target_input = true;
                                    }
                                }
                            }
                        }
                    } else if e.name().as_ref() == b"list" && in_target_input {
                        in_list = true;
                    } else if e.name().as_ref() == b"item" && in_list {
                        let mut text = String::new();
                        let mut selected = false;
                        let mut enabled = true; // Default to true
                        
                        // Parse attributes
                        for attr_result in e.attributes() {
                            if let Ok(attr) = attr_result {
                                match attr.key.as_ref() {
                                    b"selected" => {
                                        if let Ok(value) = attr.unescape_value() {
                                            selected = value == "true";
                                        }
                                    }
                                    b"enabled" => {
                                        if let Ok(value) = attr.unescape_value() {
                                            enabled = value == "true";
                                            app_log!(info, "Found enabled attribute: '{}' -> {}", value, enabled);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                        
                        // Get text content
                        buf.clear();
                        if let Ok(Event::Text(e)) = reader.read_event_into(&mut buf) {
                            text = std::str::from_utf8(e.as_ref()).unwrap_or("").to_string();
                        }
                        
                        app_log!(info, "Parsed VideoList item: text='{}', selected={}, enabled={}", text, selected, enabled);
                        items.push((text, selected, enabled));
                    }
                }
                Ok(Event::End(ref e)) => {
                    if e.name().as_ref() == b"input" {
                        in_target_input = false;
                    } else if e.name().as_ref() == b"list" {
                        in_list = false;
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    app_log!(error, "Error parsing XML: {}", e);
                    break;
                }
                _ => {}
            }
            buf.clear();
        }
        
        items
    }
    
    // Filter for VideoList type inputs and convert to VmixVideoListInput
    let video_lists: Vec<VmixVideoListInput> = vmix_state.inputs.input.iter()
        .filter(|input| input.input_type.to_lowercase() == "videolist")
        .map(|input| {
            // Use manual XML parsing to get correct enabled/selected values
            let parsed_items = parse_videolist_items_from_xml_inner(&raw_xml, &input.key);
            
            let items: Vec<VmixVideoListItem> = parsed_items.into_iter().enumerate().map(|(index, (text, selected, enabled))| {
                app_log!(info, "Creating VideoList item {} - text: '{}', selected: {}, enabled: {}", 
                    index, text, selected, enabled);
                
                VmixVideoListItem {
                    key: format!("{}_{}", input.key, index),
                    number: 0, // VideoList items don't have input numbers
                    title: text,
                    input_type: "VideoListItem".to_string(),
                    state: "Available".to_string(),
                    selected,
                    enabled,
                }
            }).collect();

            VmixVideoListInput {
                key: input.key.clone(),
                number: input.number.parse().unwrap_or(0),
                title: input.title.clone(),
                input_type: input.input_type.clone(),
                state: "Running".to_string(), // Default state for VideoList
                items,
                selected_index: input.selected_index.as_ref().and_then(|s| s.parse().ok()),
            }
        })
        .collect();
    
    // Emit update event to frontend
    let event_payload = serde_json::json!({
        "host": host,
        "videoLists": video_lists
    });
    
    match app_handle.emit("vmix-videolists-updated", &event_payload) {
        Ok(_) => app_log!(info, "Successfully emitted vmix-videolists-updated event for host: {} with {} lists", host, video_lists.len()),
        Err(e) => app_log!(error, "Failed to emit vmix-videolists-updated event for host: {} - {}", host, e),
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
    let (active_input, preview_input, status, version, edition) = match connection_type {
        ConnectionType::Http => {
            let info_vmix = VmixClientWrapper::new(&host, port);
            let active = info_vmix.get_active_input().await.unwrap_or(0);
            let preview = info_vmix.get_preview_input().await.unwrap_or(0);
            let status = info_vmix.get_status().await.unwrap_or(false);
            
            // Get vMix data to extract version and edition information
            let (version, edition) = match info_vmix.get_vmix_data().await {
                Ok(vmix_data) => (vmix_data.version, vmix_data.edition),
                Err(_) => ("Unknown".to_string(), "Unknown".to_string())
            };
            
            (active, preview, status, version, edition)
        },
        ConnectionType::Tcp => {
            // TCPの場合はバックグラウンドタスクで状態更新されるので初期値を返す
            // version/editionはXMLレスポンスから後で更新される
            (1, 1, true, "Unknown".to_string(), "Unknown".to_string())
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
        version,
        edition,
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
    
    // Disconnect from TCP connections
    {
        let mut tcp_connections = state.tcp_connections.lock().unwrap();
        if let Some(pos) = tcp_connections.iter().position(|c| c.host() == host) {
            tcp_connections[pos].shutdown();
            tcp_connections.remove(pos);
        }
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
    
    // Try to find in TCP connections
    let tcp_result = {
        let tcp_connections = state.tcp_connections.lock().unwrap();
        tcp_connections.iter().find(|c| c.host() == host).map(|c| (c.is_connected(), ConnectionType::Tcp))
    };
    
    let (status, active_input, preview_input, conn_type, version, edition) = if let Some(vmix) = http_result {
        let status = vmix.get_status().await.map_err(|e| e.to_string())?;
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        
        // Get version and edition information
        let (version, edition) = match vmix.get_vmix_data().await {
            Ok(vmix_data) => (vmix_data.version, vmix_data.edition),
            Err(_) => ("Unknown".to_string(), "Unknown".to_string())
        };
        
        (status, active_input, preview_input, ConnectionType::Http, version, edition)
    } else if let Some((tcp_status, conn_type)) = tcp_result {
        // TCPの場合はキャッシュから取得
        let cached_connection = {
            let cache = state.last_status_cache.lock().unwrap();
            cache.get(&host).cloned()
        };
        
        if let Some(cached) = cached_connection {
            (tcp_status, cached.active_input, cached.preview_input, conn_type, cached.version, cached.edition)
        } else {
            (tcp_status, 1, 1, conn_type, "Unknown".to_string(), "Unknown".to_string())
        }
    } else {
        // 既存接続がない場合は新しいHTTP接続でテスト
        let vmix = VmixClientWrapper::new(&host, port);
        let status = vmix.get_status().await.map_err(|e| e.to_string())?;
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        
        // Get version and edition information
        let (version, edition) = match vmix.get_vmix_data().await {
            Ok(vmix_data) => (vmix_data.version, vmix_data.edition),
            Err(_) => ("Unknown".to_string(), "Unknown".to_string())
        };
        
        (status, active_input, preview_input, ConnectionType::Http, version, edition)
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
        version,
        edition,
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
        
        // Get version and edition information
        let (version, edition) = match vmix.get_vmix_data().await {
            Ok(vmix_data) => (vmix_data.version, vmix_data.edition),
            Err(_) => ("Unknown".to_string(), "Unknown".to_string())
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
        });
    }
    
    // Process TCP connections
    for (host, port, tcp_status) in tcp_connections {
        let label = {
            let labels = state.connection_labels.lock().unwrap();
            labels.get(&host).cloned().unwrap_or_else(|| format!("{} (TCP)", host))
        };
        
        // TCPの詳細情報はキャッシュから取得
        let (active_input, preview_input, version, edition) = {
            let cache = state.last_status_cache.lock().unwrap();
            if let Some(cached) = cache.get(&host) {
                (cached.active_input, cached.preview_input, cached.version.clone(), cached.edition.clone())
            } else {
                (1, 1, "Unknown".to_string(), "Unknown".to_string())
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
            version,
            edition,
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
    host: String,
    list_key: String,
    list_title: String
) -> Result<(), String> {
    app_log!(info, "Opening VideoList popup window for list: {}", list_title);
    
    let window_id = format!("video-list-{}-{}", urlencoding::encode(&host), list_key);
    
    // Check if window already exists
    if let Some(_) = app_handle.get_webview_window(&window_id) {
        app_log!(info, "VideoList window already exists, focusing it");
        // Focus existing window
        if let Some(window) = app_handle.get_webview_window(&window_id) {
            let _ = window.set_focus();
        }
        return Ok(());
    }
    
    // Create URL with query parameters
    let webview_url = WebviewUrl::App(format!("/list-manager?host={}&listKey={}", 
        urlencoding::encode(&host), 
        urlencoding::encode(&list_key)
    ).into());
    
    let window_title = format!("VideoList: {}", list_title);
    
    match WebviewWindowBuilder::new(&app_handle, &window_id, webview_url)
        .title(&window_title)
        .inner_size(600.0, 500.0)
        .min_inner_size(400.0, 300.0)
        .resizable(true)
        .build()
    {
        Ok(_) => {
            app_log!(info, "VideoList popup window created successfully: {}", window_title);
            Ok(())
        }
        Err(e) => {
            app_log!(error, "Failed to create VideoList popup window: {}", e);
            Err(format!("Failed to create popup window: {}", e))
        }
    }
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