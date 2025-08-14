import React, { useState, useMemo } from 'react';
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
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Collapse
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
  const [_error, _setError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  
  // Get connected hosts
  const connectedHosts = useMemo(() => 
    connections.filter(conn => conn.status === 'Connected'), 
    [connections]
  );

  // Derive selected host directly
  const selectedHost = connectedHosts.length > 0 ? connectedHosts[0].host : '';
  
  // Get video lists for selected host from context
  const videoLists = useMemo(() => 
    selectedHost ? (contextVideoLists[selectedHost] || []) : [],
    [selectedHost, contextVideoLists]
  );

  // Show loading if no connections or no data yet
  const isLoading = connections.length === 0 || (selectedHost && !contextVideoLists[selectedHost]);



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
            onChange={() => {/* Host selection handled automatically */}}
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

      {_error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {_error}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ p: 2 }}>
          <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
          <Skeleton variant="text" height={40} />
          <Skeleton variant="text" height={40} />
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
                          <OpenInNewIcon fontSize="small" />
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