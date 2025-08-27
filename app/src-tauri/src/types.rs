use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct VmixXml {
    pub version: String,
    pub edition: String,
    #[serde(rename = "preset")]
    pub preset: Option<String>,
    pub inputs: Inputs,
    pub active: Option<String>,
    pub preview: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Inputs {
    #[serde(rename = "input", default)]
    pub input: Vec<Input>,
}

#[derive(Debug, Deserialize)]
pub struct Input {
    #[serde(rename = "@key")]
    pub key: String,
    #[serde(rename = "@number")]
    pub number: String,
    #[serde(rename = "@title")]
    pub title: String,
    #[serde(rename = "@shortTitle")]
    pub short_title: Option<String>,
    #[serde(rename = "@type")]
    pub input_type: Option<String>,
    #[serde(rename = "@state")]
    pub state: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VmixInput {
    pub key: String,
    pub number: i32,
    pub title: String,
    pub short_title: Option<String>,
    pub input_type: String,
    pub state: String,
}

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
pub struct AutoRefreshConfig {
    pub enabled: bool,
    pub duration: u64, // seconds
}

impl Default for AutoRefreshConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            duration: 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub label: String,
    pub auto_refresh: AutoRefreshConfig,
    #[serde(default)]
    pub connection_type: ConnectionType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub connections: Vec<ConnectionConfig>,
    pub app_settings: Option<AppSettings>,
    pub logging_config: Option<LoggingConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum ThemeMode {
    Light,
    Dark,
    Auto,
}

impl Default for ThemeMode {
    fn default() -> Self {
        ThemeMode::Auto
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UIDensity {
    #[serde(rename = "compact")]
    Compact,
    #[serde(rename = "comfortable")]
    Comfortable,
    #[serde(rename = "spacious")]
    Spacious,
}

impl Default for UIDensity {
    fn default() -> Self {
        UIDensity::Comfortable
    }
}

impl From<String> for UIDensity {
    fn from(s: String) -> Self {
        match s.as_str() {
            "compact" => UIDensity::Compact,
            "spacious" => UIDensity::Spacious,
            _ => UIDensity::Comfortable, // Default fallback for migration
        }
    }
}

impl From<&str> for UIDensity {
    fn from(s: &str) -> Self {
        match s {
            "compact" => UIDensity::Compact,
            "spacious" => UIDensity::Spacious,
            _ => UIDensity::Comfortable, // Default fallback for migration
        }
    }
}

impl ToString for UIDensity {
    fn to_string(&self) -> String {
        match self {
            UIDensity::Compact => "compact".to_string(),
            UIDensity::Comfortable => "comfortable".to_string(),
            UIDensity::Spacious => "spacious".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_vmix_ip: String,
    pub default_vmix_port: u16,
    pub theme: ThemeMode,
    #[serde(default)]
    pub ui_density: UIDensity,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_vmix_ip: "127.0.0.1".to_string(),
            default_vmix_port: 8088,
            theme: ThemeMode::Auto,
            ui_density: UIDensity::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub enabled: bool,
    pub level: String,
    pub save_to_file: bool,
    pub file_path: Option<PathBuf>,
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

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VmixConnection {
    pub host: String,
    pub port: u16,
    pub label: String,
    pub status: String,
    pub active_input: i32,
    pub preview_input: i32,
    pub connection_type: ConnectionType,
    pub version: String,
    pub edition: String,
    pub preset: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub version: String,
    pub git_commit_hash: String,
    pub git_branch: String,
    pub build_timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VmixVideoListItem {
    pub key: String,
    pub number: i32,
    pub title: String,
    pub input_type: String,
    pub state: String,
    pub selected: bool, // True if this is the currently selected item in the list
    pub enabled: bool,  // True if this item is enabled in the list
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VmixVideoListInput {
    pub key: String,
    pub number: i32,
    pub title: String,
    pub input_type: String,
    pub state: String,
    pub items: Vec<VmixVideoListItem>,
    pub selected_index: Option<i32>, // Currently selected item index in the list
}