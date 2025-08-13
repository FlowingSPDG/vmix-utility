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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Collapse,
  Switch,
  FormControlLabel
} from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { invoke } from '@tauri-apps/api/core';
import { useVMixStatus } from '../hooks/useVMixStatus';

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

const ListManager: React.FC = () => {
  const { connections } = useVMixStatus();
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [videoLists, setVideoLists] = useState<VmixVideoListInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());

  // Get connected hosts
  const connectedHosts = connections.filter(conn => conn.status === 'Connected');

  // Set default host when connections change
  useEffect(() => {
    if (connectedHosts.length > 0 && !selectedHost) {
      setSelectedHost(connectedHosts[0].host);
    }
  }, [connectedHosts, selectedHost]);

  // Fetch video lists when host changes
  useEffect(() => {
    if (selectedHost) {
      fetchVideoLists();
    }
  }, [selectedHost]);

  const fetchVideoLists = async () => {
    if (!selectedHost) return;

    setLoading(true);
    setError(null);
    
    try {
      const lists = await invoke<VmixVideoListInput[]>('get_vmix_video_lists', {
        host: selectedHost
      });
      setVideoLists(lists);
    } catch (err) {
      setError(err as string);
      console.error('Failed to fetch video lists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePopout = async () => {
    try {
      await invoke('open_list_manager_window');
    } catch (err) {
      console.error('Failed to open popup window:', err);
    }
  };

  const handleVideoListPopout = async (videoList: VmixVideoListInput) => {
    if (!selectedHost) return;
    
    try {
      await invoke('open_video_list_window', {
        host: selectedHost,
        listKey: videoList.key,
        listTitle: videoList.title
      });
    } catch (err) {
      console.error('Failed to open VideoList popup window:', err);
    }
  };

  const toggleListExpansion = (listKey: string) => {
    setExpandedLists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(listKey)) {
        newSet.delete(listKey);
      } else {
        newSet.add(listKey);
      }
      return newSet;
    });
  };

  const getFileName = (filePath: string) => {
    return filePath.split(/[\\\/]/).pop() || 'Unknown File';
  };

  const handleItemEnabledToggle = async (listKey: string, itemIndex: number, enabled: boolean) => {
    if (!selectedHost) return;
    
    try {
      // Find the video list to get its input number
      const videoList = videoLists.find(list => list.key === listKey);
      if (!videoList) return;
      
      await invoke('set_video_list_item_enabled', {
        host: selectedHost,
        inputNumber: videoList.number,
        itemIndex,
        enabled
      });
      
      // Refresh the video lists to show updated state
      await fetchVideoLists();
    } catch (err) {
      console.error('Failed to toggle item enabled state:', err);
    }
  };

  const handleItemSelected = async (listKey: string, itemIndex: number) => {
    if (!selectedHost) return;
    
    try {
      // Find the video list to get its input number
      const videoList = videoLists.find(list => list.key === listKey);
      if (!videoList) return;
      
      await invoke('select_video_list_item', {
        host: selectedHost,
        inputNumber: videoList.number,
        itemIndex
      });
      
      // Refresh the video lists to show updated state
      await fetchVideoLists();
    } catch (err) {
      console.error('Failed to select item:', err);
    }
  };

  const getStateChipColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'success';
      case 'paused':
        return 'warning';
      case 'completed':
        return 'info';
      default:
        return 'default';
    }
  };

  if (connectedHosts.length === 0) {
    return (
      <Box>
        <Alert severity="info">
          No vMix connections available. Please connect to a vMix instance first.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" gutterBottom>
          List Manager
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Open in external window">
            <IconButton 
              onClick={handlePopout}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
              }}
            >
              <LaunchIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Card sx={{ mb: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Connection Settings
        </Typography>
        <FormControl fullWidth>
          <InputLabel>vMix Connection</InputLabel>
          <Select
            value={selectedHost}
            label="vMix Connection"
            onChange={(e) => setSelectedHost(e.target.value)}
            sx={{
              '& .MuiSelect-select': {
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              },
            }}
          >
            {connectedHosts.map((conn) => (
              <MenuItem key={conn.host} value={conn.host}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={conn.connection_type}
                    size="small"
                    color={conn.connection_type === 'Tcp' ? 'success' : 'info'}
                    sx={{ minWidth: 50 }}
                  />
                  <Typography>
                    {conn.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({conn.host}:{conn.port})
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : videoLists.length === 0 ? (
        <Alert severity="info">
          No VideoList inputs found for the selected vMix connection.
        </Alert>
      ) : (
        <Box>
          {videoLists.map((videoList) => {
            const isExpanded = expandedLists.has(videoList.key);
            return (
              <Card key={videoList.key} sx={{ mb: 2 }}>
                <CardContent sx={{ pb: isExpanded ? 2 : 1 }}>
                  <Box 
                    display="flex" 
                    justifyContent="space-between" 
                    alignItems="center" 
                    mb={isExpanded ? 2 : 0}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      p: 1,
                      borderRadius: 1,
                      transition: 'background-color 0.2s',
                    }}
                    onClick={() => toggleListExpansion(videoList.key)}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <IconButton
                        size="small"
                        sx={{ 
                          bgcolor: isExpanded ? 'primary.main' : 'grey.300',
                          color: isExpanded ? 'white' : 'grey.700',
                          '&:hover': {
                            bgcolor: isExpanded ? 'primary.dark' : 'grey.400',
                          },
                        }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          Input {videoList.number}: {videoList.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {videoList.items.length} items
                          {videoList.selected_index !== null && ` • Selected: ${videoList.selected_index}`}
                        </Typography>
                      </Box>
                    </Box>
                    <Box display="flex" gap={1} alignItems="center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Open VideoList in new window">
                        <IconButton
                          size="small"
                          onClick={() => handleVideoListPopout(videoList)}
                          sx={{
                            bgcolor: 'secondary.main',
                            color: 'white',
                            '&:hover': {
                              bgcolor: 'secondary.dark',
                            },
                            mr: 1
                          }}
                        >
                          <LaunchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Chip
                        label={videoList.state}
                        color={getStateChipColor(videoList.state)}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                      <Chip
                        label={videoList.input_type}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  </Box>

                  <Collapse in={isExpanded}>
                    {videoList.items.length === 0 ? (
                      <Typography color="text.secondary">
                        No items in this video list
                      </Typography>
                    ) : (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          VideoList Items:
                        </Typography>
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
                                      onClick={() => handleItemSelected(videoList.key, index)}
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
                                          handleItemEnabledToggle(videoList.key, index, e.target.checked);
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
                      </Box>
                    )}
                  </Collapse>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default ListManager;