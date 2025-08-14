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
  Snackbar
} from '@mui/material';

interface Connection {
  id: number;
  host: string;
  label: string;
  status: 'Connected' | 'Disconnected';
}

const BlankGenerator = () => {
  const { connections: vmixConnections, getVMixInputs } = useVMixStatus();
  const [transparent, setTransparent] = useState(false);
  const [count, setCount] = useState(1);
  const [selectedConnection, setSelectedConnection] = useState<number | ''>('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Toast state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success');

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
        const params = transparent 
          ? { Value: 'Colour|Transparent'}
          : { Value: 'Colour|Black'};
        
        await invoke('send_vmix_function', {
          host: connection.host,
          functionName: 'AddInput',
          params: params
        });
      }

      // Refresh inputs to get latest XML data
      await getVMixInputs(connection.host);

      console.log(`Generated ${count} blank${count !== 1 ? 's' : ''} with transparent=${transparent} on ${connection.host}`);
      
      setToastMessage(`Successfully generated ${count} blank${count !== 1 ? 's' : ''} with ${transparent ? 'transparent' : 'black'} background!`);
      setToastSeverity('success');
      setToastOpen(true);
    } catch (error) {
      console.error('Failed to generate blanks:', error);
      setToastMessage(`Failed to generate blanks: ${error}`);
      setToastSeverity('error');
      setToastOpen(true);
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelGenerate = () => {
    setShowConfirmDialog(false);
  };

  const handleToastClose = () => {
    setToastOpen(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Blank Generator
      </Typography>
      
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
              {connections.filter(conn => conn.status === 'Connected').map((connection) => (
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
      
      {/* Toast Notification */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleToastClose} 
          severity={toastSeverity}
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BlankGenerator;