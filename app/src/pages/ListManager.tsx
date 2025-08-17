import React, { useState, useMemo } from 'react';
import { useConnectionSelection } from '../hooks/useConnectionSelection';
import ConnectionSelector from '../components/ConnectionSelector';
import CompactVideoListView from '../components/CompactVideoListView';
import {
  Box,
  Card,
  Typography,
  Alert,
  Skeleton,
} from '@mui/material';
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
  const { videoLists: contextVideoLists, getVMixVideoLists, selectVideoListItem, openVideoListWindow } = useVMixStatus();
  const [_error, _setError] = useState<string | null>(null);
  const [expandedLists] = useState<Set<string>>(new Set());
  
  // Use optimized connection selection hook
  const { selectedConnection, setSelectedConnection, connectedConnections } = useConnectionSelection();
  
  // Use UI settings hook
  const { uiDensity } = useUISettings();
  const spacing = getDensitySpacing(uiDensity);
  

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
      await openVideoListWindow(selectedHost, videoList.key, videoList.title);
    } catch (err) {
      console.error('❌ Failed to open VideoList popup window:', err);
      // You could add a toast notification here in the future
      // For now, we'll rely on the backend's improved error handling
    }
  };


  const handleItemSelected = async (listKey: string, itemIndex: number) => {
    if (!selectedHost) return;
    
    try {
      // Find the video list to get its input number
      const videoList = videoLists.find(list => list.key === listKey);
      if (!videoList) return;
      
      console.log('Selecting item:', itemIndex, 'for list:', listKey);
      
      await selectVideoListItem(selectedHost, videoList.number, itemIndex);
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
      {/* Top header */}
      <Typography variant={spacing.headerVariant} sx={{ fontWeight: 'medium', mb: 1 }}>
        List Manager
      </Typography>

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
        <CompactVideoListView
          videoLists={videoLists}
          onItemSelected={handleItemSelected}
          onPopout={handleVideoListPopout}
          showPathsToggle={true}
          uiDensity={uiDensity}
          initialExpandedLists={expandedLists}
        />
      )}
    </Box>
  );
};

export default ListManager;