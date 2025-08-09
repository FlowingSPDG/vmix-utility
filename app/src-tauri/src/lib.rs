use serde::{Deserialize, Serialize};
use serde_json;
use anyhow::Result;
use tauri::tray::TrayIconBuilder;
use vmix_rs::acts::ActivatorsData;
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
use vmix_rs::vmix::VmixApi as TcpVmixClient;
use vmix_rs::commands::{RecvCommand, SendCommand, Status};
use std::net::SocketAddr;
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum ConnectionType {
    Http,
    Tcp,
}

impl Default for ConnectionType {
    fn default() -> Self {
        ConnectionType::Http
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AutoRefreshConfig {
    enabled: bool,
    duration: u64, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConnectionConfig {
    host: String,
    port: u16,
    label: String,
    auto_refresh: AutoRefreshConfig,
    #[serde(default)]
    connection_type: ConnectionType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppConfig {
    connections: Vec<ConnectionConfig>,
    app_settings: Option<AppSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppSettings {
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

// HTTP Wrapper for HttpVmixClient to include host information
#[derive(Debug, Clone)]
#[allow(dead_code)]
struct VmixClientWrapper {
    client: HttpVmixClient,
    host: String,
    port: u16,
}

// TCP Manager for event-driven TCP handling
#[derive(Clone)]
struct TcpVmixManager {
    client: Arc<TcpVmixClient>,
    host: String,
    port: u16,
    last_xml_request: Arc<Mutex<Instant>>,
    shutdown_signal: Arc<std::sync::atomic::AtomicBool>,
}

impl TcpVmixManager {
    async fn new(host: &str, port: u16) -> Result<Self> {
        use std::net::ToSocketAddrs;
        
        let socket_addr: SocketAddr = format!("{}:{}", host, port)
            .to_socket_addrs()
            .map_err(|e| anyhow::anyhow!("Failed to resolve hostname {}: {}", host, e))?
            .next()
            .ok_or_else(|| anyhow::anyhow!("No socket address found for {}:{}", host, port))?;
        
        let client = TcpVmixClient::new(socket_addr, Duration::from_secs(10)).await
            .map_err(|e| anyhow::anyhow!("Failed to connect TCP client: {}", e))?;
            
        Ok(Self {
            client: Arc::new(client),
            host: host.to_string(),
            port,
            last_xml_request: Arc::new(Mutex::new(Instant::now())),
            shutdown_signal: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
    }
    
    fn start_monitoring(&self, app_handle: tauri::AppHandle, state: tauri::State<'_, AppState>) {
        let client: Arc<TcpVmixClient> = Arc::clone(&self.client);
        let host = self.host.clone();
        let port = self.port;
        let last_xml_request = Arc::clone(&self.last_xml_request);
        let shutdown_signal = Arc::clone(&self.shutdown_signal);
        
        // XMLコマンドの定期送信タスク
        let xml_sender_client: Arc<TcpVmixClient> = Arc::clone(&client);
        let xml_sender_shutdown = Arc::clone(&shutdown_signal);
        let xml_last_request = Arc::clone(&last_xml_request);
        let xml_sender_host = host.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(3));
            
            while !xml_sender_shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                interval.tick().await;
                
                if let Err(e) = xml_sender_client.send_command(SendCommand::XML) {
                    app_log!(error, "Failed to send XML command to {}: {}", xml_sender_host, e);
                } else {
                    let mut last_req = xml_last_request.lock().unwrap();
                    *last_req = Instant::now();
                }
            }
        });
        
        // レスポンス受信タスク
        let response_client: Arc<TcpVmixClient> = Arc::clone(&client);
        let response_shutdown = Arc::clone(&shutdown_signal);
        let response_host = host.clone();
        let inputs_cache = Arc::clone(&state.inputs_cache);
        let last_status_cache = Arc::clone(&state.last_status_cache);
        
        tokio::spawn(async move {
            while !response_shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                match response_client.try_receive_command(Duration::from_millis(100)) {
                    Ok(recv_command) => {
                        match recv_command {
                            RecvCommand::XML(xml_response) => {
                                // XMLレスポンスをパースしてイベント送信
                                if let Ok(vmix_xml) = Self::parse_xml_response(&xml_response.body) {
                                    let connection = VmixConnection {
                                        host: response_host.clone(),
                                        port,
                                        label: format!("{} (TCP)", response_host),
                                        status: "Connected".to_string(),
                                        active_input: vmix_xml.active.unwrap_or("1".to_string()).parse().unwrap_or(1),
                                        preview_input: vmix_xml.preview.unwrap_or("1".to_string()).parse().unwrap_or(1),
                                        connection_type: ConnectionType::Tcp,
                                    };
                                    let _ = app_handle.emit("vmix-status-updated", &connection);
                                    
                                    // Update inputs cache from XML and emit changes
                                    let new_inputs: Vec<VmixInput> = vmix_xml.inputs.input.iter().map(|input| VmixInput {
                                        key: input.key.clone(),
                                        number: input.number.parse().unwrap_or(0),
                                        title: input.title.clone(),
                                        input_type: input.input_type.clone().unwrap_or_default(),
                                        state: input.state.clone().unwrap_or_default(),
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
                                    
                                    // Update last status cache
                                    {
                                        let mut cache = last_status_cache.lock().unwrap();
                                        cache.insert(response_host.clone(), connection.clone());
                                    }
                                }
                            }
                            RecvCommand::ACTS(acts_event) => {
                                app_log!(debug, "ACTS event received: {:?}", acts_event);
                                if matches!(acts_event.status, Status::OK) {
                                    if let ActivatorsData::Input(input_number, active) = acts_event.body {
                                        if active {
                                            app_log!(debug, "Input {} is active (ACTS event)", input_number);
                                            // 必要に応じてここでactive inputの更新やイベント送信を行う
                                        }
                                    }
                                    if let ActivatorsData::InputPreview(input_number, active) = acts_event.body {
                                        if active {
                                            app_log!(debug, "Input {} is active (ACTS event)", input_number);
                                            // 必要に応じてここでactive inputの更新やイベント送信を行う
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    },
                    Err(_) => {
                        // タイムアウトは正常動作
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                }
            }
        });
    }
    
    async fn send_function(&self, function_name: &str, params: &HashMap<String, String>) -> Result<()> {
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
    
    fn is_connected(&self) -> bool {
        self.client.is_connected()
    }
    
    fn shutdown(&self) {
        self.shutdown_signal.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    
    fn parse_xml_response(xml: &str) -> Result<VmixXml> {
        quick_xml::de::from_str(xml)
            .map_err(|e| anyhow::anyhow!("TCP XML parse error: {}", e))
    }
    
    fn host(&self) -> &str {
        &self.host
    }
    
    fn port(&self) -> u16 {
        self.port
    }
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
    
    fn port(&self) -> u16 {
        self.port
    }
}

// Old VmixHttpClient implementation removed - using vmix-rs HttpVmixClient via VmixClientWrapper

// Additional Tauri command for sending vMix functions
#[tauri::command]
async fn send_vmix_function(state: tauri::State<'_, AppState>, host: String, port: Option<u16>, function_name: String, params: Option<HashMap<String, String>>) -> Result<String, String> {
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
async fn get_vmix_inputs(state: tauri::State<'_, AppState>, host: String, port: Option<u16>) -> Result<Vec<VmixInput>, String> {
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

struct AppState {
    http_connections: Arc<Mutex<Vec<VmixClientWrapper>>>,
    tcp_connections: Arc<Mutex<Vec<TcpVmixManager>>>,
    auto_refresh_configs: Arc<Mutex<HashMap<String, AutoRefreshConfig>>>,
    last_status_cache: Arc<Mutex<HashMap<String, VmixConnection>>>,
    inputs_cache: Arc<Mutex<HashMap<String, Vec<VmixInput>>>>,
    connection_labels: Arc<Mutex<HashMap<String, String>>>,
    app_settings: Arc<Mutex<AppSettings>>,
}

impl AppState {
    fn new() -> Self {
        let state = Self {
            http_connections: Arc::new(Mutex::new(Vec::new())),
            tcp_connections: Arc::new(Mutex::new(Vec::new())),
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
        
        // Add to HTTP connections (default)
        self.http_connections.lock().unwrap().push(localhost_client);
        
        // Initialize auto-refresh config for localhost
        self.auto_refresh_configs.lock().unwrap()
            .insert("127.0.0.1".to_string(), AutoRefreshConfig::default());
            
        // Set default label for localhost
        self.connection_labels.lock().unwrap()
            .insert("127.0.0.1".to_string(), "Local vMix (HTTP)".to_string());
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
        
        println!("Config loading completed");
        
        Ok(())
    }

    fn start_auto_refresh_task(&self, app_handle: tauri::AppHandle) {
        let http_connections = Arc::clone(&self.http_connections);
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

                            let new_connection = VmixConnection {
                                host: host.clone(),
                                port: vmix.port(),
                                label,
                                status: connection_status,
                                active_input,
                                preview_input,
                                connection_type: ConnectionType::Http,
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
    port: u16,
    label: String,
    status: String,
    active_input: i32,
    preview_input: i32,
    connection_type: ConnectionType,
}

#[tauri::command]
async fn connect_vmix(state: tauri::State<'_, AppState>, app_handle: tauri::AppHandle, host: String, port: Option<u16>, connection_type: ConnectionType) -> Result<VmixConnection, String> {
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
async fn disconnect_vmix(state: tauri::State<'_, AppState>, app_handle: tauri::AppHandle, host: String) -> Result<(), String> {
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
async fn get_vmix_status(state: tauri::State<'_, AppState>, host: String, port: Option<u16>) -> Result<VmixConnection, String> {
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
async fn get_vmix_statuses(state: tauri::State<'_, AppState>) -> Result<Vec<VmixConnection>, String> {
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
