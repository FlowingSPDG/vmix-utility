import { useState, useEffect } from 'react';
import type { SelectChangeEvent } from '@mui/material';
import { multiviewerService } from '../services/multiviewerService';
import { vmixService, type VmixConnection, type VmixInput } from '../services/vmixService';
import { useNavigation } from '../hooks/useNavigation';
import {
  Box,
  Typography,
  Button,
  Grid2,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Alert,
  Snackbar,
  CircularProgress,
  Card,
  CardContent,
  TextField,
  Radio,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';

// Using types from vmixService

const Multiviewer = () => {
  const { navigateToSettings } = useNavigation();
  const [selectedConnection, setSelectedConnection] = useState('');
  const [availableConnections, setAvailableConnections] = useState<VmixConnection[]>([]);
  const [vmixInputs, setVmixInputs] = useState<VmixInput[]>([]);
  const [selectedInputKey, setSelectedInputKey] = useState<string | null>(null);
  const [multiviewerConfig, setMultiviewerConfig] = useState({
    enabled: false,
    port: 8089,
  });
  const [loadingInputs, setLoadingInputs] = useState(false);
  const [multiviewerUrl, setMultiviewerUrl] = useState('');
  
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  const handleConnectionChange = async (event: SelectChangeEvent) => {
    const connectionId = event.target.value;
    setSelectedConnection(connectionId);
    setSelectedInputKey(null);
    setVmixInputs([]);
    setMultiviewerUrl('');

    if (connectionId) {
      // Extract host from host:port format
      const host = connectionId.split(':')[0];
      await loadVmixInputs(host);
    }
  };

  const loadVmixInputs = async (host: string) => {
    setLoadingInputs(true);
    try {
      const inputs = await vmixService.getVMixInputs(host);
      setVmixInputs(inputs);
      showToast(`Loaded ${inputs.length} inputs from vMix`, 'success');
    } catch (error) {
      console.error('Failed to load vMix inputs:', error);
      showToast(`Failed to load vMix inputs: ${error}`, 'error');
      setVmixInputs([]);
    } finally {
      setLoadingInputs(false);
    }
  };

  const handleInputSelect = (inputKey: string) => {
    setSelectedInputKey(prev => prev === inputKey ? null : inputKey);
  };

  const generateMultiviewerUrl = () => {
    if (!selectedConnection || !selectedInputKey) {
      showToast('Please select a connection and an input', 'error');
      return;
    }

    console.log('Generating URL with:', { selectedConnection, selectedInputKey, port: multiviewerConfig.port });
    const url = `http://127.0.0.1:${multiviewerConfig.port}/multiviewer?connection=${encodeURIComponent(selectedConnection)}&input=${encodeURIComponent(selectedInputKey)}`;
    console.log('Generated URL:', url);
    setMultiviewerUrl(url);
    showToast('Multiviewer URL generated', 'success');
  };

  const handleCopyUrl = async () => {
    if (!multiviewerUrl) {
      showToast('Please generate a URL first', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(multiviewerUrl);
      showToast('URL copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      showToast(`Failed to copy URL: ${error}`, 'error');
    }
  };

  const refreshInputs = () => {
    if (selectedConnection) {
      // Extract host from host:port format
      const host = selectedConnection.split(':')[0];
      loadVmixInputs(host);
    }
  };

  const handleGoToSettings = () => {
    navigateToSettings();
    showToast('Navigated to Settings', 'success');
  };

  // Load configuration and connections on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load available connections using the service
        const connections = await vmixService.getVMixStatuses();
        setAvailableConnections(connections);
        
        // Load multiviewer configuration
        const config = await multiviewerService.getConfig();
        console.log('Loaded multiviewer config:', config);
        setMultiviewerConfig({
          enabled: config.enabled,
          port: config.port,
        });
        
        if (!config.enabled) {
          console.warn('Multiviewer is disabled in configuration');
        } else {
          console.log(`Multiviewer should be running on port ${config.port}`);
        }
        
        // If there's a selected connection in config, load it
        if (config.selected_connection) {
          setSelectedConnection(config.selected_connection);
          // Extract host from host:port format
          const host = config.selected_connection.split(':')[0];
          await loadVmixInputs(host);
        }
      } catch (error) {
        console.error('Detailed error loading data:', error);
        showToast(`Failed to load configuration: ${error}`, 'error');
      }
    };

    loadData();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ViewModuleIcon />
        Multiviewer
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Select a vMix connection and inputs to create a custom multiviewer URL
      </Typography>

      {!multiviewerConfig.enabled && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Multiviewer server is disabled.</strong> 
            Please enable it in the <strong>Settings</strong> page to use this feature.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={handleGoToSettings}
            size="small"
          >
            Go to Settings
          </Button>
        </Alert>
      )}

      <Grid2 container spacing={3}>
        {/* Connection Selection */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                1. Select vMix Connection
              </Typography>

              <FormControl fullWidth margin="normal">
                <InputLabel id="connection-select-label">vMix Connection</InputLabel>
                <Select
                  labelId="connection-select-label"
                  value={selectedConnection}
                  onChange={handleConnectionChange}
                  label="vMix Connection"
                  disabled={!multiviewerConfig.enabled}
                >
                  <MenuItem value="">Select a connection...</MenuItem>
                  {availableConnections.map((conn) => {
                    const connectionId = `${conn.host}:${conn.port}`;
                    return (
                      <MenuItem key={connectionId} value={connectionId}>
                        {conn.label || connectionId}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              {selectedConnection && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={refreshInputs}
                    disabled={loadingInputs}
                  >
                    Refresh Inputs
                  </Button>
                  {loadingInputs && <CircularProgress size={16} />}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid2>

        {/* Server Status */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Server Status
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box 
                  sx={{ 
                    width: 8, 
                    height: 8, 
                    bgcolor: multiviewerConfig.enabled ? 'success.main' : 'grey.400', 
                    borderRadius: '50%' 
                  }} 
                />
                <Typography variant="body1">
                  {multiviewerConfig.enabled ? 'Running' : 'Stopped'}
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Server Port: {multiviewerConfig.port}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time updates via WebSocket
              </Typography>
            </CardContent>
          </Card>
        </Grid2>

        {/* Input Selection */}
        {selectedConnection && vmixInputs.length > 0 && (
          <Grid2 size={12}>
            <Card>
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6">
                    2. Select Input {selectedInputKey && `(${vmixInputs.find(i => i.key === selectedInputKey)?.title || selectedInputKey} selected)`}
                  </Typography>
                </Box>

                <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {vmixInputs.map((input) => (
                    <ListItem key={input.key} disablePadding>
                      <ListItemButton onClick={() => handleInputSelect(input.key)}>
                        <ListItemIcon>
                          <Radio
                            checked={selectedInputKey === input.key}
                            color="primary"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${input.number}. ${input.title}`}
                          secondary={`Type: ${input.input_type} | State: ${input.state}`}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>

                {selectedInputKey && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Selected input:
                    </Typography>
                    <Typography variant="body1" color="primary" fontWeight="medium">
                      {vmixInputs.find(i => i.key === selectedInputKey)?.title || selectedInputKey}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid2>
        )}

        {/* URL Generation */}
        {selectedInputKey && (
          <Grid2 size={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  3. Generate Multiviewer URL
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={generateMultiviewerUrl}
                    disabled={!multiviewerConfig.enabled || !selectedConnection || !selectedInputKey}
                  >
                    Generate URL
                  </Button>
                </Box>

                {multiviewerUrl && (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Multiviewer URL:
                    </Typography>
                    <TextField
                      fullWidth
                      value={multiviewerUrl}
                      size="small"
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <Button
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            onClick={handleCopyUrl}
                          >
                            Copy
                          </Button>
                        ),
                      }}
                    />
                    <Alert severity="success" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        Add this URL as a <strong>Web Browser</strong> input in vMix to display the selected input 
                        ({vmixInputs.find(i => i.key === selectedInputKey)?.title || selectedInputKey}).
                      </Typography>
                    </Alert>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid2>
        )}

        {/* Instructions */}
        <Grid2 size={12}>
          <Alert severity="info">
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>How to use:</strong>
            </Typography>
            <Typography variant="body2" component="div">
              1. Enable the multiviewer server in <strong>Settings</strong>
              <br />
              2. Select a vMix connection from your saved connections
              <br />
              3. Choose which input you want to display
              <br />
              4. Generate and copy the custom URL
              <br />
              5. Add the URL as a Web Browser input in vMix
              <br />
              6. The multiviewer will display your selected input
            </Typography>
          </Alert>
        </Grid2>
      </Grid2>

      {/* Toast Notification */}
      <Snackbar 
        open={toast.open} 
        autoHideDuration={6000} 
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={toast.severity} 
          sx={{ width: '100%' }}
          variant="filled"
          onClose={handleCloseToast}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Multiviewer;