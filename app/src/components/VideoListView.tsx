import React, { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';

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

interface VideoListViewProps {
  videoList: VmixVideoListInput;
  onItemSelected: (itemIndex: number) => void;
}

const VideoListView: React.FC<VideoListViewProps> = ({ 
  videoList, 
  onItemSelected 
}) => {
  const getFileName = (filePath: string) => {
    return filePath.split(/[\\\\/]/).pop() || 'Unknown File';
  };

  // Enhanced debugging for prop changes
  const prevVideoListRef = useRef(videoList);
  useEffect(() => {
    const prev = prevVideoListRef.current;
    const referenceChanged = prev !== videoList;
    const itemsReferenceChanged = prev.items !== videoList.items;
    const selectedItemsChanged = JSON.stringify(prev.items.map(i => i.selected)) !== JSON.stringify(videoList.items.map(i => i.selected));
    
    console.log('VideoListView: prop update detected:', {
      listKey: videoList.key,
      referenceChanged,
      itemsReferenceChanged,
      selectedItemsChanged,
      itemsCount: videoList.items.length,
      selectedItems: videoList.items.filter(i => i.selected).map((item, idx) => ({ index: idx, selected: item.selected, enabled: item.enabled }))
    });
    
    prevVideoListRef.current = videoList;
  }, [videoList]);

  return (
    <Box>
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
                    <Chip
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
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => item.enabled && onItemSelected(index)}
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
          ))}
        </List>
      )}
    </Box>
  );
};

export default VideoListView;