use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::app_log;
use semver::Version;

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
pub struct InputOverlay {
    #[serde(rename = "@index")]
    pub index: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub crop: bool,
    pub zorder: i32,
    pub panx: f32,
    pub pany: f32,
    pub zoom: f32,
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
    #[serde(rename = "overlay", default)]
    pub overlays: Vec<InputOverlay>,
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
    #[serde(default)]
    pub version: String,
    pub connections: Vec<ConnectionConfig>,
    pub app_settings: Option<AppSettings>,
    pub logging_config: Option<LoggingConfig>,
}

// Config version and migration support
pub fn default_config_version() -> String {
    "1.0".to_string()
}

impl AppConfig {
    pub fn migrate(&mut self) {
        // Set version if empty
        if self.version.is_empty() {
            self.version = default_config_version();
        }
        
        // Perform any necessary migrations based on version
        match self.version.as_str() {
            "" | "0.1" => {
                // Legacy config migration
                app_log!(info, "Migrating config from legacy to v1.0");
                self.version = "1.0".to_string();
            }
            _ => {
                // Config is up to date
            }
        }
    }
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
    #[serde(default)]
    pub multiviewer: MultiviewerConfig,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_vmix_ip: "127.0.0.1".to_string(),
            default_vmix_port: 8088,
            theme: ThemeMode::Auto,
            ui_density: UIDensity::default(),
            multiviewer: MultiviewerConfig::default(),
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

// Helper function to parse vMix version
pub fn parse_vmix_version(version_str: &str) -> Option<Version> {
    // Handle various vMix version formats
    let cleaned = version_str
        .replace("vMix ", "")
        .replace(" Basic", "")
        .replace(" HD", "")
        .replace(" 4K", "")
        .replace(" Pro", "")
        .split(' ')
        .next()?
        .to_string();
    
    app_log!(debug, "Parsing vMix version: '{}' -> '{}'", version_str, cleaned);
    
    // Try to parse as semver
    if let Ok(version) = Version::parse(&cleaned) {
        return Some(version);
    }
    
    // Handle version strings that don't have patch version (e.g., "26.0")
    if cleaned.matches('.').count() == 1 {
        let with_patch = format!("{}.0", cleaned);
        if let Ok(version) = Version::parse(&with_patch) {
            return Some(version);
        }
    }
    
    // Handle version strings that don't have minor and patch versions (e.g., "26")
    if !cleaned.contains('.') {
        let with_minor_patch = format!("{}.0.0", cleaned);
        if let Ok(version) = Version::parse(&with_minor_patch) {
            return Some(version);
        }
    }
    
    app_log!(warn, "Failed to parse vMix version: '{}'", version_str);
    None
}

// Helper function to check if multiviewer is supported
pub fn is_multiviewer_supported(version_str: &str, edition: &str) -> bool {
    // Only Pro edition supports multiviewer
    if !edition.contains("Pro") {
        app_log!(debug, "Multiviewer not supported: edition '{}' is not Pro", edition);
        return false;
    }
    
    // Parse version
    if let Some(version) = parse_vmix_version(version_str) {
        // Multiviewer requires vMix 26.0.0.65 or later
        let min_version = Version::new(26, 0, 0);
        let supported = version >= min_version;
        app_log!(debug, "Multiviewer support check: version {} {} minimum {}", 
            version, if supported { ">=" } else { "<" }, min_version);
        supported
    } else {
        // If we can't parse the version, assume it's not supported
        app_log!(warn, "Cannot determine multiviewer support: failed to parse version '{}'", version_str);
        false
    }
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiviewerConfig {
    pub enabled: bool,
    pub port: u16,
    pub overlay_text: String,
    #[serde(default)]
    pub selected_connection: String,
}

impl Default for MultiviewerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 8089,
            overlay_text: "vMix Multiviewer".to_string(),
            selected_connection: String::new(),
        }
    }
}