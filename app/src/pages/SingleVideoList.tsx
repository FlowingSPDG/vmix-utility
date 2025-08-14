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
import VideoListView from '../components/VideoListView';

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
  
  console.log('SingleVideoList component initialized');
  console.log('URL:', window.location.href);
  console.log('URL params:', Object.fromEntries(urlParams.entries()));
  console.log('Props - host:', host, 'listKey:', listKey);
  console.log('Resolved - targetHost:', targetHost, 'targetListKey:', targetListKey);
  
  // 開発モードでは自動的にdevtoolsを開く
  useEffect(() => {
    if (import.meta.env.DEV) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const currentWindow = getCurrentWindow();
        if ('openDevtools' in currentWindow && typeof currentWindow.openDevtools === 'function') {
          currentWindow.openDevtools().catch((error: unknown) => {
            console.warn('Failed to open devtools:', error);
          });
        }
      });
    }
  }, []);

  // ページタイトルにデバッグ情報を表示
  useEffect(() => {
    document.title = `VideoList: ${targetHost} - ${targetListKey}`;
  }, [targetHost, targetListKey]);

  useEffect(() => {
    if (targetHost && targetListKey) {
      fetchVideoList();
    }
  }, [targetHost, targetListKey]);

  // Listen for VideoList updates
  useEffect(() => {
    if (!targetHost || !targetListKey) {
      console.log('Skipping event listener setup - missing host or listKey');
      return;
    }

    console.log('Setting up event listener for:', targetHost, targetListKey);
    
    // タイトルを更新して設定中であることを示す
    document.title = `VideoList: ${targetHost} - SETTING UP LISTENER`;

    const unlistenVideoListsUpdated = listen('vmix-videolists-updated', (event) => {
      // タイトルを更新してイベント受信を示す
      document.title = `VideoList: ${targetHost} - EVENT RECEIVED!`;
      
      const logMessage = `POPUP EVENT: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        targetHost,
        targetListKey,
        eventHost: (event.payload as any).host,
        eventLists: (event.payload as any).videoLists?.map((l: any) => l.key)
      })}`;
      console.log(logMessage);
      
      const payload = event.payload as any;
      
      if (payload.host === targetHost && payload.videoLists) {
        const foundList = payload.videoLists.find((list: VmixVideoListInput) => list.key === targetListKey);
        if (foundList) {
          console.log('Found matching list, updating state:', foundList);
          setVideoList(foundList);
          document.title = `VideoList: ${targetHost} - UPDATED!`;
        } else {
          console.log('No matching list found for key:', targetListKey);
          document.title = `VideoList: ${targetHost} - NO MATCH`;
        }
      }
    });

    // リスナー設定完了をタイトルで示す
    unlistenVideoListsUpdated.then(() => {
      document.title = `VideoList: ${targetHost} - LISTENING`;
    });

    return () => {
      document.title = `VideoList: ${targetHost} - CLEANUP`;
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


  const handleItemSelected = async (itemIndex: number) => {
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
          <VideoListView 
            videoList={videoList} 
            onItemSelected={handleItemSelected}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default SingleVideoList;