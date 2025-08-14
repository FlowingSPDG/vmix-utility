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

  useEffect(() => {
    if (targetHost && targetListKey) {
      fetchVideoList();
    }
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