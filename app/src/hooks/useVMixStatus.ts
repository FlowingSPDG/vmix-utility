import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { vmixService, type VmixConnection, type VmixInput, type VmixVideoListInput, type AutoRefreshConfig } from '../services/vmixService';

// Types are now imported from vmixService

interface VMixStatusContextType {
  connections: VmixConnection[];
  autoRefreshConfigs: Record<string, AutoRefreshConfig>;
  loading: boolean;
  inputsLoading: Record<string, boolean>; // Track loading state for each host's inputs
  videoListsLoading: Record<string, boolean>; // Track loading state for each host's video lists
  inputs: Record<string, VmixInput[]>; // inputs by host
  videoLists: Record<string, VmixVideoListInput[]>; // video lists by host
  connectVMix: (host: string, port?: number, connectionType?: 'Http' | 'Tcp') => Promise<VmixConnection>;
  disconnectVMix: (host: string) => Promise<void>;
  setAutoRefreshConfig: (host: string, config: AutoRefreshConfig) => Promise<void>;
  getAutoRefreshConfig: (host: string) => Promise<AutoRefreshConfig>;
  sendVMixFunction: (host: string, functionName: string, params?: Record<string, string>) => Promise<void>;
  getVMixInputs: (host: string) => Promise<VmixInput[]>;
  getVMixVideoLists: (host: string) => Promise<VmixVideoListInput[]>;
  selectVideoListItem: (host: string, inputNumber: number, itemIndex: number) => Promise<void>;
  openVideoListWindow: (host: string, listKey: string, listTitle: string) => Promise<void>;
  refreshConnections: () => Promise<void>;
}

const VMixStatusContext = createContext<VMixStatusContextType | undefined>(undefined);

export const VMixStatusProvider = ({ children }: { children: React.ReactNode }) => {
  const [connections, setConnections] = useState<VmixConnection[]>([]);
  const [autoRefreshConfigs, setAutoRefreshConfigs] = useState<Record<string, AutoRefreshConfig>>({});
  const [inputs, setInputs] = useState<Record<string, VmixInput[]>>({});
  const [videoLists, setVideoLists] = useState<Record<string, VmixVideoListInput[]>>({});
  const [loading, setLoading] = useState(false);
  const [inputsLoading, setInputsLoading] = useState<Record<string, boolean>>({});
  const [videoListsLoading, setVideoListsLoading] = useState<Record<string, boolean>>({});
  
  // Track optimistically removed connections to ignore status updates temporarily
  const [optimisticallyRemovedHosts, setOptimisticallyRemovedHosts] = useState<Set<string>>(new Set());

  const fetchInputsForHost = useCallback(async (host: string) => {
    try {
      setInputsLoading(prev => ({ ...prev, [host]: true }));
      const vmixInputs = await vmixService.getVMixInputs(host);
      setInputs(prev => ({
        ...prev,
        [host]: vmixInputs
      }));
    } catch (error) {
      console.error(`Failed to fetch inputs for ${host}:`, error);
    } finally {
      setInputsLoading(prev => ({ ...prev, [host]: false }));
    }
  }, []);

  const fetchVideoListsForHost = useCallback(async (host: string) => {
    try {
      setVideoListsLoading(prev => ({ ...prev, [host]: true }));
      const vmixVideoLists = await vmixService.getVMixVideoLists(host);
      setVideoLists(prev => ({
        ...prev,
        [host]: vmixVideoLists
      }));
    } catch (error) {
      console.error(`Failed to fetch video lists for ${host}:`, error);
    } finally {
      setVideoListsLoading(prev => ({ ...prev, [host]: false }));
    }
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const statuses = await vmixService.getVMixStatuses();
      setConnections(statuses);
      
      // Fetch inputs and video lists for all connected hosts asynchronously
      // Don't wait for these to complete - let them run in background
      for (const connection of statuses) {
        if (connection.status === 'Connected') {
          // Fire and forget - don't await
          fetchInputsForHost(connection.host);
          fetchVideoListsForHost(connection.host);
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
      const configs = await vmixService.getAllAutoRefreshConfigs();
      setAutoRefreshConfigs(configs);
    } catch (error) {
      console.error('Failed to load auto refresh configs:', error);
    }
  }, []);

  // Listen for status updates from Tauri backend
  useEffect(() => {
    const unlistenStatus = vmixService.listenForStatusUpdates((event) => {
      console.log('vmix-status-updated event received:', event);
      const updatedConnection = event.payload;
      
      // Ignore status updates for optimistically removed hosts
      if (optimisticallyRemovedHosts.has(updatedConnection.host)) {
        console.log(`Ignoring status update for optimistically removed host: ${updatedConnection.host}`);
        return;
      }
      
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
  }, [fetchInputsForHost, fetchVideoListsForHost, optimisticallyRemovedHosts]);

  // Listen for connection removal events
  useEffect(() => {
    const unlistenRemoval = vmixService.listenForConnectionRemoved((event) => {
      const { host } = event.payload;
      console.log('vmix-connection-removed event received for host:', host);
      
      // Remove from optimistically removed list since removal is now confirmed
      setOptimisticallyRemovedHosts(prev => {
        const updated = new Set(prev);
        updated.delete(host);
        console.log(`Removed ${host} from optimistically removed list`);
        return updated;
      });
      
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
    const unlistenInputs = vmixService.listenForInputsUpdates((event) => {
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
    const unlistenVideoLists = vmixService.listenForVideoListsUpdates((event) => {
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
      // Reduced wait time for faster initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        await loadConnections();
        await loadAutoRefreshConfigs();
      } catch (error) {
        console.error('Initial data load failed, retrying in 500ms...', error);
        // Reduced retry delay for better UX
        setTimeout(async () => {
          try {
            await loadConnections();
            await loadAutoRefreshConfigs();
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          }
        }, 500);
      }
    };

    loadInitialData();
  }, [loadConnections, loadAutoRefreshConfigs]);


  const connectVMix = async (host: string, port?: number, connectionType: 'Http' | 'Tcp' = 'Http'): Promise<VmixConnection> => {
    try {
      console.log('Connecting to vMix:', host, port, connectionType);
      const connection = await vmixService.connectVMix(host, port, connectionType);
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
      
      // Add to optimistically removed list to ignore status updates temporarily
      setOptimisticallyRemovedHosts(prev => new Set([...prev, host]));
      
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
      await vmixService.disconnectVMix(host);
      
      // Backend will also emit vmix-connection-removed event, but UI is already updated
      
    } catch (error) {
      console.error('Failed to disconnect from vMix:', error);
      
      // Remove from optimistically removed list on error
      setOptimisticallyRemovedHosts(prev => {
        const updated = new Set(prev);
        updated.delete(host);
        return updated;
      });
      
      // Restore connection on error by refreshing
      loadConnections();
      throw error;
    }
  };

  const setAutoRefreshConfig = async (host: string, config: AutoRefreshConfig): Promise<void> => {
    try {
      await vmixService.setAutoRefreshConfig(host, config);
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
      return await vmixService.getAutoRefreshConfig(host);
    } catch (error) {
      console.error('Failed to get auto refresh config:', error);
      throw error;
    }
  };

  const sendVMixFunction = async (host: string, functionName: string, params?: Record<string, string>): Promise<void> => {
    try {
      await vmixService.sendVMixFunction(host, functionName, params);
    } catch (error) {
      console.error('Failed to send vMix function:', error);
      throw error;
    }
  };

  const getVMixInputs = async (host: string): Promise<VmixInput[]> => {
    try {
      const vmixInputs = await vmixService.getVMixInputs(host);
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
      const vmixVideoLists = await vmixService.getVMixVideoLists(host);
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

  const selectVideoListItem = async (host: string, inputNumber: number, itemIndex: number): Promise<void> => {
    try {
      await vmixService.selectVideoListItem(host, inputNumber, itemIndex);
      
      // The backend will emit vmix-videolists-updated event when vMix state changes
      // No manual refresh needed - rely on AutoUpdate events
    } catch (error) {
      console.error('Failed to select video list item:', error);
      throw error;
    }
  };

  const openVideoListWindow = async (host: string, listKey: string, listTitle: string): Promise<void> => {
    try {
      console.log(`🚀 Opening VideoList popup - Host: ${host}, Key: ${listKey}, Title: ${listTitle}`);
      await vmixService.openVideoListWindow(host, listKey, listTitle);
      console.log(`✅ VideoList popup window request sent successfully`);
    } catch (error) {
      console.error('❌ Failed to open VideoList popup window:', error);
      throw error;
    }
  };

  const contextValue: VMixStatusContextType = {
    connections: connections.filter(conn => !optimisticallyRemovedHosts.has(conn.host)),
    autoRefreshConfigs,
    loading,
    inputsLoading,
    videoListsLoading,
    inputs,
    videoLists,
    connectVMix,
    disconnectVMix,
    setAutoRefreshConfig,
    getAutoRefreshConfig,
    sendVMixFunction,
    getVMixInputs,
    getVMixVideoLists,
    selectVideoListItem,
    openVideoListWindow,
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