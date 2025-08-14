import React, { useState, useEffect, useRef } from 'react';
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
  Collapse
} from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
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
  const { connections, videoLists: contextVideoLists, getVMixVideoLists } = useVMixStatus();
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  
  // Get video lists for selected host from context
  const videoLists = selectedHost ? (contextVideoLists[selectedHost] || []) : [];
  
  // Enhanced debugging for re-renders and object references
  const prevVideoListsRef = useRef(videoLists);
  useEffect(() => {
    const prevVideoLists = prevVideoListsRef.current;
    const referenceChanged = prevVideoLists !== videoLists;
    const lengthChanged = prevVideoLists.length !== videoLists.length;
    
    console.log('ListManager: videoLists update detected:', {
      host: selectedHost,
      referenceChanged,
      lengthChanged,
      prevLength: prevVideoLists.length,
      newLength: videoLists.length,
      videoLists
    });
    
    if (videoLists.length > 0) {
      const firstList = videoLists[0];
      console.log('First VideoList details:', {
        key: firstList.key,
        itemsCount: firstList.items.length,
        selectedItems: firstList.items.filter(i => i.selected).map((item, idx) => ({ index: idx, title: item.title })),
        itemKeys: firstList.items.map((item, idx) => generateItemKey(item, idx))
      });
    }
    
    prevVideoListsRef.current = videoLists;
  }, [videoLists, selectedHost]);

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
      await getVMixVideoLists(selectedHost);
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

  // Generate stable key based on data content
  const generateItemKey = (item: VmixVideoListItem, index: number) => {
    return `${item.key}-${index}-${item.selected ? 'sel' : 'unsel'}-${item.enabled ? 'en' : 'dis'}`;
  };

  // Generate stable key for video list
  const generateListKey = (videoList: VmixVideoListInput) => {
    const selectedCount = videoList.items.filter(i => i.selected).length;
    const enabledCount = videoList.items.filter(i => i.enabled).length;
    return `${videoList.key}-items${videoList.items.length}-sel${selectedCount}-en${enabledCount}`;
  };

  const handleItemSelected = async (listKey: string, itemIndex: number) => {
    if (!selectedHost) return;
    
    try {
      // Find the video list to get its input number
      const videoList = videoLists.find(list => list.key === listKey);
      if (!videoList) return;
      
      console.log('Selecting item:', itemIndex, 'for list:', listKey);
      
      await invoke('select_video_list_item', {
        host: selectedHost,
        inputNumber: videoList.number,
        itemIndex
      });
      
      // Wait a moment for vMix to update, then refresh
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('Refreshing VideoLists after selection...');
      await getVMixVideoLists(selectedHost);
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
        <Box key={`videolists-${selectedHost}-${videoLists.length}`}>
          {videoLists.map((videoList) => {
            const isExpanded = expandedLists.has(videoList.key);
            return (
              <Card key={generateListKey(videoList)} sx={{ mb: 2 }}>
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
                      <Box key={`items-${generateListKey(videoList)}`}>
                        <Typography variant="subtitle2" gutterBottom>
                          VideoList Items:
                        </Typography>
                        <List dense>
                          {videoList.items.map((item, index) => {
                            const itemKey = generateItemKey(item, index);
                            console.log('Rendering ListItem:', { itemKey, selected: item.selected, enabled: item.enabled, title: item.title });
                            return (
                              <ListItem 
                                key={itemKey} 
                                divider
                                component="div"
                                sx={{
                                  pl: 1,
                                  pr: 1,
                                }}
                              >
                              <ListItemText
                                primary={
                                  <Box display="flex" alignItems="center" gap={1} key={`text-${itemKey}`}>
                                    <Typography 
                                      key={`title-${itemKey}-${item.selected ? 'bold' : 'normal'}`}
                                      variant="body2" 
                                      fontWeight={item.selected ? 'bold' : 'normal'}
                                    >
                                      {getFileName(item.title)}
                                    </Typography>
                                    {item.selected && (
                                      <Chip
                                        key={`selected-chip-${itemKey}`}
                                        label="Selected"
                                        color="primary"
                                        size="small"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                      />
                                    )}
                                    <Chip
                                      key={`enabled-chip-${itemKey}-${item.enabled ? 'en' : 'dis'}`}
                                      label={item.enabled ? "Enabled" : "Disabled"}
                                      color={item.enabled ? "success" : "default"}
                                      size="small"
                                      sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
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
                                  <Tooltip title={item.enabled ? "Select this item" : "Item is disabled"}>
                                    <span key={`button-span-${itemKey}`}>
                                      <IconButton
                                        key={`button-${itemKey}-${item.selected ? 'sel' : 'unsel'}-${item.enabled ? 'en' : 'dis'}`}
                                        size="small"
                                        onClick={() => item.enabled && handleItemSelected(videoList.key, index)}
                                        disabled={!item.enabled}
                                        sx={{
                                          bgcolor: item.selected ? 'primary.main' : 'grey.300',
                                          color: item.selected ? 'white' : 'grey.700',
                                          '&:hover': {
                                            bgcolor: item.selected ? 'primary.dark' : 'grey.400',
                                          },
                                          '&:disabled': {
                                            bgcolor: 'grey.100',
                                            color: 'grey.400',
                                          },
                                          mr: 1,
                                          width: 32,
                                          height: 32,
                                          borderRadius: '4px'
                                        }}
                                      >
                                        {item.selected ? '✓' : '○'}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Box>
                              </ListItemSecondaryAction>
                            </ListItem>
                            );
                          })}
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