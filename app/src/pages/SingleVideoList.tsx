import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';

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

  const getFileName = (filePath: string) => {
    return filePath.split(/[\\\\\\/]/).pop() || 'Unknown File';
  };

  const handleItemEnabledToggle = async (itemIndex: number, enabled: boolean) => {
    if (!targetHost || !videoList) return;
    
    try {
      await invoke('set_video_list_item_enabled', {
        host: targetHost,
        inputNumber: videoList.number,
        itemIndex,
        enabled
      });
      
      // Refresh the video list to show updated state
      await fetchVideoList();
    } catch (err) {
      console.error('Failed to toggle item enabled state:', err);
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
          <Box display="flex" gap={1} mb={2}>
            <Chip
              label={videoList.state}
              color="success"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
            <Chip
              label={videoList.input_type}
              variant="outlined"
              size="small"
            />
            <Chip
              label={`${videoList.items.length} items`}
              variant="outlined"
              size="small"
            />
            {videoList.selected_index !== null && (
              <Chip
                label={`Selected: ${videoList.selected_index}`}
                color="primary"
                size="small"
              />
            )}
          </Box>

          {videoList.items.length === 0 ? (
            <Typography color="text.secondary">
              No items in this video list
            </Typography>
          ) : (
            <List dense>
              {videoList.items.map((item, index) => (
                <ListItem 
                  key={item.key} 
                  divider
                  component="div"
                  sx={{
                    bgcolor: item.selected ? 'primary.light' : 'transparent',
                    pl: 1,
                    pr: 1,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight={item.selected ? 'bold' : 'normal'}>
                          {getFileName(item.title)}
                        </Typography>
                        {item.selected && (
                          <Chip
                            label="Selected"
                            color="primary"
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {item.title}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box display="flex" gap={1} alignItems="center">
                      <Tooltip title="Select this item">
                        <IconButton
                          size="small"
                          onClick={() => handleItemSelected(index)}
                          sx={{
                            bgcolor: item.selected ? 'primary.main' : 'grey.300',
                            color: item.selected ? 'white' : 'grey.700',
                            '&:hover': {
                              bgcolor: item.selected ? 'primary.dark' : 'grey.400',
                            },
                            mr: 1
                          }}
                        >
                          {item.selected ? '✓' : '○'}
                        </IconButton>
                      </Tooltip>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={item.enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleItemEnabledToggle(index, e.target.checked);
                            }}
                            size="small"
                            color="success"
                          />
                        }
                        label={
                          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                            Enabled
                          </Typography>
                        }
                        sx={{ mr: 0 }}
                      />
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SingleVideoList;