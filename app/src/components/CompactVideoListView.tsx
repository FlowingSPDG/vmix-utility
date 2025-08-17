import React, { useState } from 'react';
import {
  Box,
  Typography,
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
import { getDensitySpacing, UIDensity } from '../hooks/useUISettings.tsx';

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

interface CompactVideoListViewProps {
  videoLists: VmixVideoListInput[];
  onItemSelected: (listKey: string, itemIndex: number) => void;
  onPopout?: (videoList: VmixVideoListInput) => void;
  showPathsToggle?: boolean;
  uiDensity?: UIDensity;
  initialExpandedLists?: Set<string>;
}

const CompactVideoListView: React.FC<CompactVideoListViewProps> = ({
  videoLists,
  onItemSelected,
  onPopout,
  showPathsToggle = false,
  uiDensity = 'standard' as UIDensity,
  initialExpandedLists = new Set(),
}) => {
  const [expandedLists, setExpandedLists] = useState<Set<string>>(initialExpandedLists);
  const [showFullPaths, setShowFullPaths] = useState(false);
  
  const spacing = getDensitySpacing(uiDensity);

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

  return (
    <Box>
      {/* Show full paths toggle */}
      {showPathsToggle && (
        <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
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
      )}

      {/* Video Lists */}
      {videoLists.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
          No VideoList inputs found.
        </Typography>
      ) : (
        <Box>
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
                      {onPopout && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPopout(videoList);
                          }}
                          sx={{ color: 'white', p: 0.25 }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      )}
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
                            onClick={() => item.enabled && onItemSelected(videoList.key, index)}
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

export default CompactVideoListView;