use serde::{Deserialize, Serialize};
use vmix_rs::vmix::VmixApi;
use anyhow::Error;
use std::sync::Mutex;
use std::net::SocketAddr;
use std::time::Duration;
use futures::TryFutureExt;

struct AppState {
    connections: Mutex<Vec<VmixApi>>,
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
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn connect_vmix(state: tauri::State<'_, AppState>, host: String) -> Result<VmixConnection, String> {
    let socket_addr = SocketAddr::new(host.parse().unwrap(), 8088);
    let mut vmix = VmixApi::new(socket_addr, Duration::from_secs(10)).await.map_err(|e| e.to_string())?;
    let status = vmix.connect().await.map_err(|e: Error| e.to_string())?;
    let status = vmix.get_status().await.map_err(|e: Error| e.to_string())?;
    
    state.connections.lock().unwrap().push(vmix.clone());
    
    Ok(VmixConnection {
        host: host.clone(),
        label: host,
        status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
        active_input: vmix.get_active_input().await.unwrap_or(0),
        preview_input: vmix.get_preview_input().await.unwrap_or(0),
    })
}

#[tauri::command]
async fn disconnect_vmix(host: String) -> Result<(), String> {
    let socket_addr = SocketAddr::new(host.parse().unwrap(), 8088);
    let mut vmix = VmixApi::new(socket_addr, Duration::from_secs(10)).map_err(|e| e.to_string())?;
    vmix.disconnect().await.map_err(|e: Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_vmix_status(host: String) -> Result<VmixConnection, String> {
    let socket_addr = SocketAddr::new(host.parse().unwrap(), 8088);
    let mut vmix = VmixApi::new(socket_addr, Duration::from_secs(10)).map_err(|e| e.to_string())?;
    
    let status = vmix.get_status().await.map_err(|e: Error| e.to_string())?;
    
    Ok(VmixConnection {
        host: host.clone(),
        label: host,
        status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
        active_input: vmix.get_active_input().await.unwrap_or(0),
        preview_input: vmix.get_preview_input().await.unwrap_or(0),
    })
}

#[tauri::command]
async fn get_vmix_statuses(state: tauri::State<'_, AppState>) -> Result<Vec<VmixConnection>, String> {
    let connections = state.connections.lock().unwrap();
    let mut statuses = Vec::new();

    for vmix in connections.iter() {
        let status = vmix.get_status().await.map_err(|e: VmixError| e.to_string())?;
        statuses.push(VmixConnection {
            host: vmix.host().to_string(),
            label: vmix.host().to_string(),
            status: if status { "Connected".to_string() } else { "Disconnected".to_string() },
            active_input: vmix.get_active_input().await.unwrap_or(0),
            preview_input: vmix.get_preview_input().await.unwrap_or(0),
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
            greet,
            connect_vmix,
            disconnect_vmix,
            get_vmix_status,
            get_vmix_statuses
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
