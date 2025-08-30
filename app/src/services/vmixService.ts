import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Re-export types from useVMixStatus for consistency
export interface VmixConnection {
  host: string;
  port: number;
  label: string;
  status: string;
  active_input: number;
  preview_input: number;
  connection_type: 'Http' | 'Tcp';
  version: string;
  edition: string;
  preset?: string;
}

export interface VmixInput {
  key: string;
  number: number;
  title: string;
  short_title?: string;
  input_type: string;
  state: string;
}

export interface VmixVideoListItem {
  key: string;
  number: number;
  title: string;
  input_type: string;
  state: string;
  selected: boolean;
  enabled: boolean;
}

export interface VmixVideoListInput {
  key: string;
  number: number;
  title: string;
  input_type: string;
  state: string;
  items: VmixVideoListItem[];
  selected_index: number | null;
}

export interface AutoRefreshConfig {
  enabled: boolean;
  duration: number;
}

/**
 * Centralized vMix service for all Tauri backend communication.
 * 
 * Note: Most components should use the useVMixStatus hook instead of calling
 * these functions directly, as the hook provides caching and real-time updates.
 * These functions are primarily for use within the VMixStatusProvider itself
 * or for special cases that need direct backend communication.
 */
export const vmixService = {
  // Connection management
  async connectVMix(host: string, port?: number, connectionType: 'Http' | 'Tcp' = 'Http'): Promise<VmixConnection> {
    return invoke<VmixConnection>('connect_vmix', { host, port, connectionType });
  },

  async disconnectVMix(host: string): Promise<void> {
    return invoke('disconnect_vmix', { host });
  },

  async getVMixStatuses(): Promise<VmixConnection[]> {
    return invoke<VmixConnection[]>('get_vmix_statuses');
  },

  // Data fetching
  async getVMixInputs(host: string, port?: number): Promise<VmixInput[]> {
    return invoke<VmixInput[]>('get_vmix_inputs', { host, port });
  },

  async getVMixVideoLists(host: string, port?: number): Promise<VmixVideoListInput[]> {
    return invoke<VmixVideoListInput[]>('get_vmix_video_lists', { host, port });
  },

  // vMix function execution
  async sendVMixFunction(host: string, functionName: string, params?: Record<string, string>): Promise<void> {
    return invoke('send_vmix_function', { host, functionName, params });
  },

  async selectVideoListItem(host: string, inputNumber: number, itemIndex: number): Promise<void> {
    return invoke('select_video_list_item', { host, inputNumber, itemIndex });
  },

  // Window management
  async openVideoListWindow(host: string, listKey: string, listTitle: string): Promise<void> {
    return invoke('open_video_list_window', { host, listKey, listTitle });
  },

  // Auto-refresh configuration
  async getAutoRefreshConfig(host: string): Promise<AutoRefreshConfig> {
    return invoke<AutoRefreshConfig>('get_auto_refresh_config', { host });
  },

  async getAllAutoRefreshConfigs(): Promise<Record<string, AutoRefreshConfig>> {
    return invoke<Record<string, AutoRefreshConfig>>('get_all_auto_refresh_configs');
  },

  async setAutoRefreshConfig(host: string, config: AutoRefreshConfig): Promise<void> {
    return invoke('set_auto_refresh_config', { host, config });
  },

  // Event listening
  listenForVideoListsUpdates(callback: (event: { payload: { host: string, videoLists: VmixVideoListInput[] } }) => void) {
    return listen<{host: string, videoLists: VmixVideoListInput[]}>(VMIX_EVENTS.VIDEOLISTS_UPDATED, callback);
  },

  listenForStatusUpdates(callback: (event: { payload: VmixConnection }) => void) {
    return listen<VmixConnection>(VMIX_EVENTS.STATUS_UPDATED, callback);
  },

  listenForConnectionRemoved(callback: (event: { payload: {host: string} }) => void) {
    return listen<{host: string}>(VMIX_EVENTS.CONNECTION_REMOVED, callback);
  },

  listenForInputsUpdates(callback: (event: { payload: {host: string, inputs: VmixInput[]} }) => void) {
    return listen<{host: string, inputs: VmixInput[]}>(VMIX_EVENTS.INPUTS_UPDATED, callback);
  }

};

/**
 * Event names for vMix-related Tauri events.
 * Use these constants instead of hardcoding event names.
 */
export const VMIX_EVENTS = {
  STATUS_UPDATED: 'vmix-status-updated',
  CONNECTION_REMOVED: 'vmix-connection-removed', 
  INPUTS_UPDATED: 'vmix-inputs-updated',
  VIDEOLISTS_UPDATED: 'vmix-videolists-updated'
} as const;

export type VmixEventName = typeof VMIX_EVENTS[keyof typeof VMIX_EVENTS];