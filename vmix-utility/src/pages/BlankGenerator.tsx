import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useVMixStatus } from '../hooks/useVMixStatus';
import type { SelectChangeEvent } from '@mui/material';
import {
  Box,
  Typography,
  Paper,
  Button,
  Checkbox,
  FormControlLabel,
  Slider,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
} from '@mui/material';

interface VmixConnection {
  host: string;
  label: string;
  status: 'Connected' | 'Disconnected';
  active_input: number;
  preview_input: number;
}

interface Connection {
  id: number;
  host: string;
  label: string;
  status: 'Connected' | 'Disconnected';
}

const BlankGenerator = () => {
  const { connections: vmixConnections } = useVMixStatus();
  const [transparent, setTransparent] = useState(false);
  const [count, setCount] = useState(1);
  const [generated, setGenerated] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<number | ''>('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Transform connections from useVMixStatus
  useEffect(() => {
    const mappedConnections = vmixConnections.map((conn, index) => ({
      id: index + 1,
      host: conn.host,
      label: conn.label,
      status: conn.status as 'Connected' | 'Disconnected',
    }));
    setConnections(mappedConnections);
    
    // Auto-select first available connection
    const connectedConnections = mappedConnections.filter(conn => conn.status === 'Connected');
    if (connectedConnections.length > 0 && selectedConnection === '') {
      setSelectedConnection(connectedConnections[0].id);
    }
  }, [vmixConnections, selectedConnection]);

  const handleTransparentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTransparent(event.target.checked);
  };

  const handleCountChange = (_event: Event, newValue: number | number[]) => {
    setCount(newValue as number);
  };

  const handleConnectionChange = (event: SelectChangeEvent<number | ''>) => {
    setSelectedConnection(event.target.value as number);
  };

  const handleGenerate = () => {
    if (selectedConnection === '') {
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmGenerate = async () => {
    const connection = connections.find(c => c.id === selectedConnection);
    if (!connection) {
      return;
    }

    setShowConfirmDialog(false);
    setGenerating(true);

    try {
      // Generate blanks using vMix API
      for (let i = 0; i < count; i++) {
        const blankTitle = `Blank ${i + 1}${transparent ? ' (Transparent)' : ''}`;
        const params = transparent 
          ? { Value: 'Colour|Transparent', Title: blankTitle }
          : { Value: 'Colour|Black', Title: blankTitle };
        
        await invoke('send_vmix_function', {
          host: connection.host,
          function_name: 'AddInput',
          params: params
        });
        
        // Small delay between requests to avoid overwhelming vMix
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Generated ${count} blank${count !== 1 ? 's' : ''} with transparent=${transparent} on ${connection.host}`);
      
      setGenerated(true);
      setTimeout(() => {
        setGenerated(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to generate blanks:', error);
      // Could add error state here
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelGenerate = () => {
    setShowConfirmDialog(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Blank Generator
      </Typography>
      
      {generated && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Successfully generated {count} blank{count !== 1 ? 's' : ''} with {transparent ? 'transparent' : 'solid'} background on {connections.find(c => c.id === selectedConnection)?.label}!
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Generate Blank Inputs
        </Typography>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel id="vmix-connection-label">vMix Connection</InputLabel>
            <Select
              labelId="vmix-connection-label"
              id="vmix-connection"
              value={selectedConnection}
              label="vMix Connection"
              onChange={handleConnectionChange}
            >
              {connections.map((connection) => (
                <MenuItem
                  key={connection.id}
                  value={connection.id}
                  disabled={connection.status === 'Disconnected'}
                >
                  {connection.label} ({connection.host})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={transparent}
                onChange={handleTransparentChange}
                color="primary"
              />
            }
            label="Transparent Background"
          />
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography id="blank-count-slider" gutterBottom>
            Number of Blanks to Generate: {count}
          </Typography>
          <Slider
            value={count}
            onChange={handleCountChange}
            aria-labelledby="blank-count-slider"
            valueLabelDisplay="auto"
            step={1}
            marks
            min={1}
            max={10}
          />
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleGenerate}
          disabled={selectedConnection === '' || generating}
          startIcon={generating ? <CircularProgress size={20} /> : null}
        >
          {generating ? 'Generating...' : 'Generate Blanks'}
        </Button>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={handleCancelGenerate}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          Confirm Blank Generation
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            Are you sure you want to generate {count} {transparent ? 'transparent' : 'black'} blank input{count !== 1 ? 's' : ''} in vMix?
            <br />
            <br />
            <strong>Connection:</strong> {connections.find(c => c.id === selectedConnection)?.label}
            <br />
            <strong>Type:</strong> {transparent ? 'Transparent' : 'Black'} Colour
            <br />
            <strong>Count:</strong> {count}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelGenerate}>
            Cancel
          </Button>
          <Button onClick={handleConfirmGenerate} variant="contained" autoFocus>
            Generate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BlankGenerator;