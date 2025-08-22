import { invoke } from '@tauri-apps/api/core';

export interface MultiviewerConfig {
  enabled: boolean;
  port: number;
  refresh_interval: number; // in milliseconds
  selected_connection?: string; // host:port
}

export const multiviewerService = {
  async getConfig(): Promise<MultiviewerConfig> {
    return invoke<MultiviewerConfig>('get_multiviewer_config');
  },

  async updateConfig(config: MultiviewerConfig): Promise<void> {
    return invoke('update_multiviewer_config', { config });
  },

  async startServer(): Promise<void> {
    return invoke('start_multiviewer_server');
  },

  async stopServer(): Promise<void> {
    return invoke('stop_multiviewer_server');
  },

  async getMultiviewerUrl(): Promise<string> {
    return invoke<string>('get_multiviewer_url');
  },
};

