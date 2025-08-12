use crate::types::LoggingConfig;
use chrono::Local;
use once_cell::sync::Lazy;
use std::io::Write;
use std::fs::OpenOptions;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use log::info;
use tauri::Manager;

// Global logging configuration
pub static LOGGING_CONFIG: Lazy<Arc<Mutex<LoggingConfig>>> = Lazy::new(|| {
    Arc::new(Mutex::new(LoggingConfig::default()))
});

// Custom logger that writes to file
pub struct FileLogger {
    file_path: PathBuf,
}

impl FileLogger {
    pub fn new(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    pub fn log(&self, level: &str, message: &str) {
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
pub fn init_logging(app_handle: &tauri::AppHandle) -> Result<(), String> {
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
#[macro_export]
macro_rules! app_log {
    ($level:ident, $($arg:tt)*) => {
        {
            let config = $crate::logging::LOGGING_CONFIG.lock().unwrap();
            if config.enabled && $crate::logging::should_log_level(stringify!($level), &config.level) {
                let message = format!($($arg)*);
                
                // Log to console
                log::$level!("{}", message);
                
                // Log to file if enabled
                if config.save_to_file {
                    if let Some(ref file_path) = config.file_path {
                        let logger = $crate::logging::FileLogger::new(file_path.clone());
                        logger.log(stringify!($level), &message);
                    }
                }
            }
        }
    };
}

// Helper function to check if log level should be output
pub fn should_log_level(current_level: &str, config_level: &str) -> bool {
    let level_priority = |level: &str| -> u8 {
        match level.to_lowercase().as_str() {
            "error" => 4,
            "warn" => 3,
            "info" => 2,
            "debug" => 1,
            _ => 0,
        }
    };
    
    level_priority(current_level) >= level_priority(config_level)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_level_filtering() {
        // Test error level allows error only
        assert!(should_log_level("error", "error"));
        assert!(!should_log_level("warn", "error"));
        assert!(!should_log_level("info", "error"));
        assert!(!should_log_level("debug", "error"));

        // Test warn level allows warn and error
        assert!(should_log_level("error", "warn"));
        assert!(should_log_level("warn", "warn"));
        assert!(!should_log_level("info", "warn"));
        assert!(!should_log_level("debug", "warn"));

        // Test info level allows info, warn, and error
        assert!(should_log_level("error", "info"));
        assert!(should_log_level("warn", "info"));
        assert!(should_log_level("info", "info"));
        assert!(!should_log_level("debug", "info"));

        // Test debug level allows all
        assert!(should_log_level("error", "debug"));
        assert!(should_log_level("warn", "debug"));
        assert!(should_log_level("info", "debug"));
        assert!(should_log_level("debug", "debug"));
    }
}