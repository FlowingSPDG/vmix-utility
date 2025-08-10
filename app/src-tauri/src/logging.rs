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
            if config.enabled {
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