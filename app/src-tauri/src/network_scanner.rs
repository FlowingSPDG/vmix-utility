use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;
use serde::{Serialize, Deserialize};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Semaphore;
use crate::http_client::VmixClientWrapper;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub ip_address: String,
    pub subnet: String,
    pub is_up: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmixScanResult {
    pub ip_address: String,
    pub port: u16,
    pub is_vmix: bool,
    pub response_time: u64,
    pub error_message: Option<String>,
}

pub fn get_network_interfaces() -> Result<Vec<NetworkInterface>> {
    let mut interfaces = Vec::new();
    
    // Windows環境でのネットワークインターフェース取得
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let output = Command::new("ipconfig")
            .output()
            .map_err(|e| anyhow::anyhow!("Failed to execute ipconfig: {}", e))?;
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = output_str.lines().collect();
        
        let mut current_interface = None;
        
        for line in lines {
            let line = line.trim();
            
            // アダプター名の検出
            if line.ends_with(":") && !line.starts_with(" ") {
                if let Some(interface) = current_interface.take() {
                    interfaces.push(interface);
                }
                current_interface = Some(NetworkInterface {
                    name: line.trim_end_matches(':').to_string(),
                    ip_address: String::new(),
                    subnet: String::new(),
                    is_up: false,
                });
            }
            
            // IPv4アドレスの検出
            if let Some(interface) = &mut current_interface {
                if line.contains("IPv4") && line.contains(":") {
                    if let Some(ip_part) = line.split(':').nth(1) {
                        let ip = ip_part.trim();
                        if !ip.is_empty() && ip != "(Preferred)" {
                            interface.ip_address = ip.to_string();
                            // サブネットを推定（通常は.1-.254の範囲）
                            if let Some(parts) = ip.split('.').collect::<Vec<&str>>().get(0..3) {
                                interface.subnet = format!("{}.{}.{}", parts[0], parts[1], parts[2]);
                            }
                            interface.is_up = true;
                        }
                    }
                }
            }
        }
        
        // 最後のインターフェースを追加
        if let Some(interface) = current_interface {
            interfaces.push(interface);
        }
    }
    
    // Linux/macOS環境でのネットワークインターフェース取得
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        
        let output = Command::new("ip")
            .args(["addr", "show"])
            .output()
            .map_err(|e| anyhow::anyhow!("Failed to execute ip addr: {}", e))?;
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = output_str.lines().collect();
        
        let mut current_interface = None;
        
        for line in lines {
            let line = line.trim();
            
            // インターフェース名の検出
            if line.contains(':') && !line.starts_with(" ") {
                if let Some(interface) = current_interface.take() {
                    interfaces.push(interface);
                }
                
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 2 {
                    let name = parts[1].trim();
                    current_interface = Some(NetworkInterface {
                        name: name.to_string(),
                        ip_address: String::new(),
                        subnet: String::new(),
                        is_up: true,
                    });
                }
            }
            
            // IPv4アドレスの検出
            if let Some(interface) = &mut current_interface {
                if line.contains("inet ") && !line.contains("inet6") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let ip_with_mask = parts[1];
                        if let Some(ip) = ip_with_mask.split('/').next() {
                            interface.ip_address = ip.to_string();
                            // サブネットを推定
                            if let Some(parts) = ip.split('.').collect::<Vec<&str>>().get(0..3) {
                                interface.subnet = format!("{}.{}.{}", parts[0], parts[1], parts[2]);
                            }
                        }
                    }
                }
            }
        }
        
        // 最後のインターフェースを追加
        if let Some(interface) = current_interface {
            interfaces.push(interface);
        }
    }
    
    // 有効なIPアドレスを持つインターフェースのみをフィルタ
    interfaces.retain(|iface| !iface.ip_address.is_empty() && iface.is_up);
    
    Ok(interfaces)
}

pub async fn scan_network_for_vmix(interface_name: String, app_state: &crate::state::AppState) -> Result<Vec<VmixScanResult>> {
    let interfaces = get_network_interfaces()?;
    
    // 指定されたインターフェースを検索
    let target_interface = interfaces
        .iter()
        .find(|iface| iface.name == interface_name)
        .ok_or_else(|| anyhow::anyhow!("Interface '{}' not found", interface_name))?;
    
    if target_interface.subnet.is_empty() {
        return Err(anyhow::anyhow!("Invalid subnet for interface '{}'", interface_name));
    }
    
    let subnet = target_interface.subnet.clone();
    let port = 8088;
    
    // 既に接続されているIPアドレスのリストを取得
    let connected_hosts = {
        let http_connections = app_state.http_connections.lock().unwrap();
        let tcp_connections = app_state.tcp_connections.lock().unwrap();
        
        let mut hosts = std::collections::HashSet::new();
        
        // HTTP接続からIPアドレスを取得
        for conn in http_connections.iter() {
            hosts.insert(conn.host().to_string());
        }
        
        // TCP接続からIPアドレスを取得
        for conn in tcp_connections.iter() {
            hosts.insert(conn.host().to_string());
        }
        
        hosts
    };
    
    // 並行実行数を制限するセマフォ
    let semaphore = Arc::new(Semaphore::new(50));
    let mut tasks = vec![];
    let mut results = Vec::new();
    
    // 1から254までのIPアドレスをスキャン（既に接続されているIPは除外）
    for host in 1..=254 {
        let ip_str = format!("{}.{}", subnet, host);
        
        // 既に接続されているIPはスキップ
        if connected_hosts.contains(&ip_str) {
            continue;
        }
        
        let ip: IpAddr = ip_str.parse::<Ipv4Addr>()?.into();
        let addr = SocketAddr::new(ip, port);
        let semaphore_clone = semaphore.clone();
        
        let task = tokio::spawn(async move {
            let _permit = semaphore_clone.acquire().await.unwrap();
            check_vmix_port(addr).await
        });
        
        tasks.push(task);
    }
    
    // すべてのタスクの完了を待つ
    for task in tasks {
        if let Ok(result) = task.await {
            if let Some(scan_result) = result {
                results.push(scan_result);
            }
        }
    }
    
    Ok(results)
}

async fn check_vmix_port(addr: SocketAddr) -> Option<VmixScanResult> {
    let start_time = std::time::Instant::now();
    
    // vMix HTTP APIを使用してvMixの存在を確認
    match check_vmix_http_api(addr).await {
        Ok(_) => {
            let response_time = start_time.elapsed().as_millis() as u64;
            Some(VmixScanResult {
                ip_address: addr.ip().to_string(),
                port: addr.port(),
                is_vmix: true,
                response_time,
                error_message: None,
            })
        }
        Err(_e) => None,
    }
}

async fn check_vmix_http_api(addr: SocketAddr) -> Result<()> {
    let host = addr.ip().to_string();
    let port = addr.port();
    
    // VmixClientWrapperを使用してHTTP APIでvMixの存在を確認
    let client = VmixClientWrapper::new(&host, port);
    
    // 短いタイムアウトでXMLを取得・パースできた場合のみ成功とみなす
    match tokio::time::timeout(Duration::from_secs(3), client.get_vmix_data()).await {
        Ok(Ok(_xml)) => Ok(()),
        Ok(Err(e)) => Err(anyhow::anyhow!("HTTP API XML error: {}", e)),
        Err(_) => Err(anyhow::anyhow!("HTTP API timeout")),
    }
}
