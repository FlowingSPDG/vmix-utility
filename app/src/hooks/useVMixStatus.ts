import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface VmixConnection {
  host: string;
  port: number;
  label: string;
  status: string;
  active_input: number;
  preview_input: number;
  connection_type: 'Http' | 'Tcp';
}

interface AutoRefreshConfig {
  enabled: boolean;
  duration: number;
}

interface VmixInput {
  key: string;
  number: number;
  title: string;
  input_type: string;
  state: string;
}

interface VMixStatusContextType {
  connections: VmixConnection[];
  autoRefreshConfigs: Record<string, AutoRefreshConfig>;
  loading: boolean;
  inputs: Record<string, VmixInput[]>; // inputs by host
  connectVMix: (host: string, port?: number, connectionType?: 'Http' | 'Tcp') => Promise<VmixConnection>;
  disconnectVMix: (host: string) => Promise<void>;
  setAutoRefreshConfig: (host: string, config: AutoRefreshConfig) => Promise<void>;
  getAutoRefreshConfig: (host: string) => Promise<AutoRefreshConfig>;
  sendVMixFunction: (host: string, functionName: string, params?: Record<string, string>) => Promise<void>;
  getVMixInputs: (host: string) => Promise<VmixInput[]>;
  refreshConnections: () => Promise<void>;
}

const VMixStatusContext = createContext<VMixStatusContextType | undefined>(undefined);

export const VMixStatusProvider = ({ children }: { children: React.ReactNode }) => {
  const [connections, setConnections] = useState<VmixConnection[]>([]);
  const [autoRefreshConfigs, setAutoRefreshConfigs] = useState<Record<string, AutoRefreshConfig>>({});
  const [inputs, setInputs] = useState<Record<string, VmixInput[]>>({});
  const [loading, setLoading] = useState(false);

  const fetchInputsForHost = useCallback(async (host: string) => {
    try {
      const vmixInputs = await invoke<VmixInput[]>('get_vmix_inputs', { host });
      setInputs(prev => ({
        ...prev,
        [host]: vmixInputs
      }));
    } catch (error) {
      console.error(`Failed to fetch inputs for ${host}:`, error);
    }
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const statuses = await invoke<VmixConnection[]>('get_vmix_statuses');
      setConnections(statuses);
      
      // Fetch inputs for all connected hosts
      for (const connection of statuses) {
        if (connection.status === 'Connected') {
          await fetchInputsForHost(connection.host);
        }
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchInputsForHost]);

  const loadAutoRefreshConfigs = useCallback(async () => {
    try {
      const configs = await invoke<Record<string, AutoRefreshConfig>>('get_all_auto_refresh_configs');
      setAutoRefreshConfigs(configs);
    } catch (error) {
      console.error('Failed to load auto refresh configs:', error);
    }
  }, []);

  // Listen for status updates from Tauri backend
  useEffect(() => {
    const unlisten = listen<VmixConnection>('vmix-status-updated', (event) => {
      const updatedConnection = event.payload;
      
      setConnections(prev => {
        const existingIndex = prev.findIndex(conn => conn.host === updatedConnection.host);
        if (existingIndex >= 0) {
          // Update existing connection
          const updated = [...prev];
          updated[existingIndex] = updatedConnection;
          return updated;
        } else {
          // Add new connection if it doesn't exist
          return [...prev, updatedConnection];
        }
      });

      // If connection is established, fetch inputs
      if (updatedConnection.status === 'Connected') {
        fetchInputsForHost(updatedConnection.host);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [fetchInputsForHost]);

  // Load initial connections and configs with retry
  useEffect(() => {
    const loadInitialData = async () => {
      // Wait a bit for backend initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        await loadConnections();
        await loadAutoRefreshConfigs();
      } catch (error) {
        console.error('Initial data load failed, retrying in 1 second...', error);
        // Retry after 1 second if initial load fails
        setTimeout(async () => {
          try {
            await loadConnections();
            await loadAutoRefreshConfigs();
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          }
        }, 1000);
      }
    };

    loadInitialData();
  }, [loadConnections, loadAutoRefreshConfigs]);

  const connectVMix = async (host: string, port?: number, connectionType: 'Http' | 'Tcp' = 'Http'): Promise<VmixConnection> => {
    try {
      console.log('Connecting to vMix:', host, port, connectionType);
      const connection = await invoke<VmixConnection>('connect_vmix', { 
        host, 
        port, 
        connectionType 
      });
      setConnections(prev => {
        const existingIndex = prev.findIndex(conn => conn.host === host);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = connection;
          return updated;
        } else {
          return [...prev, connection];
        }
      });
      
      // Fetch inputs if connected
      if (connection.status === 'Connected') {
        await fetchInputsForHost(host);
      }
      
      return connection;
    } catch (error) {
      console.error('Failed to connect to vMix:', error);
      throw error;
    }
  };

  const disconnectVMix = async (host: string): Promise<void> => {
    try {
      await invoke('disconnect_vmix', { host });
      setConnections(prev => prev.filter(conn => conn.host !== host));
      setAutoRefreshConfigs(prev => {
        const updated = { ...prev };
        delete updated[host];
        return updated;
      });
      setInputs(prev => {
        const updated = { ...prev };
        delete updated[host];
        return updated;
      });
    } catch (error) {
      console.error('Failed to disconnect from vMix:', error);
      throw error;
    }
  };

  const setAutoRefreshConfig = async (host: string, config: AutoRefreshConfig): Promise<void> => {
    try {
      await invoke('set_auto_refresh_config', { host, config });
      setAutoRefreshConfigs(prev => ({
        ...prev,
        [host]: config
      }));
    } catch (error) {
      console.error('Failed to set auto refresh config:', error);
      throw error;
    }
  };

  const getAutoRefreshConfig = async (host: string): Promise<AutoRefreshConfig> => {
    try {
      return await invoke<AutoRefreshConfig>('get_auto_refresh_config', { host });
    } catch (error) {
      console.error('Failed to get auto refresh config:', error);
      throw error;
    }
  };

  const sendVMixFunction = async (host: string, functionName: string, params?: Record<string, string>): Promise<void> => {
    try {
      await invoke('send_vmix_function', { host, functionName, params });
    } catch (error) {
      console.error('Failed to send vMix function:', error);
      throw error;
    }
  };

  const getVMixInputs = async (host: string): Promise<VmixInput[]> => {
    try {
      const vmixInputs = await invoke<VmixInput[]>('get_vmix_inputs', { host });
      setInputs(prev => ({
        ...prev,
        [host]: vmixInputs
      }));
      return vmixInputs;
    } catch (error) {
      console.error('Failed to get vMix inputs:', error);
      throw error;
    }
  };

  const contextValue: VMixStatusContextType = {
    connections,
    autoRefreshConfigs,
    loading,
    inputs,
    connectVMix,
    disconnectVMix,
    setAutoRefreshConfig,
    getAutoRefreshConfig,
    sendVMixFunction,
    getVMixInputs,
    refreshConnections: loadConnections,
  };

  return React.createElement(VMixStatusContext.Provider, { value: contextValue }, children);
};

export const useVMixStatus = (): VMixStatusContextType => {
  const context = useContext(VMixStatusContext);
  if (context === undefined) {
    throw new Error('useVMixStatus must be used within a VMixStatusProvider');
  }
  return context;
};