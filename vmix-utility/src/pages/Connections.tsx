import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  Collapse
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface Connection {
  id: number;
  host: string;
  label: string;
  status: 'Connected' | 'Disconnected';
  activeInput: number;
  previewInput: number;
}

interface AutoRefreshConfig {
  enabled: boolean;
  duration: number; // in seconds
}

interface VmixConnection {
  host: string;
  label: string;
  status: 'Connected' | 'Disconnected';
  active_input: number;
  preview_input: number;
}

const Connections: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [newHost, setNewHost] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [autoRefreshConfig, setAutoRefreshConfig] = useState<{[host: string]: AutoRefreshConfig}>({});
  const [showAutoRefreshSettings, setShowAutoRefreshSettings] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const vmixConnections = await invoke<VmixConnection[]>('get_vmix_statuses');
      const newConnections = vmixConnections.map((conn, index) => ({
        id: index + 1,
        host: conn.host,
        label: conn.label,
        status: conn.status,
        activeInput: conn.active_input,
        previewInput: conn.preview_input,
      }));
      
      // Only update if connections actually changed
      setConnections(prevConnections => {
        if (JSON.stringify(prevConnections) === JSON.stringify(newConnections)) {
          return prevConnections; // Keep the same reference if data is identical
        }
        return newConnections;
      });
    } catch (error) {
      console.error('Failed to fetch connections:', error);
      setError(error as string);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
    
    // Load auto-refresh configs from backend
    const loadAutoRefreshConfigs = async () => {
      try {
        const configs = await invoke<{[host: string]: AutoRefreshConfig}>('get_all_auto_refresh_configs');
        setAutoRefreshConfig(configs);
      } catch (error) {
        console.error('Failed to load auto-refresh configs:', error);
      }
    };
    
    loadAutoRefreshConfigs();
  }, [fetchConnections]);

  // Listen for backend status updates
  useEffect(() => {
    const unlisten = listen<VmixConnection>('vmix-status-updated', (event) => {
      const updatedConnection = event.payload;
      
      setConnections(prevConnections => {
        const newConnections = prevConnections.map(conn => 
          conn.host === updatedConnection.host 
            ? {
                ...conn,
                status: updatedConnection.status as 'Connected' | 'Disconnected',
                activeInput: updatedConnection.active_input,
                previewInput: updatedConnection.preview_input,
              }
            : conn
        );
        
        // Only update if something actually changed
        if (JSON.stringify(prevConnections) === JSON.stringify(newConnections)) {
          return prevConnections;
        }
        return newConnections;
      });
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setNewHost('');
    setError(null);
  };

  const handleAdd = async () => {
    if (!newHost.trim()) return;
    
    setConnecting(true);
    setError(null);
    try {
      const newConnection = await invoke<VmixConnection>('connect_vmix', { host: newHost.trim() });
      // Initialize auto-refresh config for new connection
      setAutoRefreshConfig(prev => ({
        ...prev,
        [newHost.trim()]: { enabled: true, duration: 5 }
      }));
      await fetchConnections(); // Refresh the list
      handleClose();
    } catch (error) {
      console.error('Failed to connect:', error);
      setError(`Failed to connect to ${newHost}: ${error}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const connection = connections.find(c => c.id === id);
    if (!connection) return;
    
    try {
      await invoke('disconnect_vmix', { host: connection.host });
      await fetchConnections(); // Refresh the list
    } catch (error) {
      console.error('Failed to disconnect:', error);
      setError(`Failed to disconnect from ${connection.host}: ${error}`);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, connection: Connection) => {
    setAnchorEl(event.currentTarget);
    setSelectedConnection(connection);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedConnection(null);
  };

  const sendVmixFunction = async (functionName: string) => {
    if (!selectedConnection) return;
    
    try {
      await invoke('send_vmix_function', { 
        host: selectedConnection.host, 
        function: functionName 
      });
      handleMenuClose();
      // Optional: Show success message
    } catch (error) {
      console.error('Failed to send function:', error);
      setError(`Failed to send ${functionName} to ${selectedConnection.host}: ${error}`);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          vMix Connections
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />}
            onClick={fetchConnections}
            disabled={loading}
          >
            Refresh All
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleClickOpen}
          >
            Add Connection
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Host</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Active Input</TableCell>
              <TableCell>Preview Input</TableCell>
              <TableCell>Auto-Refresh</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="textSecondary">
                    No vMix connections. Add a connection to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              connections.map((connection) => [
                <TableRow key={connection.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {connection.host}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {connection.label}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={connection.status}
                      color={connection.status === 'Connected' ? 'success' : 'error'}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{connection.activeInput}</TableCell>
                  <TableCell>{connection.previewInput}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={autoRefreshConfig[connection.host]?.enabled || false}
                            onChange={(e) => {
                              setAutoRefreshConfig(prev => ({
                                ...prev,
                                [connection.host]: {
                                  enabled: e.target.checked,
                                  duration: prev[connection.host]?.duration || 5
                                }
                              }));
                            }}
                            size="small"
                          />
                        }
                        label={autoRefreshConfig[connection.host]?.enabled ? 'ON' : 'OFF'}
                        sx={{ margin: 0 }}
                      />
                      {autoRefreshConfig[connection.host]?.enabled && (
                        <Typography variant="caption" color="textSecondary">
                          {autoRefreshConfig[connection.host]?.duration || 5}s
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={(e) => handleMenuClick(e, connection)}
                      disabled={connection.status !== 'Connected'}
                    >
                      <MoreVertIcon />
                    </IconButton>
                    <Button
                      size="small"
                      onClick={() => {
                        setShowAutoRefreshSettings(
                          showAutoRefreshSettings === connection.host ? null : connection.host
                        );
                      }}
                      sx={{ mr: 1 }}
                    >
                      Settings
                    </Button>
                    <IconButton 
                      color="error" 
                      onClick={() => handleDelete(connection.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>,
                showAutoRefreshSettings === connection.host && (
                  <TableRow key={`${connection.id}-settings`}>
                    <TableCell colSpan={6}>
                      <Collapse in={showAutoRefreshSettings === connection.host}>
                        <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Auto-Refresh Settings for {connection.host}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                            <Typography variant="body2" sx={{ minWidth: '120px' }}>
                              Refresh Duration:
                            </Typography>
                            <Slider
                              value={autoRefreshConfig[connection.host]?.duration || 5}
                              onChange={(_, value) => {
                                setAutoRefreshConfig(prev => ({
                                  ...prev,
                                  [connection.host]: {
                                    enabled: prev[connection.host]?.enabled || false,
                                    duration: value as number
                                  }
                                }));
                              }}
                              min={1}
                              max={30}
                              step={1}
                              marks={[
                                { value: 1, label: '1s' },
                                { value: 5, label: '5s' },
                                { value: 10, label: '10s' },
                                { value: 30, label: '30s' }
                              ]}
                              valueLabelDisplay="auto"
                              valueLabelFormat={(value) => `${value}s`}
                              sx={{ width: 200, mx: 2 }}
                            />
                            <Typography variant="body2">
                              {autoRefreshConfig[connection.host]?.duration || 5} seconds
                            </Typography>
                          </Box>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )
              ]).flat().filter(Boolean)
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* vMix Function Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => sendVmixFunction('Cut')}>
          <PlayArrowIcon sx={{ mr: 1 }} />
          Cut
        </MenuItem>
        <MenuItem onClick={() => sendVmixFunction('Preview')}>
          <PlayArrowIcon sx={{ mr: 1 }} />
          Preview
        </MenuItem>
        <MenuItem onClick={() => sendVmixFunction('Fade')}>
          <PlayArrowIcon sx={{ mr: 1 }} />
          Fade
        </MenuItem>
        <MenuItem onClick={() => sendVmixFunction('QuickPlay')}>
          <PlayArrowIcon sx={{ mr: 1 }} />
          Quick Play
        </MenuItem>
      </Menu>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add New vMix Connection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="host"
            label="Host (IP Address or Hostname)"
            type="text"
            fullWidth
            variant="outlined"
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
            placeholder="192.168.1.6 or localhost"
            helperText="Enter the IP address or hostname of your vMix instance"
            disabled={connecting}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={connecting}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            variant="contained" 
            disabled={!newHost.trim() || connecting}
            startIcon={connecting ? <CircularProgress size={16} /> : null}
          >
            {connecting ? 'Connecting...' : 'Add Connection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Connections;