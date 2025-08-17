import React, { useState, useMemo } from 'react';
import { useConnectionSelection } from '../hooks/useConnectionSelection';
import ConnectionSelector from '../components/ConnectionSelector';
import {
  Box,
  Card,
  Typography,
  Alert,
  Skeleton,
  IconButton,
  Collapse,
  Switch,
  FormControlLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { invoke } from '@tauri-apps/api/core';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { useUISettings, getDensitySpacing } from '../hooks/useUISettings.tsx';

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
  const { videoLists: contextVideoLists, getVMixVideoLists } = useVMixStatus();
  const [_error, _setError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  
  // Use optimized connection selection hook
  const { selectedConnection, setSelectedConnection, connectedConnections } = useConnectionSelection();
  
  // Use UI settings hook
  const { uiDensity } = useUISettings();
  const spacing = getDensitySpacing(uiDensity);
  
  // Local state for file paths visibility (temporary, not saved)
  const [showFullPaths, setShowFullPaths] = useState(false);

  // Use selectedConnection instead of selectedHost for compatibility
  const selectedHost = selectedConnection;
  
  // Get video lists for selected host from context
  const videoLists = useMemo(() => 
    selectedHost ? (contextVideoLists[selectedHost] || []) : [],
    [selectedHost, contextVideoLists]
  );

  // Show loading if no connections or no data yet
  const isLoading = connectedConnections.length === 0 || (selectedHost && !contextVideoLists[selectedHost]);

  // Auto-fetch VideoLists when needed - memoized to avoid constant re-fetching
  useMemo(() => {
    if (selectedHost && !contextVideoLists[selectedHost]) {
      console.log(`Auto-fetching VideoLists for host: ${selectedHost}`);
      // Use Promise.resolve() to avoid blocking render
      Promise.resolve().then(() => {
        getVMixVideoLists(selectedHost).catch(error => {
          console.error(`Failed to auto-fetch VideoLists for ${selectedHost}:`, error);
        });
      });
    }
  }, [selectedHost, contextVideoLists, getVMixVideoLists]);


  const handleVideoListPopout = async (videoList: VmixVideoListInput) => {
    if (!selectedHost) return;
    
    try {
      console.log(`🚀 Opening VideoList popup - Host: ${selectedHost}, Key: ${videoList.key}, Title: ${videoList.title}`);
      await invoke('open_video_list_window', {
        host: selectedHost,
        listKey: videoList.key,
        listTitle: videoList.title
      });
      console.log(`✅ VideoList popup window request sent successfully`);
    } catch (err) {
      console.error('❌ Failed to open VideoList popup window:', err);
      // You could add a toast notification here in the future
      // For now, we'll rely on the backend's improved error handling
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



  if (connectedConnections.length === 0) {
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
      {/* Top header with show full paths toggle */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant={spacing.headerVariant} sx={{ fontWeight: 'medium' }}>
          List Manager
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showFullPaths}
              onChange={(e) => setShowFullPaths(e.target.checked)}
              size="small"
              icon={<VisibilityOffIcon fontSize="small" />}
              checkedIcon={<VisibilityIcon fontSize="small" />}
            />
          }
          label="Show full paths"
          labelPlacement="start"
          sx={{ ml: 0, mr: 0 }}
        />
      </Box>

      <Card sx={{ mb: spacing.spacing * 2, p: spacing.cardPadding }}>
        <Typography variant={spacing.headerVariant} gutterBottom>
          Connection Settings
        </Typography>
        <ConnectionSelector
          selectedConnection={selectedConnection}
          onConnectionChange={setSelectedConnection}
          label="vMix Connection"
        />
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
              <Box key={generateListKey(videoList)} sx={{ mb: spacing.spacing }}>
                {/* vMix-style compact header */}
                <Box 
                  sx={{
                    bgcolor: 'grey.800',
                    color: 'white',
                    p: spacing.cardPadding,
                    borderRadius: '4px 4px 0 0',
                    border: '1px solid',
                    borderColor: 'grey.700',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'grey.700',
                    },
                  }}
                  onClick={() => toggleListExpansion(videoList.key)}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'medium' }}>
                        {videoList.title}
                      </Typography>
                      <Box 
                        sx={{ 
                          width: 8, 
                          height: 8, 
                          bgcolor: videoList.state === 'running' ? 'success.main' : 'grey.400', 
                          borderRadius: '50%' 
                        }} 
                      />
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'grey.300' }}>
                        {videoList.items.length} items
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleVideoListPopout(videoList)}
                        sx={{ color: 'white', p: 0.25 }}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" sx={{ color: 'white', p: 0.25 }}>
                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                  </Box>
                </Box>

                {/* vMix-style compact list */}
                <Collapse in={isExpanded}>
                  <Box 
                    sx={{
                      bgcolor: 'grey.900',
                      border: '1px solid',
                      borderColor: 'grey.700',
                      borderTop: 'none',
                      borderRadius: '0 0 4px 4px',
                      maxHeight: '300px',
                      overflow: 'auto',
                    }}
                  >
                    {videoList.items.length === 0 ? (
                      <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                        No items in this video list
                      </Typography>
                    ) : (
                      videoList.items.map((item, index) => {
                        const itemKey = generateItemKey(item, index);
                        const displayName = showFullPaths ? item.title : getFileName(item.title);
                        
                        return (
                          <Box
                            key={itemKey}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              height: spacing.itemHeight,
                              px: 1,
                              py: 0.25,
                              bgcolor: item.selected ? 'primary.dark' : 'transparent',
                              borderBottom: '1px solid',
                              borderColor: 'grey.800',
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: item.selected ? 'primary.dark' : 'grey.800',
                              },
                              '&:last-child': {
                                borderBottom: 'none',
                              },
                            }}
                            onClick={() => item.enabled && handleItemSelected(videoList.key, index)}
                          >
                            {/* Status indicator (green square like vMix) */}
                            <Box display="flex" alignItems="center" gap={1} sx={{ flex: 1, minWidth: 0 }}>
                              <Box 
                                sx={{
                                  width: 12,
                                  height: 12,
                                  bgcolor: item.enabled ? 'success.main' : 'grey.600',
                                  borderRadius: '2px',
                                  flexShrink: 0,
                                }}
                              />
                              <Typography 
                                variant="body2"
                                sx={{ 
                                  fontSize: spacing.fontSize,
                                  fontWeight: item.selected ? 'bold' : 'normal',
                                  color: item.selected ? 'white' : 'text.primary',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {displayName}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default ListManager;