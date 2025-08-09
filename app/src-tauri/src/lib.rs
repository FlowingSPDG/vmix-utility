use serde::{Deserialize, Serialize};
use anyhow::Result;
use tauri::tray::TrayIconBuilder;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use std::path::PathBuf;
use tokio::time::{interval, sleep};
use tokio::fs;
use tauri::{Emitter, Manager};
use tauri::{
    menu::{Menu, MenuItem}
};
use log::info;
use chrono::Local;
use once_cell::sync::Lazy;
use std::io::Write;
use std::fs::OpenOptions;
use vmix_rs::http::HttpVmixClient;
// Duration already imported above

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct VmixXml {
    version: String,
    edition: String,
    #[serde(rename = "preset")]
    preset: Option<String>,
    inputs: Inputs,
    active: Option<String>,
    preview: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Inputs {
    #[serde(rename = "input", default)]
    input: Vec<Input>,
}

#[derive(Debug, Deserialize)]
struct Input {
    #[serde(rename = "@key")]
    key: String,
    #[serde(rename = "@number")]
    number: String,
    #[serde(rename = "@title")]
    title: String,
    #[serde(rename = "@type")]
    input_type: Option<String>,
    #[serde(rename = "@state")]
    state: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct VmixInput {
    key: String,
    number: i32,
    title: String,
    input_type: String,
    state: String,
}

// Using vmix_rs::http::VmixHttpClient instead of custom implementation

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AutoRefreshConfig {
    enabled: bool,
    duration: u64, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConnectionConfig {
    host: String,
    label: String,
    auto_refresh: AutoRefreshConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppConfig {
    connections: Vec<ConnectionConfig>,
    app_settings: Option<AppSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppSettings {
    startup_auto_launch: bool,
    default_vmix_ip: String,
    default_vmix_port: u16,
    refresh_interval: u32,
    theme: String,
    auto_reconnect: bool,
    auto_reconnect_interval: u32,
    max_log_file_size: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            startup_auto_launch: true,
            default_vmix_ip: "127.0.0.1".to_string(),
            default_vmix_port: 8088,
            refresh_interval: 1000,
            theme: "light".to_string(),
            auto_reconnect: true,
            auto_reconnect_interval: 5000,
            max_log_file_size: 10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LoggingConfig {
    enabled: bool,
    level: String,
    save_to_file: bool,
    file_path: Option<PathBuf>,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            level: "info".to_string(),
            save_to_file: false,
            file_path: None,
        }
    }
}

// Global logging configuration
static LOGGING_CONFIG: Lazy<Arc<Mutex<LoggingConfig>>> = Lazy::new(|| {
    Arc::new(Mutex::new(LoggingConfig::default()))
});

// Custom logger that writes to file
struct FileLogger {
    file_path: PathBuf,
}

impl FileLogger {
    fn new(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    fn log(&self, level: &str, message: &str) {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let log_line = format!("[{}] {} - {}\n", timestamp, level, message);
        
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.file_path)
        {
            let _ = file.write_all(log_line.as_bytes());
        }
    }
}

// Initialize logging with file output
fn init_logging(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = app_data_dir.join("logs");
    
    // Create logs directory if it doesn't exist
    std::fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    
    // Generate log filename with timestamp
    let timestamp = Local::now().format("%Y%m%d-%H%M%S");
    let log_filename = format!("{}.log", timestamp);
    let log_path = logs_dir.join(log_filename);
    
    // Update global logging config with file path
    {
        let mut config = LOGGING_CONFIG.lock().unwrap();
        config.file_path = Some(log_path.clone());
        config.save_to_file = true;
    }
    
    info!("Logging initialized with file: {:?}", log_path);
    
    Ok(())
}

// Custom logging macro that respects configuration
macro_rules! app_log {
    ($level:ident, $($arg:tt)*) => {
        {
            let config = LOGGING_CONFIG.lock().unwrap();
            if config.enabled {
                let message = format!($($arg)*);
                
                // Log to console
                log::$level!("{}", message);
                
                // Log to file if enabled
                if config.save_to_file {
                    if let Some(ref file_path) = config.file_path {
                        let logger = FileLogger::new(file_path.clone());
                        logger.log(stringify!($level), &message);
                    }
                }
            }
        }
    };
}

impl Default for AutoRefreshConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            duration: 3,
        }
    }
}

// Wrapper for HttpVmixClient to include host information
#[derive(Debug, Clone)]
#[allow(dead_code)]
struct VmixClientWrapper {
    client: HttpVmixClient,
    host: String,
    port: u16,
}

impl VmixClientWrapper {
    fn new(host: &str, port: u16) -> Self {
        let client = HttpVmixClient::new_with_host_port(host, port, Duration::from_secs(10));
        Self {
            client,
            host: host.to_string(),
            port,
        }
    }

    async fn get_status(&self) -> Result<bool> {
        Ok(self.client.is_connected().await)
    }

    async fn get_active_input(&self) -> Result<i32> {
        let active = self.client.get_active_input().await?;
        Ok(active as i32)
    }

    async fn get_preview_input(&self) -> Result<i32> {
        let preview = self.client.get_preview_input().await?;
        Ok(preview as i32)
    }

    async fn send_function(&self, function_name: &str, params: &HashMap<String, String>) -> Result<()> {
        app_log!(info, "Sending vMix function: {} to {} with params: {:?}", function_name, self.host(), params);
        
        self.client.execute_function(function_name, params).await?;
        
        app_log!(info, "Successfully sent vMix function: {} to {}", function_name, self.host());
        Ok(())
    }

    async fn get_vmix_data(&self) -> Result<VmixXml> {
        let vmix_state = self.client.get_xml_state().await?;
        // Convert vmix-rs Vmix struct to our VmixXml format
        Ok(VmixXml {
            version: vmix_state.version,
            edition: vmix_state.edition,
            preset: Some(vmix_state.preset),
            inputs: Inputs {
                input: vmix_state.inputs.input.into_iter().map(|input| Input {
                    key: input.key,
                    number: input.number.to_string(),
                    title: input.title.clone(),
                    input_type: Some(input.input_type),
                    state: Some("Unknown".to_string()), // TODO: Convert State enum properly
                }).collect(),
            },
            active: Some(vmix_state.active),
            preview: Some(vmix_state.preview),
        })
    }

    fn host(&self) -> &str {
        &self.host
    }
}

// Old VmixHttpClient implementation removed - using vmix-rs HttpVmixClient via VmixClientWrapper

// Additional Tauri command for sending vMix functions
#[tauri::command]
async fn send_vmix_function(state: tauri::State<'_, AppState>, host: String, function_name: String, params: Option<HashMap<String, String>>) -> Result<String, String> {
    let params_map = params.unwrap_or_default();
    
    app_log!(info, "Sending vMix function command: {} to host: {}", function_name, host);
    
    // First check if connection exists
    let has_connection = {
        let connections = state.connections.lock().unwrap();
        connections.iter().any(|c| c.host() == host)
    };
    
    if has_connection {
        // Use existing connection - need to clone to avoid lifetime issues
        let vmix_clone = {
            let connections = state.connections.lock().unwrap();
            connections.iter().find(|c| c.host() == host).cloned()
        };
        
        if let Some(vmix) = vmix_clone {
            match vmix.send_function(&function_name, &params_map).await {
                Ok(_) => {
                    app_log!(info, "vMix function command sent successfully: {}", function_name);
                    Ok("Function sent successfully".to_string())
                }
                Err(e) => {
                    app_log!(error, "Failed to send vMix function command: {} - {}", function_name, e);
                    Err(e.to_string())
                }
            }
        } else {
            Err("Connection not found".to_string())
        }
    } else {
        // Try to establish new connection
        // Use VmixClientWrapper instead
        let vmix_clone = {
            let connections = state.connections.lock().unwrap();
            connections.iter().find(|c| c.host() == host).cloned()
        };
        
        if let Some(vmix) = vmix_clone {
            match vmix.send_function(&function_name, &params_map).await {
                Ok(_) => {
                    app_log!(info, "vMix function command sent successfully to new connection: {}", function_name);
                    Ok("Function sent successfully".to_string())
                }
                Err(e) => {
                    app_log!(error, "Failed to send vMix function command to new connection: {} - {}", function_name, e);
                    Err(e.to_string())
                }
            }
        } else {
            // Create new connection if not found
            let new_vmix = VmixClientWrapper::new(&host, 8088);
            match new_vmix.send_function(&function_name, &params_map).await {
                Ok(_) => {
                    app_log!(info, "vMix function command sent successfully to new connection: {}", function_name);
                    Ok("Function sent successfully".to_string())
                }
                Err(e) => {
                    app_log!(error, "Failed to send vMix function command to new connection: {} - {}", function_name, e);
                    Err(e.to_string())
                }
            }
        }
    }
}

// Command to get vMix inputs
#[tauri::command]
async fn get_vmix_inputs(state: tauri::State<'_, AppState>, host: String) -> Result<Vec<VmixInput>, String> {
    // Find existing connection or create new one
    let vmix_clone = {
        let connections = state.connections.lock().unwrap();
        connections.iter().find(|c| c.host() == host).cloned()
    };
    
    let vmix_data = match vmix_clone {
        Some(vmix) => vmix.get_vmix_data().await.map_err(|e| e.to_string())?,
        None => {
            // Try to establish new connection
            let vmix = VmixClientWrapper::new(&host, 8088);
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

struct AppState {
    connections: Arc<Mutex<Vec<VmixClientWrapper>>>,
    auto_refresh_configs: Arc<Mutex<HashMap<String, AutoRefreshConfig>>>,
    last_status_cache: Arc<Mutex<HashMap<String, VmixConnection>>>,
    inputs_cache: Arc<Mutex<HashMap<String, Vec<VmixInput>>>>,
    connection_labels: Arc<Mutex<HashMap<String, String>>>,
    app_settings: Arc<Mutex<AppSettings>>,
}

impl AppState {
    fn new() -> Self {
        let state = Self {
            connections: Arc::new(Mutex::new(Vec::new())),
            auto_refresh_configs: Arc::new(Mutex::new(HashMap::new())),
            last_status_cache: Arc::new(Mutex::new(HashMap::new())),
            inputs_cache: Arc::new(Mutex::new(HashMap::new())),
            connection_labels: Arc::new(Mutex::new(HashMap::new())),
            app_settings: Arc::new(Mutex::new(AppSettings::default())),
        };
        
        state
    }
    
    async fn initialize(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
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
    
    fn add_localhost_connection(&self) {
        let localhost_client = VmixClientWrapper::new("127.0.0.1", 8088);
        
        // Add to connections
        self.connections.lock().unwrap().push(localhost_client);
        
        // Initialize auto-refresh config for localhost
        self.auto_refresh_configs.lock().unwrap()
            .insert("localhost".to_string(), AutoRefreshConfig::default());
            
        // Set default label for localhost
        self.connection_labels.lock().unwrap()
            .insert("localhost".to_string(), "Local vMix".to_string());
    }
    
    async fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
        let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
        fs::create_dir_all(&app_data_dir).await.map_err(|e| e.to_string())?;
        Ok(app_data_dir.join("config.json"))
    }
    
    async fn save_config(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        let config_path = Self::get_config_path(app_handle).await?;
        println!("Saving config to: {:?}", config_path);
        
        let config = {
            let connections = self.connections.lock().unwrap();
            let labels = self.connection_labels.lock().unwrap();
            let auto_configs = self.auto_refresh_configs.lock().unwrap();
            
            println!("Current connections count: {}", connections.len());
            
            AppConfig {
                connections: connections.iter().map(|conn| {
                    let host = conn.host().to_string();
                    let label = labels.get(&host).cloned().unwrap_or_else(|| host.clone());
                    let auto_refresh = auto_configs.get(&host).cloned().unwrap_or_default();
                    println!("Saving connection: {} -> {}", host, label);
                    
                    ConnectionConfig {
                        host: host.clone(),
                        label,
                        auto_refresh,
                    }
                }).collect(),
                app_settings: Some(self.app_settings.lock().unwrap().clone()),
            }
        };
        
        let json_data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        println!("Config JSON: {}", json_data);
        
        fs::write(&config_path, json_data).await.map_err(|e| e.to_string())?;
        println!("Config saved successfully");
        
        Ok(())
    }
    
    async fn load_config(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
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
            let mut connections = self.connections.lock().unwrap();
            connections.clear();
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
            println!("Loading connection {}: {} ({})", i, conn_config.host, conn_config.label);
            let vmix_client = VmixClientWrapper::new(&conn_config.host, 8088);
            
            {
                let mut connections = self.connections.lock().unwrap();
                connections.push(vmix_client);
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
        
        println!("Config loading completed");
        
        Ok(())
    }

    fn start_auto_refresh_task(&self, app_handle: tauri::AppHandle) {
        let connections = Arc::clone(&self.connections);
        let configs = Arc::clone(&self.auto_refresh_configs);
        let cache = Arc::clone(&self.last_status_cache);
        let inputs_cache = Arc::clone(&self.inputs_cache);
        let labels = Arc::clone(&self.connection_labels);

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(1));
            let mut next_refresh_times: HashMap<String, Instant> = HashMap::new();
            let mut consecutive_failures: HashMap<String, u32> = HashMap::new();

            loop {
                interval.tick().await;

                let current_connections = {
                    let guard = connections.lock().unwrap();
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

                            let new_connection = VmixConnection {
                                host: host.clone(),
                                label,
                                status: connection_status,
                                active_input,
                                preview_input,
                            };

                            // Get current inputs for comparison
                            let current_inputs = if connection_successful {
                                match vmix.get_vmix_data().await {
                                    Ok(data) => {
                                        data.inputs.input.into_iter().map(|input| VmixInput {
                                            key: input.key,
                                            number: input.number.parse().unwrap_or(0),
                                            title: input.title,
                                            input_type: input.input_type.unwrap_or_default(),
                                            state: input.state.unwrap_or_default(),
                                        }).collect::<Vec<_>>()
                                    }
                                    Err(_) => Vec::new(),
                                }
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
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct VmixConnection {
    host: String,
    label: String,
    status: String,
    active_input: i32,
    preview_input: i32,
}

#[tauri::command]
async fn connect_vmix(state: tauri::State<'_, AppState>, app_handle: tauri::AppHandle, host: String) -> Result<VmixConnection, String> {
    app_log!(info, "Attempting to connect to vMix at {} via TCP", host);
    
    let vmix = VmixClientWrapper::new(&host, 8088);
    let _status = vmix.get_status().await.map_err(|e| {
        app_log!(error, "Failed to establish TCP connection to {}: {}", host, e);
        e.to_string()
    })?;
    
    let status = vmix.get_status().await.unwrap_or(false);
    
    if status {
        app_log!(info, "Successfully connected to vMix at {}", host);
    } else {
        app_log!(warn, "Failed to connect to vMix at {}", host);
    }
    
    // Check if this IP is already connected
    {
        let mut connections = state.connections.lock().unwrap();
        
        if let Some(existing_index) = connections.iter().position(|c| c.host() == host) {
            // Replace existing connection (for reconnection)
            connections[existing_index] = vmix;
            app_log!(debug, "Replaced existing connection for {}", host);
        } else {
            // Add new connection
            connections.push(vmix);
            app_log!(debug, "Added new connection for {}", host);
        }
    }
    
    // Get connection info with the clone
    
    let info_vmix = VmixClientWrapper::new(&host, 8088);
    let active_input = info_vmix.get_active_input().await.unwrap_or(0);
    let preview_input = info_vmix.get_preview_input().await.unwrap_or(0);
    
    // Initialize or update auto-refresh config
    {
        let mut configs = state.auto_refresh_configs.lock().unwrap();
        if !configs.contains_key(&host) {
            configs.insert(host.clone(), AutoRefreshConfig::default());
        }
    }
    
    let label = {
        let labels = state.connection_labels.lock().unwrap();
        labels.get(&host).cloned().unwrap_or_else(|| format!("{} (TCP)", host))
    };
    
    // Save configuration after connection change
    let _ = state.save_config(&app_handle).await;
    
    Ok(VmixConnection {
        host: host.clone(),
        label,
        status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
        active_input,
        preview_input,
    })
}

#[tauri::command]
async fn disconnect_vmix(state: tauri::State<'_, AppState>, app_handle: tauri::AppHandle, host: String) -> Result<(), String> {
    {
        let mut connections = state.connections.lock().unwrap();
        connections.retain(|c| c.host() != host);
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
async fn get_vmix_status(state: tauri::State<'_, AppState>, host: String) -> Result<VmixConnection, String> {
    // Find existing connection or create new one
    let vmix = {
        let connections = state.connections.lock().unwrap();
        connections.iter().find(|c| c.host() == host).cloned()
    }.unwrap_or_else(|| VmixClientWrapper::new(&host, 8088));
    let status = vmix.get_status().await.map_err(|e| e.to_string())?;
    let active_input = vmix.get_active_input().await.unwrap_or(0);
    let preview_input = vmix.get_preview_input().await.unwrap_or(0);
    
    let label = {
        let labels = state.connection_labels.lock().unwrap();
        labels.get(&host).cloned().unwrap_or_else(|| host.clone())
    };
    
    Ok(VmixConnection {
        host: host.clone(),
        label,
        status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
        active_input,
        preview_input,
    })
}

#[tauri::command]
async fn get_vmix_statuses(state: tauri::State<'_, AppState>) -> Result<Vec<VmixConnection>, String> {
    let connections = {
        let guard = state.connections.lock().unwrap();
        guard.clone()
    };
    let mut statuses = Vec::new();

    for vmix in connections.iter() {
        let status = vmix.get_status().await.unwrap_or(false);
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        let host = vmix.host().to_string();
        
        let label = {
            let labels = state.connection_labels.lock().unwrap();
            labels.get(&host).cloned().unwrap_or_else(|| host.clone())
        };
        
        statuses.push(VmixConnection {
            host,
            label,
            status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
            active_input,
            preview_input,
        });
    }

    Ok(statuses)
}

#[tauri::command]
async fn set_auto_refresh_config(
    state: tauri::State<'_, AppState>, 
    host: String, 
    config: AutoRefreshConfig
) -> Result<(), String> {
    state.auto_refresh_configs.lock().unwrap()
        .insert(host, config);
    Ok(())
}

#[tauri::command]
async fn get_auto_refresh_config(
    state: tauri::State<'_, AppState>, 
    host: String
) -> Result<AutoRefreshConfig, String> {
    Ok(state.auto_refresh_configs.lock().unwrap()
        .get(&host)
        .cloned()
        .unwrap_or_default())
}

#[tauri::command]
async fn get_all_auto_refresh_configs(
    state: tauri::State<'_, AppState>
) -> Result<HashMap<String, AutoRefreshConfig>, String> {
    Ok(state.auto_refresh_configs.lock().unwrap().clone())
}

#[tauri::command]
async fn update_connection_label(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
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
async fn get_connection_labels(
    state: tauri::State<'_, AppState>
) -> Result<HashMap<String, String>, String> {
    Ok(state.connection_labels.lock().unwrap().clone())
}

#[tauri::command]
async fn save_settings(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle
) -> Result<(), String> {
    state.save_config(&app_handle).await
}

#[tauri::command]
async fn set_logging_config(level: String, save_to_file: bool) -> Result<(), String> {
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
async fn get_logging_config() -> Result<LoggingConfig, String> {
    let config = LOGGING_CONFIG.lock().unwrap();
    Ok(config.clone())
}

#[tauri::command]
async fn save_app_settings(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
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
async fn get_app_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.app_settings.lock().unwrap();
    Ok(settings.clone())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppInfo {
    version: String,
    git_commit_hash: String,
    git_branch: String,
    build_timestamp: String,
}

#[tauri::command]
async fn get_app_info(app_handle: tauri::AppHandle) -> Result<AppInfo, String> {
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
async fn open_logs_directory(app_handle: tauri::AppHandle) -> Result<(), String> {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UpdateInfo {
    available: bool,
    current_version: String,
    latest_version: Option<String>,
    body: Option<String>,
}

#[tauri::command]
async fn check_for_updates(app_handle: tauri::AppHandle) -> Result<UpdateInfo, String> {
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
async fn install_update(app_handle: tauri::AppHandle) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize env_logger for console output
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
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
            install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
