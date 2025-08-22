use crate::types::{
    AppConfig, AppSettings, AutoRefreshConfig, ConnectionConfig, ConnectionType,
    VmixConnection, VmixInput, VmixVideoListInput,
};
use crate::http_client::VmixClientWrapper;
use crate::tcp_manager::TcpVmixManager;
use crate::multiviewer::MultiviewerServer;
use crate::app_log;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::fs;
use tokio::time::{interval, sleep};
use tauri::{Emitter, Manager};

#[derive(Debug, Clone)]
pub struct VideoListWindow {
    pub window_id: String,
    pub host: String,
    pub list_key: String,
    pub list_title: String,
    pub created_at: std::time::Instant,
}

#[derive(Clone)]
pub struct AppState {
    pub http_connections: Arc<Mutex<Vec<VmixClientWrapper>>>,
    pub tcp_connections: Arc<Mutex<Vec<TcpVmixManager>>>,
    pub auto_refresh_configs: Arc<Mutex<HashMap<String, AutoRefreshConfig>>>,
    pub last_status_cache: Arc<Mutex<HashMap<String, VmixConnection>>>,
    pub inputs_cache: Arc<Mutex<HashMap<String, Vec<VmixInput>>>>,
    pub video_lists_cache: Arc<Mutex<HashMap<String, Vec<VmixVideoListInput>>>>,
    pub connection_labels: Arc<Mutex<HashMap<String, String>>>,
    pub app_settings: Arc<Mutex<AppSettings>>,
    pub video_list_windows: Arc<Mutex<HashMap<String, VideoListWindow>>>,
    pub multiviewer_server: Arc<Mutex<Option<MultiviewerServer>>>,
}

// Ensure AppState is Send and Sync
unsafe impl Send for AppState {}
unsafe impl Sync for AppState {}

impl AppState {
    pub fn new() -> Self {
        Self {
            http_connections: Arc::new(Mutex::new(Vec::new())),
            tcp_connections: Arc::new(Mutex::new(Vec::new())),
            auto_refresh_configs: Arc::new(Mutex::new(HashMap::new())),
            last_status_cache: Arc::new(Mutex::new(HashMap::new())),
            inputs_cache: Arc::new(Mutex::new(HashMap::new())),
            video_lists_cache: Arc::new(Mutex::new(HashMap::new())),
            connection_labels: Arc::new(Mutex::new(HashMap::new())),
            app_settings: Arc::new(Mutex::new(AppSettings::default())),
            video_list_windows: Arc::new(Mutex::new(HashMap::new())),
            multiviewer_server: Arc::new(Mutex::new(None)),
        }
    }
    
    pub async fn initialize(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        // Try to load config first
        if let Err(e) = self.load_config(app_handle).await {
            println!("Config load failed: {}, initializing with default localhost", e);
            // If loading fails, add default localhost connection
            self.add_localhost_connection();
            // Save the default configuration
            if let Err(e) = self.save_config(app_handle).await {
                println!("Failed to save default config: {}", e);
                return Err(e);
            }
        } else {
            println!("Config loaded successfully");
        }
        Ok(())
    }
    
    pub fn add_localhost_connection(&self) {
        let localhost_client = VmixClientWrapper::new("127.0.0.1", 8088);
        
        // Add to HTTP connections (default)
        self.http_connections.lock().unwrap().push(localhost_client);
        
        // Initialize auto-refresh config for localhost
        self.auto_refresh_configs.lock().unwrap()
            .insert("127.0.0.1".to_string(), AutoRefreshConfig::default());
            
        // Set default label for localhost
        self.connection_labels.lock().unwrap()
            .insert("127.0.0.1".to_string(), "Local vMix (HTTP)".to_string());
    }
    
    pub async fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
        let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
        fs::create_dir_all(&app_data_dir).await.map_err(|e| e.to_string())?;
        Ok(app_data_dir.join("config.json"))
    }
    
    pub async fn save_config(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        let config_path = Self::get_config_path(app_handle).await?;
        println!("Saving config to: {:?}", config_path);
        
        let config = {
            let http_connections = self.http_connections.lock().unwrap();
            let tcp_connections = self.tcp_connections.lock().unwrap();
            let labels = self.connection_labels.lock().unwrap();
            let auto_configs = self.auto_refresh_configs.lock().unwrap();
            
            println!("Current HTTP connections count: {}", http_connections.len());
            println!("Current TCP connections count: {}", tcp_connections.len());
            
            let mut all_connections = Vec::new();
            
            // Add HTTP connections
            for conn in http_connections.iter() {
                let host = conn.host().to_string();
                let label = labels.get(&host).cloned().unwrap_or_else(|| format!("{} (HTTP)", host));
                let auto_refresh = auto_configs.get(&host).cloned().unwrap_or_default();
                println!("Saving HTTP connection: {} -> {}", host, label);
                
                all_connections.push(ConnectionConfig {
                    host: host.clone(),
                    port: conn.port(),
                    label,
                    auto_refresh,
                    connection_type: ConnectionType::Http,
                });
            }
            
            // Add TCP connections
            for conn in tcp_connections.iter() {
                let host = conn.host().to_string();
                let label = labels.get(&host).cloned().unwrap_or_else(|| format!("{} (TCP)", host));
                let auto_refresh = auto_configs.get(&host).cloned().unwrap_or_default();
                println!("Saving TCP connection: {} -> {}", host, label);
                
                all_connections.push(ConnectionConfig {
                    host: host.clone(),
                    port: conn.port(),
                    label,
                    auto_refresh,
                    connection_type: ConnectionType::Tcp,
                });
            }
            
            AppConfig {
                connections: all_connections,
                app_settings: Some(self.app_settings.lock().unwrap().clone()),
                logging_config: Some(crate::logging::LOGGING_CONFIG.lock().unwrap().clone()),
            }
        };
        
        let json_data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        println!("Config JSON: {}", json_data);
        
        fs::write(&config_path, json_data).await.map_err(|e| e.to_string())?;
        println!("Config saved successfully");
        
        Ok(())
    }
    
    pub async fn load_config(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        let config_path = Self::get_config_path(app_handle).await?;
        
        // Check if config file exists using tokio::fs
        if !fs::try_exists(&config_path).await.unwrap_or(false) {
            return Err("Config file does not exist".to_string());
        }
        
        let json_data = fs::read_to_string(&config_path).await.map_err(|e| e.to_string())?;
        println!("Config file content: {}", json_data);
        
        let config: AppConfig = serde_json::from_str(&json_data).map_err(|e| e.to_string())?;
        println!("Parsed config with {} connections", config.connections.len());
        
        // Clear existing connections
        {
            let mut http_connections = self.http_connections.lock().unwrap();
            http_connections.clear();
        }
        {
            let mut tcp_connections = self.tcp_connections.lock().unwrap();
            tcp_connections.clear();
        }
        {
            let mut labels = self.connection_labels.lock().unwrap();
            labels.clear();
        }
        {
            let mut auto_configs = self.auto_refresh_configs.lock().unwrap();
            auto_configs.clear();
        }
        
        // Load connections from config
        for (i, conn_config) in config.connections.iter().enumerate() {
            println!("Loading connection {}: {} ({}) - {:?}", i, conn_config.host, conn_config.label, conn_config.connection_type);
            
            match conn_config.connection_type {
                ConnectionType::Http => {
                    let vmix_client = VmixClientWrapper::new(&conn_config.host, conn_config.port);
                    {
                        let mut http_connections = self.http_connections.lock().unwrap();
                        http_connections.push(vmix_client);
                    }
                },
                ConnectionType::Tcp => {
                    // TCP接続はあとで実際に接続時に作成する
                    println!("TCP connection config loaded, will create on connect: {}", conn_config.host);
                }
            }
            
            {
                let mut labels = self.connection_labels.lock().unwrap();
                labels.insert(conn_config.host.clone(), conn_config.label.clone());
            }
            {
                let mut auto_configs = self.auto_refresh_configs.lock().unwrap();
                auto_configs.insert(conn_config.host.clone(), conn_config.auto_refresh.clone());
            }
        }
        
        // Load app settings
        if let Some(app_settings) = config.app_settings {
            let mut settings = self.app_settings.lock().unwrap();
            *settings = app_settings;
            println!("Loaded app settings");
        }
        
        // Load logging config
        if let Some(logging_config) = config.logging_config {
            let mut config = crate::logging::LOGGING_CONFIG.lock().unwrap();
            *config = logging_config;
            println!("Loaded logging config");
        }
        
        println!("Config loading completed");
        
        Ok(())
    }

    pub fn start_auto_refresh_task(&self, app_handle: tauri::AppHandle) {
        let http_connections = Arc::clone(&self.http_connections);
        let configs = Arc::clone(&self.auto_refresh_configs);
        let cache = Arc::clone(&self.last_status_cache);
        let inputs_cache = Arc::clone(&self.inputs_cache);
        let video_lists_cache = Arc::clone(&self.video_lists_cache);
        let labels = Arc::clone(&self.connection_labels);

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(1));
            let mut next_refresh_times: HashMap<String, Instant> = HashMap::new();
            let mut consecutive_failures: HashMap<String, u32> = HashMap::new();

            loop {
                interval.tick().await;

                let current_connections = {
                    let guard = http_connections.lock().unwrap();
                    guard.clone()
                };

                let current_configs = {
                    let guard = configs.lock().unwrap();
                    guard.clone()
                };

                let now = Instant::now();

                for vmix in current_connections.iter() {
                    let host = vmix.host().to_string();
                    
                    if let Some(config) = current_configs.get(&host) {
                        if !config.enabled {
                            continue;
                        }

                        let should_refresh = match next_refresh_times.get(&host) {
                            Some(next_time) => now >= *next_time,
                            None => true,
                        };

                        if should_refresh {
                            // Try to get current status with retry logic
                            let mut retry_attempts = 0;
                            let max_retries = 3;
                            let mut connection_successful = false;
                            let mut active_input = 0;
                            let mut preview_input = 0;

                            while retry_attempts < max_retries && !connection_successful {
                                if retry_attempts > 0 {
                                    sleep(Duration::from_millis(500 * retry_attempts as u64)).await;
                                }

                                match vmix.get_status().await {
                                    Ok(status) if status => {
                                        active_input = vmix.get_active_input().await.unwrap_or(0);
                                        preview_input = vmix.get_preview_input().await.unwrap_or(0);
                                        connection_successful = true;
                                        consecutive_failures.remove(&host);
                                    }
                                    _ => {
                                        // If connection failed and this is not the first attempt, try to reconnect
                                        if retry_attempts > 0 && !vmix.get_status().await.unwrap_or(false) {
                                            app_log!(debug, "Connection lost to {}, will retry", host);
                                        }
                                        retry_attempts += 1;
                                    }
                                }
                            }

                            let connection_status = if connection_successful { 
                                "Connected".to_string() 
                            } else { 
                                let failures = consecutive_failures.entry(host.clone()).or_insert(0);
                                *failures += 1;
                                
                                if *failures >= 3 {
                                    "Disconnected".to_string()
                                } else {
                                    "Reconnecting".to_string()
                                }
                            };

                            let label = {
                                let labels_guard = labels.lock().unwrap();
                                labels_guard.get(&host).cloned().unwrap_or_else(|| host.clone())
                            };

                            // Get vMix data once if connected, then use it for both version/edition and inputs
                            let vmix_data_opt = if connection_successful {
                                vmix.get_vmix_data().await.ok()
                            } else {
                                None
                            };

                            // Preserve version/edition from cache if they exist, otherwise get from vMix data
                            let (version, edition) = if let Some(ref data) = vmix_data_opt {
                                (data.version.clone(), data.edition.clone())
                            } else {
                                // If no data available (failed request or disconnected), preserve cached values
                                let cache_guard = cache.lock().unwrap();
                                if let Some(cached) = cache_guard.get(&host) {
                                    (cached.version.clone(), cached.edition.clone())
                                } else {
                                    ("Unknown".to_string(), "Unknown".to_string())
                                }
                            };

                            let new_connection = VmixConnection {
                                host: host.clone(),
                                port: vmix.port(),
                                label,
                                status: connection_status,
                                active_input,
                                preview_input,
                                connection_type: ConnectionType::Http,
                                version,
                                edition,
                            };

                            // Get current inputs for comparison
                            let current_inputs = if let Some(data) = vmix_data_opt {
                                data.inputs.input.into_iter().map(|input| VmixInput {
                                    key: input.key,
                                    number: input.number.parse().unwrap_or(0),
                                    title: input.title,
                                    short_title: input.short_title,
                                    input_type: input.input_type.unwrap_or_default(),
                                    state: input.state.unwrap_or_default(),
                                }).collect::<Vec<_>>()
                            } else {
                                Vec::new()
                            };

                            // Check if status changed (including inputs comparison)
                            let status_changed = {
                                let mut cache_guard = cache.lock().unwrap();
                                let mut inputs_cache_guard = inputs_cache.lock().unwrap();
                                
                                let connection_changed = cache_guard.get(&host)
                                    .map(|cached| {
                                        cached.status != new_connection.status ||
                                        cached.active_input != new_connection.active_input ||
                                        cached.preview_input != new_connection.preview_input
                                    })
                                    .unwrap_or(true);

                                let inputs_changed = inputs_cache_guard.get(&host)
                                    .map(|cached_inputs| {
                                        // Compare inputs directly using PartialEq
                                        cached_inputs != &current_inputs
                                    })
                                    .unwrap_or(true);
                                
                                cache_guard.insert(host.clone(), new_connection.clone());
                                inputs_cache_guard.insert(host.clone(), current_inputs);
                                
                                connection_changed || inputs_changed
                            };

                            // Always emit event for connection updates
                            if status_changed {
                                let _ = app_handle.emit("vmix-status-updated", &new_connection);
                            }

                            // Also check and emit VideoLists updates
                            if new_connection.status == "Connected" {
                                let app_handle_clone = app_handle.clone();
                                let host_clone = host.clone();
                                let http_connections_clone = Arc::clone(&http_connections);
                                let video_lists_cache_clone = Arc::clone(&video_lists_cache);
                                
                                tokio::spawn(async move {
                                    // Get vMix HTTP client for this host
                                    let vmix_client = {
                                        let guard = http_connections_clone.lock().unwrap();
                                        guard.iter().find(|c| c.host() == host_clone).cloned()
                                    };
                                    
                                    if let Some(client) = vmix_client {
                                        // Get raw vmix-rs state and use shared builder function
                                        match client.get_raw_vmix_state().await {
                                            Ok(vmix_state) => {
                                                // Use shared builder function for consistent VideoList parsing
                                                let video_lists = crate::commands::build_video_lists_from_vmix(&vmix_state);
                                                
                                                app_log!(debug, "Auto-refresh retrieved {} VideoLists for host: {}", video_lists.len(), host_clone);
                                                
                                                // Check if VideoLists data has changed using cache comparison
                                                let video_lists_changed = {
                                                    let mut cache_guard = video_lists_cache_clone.lock().unwrap();
                                                    let has_changed = cache_guard.get(&host_clone)
                                                        .map(|cached_video_lists| {
                                                            let changed = cached_video_lists != &video_lists;
                                                            app_log!(debug, "Auto-refresh VideoLists comparison for {}: cached={}, new={}, changed={}", 
                                                                host_clone, cached_video_lists.len(), video_lists.len(), changed);
                                                            changed
                                                        })
                                                        .unwrap_or_else(|| {
                                                            app_log!(debug, "No cached VideoLists for {} in auto-refresh, treating as changed", host_clone);
                                                            true
                                                        });
                                                    
                                                    // Update cache with new data
                                                    cache_guard.insert(host_clone.clone(), video_lists.clone());
                                                    app_log!(debug, "Auto-refresh updated VideoLists cache for {} with {} items", host_clone, video_lists.len());
                                                    has_changed
                                                };
                                                
                                                // Only emit frontend event if data actually changed (for auto-refresh)
                                                if video_lists_changed {
                                                    let payload = serde_json::json!({
                                                        "host": host_clone,
                                                        "videoLists": video_lists
                                                    });
                                                    
                                                    if let Err(e) = app_handle_clone.emit("vmix-videolists-updated", payload) {
                                                        app_log!(error, "Failed to emit VideoLists update: {}", e);
                                                    } else {
                                                        app_log!(debug, "VideoLists auto-refresh completed for {} with {} lists (data changed)", host_clone, video_lists.len());
                                                    }
                                                } else {
                                                    app_log!(debug, "VideoLists auto-refresh completed for {} - no changes detected", host_clone);
                                                }
                                            }
                                            Err(e) => {
                                                app_log!(error, "Failed to refresh VideoLists in auto-refresh for {}: {}", host_clone, e);
                                            }
                                        }
                                    }
                                });
                            }

                            // Schedule next refresh (shorter interval if reconnecting)
                            let refresh_interval = if new_connection.status == "Reconnecting" {
                                Duration::from_secs(config.duration.min(2))
                            } else {
                                Duration::from_secs(config.duration)
                            };
                            next_refresh_times.insert(host, now + refresh_interval);
                        }
                    }
                }
            }
        });
    }

    // VideoList window registry management methods
    pub fn register_video_list_window(&self, window_id: String, host: String, list_key: String, list_title: String) {
        let window_info = VideoListWindow {
            window_id: window_id.clone(),
            host,
            list_key,
            list_title,
            created_at: std::time::Instant::now(),
        };
        
        let mut windows = self.video_list_windows.lock().unwrap();
        windows.insert(window_id.clone(), window_info);
        app_log!(info, "Registered VideoList window: {}", window_id);
    }

    pub fn unregister_video_list_window(&self, window_id: &str) {
        let mut windows = self.video_list_windows.lock().unwrap();
        if windows.remove(window_id).is_some() {
            app_log!(info, "Unregistered VideoList window: {}", window_id);
        } else {
            app_log!(warn, "Attempted to unregister non-existent VideoList window: {}", window_id);
        }
    }

    pub fn get_video_list_window(&self, window_id: &str) -> Option<VideoListWindow> {
        let windows = self.video_list_windows.lock().unwrap();
        windows.get(window_id).cloned()
    }

    pub fn get_video_list_windows_for_host(&self, host: &str) -> Vec<VideoListWindow> {
        let windows = self.video_list_windows.lock().unwrap();
        windows.values()
            .filter(|window| window.host == host)
            .cloned()
            .collect()
    }

    pub fn cleanup_stale_video_list_windows(&self, app_handle: &tauri::AppHandle) {
        let mut windows_to_remove = Vec::new();
        
        {
            let windows = self.video_list_windows.lock().unwrap();
            for (window_id, _window_info) in windows.iter() {
                // Check if window still exists in Tauri
                if app_handle.get_webview_window(window_id).is_none() {
                    windows_to_remove.push(window_id.clone());
                }
            }
        }
        
        // Remove stale entries
        for window_id in windows_to_remove {
            self.unregister_video_list_window(&window_id);
        }
    }

    // Multiviewer server management methods
    pub async fn start_multiviewer_server(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Get config first and drop the guard before any await
        let multiviewer_config = {
            let app_settings = self.app_settings.lock().unwrap();
            app_settings.multiviewer.clone()
        };
        
        if !multiviewer_config.enabled {
            app_log!(info, "Multiviewer is disabled, not starting server");
            return Ok(());
        }

        // Stop existing server if running
        self.stop_multiviewer_server();

        // Create new server
        let app_state_arc = Arc::new(self.clone());
        let server = MultiviewerServer::new(app_state_arc);
        
        // Update server config
        server.update_config(multiviewer_config.clone())?;
        
        // Start the server
        server.start()?;
        
        // Store the server
        {
            let mut server_guard = self.multiviewer_server.lock().unwrap();
            *server_guard = Some(server);
        }
        
        app_log!(info, "Multiviewer server started on port {}", multiviewer_config.port);
        Ok(())
    }

    pub fn stop_multiviewer_server(&self) {
        // Take the server out of the mutex before await
        let server = {
            let mut server_guard = self.multiviewer_server.lock().unwrap();
            server_guard.take()
        };
        
        if let Some(server) = server {
            server.stop();
            app_log!(info, "Multiviewer server stopped");
        }
    }

    pub async fn update_multiviewer_config(&self, config: crate::types::MultiviewerConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Update app settings first
        {
            let mut app_settings = self.app_settings.lock().unwrap();
            app_settings.multiviewer = config.clone();
        }
        
        // Update existing server if running
        {
            let mut server_guard = self.multiviewer_server.lock().unwrap();
            if let Some(server) = &mut *server_guard {
                server.update_config(config.clone())?;
            }
        }
        
        // Restart server if needed
        if config.enabled {
            self.start_multiviewer_server().await?;
        } else {
            self.stop_multiviewer_server();
        }
        
        Ok(())
    }

    pub fn get_multiviewer_config(&self) -> crate::types::MultiviewerConfig {
        let app_settings = self.app_settings.lock().unwrap();
        app_settings.multiviewer.clone()
    }

    pub fn get_connections(&self) -> Vec<crate::types::VmixConnection> {
        let mut connections = Vec::new();
        
        // Get HTTP connections
        {
            let http_connections = self.http_connections.lock().unwrap();
            for client in http_connections.iter() {
                let host = client.host().to_string();
                let label = {
                    let labels = self.connection_labels.lock().unwrap();
                    labels.get(&host).cloned().unwrap_or_else(|| format!("{}:8088", host))
                };
                
                connections.push(crate::types::VmixConnection {
                    host,
                    port: 8088,
                    label,
                    status: "Connected".to_string(),
                    active_input: 0,
                    preview_input: 0,
                    connection_type: crate::types::ConnectionType::Http,
                    version: "Unknown".to_string(),
                    edition: "Unknown".to_string(),
                });
            }
        }
        
        // Get TCP connections
        {
            let tcp_connections = self.tcp_connections.lock().unwrap();
            for manager in tcp_connections.iter() {
                let host = manager.host().to_string();
                let label = {
                    let labels = self.connection_labels.lock().unwrap();
                    labels.get(&host).cloned().unwrap_or_else(|| format!("{}:8088", host))
                };
                
                connections.push(crate::types::VmixConnection {
                    host,
                    port: 8088,
                    label,
                    status: "Connected".to_string(),
                    active_input: 0,
                    preview_input: 0,
                    connection_type: crate::types::ConnectionType::Tcp,
                    version: "Unknown".to_string(),
                    edition: "Unknown".to_string(),
                });
            }
        }
        
        connections
    }
}