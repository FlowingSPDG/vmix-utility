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
  version: string;
  edition: string;
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

interface VmixVideoListItem {
  key: string;
  number: number;
  title: string;
  input_type: string;
  state: string;
  selected: boolean;
  enabled: boolean;
}

interface VmixVideoListInput {
  key: string;
  number: number;
  title: string;
  input_type: string;
  state: string;
  items: VmixVideoListItem[];
  selected_index: number | null;
}

interface VMixStatusContextType {
  connections: VmixConnection[];
  autoRefreshConfigs: Record<string, AutoRefreshConfig>;
  loading: boolean;
  inputs: Record<string, VmixInput[]>; // inputs by host
  videoLists: Record<string, VmixVideoListInput[]>; // video lists by host
  connectVMix: (host: string, port?: number, connectionType?: 'Http' | 'Tcp') => Promise<VmixConnection>;
  disconnectVMix: (host: string) => Promise<void>;
  setAutoRefreshConfig: (host: string, config: AutoRefreshConfig) => Promise<void>;
  getAutoRefreshConfig: (host: string) => Promise<AutoRefreshConfig>;
  sendVMixFunction: (host: string, functionName: string, params?: Record<string, string>) => Promise<void>;
  getVMixInputs: (host: string) => Promise<VmixInput[]>;
  getVMixVideoLists: (host: string) => Promise<VmixVideoListInput[]>;
  refreshConnections: () => Promise<void>;
}

const VMixStatusContext = createContext<VMixStatusContextType | undefined>(undefined);

export const VMixStatusProvider = ({ children }: { children: React.ReactNode }) => {
  const [connections, setConnections] = useState<VmixConnection[]>([]);
  const [autoRefreshConfigs, setAutoRefreshConfigs] = useState<Record<string, AutoRefreshConfig>>({});
  const [inputs, setInputs] = useState<Record<string, VmixInput[]>>({});
  const [videoLists, setVideoLists] = useState<Record<string, VmixVideoListInput[]>>({});
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

  const fetchVideoListsForHost = useCallback(async (host: string) => {
    try {
      const vmixVideoLists = await invoke<VmixVideoListInput[]>('get_vmix_video_lists', { host });
      setVideoLists(prev => ({
        ...prev,
        [host]: vmixVideoLists
      }));
    } catch (error) {
      console.error(`Failed to fetch video lists for ${host}:`, error);
    }
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const statuses = await invoke<VmixConnection[]>('get_vmix_statuses');
      setConnections(statuses);
      
      // Fetch inputs and video lists for all connected hosts
      for (const connection of statuses) {
        if (connection.status === 'Connected') {
          await fetchInputsForHost(connection.host);
          await fetchVideoListsForHost(connection.host);
        }
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchInputsForHost, fetchVideoListsForHost]);

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
    const unlistenStatus = listen<VmixConnection>('vmix-status-updated', (event) => {
      console.log('vmix-status-updated event received:', event);
      const updatedConnection = event.payload;
      
      setConnections(prev => {
        const existingIndex = prev.findIndex(conn => conn.host === updatedConnection.host);
        if (existingIndex >= 0) {
          // Update existing connection
          const updated = [...prev];
          updated[existingIndex] = updatedConnection;
          console.log(`Updated connection status for ${updatedConnection.host}: ${updatedConnection.status}`);
          return updated;
        } else {
          // Add new connection if it doesn't exist
          console.log(`Added new connection for ${updatedConnection.host}: ${updatedConnection.status}`);
          return [...prev, updatedConnection];
        }
      });

      // If connection is established, fetch inputs
      if (updatedConnection.status === 'Connected') {
        fetchInputsForHost(updatedConnection.host);
        fetchVideoListsForHost(updatedConnection.host);
      } else if (updatedConnection.status === 'Disconnected') {
        // Clear inputs for disconnected hosts
        console.log(`Clearing inputs for disconnected host: ${updatedConnection.host}`);
        setInputs(prev => {
          const updated = { ...prev };
          delete updated[updatedConnection.host];
          return updated;
        });
        // Clear video lists for disconnected hosts
        setVideoLists(prev => {
          const updated = { ...prev };
          delete updated[updatedConnection.host];
          return updated;
        });
      }
    });

    return () => {
      unlistenStatus.then(f => f());
    };
  }, [fetchInputsForHost, fetchVideoListsForHost]);

  // Listen for connection removal events
  useEffect(() => {
    const unlistenRemoval = listen<{host: string}>('vmix-connection-removed', (event) => {
      const { host } = event.payload;
      console.log('vmix-connection-removed event received for host:', host);
      
      setConnections(prev => {
        const filtered = prev.filter(conn => conn.host !== host);
        console.log(`Removed connection ${host}, remaining connections:`, filtered.length);
        return filtered;
      });
      
      // Also clear inputs for removed host
      setInputs(prev => {
        const updated = { ...prev };
        delete updated[host];
        return updated;
      });
      
      // Also clear video lists for removed host
      setVideoLists(prev => {
        const updated = { ...prev };
        delete updated[host];
        return updated;
      });
    });

    return () => {
      unlistenRemoval.then(f => f());
    };
  }, []);

  // Listen for inputs updates (especially for TCP connections)
  useEffect(() => {
    const unlistenInputs = listen<{host: string, inputs: VmixInput[]}>('vmix-inputs-updated', (event) => {
      const { host, inputs: updatedInputs } = event.payload;
      
      setInputs(prev => ({
        ...prev,
        [host]: updatedInputs
      }));
      
      console.log(`Inputs updated for ${host}:`, updatedInputs);
    });

    return () => {
      unlistenInputs.then(f => f());
    };
  }, []);

  // Listen for video lists updates
  useEffect(() => {
    console.log('Setting up vmix-videolists-updated listener');
    const unlistenVideoLists = listen<{host: string, videoLists: VmixVideoListInput[]}>('vmix-videolists-updated', (event) => {
      const { host, videoLists: updatedVideoLists } = event.payload;
      
      console.log(`VideoLists update event received for ${host}:`, updatedVideoLists);
      
      setVideoLists(prev => {
        // Deep clone to ensure all object references are new
        const deepClonedVideoLists = updatedVideoLists.map(list => ({
          ...list,
          items: list.items.map(item => ({
            ...item // Create new reference for each item
          }))
        }));
        
        const updated = {
          ...prev,
          [host]: deepClonedVideoLists
        };
        
        console.log('VideoLists state updated with deep clone:', updated);
        console.log('Object references changed:', prev[host] !== updated[host]);
        return updated;
      });
    });

    return () => {
      console.log('Cleaning up vmix-videolists-updated listener');
      unlistenVideoLists.then(f => f());
    };
  }, []);

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
        await fetchVideoListsForHost(host);
      }
      
      return connection;
    } catch (error) {
      console.error('Failed to connect to vMix:', error);
      throw error;
    }
  };

  const disconnectVMix = async (host: string): Promise<void> => {
    try {
      console.log(`Disconnecting from vMix host: ${host}`);
      
      // Optimistically remove from UI immediately for better UX
      setConnections(prev => {
        const filtered = prev.filter(conn => conn.host !== host);
        console.log(`Optimistically removed connection ${host}, remaining:`, filtered.length);
        return filtered;
      });
      
      // Clear inputs immediately
      setInputs(prev => {
        const updated = { ...prev };
        delete updated[host];
        return updated;
      });
      
      // Clear video lists immediately
      setVideoLists(prev => {
        const updated = { ...prev };
        delete updated[host];
        return updated;
      });
      
      // Call backend to actually disconnect
      await invoke('disconnect_vmix', { host });
      
      // Backend will also emit vmix-connection-removed event, but UI is already updated
      
    } catch (error) {
      console.error('Failed to disconnect from vMix:', error);
      // Restore connection on error by refreshing
      loadConnections();
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

  const getVMixVideoLists = async (host: string): Promise<VmixVideoListInput[]> => {
    try {
      const vmixVideoLists = await invoke<VmixVideoListInput[]>('get_vmix_video_lists', { host });
      setVideoLists(prev => ({
        ...prev,
        [host]: vmixVideoLists
      }));
      return vmixVideoLists;
    } catch (error) {
      console.error('Failed to get vMix video lists:', error);
      throw error;
    }
  };

  const contextValue: VMixStatusContextType = {
    connections,
    autoRefreshConfigs,
    loading,
    inputs,
    videoLists,
    connectVMix,
    disconnectVMix,
    setAutoRefreshConfig,
    getAutoRefreshConfig,
    sendVMixFunction,
    getVMixInputs,
    getVMixVideoLists,
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