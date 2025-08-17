import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import CompactVideoListView from '../components/CompactVideoListView';
import { diagnosticsService } from '../services/diagnosticsService';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { vmixService } from '../services/vmixService';

// Using VmixVideoListItem and VmixVideoListInput from useVMixStatus hook

interface SingleVideoListProps {
  host?: string;
  listKey?: string;
}

const SingleVideoList: React.FC<SingleVideoListProps> = ({ host, listKey }) => {
  const [error, setError] = useState<string | null>(null);
  
  // Use global VMixStatusProvider instead of direct API calls
  const { videoLists: contextVideoLists, connections } = useVMixStatus();

  // Get URL parameters if not provided as props
  const urlParams = new URLSearchParams(window.location.search);
  const targetHost = host || urlParams.get('host') || '';
  const targetListKey = listKey || urlParams.get('listKey') || '';
  
  console.log('SingleVideoList initialized:', { targetHost, targetListKey, url: window.location.href });

  // Get video list from global cache
  const videoList = useMemo(() => {
    const hostVideoLists = contextVideoLists[targetHost] || [];
    return hostVideoLists.find(list => list.key === targetListKey) || null;
  }, [contextVideoLists, targetHost, targetListKey]);

  // Check if connection exists for this host
  const connectionExists = useMemo(() => {
    return connections.some(conn => conn.host === targetHost && conn.status === 'Connected');
  }, [connections, targetHost]);

  // Set loading state based on connection and data availability
  const loading = useMemo(() => {
    if (!connectionExists) return false; // Don't show loading if no connection
    return !videoList && targetHost && targetListKey; // Loading if we expect data but don't have it
  }, [connectionExists, videoList, targetHost, targetListKey]);
  
  // Development tools and debugging
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Auto-open devtools in development
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const currentWindow = getCurrentWindow();
        if ('openDevtools' in currentWindow && typeof currentWindow.openDevtools === 'function') {
          currentWindow.openDevtools().catch((error: unknown) => {
            console.warn('Failed to open devtools:', error);
          });
        }
      });

      // Add global diagnostic function for testing
      (window as any).debugVideoListWindows = async () => {
        try {
          return await diagnosticsService.getVideoListWindowsDiagnostic();
        } catch (error) {
          console.error('❌ Failed to get diagnostic info:', error);
        }
      };

      console.log('🔧 Development mode: Call window.debugVideoListWindows() to see window registry');
    }
  }, []);

  // Set page title with better formatting
  useEffect(() => {
    if (targetHost && targetListKey) {
      document.title = `VideoList: ${targetHost} - ${targetListKey}`;
    } else {
      document.title = 'VideoList - Loading...';
    }
  }, [targetHost, targetListKey]);

  // Set error state based on data availability
  useEffect(() => {
    if (!targetHost || !targetListKey) {
      setError('Missing required parameters: host and listKey');
      return;
    }

    if (!connectionExists) {
      setError(`No active connection found for host: ${targetHost}`);
      return;
    }

    if (!loading && !videoList) {
      setError(`VideoList with key "${targetListKey}" not found`);
      return;
    }

    // Clear error if we have valid data
    if (videoList) {
      setError(null);
    }
  }, [targetHost, targetListKey, connectionExists, loading, videoList]);

  const handleItemSelected = async (_listKey: string, itemIndex: number) => {
    if (!targetHost || !videoList) return;
    
    try {
      await vmixService.selectVideoListItem(targetHost, videoList.number, itemIndex);
      
      // No need to manually refresh - backend will emit vmix-videolists-updated event
      // which will automatically update the global cache via VMixStatusProvider
    } catch (err) {
      console.error('Failed to select item:', err);
      setError(`Failed to select item: ${err}`);
    }
  };

  if (!targetHost || !targetListKey) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Missing required parameters: host and listKey
          <br />
          <Typography variant="caption" display="block" sx={{ mt: 1, opacity: 0.7 }}>
            Current URL: {window.location.href}
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!videoList) {
    return (
      <Box p={3}>
        <Alert severity="info">
          VideoList not found or no data available.
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Input {videoList.number}: {videoList.title}
      </Typography>
      
      <Card>
        <CardContent>
          <CompactVideoListView 
            videoLists={[videoList]} 
            onItemSelected={handleItemSelected}
            showPathsToggle={false}
            initialExpandedLists={new Set([videoList.key])}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default SingleVideoList;