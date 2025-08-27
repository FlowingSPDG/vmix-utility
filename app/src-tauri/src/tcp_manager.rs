use crate::types::{VmixXml, VmixInput, VmixConnection, ConnectionType};
use crate::state::AppState;
use crate::app_log;
use anyhow::Result;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Emitter;
use vmix_rs::acts::ActivatorsData;
use vmix_rs::commands::{RecvCommand, SendCommand, Status};
use vmix_rs::vmix::VmixApi as TcpVmixClient;

// TCP Manager for event-driven TCP handling
#[derive(Clone)]
pub struct TcpVmixManager {
    client: Arc<TcpVmixClient>,
    host: String,
    port: u16,
    last_xml_request: Arc<Mutex<Instant>>,
    shutdown_signal: Arc<std::sync::atomic::AtomicBool>,
}

impl TcpVmixManager {
    pub async fn new(host: &str, port: u16) -> Result<Self> {
        use std::net::ToSocketAddrs;
        
        let socket_addr: SocketAddr = format!("{}:{}", host, port)
            .to_socket_addrs()
            .map_err(|e| anyhow::anyhow!("Failed to resolve hostname {}: {}", host, e))?
            .next()
            .ok_or_else(|| anyhow::anyhow!("No socket address found for {}:{}", host, port))?;
        
        let client = TcpVmixClient::new(socket_addr, Duration::from_secs(10)).await
            .map_err(|e| anyhow::anyhow!("Failed to connect TCP client: {}", e))?;

        // Send initial XML command to get current state and populate cache
        if let Err(e) = client.send_command(SendCommand::XML) {
            app_log!(warn, "Failed to send initial XML command for {}: {}", host, e);
        } else {
            app_log!(info, "Sent initial XML command to populate cache for {}", host);
        }
                    
        Ok(Self {
            client: Arc::new(client),
            host: host.to_string(),
            port,
            last_xml_request: Arc::new(Mutex::new(Instant::now())),
            shutdown_signal: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
    }
    
    pub fn start_monitoring(&self, app_handle: tauri::AppHandle, state: tauri::State<'_, AppState>) {
        let client: Arc<TcpVmixClient> = Arc::clone(&self.client);
        let host = self.host.clone();
        let port = self.port;
        let last_xml_request = Arc::clone(&self.last_xml_request);
        let shutdown_signal = Arc::clone(&self.shutdown_signal);
        let auto_refresh_configs = Arc::clone(&state.auto_refresh_configs);
        
        // XMLコマンドの定期送信タスク
        let xml_sender_client: Arc<TcpVmixClient> = Arc::clone(&client);
        let xml_sender_shutdown = Arc::clone(&shutdown_signal);
        let xml_last_request = Arc::clone(&last_xml_request);
        let xml_sender_host = host.clone();
        let xml_configs = Arc::clone(&auto_refresh_configs);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1)); // Check config every second
            let mut consecutive_failures = 0;
            let mut last_send_time = Instant::now();
            
            while !xml_sender_shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                interval.tick().await;
                
                // Check if connection is still alive
                if !xml_sender_client.is_connected() {
                    app_log!(warn, "TCP connection lost for {} during XML sending, stopping XML sender task", xml_sender_host);
                    break;
                }
                
                // Get current auto-refresh config
                let refresh_config = {
                    let configs = xml_configs.lock().unwrap();
                    configs.get(&xml_sender_host).cloned()
                };
                
                // Use config or default
                let config = refresh_config.unwrap_or_else(|| crate::types::AutoRefreshConfig {
                    enabled: true,
                    duration: 3,
                });
                
                // Only send XML if auto-refresh is enabled and enough time has passed
                if config.enabled && last_send_time.elapsed() >= Duration::from_secs(config.duration) {
                    match xml_sender_client.send_command(SendCommand::XML) {
                        Ok(_) => {
                            let mut last_req = xml_last_request.lock().unwrap();
                            *last_req = Instant::now();
                            last_send_time = Instant::now();
                            consecutive_failures = 0; // Reset failure counter on success
                            app_log!(debug, "TCP: Sent XML command to {} (interval: {}s)", xml_sender_host, config.duration);
                        },
                        Err(e) => {
                            consecutive_failures += 1;
                            app_log!(error, "Failed to send XML command to {} (attempt {}): {}", xml_sender_host, consecutive_failures, e);
                            
                            // Stop after 3 consecutive failures to avoid endless error spam
                            if consecutive_failures >= 3 {
                                app_log!(error, "Too many consecutive failures for {}, stopping XML sender task", xml_sender_host);
                                break;
                            }
                        }
                    }
                }
            }
            app_log!(info, "XML sender task ended for {}", xml_sender_host);
        });
        
        // レスポンス受信タスク
        let response_client: Arc<TcpVmixClient> = Arc::clone(&client);
        let response_shutdown = Arc::clone(&shutdown_signal);
        let response_host = host.clone();
        let inputs_cache = Arc::clone(&state.inputs_cache);
        let video_lists_cache = Arc::clone(&state.video_lists_cache);
        let last_status_cache = Arc::clone(&state.last_status_cache);
        
        tokio::spawn(async move {
            while !response_shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                match response_client.try_receive_command(Duration::from_millis(100)) {
                    Ok(recv_command) => {
                        match recv_command {
                            RecvCommand::XML(xml_response) => {
                                // XMLレスポンスをパースしてInputs情報のみ更新
                                if let Ok(vmix_xml) = Self::parse_xml_response(&xml_response.body) {
                                    // Update inputs cache from XML and emit changes
                                    let new_inputs: Vec<VmixInput> = vmix_xml.inputs.input.iter().map(|input| VmixInput {
                                        key: input.key.clone(),
                                        number: input.number.parse().unwrap_or(0),
                                        title: input.title.clone(),
                                        short_title: input.short_title.clone(),
                                        input_type: input.input_type.clone().unwrap_or_else(|| "Unknown".to_string()),
                                        state: input.state.clone().unwrap_or_else(|| "Unknown".to_string()),
                                    }).collect();
                                    
                                    // Compare with cached inputs and emit if changed
                                    let mut cache = inputs_cache.lock().unwrap();
                                    let cache_key = response_host.clone();
                                    let inputs_changed = cache.get(&cache_key).map_or(true, |cached| *cached != new_inputs);
                                    
                                    if inputs_changed {
                                        app_log!(debug, "TCP: Inputs changed for {}, emitting vmix-inputs-updated", response_host);
                                        cache.insert(cache_key, new_inputs.clone());
                                        let _ = app_handle.emit("vmix-inputs-updated", serde_json::json!({
                                            "host": response_host,
                                            "inputs": new_inputs
                                        }));
                                    }
                                    
                                    // Parse and process VideoLists from XML as well
                                    let vmix_state = match Self::build_vmix_state_from_xml(&xml_response.body) {
                                        Ok(state) => state,
                                        Err(e) => {
                                            app_log!(warn, "Failed to parse vmix state for VideoLists from TCP XML: {}", e);
                                            return; // Skip VideoLists processing if parsing fails
                                        }
                                    };
                                    
                                    // Build VideoLists using the shared function
                                    let video_lists = crate::commands::build_video_lists_from_vmix(&vmix_state);
                                    
                                    // Check if VideoLists data has changed using cache comparison
                                    let video_lists_changed = {
                                        let mut video_cache = video_lists_cache.lock().unwrap();
                                        let has_changed = video_cache.get(&response_host)
                                            .map(|cached_video_lists| {
                                                let changed = cached_video_lists != &video_lists;
                                                app_log!(debug, "TCP VideoLists comparison for {}: cached={}, new={}, changed={}", 
                                                    response_host, cached_video_lists.len(), video_lists.len(), changed);
                                                changed
                                            })
                                            .unwrap_or_else(|| {
                                                app_log!(debug, "No cached VideoLists for {} in TCP, treating as changed", response_host);
                                                true
                                            });
                                        
                                        // Update cache with new data
                                        video_cache.insert(response_host.clone(), video_lists.clone());
                                        app_log!(debug, "TCP updated VideoLists cache for {} with {} items", response_host, video_lists.len());
                                        has_changed
                                    };
                                    
                                    // Only emit frontend event if VideoLists data actually changed
                                    if video_lists_changed {
                                        let payload = serde_json::json!({
                                            "host": response_host,
                                            "videoLists": video_lists
                                        });
                                        
                                        if let Err(e) = app_handle.emit("vmix-videolists-updated", payload) {
                                            app_log!(error, "TCP: Failed to emit VideoLists update: {}", e);
                                        } else {
                                            app_log!(debug, "TCP: VideoLists updated for {} with {} lists (data changed)", response_host, video_lists.len());
                                        }
                                    } else {
                                        app_log!(debug, "TCP: VideoLists for {} - no changes detected", response_host);
                                    }
                                    
                                    // Update status cache with active/preview inputs from XML
                                    let active_input = vmix_xml.active
                                        .as_ref()
                                        .and_then(|s| s.parse::<i32>().ok())
                                        .unwrap_or(0);
                                    let preview_input = vmix_xml.preview
                                        .as_ref()
                                        .and_then(|s| s.parse::<i32>().ok())
                                        .unwrap_or(0);
                                    
                                    let connection_status = VmixConnection {
                                        host: response_host.clone(),
                                        port,
                                        label: format!("vMix {}", response_host),
                                        status: "Connected".to_string(),
                                        active_input,
                                        preview_input,
                                        connection_type: ConnectionType::Tcp,
                                        version: vmix_xml.version,
                                        edition: vmix_xml.edition,
                                        preset: vmix_xml.preset,
                                    };
                                    
                                    // Update the status cache
                                    {
                                        let mut status_cache = last_status_cache.lock().unwrap();
                                        status_cache.insert(response_host.clone(), connection_status.clone());
                                        app_log!(debug, "TCP: Updated status cache - Active: {}, Preview: {}", active_input, preview_input);
                                    }
                                    
                                    // Send status update to frontend
                                    let _ = app_handle.emit("vmix-status-updated", &connection_status);
                                    app_log!(debug, "TCP: Sent initial vmix-status-updated event from XML response");
                                }
                            }
                            RecvCommand::ACTS(acts_event) => {
                                app_log!(debug, "ACTS event received: {:?}", acts_event);
                                if matches!(acts_event.status, Status::OK) {
                                    let mut status_changed = false;
                                    let mut new_active_input = None;
                                    let mut new_preview_input = None;
                                    
                                    // Get current status from cache
                                    let current_status = {
                                        let cache = last_status_cache.lock().unwrap();
                                        cache.get(&response_host).cloned()
                                    };
                                    
                                    match acts_event.body {
                                        ActivatorsData::Input(input_number, active) => {
                                            app_log!(debug, "Input {} {} (ACTS event)", input_number, if active { "activated" } else { "deactivated" });
                                            if active {
                                                // New input became active
                                                new_active_input = Some(input_number as i32);
                                                status_changed = true;
                                            } else if let Some(ref status) = current_status {
                                                // Input deactivated - keep current active if it's different
                                                if status.active_input == input_number as i32 {
                                                    // Current active was deactivated, but we don't know the new one yet
                                                    app_log!(debug, "Current active input {} was deactivated, waiting for new active", input_number);
                                                }
                                            }
                                        }
                                        ActivatorsData::InputPreview(input_number, active) => {
                                            app_log!(debug, "InputPreview {} {} (ACTS event)", input_number, if active { "activated" } else { "deactivated" });
                                            if active {
                                                // New input became preview
                                                new_preview_input = Some(input_number as i32);
                                                status_changed = true;
                                            } else if let Some(ref status) = current_status {
                                                // Preview deactivated - keep current preview if it's different
                                                if status.preview_input == input_number as i32 {
                                                    // Current preview was deactivated, but we don't know the new one yet
                                                    app_log!(debug, "Current preview input {} was deactivated, waiting for new preview", input_number);
                                                }
                                            }
                                        }
                                        _ => {
                                            app_log!(debug, "TCP: Received unhandled ACTS event type: {:?}", acts_event.body);
                                        }
                                    }
                                    
                                    // Send immediate status update if we have new active/preview info
                                    if status_changed {
                                        if let Some(ref status) = current_status {
                                            let updated_connection = VmixConnection {
                                                host: response_host.clone(),
                                                port,
                                                label: status.label.clone(),
                                                status: status.status.clone(),
                                                active_input: new_active_input.unwrap_or(status.active_input),
                                                preview_input: new_preview_input.unwrap_or(status.preview_input),
                                                connection_type: ConnectionType::Tcp,
                                                version: status.version.clone(),
                                                edition: status.edition.clone(),
                                                preset: status.preset.clone(),
                                            };
                                            
                                            // Update cache
                                            {
                                                let mut cache = last_status_cache.lock().unwrap();
                                                cache.insert(response_host.clone(), updated_connection.clone());
                                            }
                                            
                                            // Send immediate update to frontend
                                            let _ = app_handle.emit("vmix-status-updated", &updated_connection);
                                            app_log!(debug, "TCP: ACTS event triggered immediate status update - Active: {}, Preview: {}", 
                                                updated_connection.active_input, updated_connection.preview_input);
                                        }
                                    }
                                }
                            }
                            RecvCommand::VERSION(version_response) => {
                                app_log!(debug, "TCP: Received VERSION command: {:?}", version_response);
                                // Subscribe to ACTS events to receive real-time input/preview changes
                                if let Err(e) = client.send_command(SendCommand::SUBSCRIBE(vmix_rs::commands::SUBSCRIBECommand::ACTS)) {
                                    app_log!(warn, "Failed to send subscribe command to ACTS events for {}: {}", host, e);
                                } else {
                                    app_log!(info, "Successfully send subscribe command to ACTS events for {}", host);
                                }
                            }
                            RecvCommand::SUBSCRIBE(subscribe_response) => {
                                app_log!(debug, "TCP: Received SUBSCRIBE command: {:?}", subscribe_response);
                            }
                            RecvCommand::UNSUBSCRIBE(unsubscribe_response) => {
                                app_log!(debug, "TCP: Received UNSUBSCRIBE command: {:?}", unsubscribe_response);
                            }
                            _ => {
                                app_log!(debug, "TCP: Received unhandled command type");
                            }
                        }
                    },
                    Err(e) => {
                        // Handle errors more gracefully
                        let error_msg = format!("{}", e);
                        
                        // Check if this is a real connection failure (not just timeout)
                        if error_msg.contains("Connection reset") || 
                           error_msg.contains("Connection refused") ||
                           error_msg.contains("Connection aborted") ||
                           error_msg.contains("Broken pipe") ||
                           (!response_client.is_connected() && !error_msg.contains("timeout")) {
                            
                            app_log!(error, "TCP connection lost for {}: {}", response_host, e);
                            
                            // Get current connection info from cache for event emission
                            let disconnected_connection = {
                                let cache = last_status_cache.lock().unwrap();
                                if let Some(cached) = cache.get(&response_host) {
                                    VmixConnection {
                                        host: response_host.clone(),
                                        port,
                                        label: cached.label.clone(),
                                        status: "Disconnected".to_string(),
                                        active_input: cached.active_input,
                                        preview_input: cached.preview_input,
                                        connection_type: ConnectionType::Tcp,
                                        version: cached.version.clone(),
                                        edition: cached.edition.clone(),
                                        preset: cached.preset.clone(),
                                    }
                                } else {
                                    VmixConnection {
                                        host: response_host.clone(),
                                        port,
                                        label: format!("{} (TCP)", response_host),
                                        status: "Disconnected".to_string(),
                                        active_input: 0,
                                        preview_input: 0,
                                        connection_type: ConnectionType::Tcp,
                                        version: "".to_string(),
                                        edition: "".to_string(),
                                        preset: None,
                                    }
                                }
                            };
                            
                            // Emit disconnection event
                            let _ = app_handle.emit("vmix-status-updated", &disconnected_connection);
                            app_log!(info, "Emitted vmix-status-updated disconnection event for {}", response_host);
                            
                            // Signal shutdown to stop XML sender task
                            response_shutdown.store(true, std::sync::atomic::Ordering::Relaxed);
                            
                            // Exit the monitoring loop for this connection
                            break;
                        }
                        
                        // Normal timeout or other non-critical errors - just sleep and continue
                        if !error_msg.contains("timeout") && !error_msg.contains("No matching command found") {
                            app_log!(debug, "TCP: Receive error for {}: {}", response_host, e);
                        }
                        
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                }
            }
        });
    }
    
    pub async fn send_function(&self, function_name: &str, params: &HashMap<String, String>) -> Result<()> {
        let params_str = if params.is_empty() {
            None
        } else {
            Some(params.iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<_>>()
                .join("&"))
        };
        
        let send_command = SendCommand::FUNCTION(function_name.to_string(), params_str);
        self.client.send_command(send_command)
            .map_err(|e| anyhow::anyhow!("TCP function send failed: {}", e))
    }
    
    pub fn is_connected(&self) -> bool {
        self.client.is_connected()
    }
    
    pub fn shutdown(&self) {
        self.shutdown_signal.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    
    fn parse_xml_response(xml: &str) -> Result<VmixXml> {
        quick_xml::de::from_str(xml)
            .map_err(|e| anyhow::anyhow!("TCP XML parse error: {}", e))
    }

    fn build_vmix_state_from_xml(xml: &str) -> Result<vmix_rs::models::Vmix> {
        quick_xml::de::from_str(xml)
            .map_err(|e| anyhow::anyhow!("Failed to parse vmix state from XML: {}", e))
    }
    
    pub fn host(&self) -> &str {
        &self.host
    }
    
    pub fn port(&self) -> u16 {
        self.port
    }
}