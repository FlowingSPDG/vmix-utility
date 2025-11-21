use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;
use serde::{Serialize, Deserialize};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Semaphore;
use crate::http_client::VmixClientWrapper;
use std::result::Result as StdResult;
use network_interface::{NetworkInterface as NativeNetworkInterface, NetworkInterfaceConfig};

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
    pub preset: Option<String>,
}

pub fn get_network_interfaces() -> Result<Vec<NetworkInterface>> {
    // network-interfaceライブラリを使用してプラットフォームネイティブにネットワークインターフェースを取得
    let native_interfaces = NativeNetworkInterface::show()
        .map_err(|e| anyhow::anyhow!("Failed to get network interfaces: {}", e))?;
    
    let mut interfaces = Vec::new();
    
    for native_iface in native_interfaces {
        // IPv4アドレスのみを処理
        for addr in &native_iface.addr {
            if let network_interface::Addr::V4(ipv4_addr) = addr {
                let ip_str = ipv4_addr.ip.to_string();
                
                // より厳密なIPv4アドレスのバリデーション
                if is_valid_ipv4_address(&ip_str) && is_usable_ipv4_address(&ip_str) {
                    // サブネットを推定
                    let subnet = if let Some(parts) = ip_str.split('.').collect::<Vec<&str>>().get(0..3) {
                        format!("{}.{}.{}", parts[0], parts[1], parts[2])
                    } else {
                        continue;
                    };
                    
                    let interface = NetworkInterface {
                        name: native_iface.name.clone(),
                        ip_address: ip_str,
                        subnet,
                        is_up: true, // network-interfaceライブラリは有効なインターフェースのみを返す
                    };
                    
                    interfaces.push(interface);
                }
            }
        }
    }
    
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
    
    // vMix HTTP APIを使用してvMixの存在を確認し、プリセット名も取得
    match check_vmix_http_api(addr).await {
        Ok(vmix_data) => {
            let response_time = start_time.elapsed().as_millis() as u64;
            Some(VmixScanResult {
                ip_address: addr.ip().to_string(),
                port: addr.port(),
                is_vmix: true,
                response_time,
                error_message: None,
                preset: vmix_data.preset,
            })
        }
        Err(_e) => None,
    }
}

async fn check_vmix_http_api(addr: SocketAddr) -> Result<crate::types::VmixXml> {
    let host = addr.ip().to_string();
    let port = addr.port();
    
    // VmixClientWrapperを使用してHTTP APIでvMixの存在を確認
    let client = VmixClientWrapper::new(&host, port);
    
    // 短いタイムアウトでXMLを取得・パースできた場合のみ成功とみなす
    match tokio::time::timeout(Duration::from_secs(1), client.get_vmix_data()).await {
        Ok(Ok(xml)) => Ok(xml),
        Ok(Err(e)) => Err(anyhow::anyhow!("HTTP API XML error: {}", e)),
        Err(_) => Err(anyhow::anyhow!("HTTP API timeout")),
    }
}

/// IPv4アドレスの形式が正しいかチェック
fn is_valid_ipv4_address(ip: &str) -> bool {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    
    for part in parts {
        match part.parse::<u8>() {
            Ok(_) => continue,
            Err(_) => return false,
        }
    }
    
    true
}

/// 使用可能なIPv4アドレスかチェック（ループバック、リンクローカル、マルチキャストアドレスを除外）
fn is_usable_ipv4_address(ip: &str) -> bool {
    // ループバックアドレス (127.0.0.0/8)
    if ip.starts_with("127.") {
        return false;
    }
    
    // リンクローカルアドレス (169.254.0.0/16)
    if ip.starts_with("169.254.") {
        return false;
    }
    
    // マルチキャストアドレス (224.0.0.0/4)
    if let Ok(parts) = ip.split('.').map(|p| p.parse::<u8>()).collect::<StdResult<Vec<u8>, _>>() {
        if parts.len() == 4 && parts[0] >= 224 && parts[0] <= 239 {
            return false;
        }
    }
    
    // ブロードキャストアドレス (255.255.255.255)
    if ip == "255.255.255.255" {
        return false;
    }
    
    // プライベートアドレス（10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16）は使用可能
    // vMixは通常プライベートネットワークで動作するため
    
    true
}
