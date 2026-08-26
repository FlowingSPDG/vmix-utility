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

/// vMix connections use the HTTP API only (legacy `"Tcp"` in config is migrated on load).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum ConnectionType {
    Http,
}

impl Default for ConnectionType {
    fn default() -> Self {
        ConnectionType::Http
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
enum SavedConnectionType {
    Http,
    Tcp,
}

impl Default for SavedConnectionType {
    fn default() -> Self {
        SavedConnectionType::Http
    }
}

#[derive(Deserialize)]
struct ConnectionConfigDe {
    host: String,
    port: u16,
    label: String,
    auto_refresh: AutoRefreshConfig,
    #[serde(default)]
    connection_type: SavedConnectionType,
}

impl From<ConnectionConfigDe> for ConnectionConfig {
    fn from(c: ConnectionConfigDe) -> Self {
        // Legacy TCP API used port 8099; HTTP default is 8088.
        let port = match c.connection_type {
            SavedConnectionType::Tcp if c.port == 8099 => 8088,
            _ => c.port,
        };
        ConnectionConfig {
            host: c.host,
            port,
            label: c.label,
            auto_refresh: c.auto_refresh,
            connection_type: ConnectionType::Http,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct AutoRefreshConfig {
    pub enabled: bool,
    pub duration: u64, // milliseconds
}

impl Default for AutoRefreshConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            duration: 3000, // 3 seconds in milliseconds
        }
    }
}

impl Serialize for AutoRefreshConfig {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AutoRefreshConfig", 2)?;
        state.serialize_field("enabled", &self.enabled)?;
        state.serialize_field("duration", &self.duration)?;
        state.end()
    }
}

impl<'de> Deserialize<'de> for AutoRefreshConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct AutoRefreshConfigHelper {
            enabled: bool,
            duration: u64,
        }
        
        let helper = AutoRefreshConfigHelper::deserialize(deserializer)?;
        
        // Migration: If duration is less than 100, assume it's in seconds (old format)
        // and convert to milliseconds. Otherwise, assume it's already in milliseconds.
        let duration_ms = if helper.duration < 100 {
            // Old format: seconds -> milliseconds
            helper.duration * 1000
        } else {
            // New format: already in milliseconds
            helper.duration
        };
        
        // Clamp to valid range: 100ms to 10000ms
        let duration_ms = duration_ms.max(100).min(10000);
        
        Ok(AutoRefreshConfig {
            enabled: helper.enabled,
            duration: duration_ms,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub label: String,
    pub auto_refresh: AutoRefreshConfig,
    pub connection_type: ConnectionType,
}

impl<'de> Deserialize<'de> for ConnectionConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        ConnectionConfigDe::deserialize(deserializer).map(Into::into)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub connections: Vec<ConnectionConfig>,
    pub app_settings: Option<AppSettings>,
    pub logging_config: Option<LoggingConfig>,
    #[serde(default)]
    pub donation_prompt: Option<DonationPromptConfig>,
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

fn default_locale() -> String {
    String::new()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_vmix_ip: String,
    pub default_vmix_port: u16,
    pub theme: ThemeMode,
    #[serde(default)]
    pub ui_density: UIDensity,
    #[serde(default = "default_locale")]
    pub locale: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_vmix_ip: "127.0.0.1".to_string(),
            default_vmix_port: 8088,
            theme: ThemeMode::Auto,
            ui_density: UIDensity::default(),
            locale: default_locale(),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DonationPromptConfig {
    pub last_shown: Option<String>,       // RFC3339 timestamp
    pub permanently_dismissed: bool,       // "今後表示しない" flag
}

impl Default for DonationPromptConfig {
    fn default() -> Self {
        Self {
            last_shown: None,
            permanently_dismissed: false
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CachedUpdateStatus {
    pub checked: bool,
    pub info: Option<UpdateInfo>,
    pub error: Option<String>,
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