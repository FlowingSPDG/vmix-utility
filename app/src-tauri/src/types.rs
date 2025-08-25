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

#[derive(Debug, Deserialize)]
pub struct InputOverlay {
    #[serde(rename = "@index")]
    pub index: String,
    #[serde(rename = "@x")]
    pub x: Option<String>,
    #[serde(rename = "@y")]
    pub y: Option<String>,
    #[serde(rename = "@width")]
    pub width: Option<String>,
    #[serde(rename = "@height")]
    pub height: Option<String>,
    #[serde(rename = "@crop")]
    pub crop: Option<String>,
    #[serde(rename = "@zorder")]
    pub zorder: Option<String>,
    #[serde(rename = "@panx")]
    pub panx: Option<String>,
    #[serde(rename = "@pany")]
    pub pany: Option<String>,
    #[serde(rename = "@zoom")]
    pub zoom: Option<String>,
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
    pub duration: u64, // seconds (legacy) or milliseconds (new)
    #[serde(default)]
    pub duration_unit: DurationUnit, // Added for migration
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DurationUnit {
    #[serde(rename = "seconds")]
    Seconds,  // Legacy format
    #[serde(rename = "milliseconds")] 
    Milliseconds, // New format
}

impl Default for DurationUnit {
    fn default() -> Self {
        DurationUnit::Seconds // Default to legacy for backward compatibility
    }
}

impl Default for AutoRefreshConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            duration: 3000, // 3 seconds in milliseconds for new installations
            duration_unit: DurationUnit::Milliseconds,
        }
    }
}

impl AutoRefreshConfig {
    // Helper method to get duration in milliseconds, handling migration
    pub fn get_duration_ms(&self) -> u64 {
        match self.duration_unit {
            DurationUnit::Seconds => self.duration * 1000,
            DurationUnit::Milliseconds => self.duration,
        }
    }
    
    // Helper method to set duration in milliseconds
    pub fn set_duration_ms(&mut self, ms: u64) {
        self.duration = ms;
        self.duration_unit = DurationUnit::Milliseconds;
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
    #[serde(default = "default_config_version")]
    pub version: String,
    pub connections: Vec<ConnectionConfig>,
    pub app_settings: Option<AppSettings>,
    pub logging_config: Option<LoggingConfig>,
}

pub fn default_config_version() -> String {
    "2.2.0".to_string() // Current version in semver format
}

impl AppConfig {
    // Migrate configuration from older versions
    pub fn migrate(&mut self) {
        // Handle the case where version field doesn't exist (old configs)
        if self.version.is_empty() {
            app_log!(info, "No version field found in config - treating as legacy config (pre-v2.2.0)");
            self.migrate_from_legacy();
            self.version = "2.2.0".to_string();
            return;
        }

        // Parse version and handle migration
        match self.version.as_str() {
            "2.2.0" => {
                // Current version, no migration needed
                app_log!(debug, "Configuration is already at current version 2.2.0");
            }
            _ => {
                // Check if it's an older version that needs migration
                if self.is_version_older_than("2.2.0") {
                    app_log!(info, "Migrating configuration from {} to 2.2.0", self.version);
                    self.migrate_from_legacy();
                    self.version = "2.2.0".to_string();
                } else {
                    // Future version, no migration needed
                    app_log!(warn, "Configuration version {} is newer than current version 2.2.0, keeping as is", self.version);
                }
            }
        }
    }

    fn migrate_from_legacy(&mut self) {
        app_log!(info, "Migrating legacy configuration to v2.2.0");
        
        // Migrate auto-refresh durations from seconds to milliseconds
        for connection in &mut self.connections {
            // If duration_unit is not set, assume it's in seconds (legacy format)
            if connection.auto_refresh.duration_unit == crate::types::DurationUnit::Seconds {
                // Convert seconds to milliseconds
                let old_duration = connection.auto_refresh.duration;
                connection.auto_refresh.duration *= 1000;
                connection.auto_refresh.duration_unit = crate::types::DurationUnit::Milliseconds;
                app_log!(info, "Migrated connection {} auto-refresh from {}s to {}ms", 
                    connection.host, old_duration, connection.auto_refresh.duration);
            }
        }
    }

    fn is_version_older_than(&self, target: &str) -> bool {
        // Use semver crate for proper semantic version comparison
        match (Version::parse(&self.version), Version::parse(target)) {
            (Ok(current), Ok(target_version)) => {
                current < target_version
            }
            (Err(e), _) => {
                app_log!(warn, "Could not parse current version '{}': {}, assuming it's older", self.version, e);
                true
            }
            (_, Err(e)) => {
                app_log!(warn, "Could not parse target version '{}': {}, assuming current is newer", target, e);
                false
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
pub struct MultiviewerConfig {
    pub enabled: bool,
    pub port: u16,
    pub selected_connection: Option<String>, // host:port
}

impl Default for MultiviewerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 8089,
            selected_connection: None,
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