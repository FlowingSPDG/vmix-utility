use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::sync::Mutex;
use reqwest;
use quick_xml::de;

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

    // TODO: Implement function query
    async fn send_function(&self, function: &str) -> Result<()> {
        let url = format!("{}/?Function={}", self.base_url, function);
        let response = self.client
            .get(&url)
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
async fn send_vmix_function(host: String, function: String) -> Result<String, String> {
    let vmix = VmixHttpClient::new(&host, 8088);
    vmix.send_function(&function).await.map_err(|e| e.to_string())?;
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
    connections: Mutex<Vec<VmixHttpClient>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            connections: Mutex::new(Vec::new()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
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
    let status = vmix.get_status().await.map_err(|e| e.to_string())?;
    
    if status {
        state.connections.lock().unwrap().push(vmix.clone());
    }
    
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
    let mut connections = state.connections.lock().unwrap();
    connections.retain(|c| c.host() != host);
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            connect_vmix,
            disconnect_vmix,
            get_vmix_status,
            get_vmix_statuses,
            send_vmix_function,
            get_vmix_inputs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
