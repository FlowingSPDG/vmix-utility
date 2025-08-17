import { useState } from 'react';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { useConnectionSelection } from '../hooks/useConnectionSelection';
import ConnectionSelector from '../components/ConnectionSelector';
import {
  Box,
  Typography,
  Paper,
  Button,
  Checkbox,
  FormControlLabel,
  Slider,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Snackbar
} from '@mui/material';

const BlankGenerator = () => {
  const { getVMixInputs, sendVMixFunction } = useVMixStatus();
  const [transparent, setTransparent] = useState(false);
  const [count, setCount] = useState(1);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Toast state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success');

  // Use optimized connection selection hook
  const { selectedConnection, setSelectedConnection, connectedConnections } = useConnectionSelection();

  const handleTransparentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTransparent(event.target.checked);
  };

  const handleCountChange = (_event: Event, newValue: number | number[]) => {
    setCount(newValue as number);
  };

  const handleGenerate = () => {
    if (selectedConnection === '') {
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmGenerate = async () => {
    if (!selectedConnection) {
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
        
        await sendVMixFunction(selectedConnection, 'AddInput', params);
      }

      // Refresh inputs to get latest XML data
      await getVMixInputs(selectedConnection);

      console.log(`Generated ${count} blank${count !== 1 ? 's' : ''} with transparent=${transparent} on ${selectedConnection}`);
      
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
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Generate Blank Inputs
        </Typography>

        <Box sx={{ mb: 3 }}>
          <ConnectionSelector
            selectedConnection={selectedConnection}
            onConnectionChange={setSelectedConnection}
            label="vMix Connection"
          />
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
            <strong>Connection:</strong> {connectedConnections.find(c => c.host === selectedConnection)?.label}
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