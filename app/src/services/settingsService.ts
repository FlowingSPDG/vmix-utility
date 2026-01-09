import { invoke } from '@tauri-apps/api/core';

export interface AppSettings {
  default_vmix_ip: string;
  default_vmix_port: number;
  theme: string;
  ui_density: string;
  enable_http_server?: boolean;
  http_server_port?: number;
}

export interface LoggingConfig {
  level: string;
  save_to_file: boolean;
}

export interface AppInfo {
  version: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  module?: string;
  target?: string;
}

/**
 * Service for application settings and configuration operations
 */
export const settingsService = {
  /**
   * Get application settings from backend
   */
  async getAppSettings(): Promise<AppSettings | null> {
    try {
      return await invoke<AppSettings>('get_app_settings');
    } catch (error) {
      console.error('Failed to get app settings:', error);
      throw error;
    }
  },

  /**
   * Save application settings to backend
   */
  async saveAppSettings(settings: {
    defaultVMixIP: string;
    defaultVMixPort: number;
    theme: string;
    uiDensity: string;
    enableHttpServer?: boolean;
    httpServerPort?: number;
  }): Promise<void> {
    try {
      await invoke('save_app_settings', {
        settings: {
          default_vmix_ip: settings.defaultVMixIP,
          default_vmix_port: settings.defaultVMixPort,
          theme: settings.theme,
          ui_density: settings.uiDensity,
          enable_http_server: settings.enableHttpServer ?? false,
          http_server_port: settings.httpServerPort ?? 3000,
        }
      });
    } catch (error) {
      console.error('Failed to save app settings:', error);
      throw error;
    }
  },

  /**
   * Get logging configuration from backend
   */
  async getLoggingConfig(): Promise<LoggingConfig | null> {
    try {
      return await invoke<LoggingConfig>('get_logging_config');
    } catch (error) {
      console.error('Failed to get logging config:', error);
      throw error;
    }
  },

  /**
   * Set logging configuration
   */
  async setLoggingConfig(level: string, saveToFile: boolean): Promise<void> {
    try {
      await invoke('set_logging_config', {
        level,
        saveToFile
      });
    } catch (error) {
      console.error('Failed to set logging config:', error);
      throw error;
    }
  },

  /**
   * Get application information
   */
  async getAppInfo(): Promise<AppInfo | null> {
    try {
      return await invoke<AppInfo>('get_app_info');
    } catch (error) {
      console.error('Failed to get app info:', error);
      throw error;
    }
  },

  /**
   * Open logs directory
   */
  async openLogsDirectory(): Promise<void> {
    try {
      await invoke('open_logs_directory');
    } catch (error) {
      console.error('Failed to open logs directory:', error);
      throw error;
    }
  },

  /**
   * Update connection label
   */
  async updateConnectionLabel(host: string, label: string): Promise<void> {
    try {
      await invoke('update_connection_label', {
        host,
        label: label.trim()
      });
    } catch (error) {
      console.error('Failed to update connection label:', error);
      throw error;
    }
  },

  /**
   * Get application logs
   */
  async getAppLogs(limit?: number, filter?: string, levelFilter?: string): Promise<LogEntry[]> {
    try {
      return await invoke<LogEntry[]>('get_app_logs', {
        limit,
        filter,
        level_filter: levelFilter
      });
    } catch (error) {
      console.error('Failed to get app logs:', error);
      throw error;
    }
  },

  /**
   * Get HTTP server logs
   */
  async getHttpServerLogs(limit?: number, filter?: string, levelFilter?: string): Promise<LogEntry[]> {
    try {
      return await invoke<LogEntry[]>('get_http_server_logs', {
        limit,
        filter,
        level_filter: levelFilter
      });
    } catch (error) {
      console.error('Failed to get HTTP server logs:', error);
      throw error;
    }
  },
};