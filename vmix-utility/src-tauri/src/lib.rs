use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use reqwest;
use quick_xml::de;
use tokio::time::{interval, sleep};
use tauri::{Emitter, Manager};
use url::Url;

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Serialize, Deserialize)]
struct VmixInput {
    key: String,
    number: i32,
    title: String,
    input_type: String,
    state: String,
}

#[derive(Debug, Clone)]
struct VmixHttpClient {
    base_url: String,
    client: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AutoRefreshConfig {
    enabled: bool,
    duration: u64, // seconds
}

impl Default for AutoRefreshConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            duration: 5,
        }
    }
}

impl VmixHttpClient {
    fn new(host: &str, port: u16) -> Self {
        Self {
            base_url: format!("http://{}:{}/api", host, port),
            client: reqwest::Client::new(),
        }
    }

    async fn get_vmix_data(&self) -> Result<VmixXml> {
        let response = self.client
            .get(&self.base_url)
            .send()
            .await?;
        
        let xml_text = response.text().await?;
        let vmix_data: VmixXml = de::from_str(&xml_text)?;
        Ok(vmix_data)
    }

    async fn get_status(&self) -> Result<bool> {
        match self.get_vmix_data().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn send_function(&self, function_name: &str, params: &HashMap<String, String>) -> Result<()> {
        // Parse base URL and add query parameters using url::Url
        let mut url = Url::parse(&self.base_url)?;
        
        // Add Function parameter automatically
        url.query_pairs_mut().append_pair("Function", function_name);
        
        // Add all parameters from HashMap
        for (key, value) in params {
            url.query_pairs_mut().append_pair(key, value);
        }
        
        let response = self.client
            .get(url.as_str())
            .send()
            .await?;
        
        // HTTP API only returns success/failure, not data
        if response.status().is_success() {
            Ok(())
        } else {
            Err(anyhow::anyhow!("Function failed"))
        }
    }

    async fn get_active_input(&self) -> Result<i32> {
        let vmix_data = self.get_vmix_data().await?;
        if let Some(active) = vmix_data.active {
            Ok(active.parse().unwrap_or(0))
        } else {
            Ok(0)
        }
    }

    async fn get_preview_input(&self) -> Result<i32> {
        let vmix_data = self.get_vmix_data().await?;
        if let Some(preview) = vmix_data.preview {
            Ok(preview.parse().unwrap_or(0))
        } else {
            Ok(0)
        }
    }

    fn host(&self) -> &str {
        // Extract host from base_url
        let start = "http://".len();
        let end = self.base_url[start..].find(':').map(|i| start + i).unwrap_or(self.base_url.len());
        &self.base_url[start..end]
    }
}

// Additional Tauri command for sending vMix functions
#[tauri::command]
async fn send_vmix_function(host: String, function_name: String, params: Option<HashMap<String, String>>) -> Result<String, String> {
    let vmix = VmixHttpClient::new(&host, 8088);
    let params_map = params.unwrap_or_default();
    vmix.send_function(&function_name, &params_map).await.map_err(|e| e.to_string())?;
    Ok("Function sent successfully".to_string())
}

// Command to get vMix inputs
#[tauri::command]
async fn get_vmix_inputs(host: String) -> Result<Vec<VmixInput>, String> {
    let vmix = VmixHttpClient::new(&host, 8088);
    let vmix_data = vmix.get_vmix_data().await.map_err(|e| e.to_string())?;
    
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
    connections: Arc<Mutex<Vec<VmixHttpClient>>>,
    auto_refresh_configs: Arc<Mutex<HashMap<String, AutoRefreshConfig>>>,
    last_status_cache: Arc<Mutex<HashMap<String, VmixConnection>>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(Vec::new())),
            auto_refresh_configs: Arc::new(Mutex::new(HashMap::new())),
            last_status_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn start_auto_refresh_task(&self, app_handle: tauri::AppHandle) {
        let connections = Arc::clone(&self.connections);
        let configs = Arc::clone(&self.auto_refresh_configs);
        let cache = Arc::clone(&self.last_status_cache);

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(1));
            let mut next_refresh_times: HashMap<String, Instant> = HashMap::new();

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
                            None => true, // First time, refresh immediately
                        };

                        if should_refresh {
                            // Get current status
                            if let Ok(status) = vmix.get_status().await {
                                let active_input = vmix.get_active_input().await.unwrap_or(0);
                                let preview_input = vmix.get_preview_input().await.unwrap_or(0);

                                let new_connection = VmixConnection {
                                    host: host.clone(),
                                    label: host.clone(),
                                    status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
                                    active_input,
                                    preview_input,
                                };

                                // Check if status changed
                                let status_changed = {
                                    let mut cache_guard = cache.lock().unwrap();
                                    let changed = cache_guard.get(&host)
                                        .map(|cached| {
                                            cached.status != new_connection.status ||
                                            cached.active_input != new_connection.active_input ||
                                            cached.preview_input != new_connection.preview_input
                                        })
                                        .unwrap_or(true);
                                    
                                    cache_guard.insert(host.clone(), new_connection.clone());
                                    changed
                                };

                                // Emit event only if status changed
                                if status_changed {
                                    let _ = app_handle.emit("vmix-status-updated", &new_connection);
                                }
                            }

                            // Schedule next refresh
                            next_refresh_times.insert(host, now + Duration::from_secs(config.duration));
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
async fn connect_vmix(state: tauri::State<'_, AppState>, host: String) -> Result<VmixConnection, String> {
    let vmix = VmixHttpClient::new(&host, 8088);
    let status = vmix.get_status().await.unwrap_or(false);
    
    state.connections.lock().unwrap().push(vmix.clone());
    // Initialize auto-refresh config for new connection
    state.auto_refresh_configs.lock().unwrap()
        .insert(host.clone(), AutoRefreshConfig::default());
    
    let active_input = vmix.get_active_input().await.unwrap_or(0);
    let preview_input = vmix.get_preview_input().await.unwrap_or(0);
    
    Ok(VmixConnection {
        host: host.clone(),
        label: host,
        status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
        active_input,
        preview_input,
    })
}

#[tauri::command]
async fn disconnect_vmix(state: tauri::State<'_, AppState>, host: String) -> Result<(), String> {
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
    Ok(())
}

#[tauri::command]
async fn get_vmix_status(host: String) -> Result<VmixConnection, String> {
    let vmix = VmixHttpClient::new(&host, 8088);
    let status = vmix.get_status().await.map_err(|e| e.to_string())?;
    let active_input = vmix.get_active_input().await.unwrap_or(0);
    let preview_input = vmix.get_preview_input().await.unwrap_or(0);
    
    Ok(VmixConnection {
        host: host.clone(),
        label: host,
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
        let status = vmix.get_status().await.map_err(|e| e.to_string())?;
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);
        
        statuses.push(VmixConnection {
            host: vmix.host().to_string(),
            label: vmix.host().to_string(),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_state = app.state::<AppState>();
            let app_handle = app.handle();
            
            // Start auto-refresh background task
            // app_state.start_auto_refresh_task(app_handle.clone());
            
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
            get_all_auto_refresh_configs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
