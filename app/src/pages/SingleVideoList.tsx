import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import CompactVideoListView from '../components/CompactVideoListView';

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

interface SingleVideoListProps {
  host?: string;
  listKey?: string;
}

const SingleVideoList: React.FC<SingleVideoListProps> = ({ host, listKey }) => {
  const [videoList, setVideoList] = useState<VmixVideoListInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get URL parameters if not provided as props
  const urlParams = new URLSearchParams(window.location.search);
  const targetHost = host || urlParams.get('host') || '';
  const targetListKey = listKey || urlParams.get('listKey') || '';
  
  console.log('SingleVideoList initialized:', { targetHost, targetListKey, url: window.location.href });
  
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
          const diagnostic = await invoke('get_video_list_windows_diagnostic');
          console.log('🔧 VideoList Windows Diagnostic:', diagnostic);
          return diagnostic;
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

  useEffect(() => {
    if (targetHost && targetListKey) {
      fetchVideoList();
    }
  }, [targetHost, targetListKey]);

  // Listen for VideoList updates from the backend
  useEffect(() => {
    if (!targetHost || !targetListKey) {
      console.log('⚠️ Skipping event listener setup - missing host or listKey');
      return;
    }

    console.log(`🎧 Setting up VideoList update listener for ${targetHost}:${targetListKey}`);

    const unlistenVideoListsUpdated = listen('vmix-videolists-updated', (event) => {
      const payload = event.payload as any;
      
      if (payload.host === targetHost && payload.videoLists) {
        const foundList = payload.videoLists.find((list: VmixVideoListInput) => list.key === targetListKey);
        if (foundList) {
          console.log(`✅ VideoList updated: ${targetHost}:${targetListKey}`);
          setVideoList(foundList);
        } else {
          console.log(`⚠️ VideoList not found in update: ${targetListKey}`);
        }
      }
    });

    return () => {
      console.log(`🧹 Cleaning up VideoList listener for ${targetHost}:${targetListKey}`);
      unlistenVideoListsUpdated.then(fn => fn());
    };
  }, [targetHost, targetListKey]);

  const fetchVideoList = async () => {
    if (!targetHost) return;

    setLoading(true);
    setError(null);
    
    try {
      const lists = await invoke<VmixVideoListInput[]>('get_vmix_video_lists', {
        host: targetHost
      });
      
      const foundList = lists.find(list => list.key === targetListKey);
      if (foundList) {
        setVideoList(foundList);
      } else {
        setError(`VideoList with key "${targetListKey}" not found`);
      }
    } catch (err) {
      setError(err as string);
      console.error('Failed to fetch video list:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleItemSelected = async (listKey: string, itemIndex: number) => {
    if (!targetHost || !videoList) return;
    
    try {
      await invoke('select_video_list_item', {
        host: targetHost,
        inputNumber: videoList.number,
        itemIndex
      });
      
      // Refresh the video list to show updated state
      await fetchVideoList();
    } catch (err) {
      console.error('Failed to select item:', err);
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