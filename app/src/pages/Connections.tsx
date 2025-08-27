import { useState, useEffect } from 'react';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { settingsService } from '../services/settingsService';
import { NetworkScannerService, type NetworkInterface, type VmixScanResult } from '../services/networkScannerService';
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
  MenuItem,
  Switch,
  Select,
  FormControl,
  FormLabel,
  FormControlLabel,
  RadioGroup,
  Radio,
  Backdrop,
  Card,
  CardContent,
  DialogContentText,
  Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ReconnectIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import WifiIcon from '@mui/icons-material/Wifi';

interface Connection {
  id: number;
  host: string;
  port: number;
  label: string;
  status: 'Connected' | 'Disconnected' | 'Reconnecting';
  activeInput: number;
  previewInput: number;
  connectionType: 'Http' | 'Tcp';
  version: string;
  edition: string;
  preset?: string;
}

const Connections: React.FC = () => {
  const { connections: vmixConnections, loading: globalLoading, connectVMix, disconnectVMix, autoRefreshConfigs, setAutoRefreshConfig, refreshConnections } = useVMixStatus();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState(8088);
  const [newConnectionType, setNewConnectionType] = useState<'Http' | 'Tcp'>('Http');
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);

  // Network scanning state
  const [networkInterfaces, setNetworkInterfaces] = useState<NetworkInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [scanResults, setScanResults] = useState<VmixScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Background connection state
  const [backgroundConnections, setBackgroundConnections] = useState<Set<string>>(new Set());
  const [connectionNotifications, setConnectionNotifications] = useState<Array<{host: string, success: boolean, message: string}>>([]);

  // Transform global connections to local format
  useEffect(() => {
    const newConnections = vmixConnections.map((conn, index) => ({
      id: index + 1,
      host: conn.host,
      port: conn.port,
      label: conn.label,
      status: conn.status as 'Connected' | 'Disconnected' | 'Reconnecting',
      activeInput: conn.active_input,
      previewInput: conn.preview_input,
      connectionType: conn.connection_type,
      version: conn.version,
      edition: conn.edition,
      preset: conn.preset,
    }));
    
    setConnections(newConnections);
    
    // Mark initial loading as complete when we have connections or after a shorter timeout
    if (isInitialLoading && (!globalLoading || newConnections.length > 0)) {
      setIsInitialLoading(false);
    }
  }, [vmixConnections, globalLoading, isInitialLoading]);

  // Auto-refresh connections when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshConnections();
    }, 100); // Further reduced for faster initial load
    
    return () => clearTimeout(timer);
  }, [refreshConnections]);

  // Set a shorter timeout for initial loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    }, 800); // Further reduced for better UX

    return () => clearTimeout(timeout);
  }, [isInitialLoading]);

  // Clear old notifications
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionNotifications(prev => prev.slice(1));
    }, 5000);

    return () => clearTimeout(timer);
  }, [connectionNotifications]);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setNewHost('');
    setNewPort(8088);
    setNewConnectionType('Http');
    setError(null);
  };

  const handleAdd = async () => {
    if (!newHost.trim()) return;
    
    // Check for duplicate IP on frontend
    const trimmedHost = newHost.trim();
    const isDuplicate = connections.some(conn => conn.host === trimmedHost);
    
    if (isDuplicate) {
      setError(`Host ${trimmedHost} is already connected`);
      return;
    }
    
    // Close dialog immediately for better UX
    handleClose();
    
    // Add to background connections set
    setBackgroundConnections(prev => new Set([...prev, trimmedHost]));
    
    // Start background connection process
    const portToUse = newConnectionType === 'Tcp' ? 8099 : newPort;
    
    try {
      await connectVMix(trimmedHost, portToUse, newConnectionType);
      
      // Add success notification
      setConnectionNotifications(prev => [...prev, {
        host: trimmedHost,
        success: true,
        message: `Successfully connected to ${trimmedHost}`
      }]);
    } catch (error) {
      console.error('Failed to connect:', error);
      
      // Add error notification
      setConnectionNotifications(prev => [...prev, {
        host: trimmedHost,
        success: false,
        message: `Failed to connect to ${trimmedHost}: ${error}`
      }]);
    } finally {
      // Remove from background connections
      setBackgroundConnections(prev => {
        const updated = new Set(prev);
        updated.delete(trimmedHost);
        return updated;
      });
    }
  };

  const handleDelete = (id: number) => {
    const connection = connections.find(c => c.id === id);
    if (connection) {
      setConnectionToDelete(connection);
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (connectionToDelete) {
      try {
        // Always call disconnectVMix to remove from backend config
        // It should handle both active disconnection and config removal
        await disconnectVMix(connectionToDelete.host);
      } catch (error) {
        console.error('Failed to disconnect:', error);
        setError(`Failed to disconnect from ${connectionToDelete.host}: ${error}`);
      }
    }
    setDeleteDialogOpen(false);
    setConnectionToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setConnectionToDelete(null);
  };

  // Network scanning functions
  const loadNetworkInterfaces = async () => {
    try {
      const interfaces = await NetworkScannerService.getNetworkInterfaces();
      setNetworkInterfaces(interfaces);
      if (interfaces.length > 0 && !selectedInterface) {
        setSelectedInterface(interfaces[0].name);
      }
    } catch (error) {
      console.error('Failed to load network interfaces:', error);
      setError(`Failed to load network interfaces: ${error}`);
    }
  };

  const handleScanClick = () => {
    setScanDialogOpen(true);
    setScanError(null);
    setScanResults([]);
    loadNetworkInterfaces();
  };

  const handleScanClose = () => {
    setScanDialogOpen(false);
    setSelectedInterface('');
    setScanResults([]);
    setScanError(null);
  };

  const handleScanNetwork = async () => {
    if (!selectedInterface) return;
    
    setIsScanning(true);
    setScanError(null);
    setScanResults([]);
    
    try {
      const results = await NetworkScannerService.scanNetworkForVmix(selectedInterface);
      setScanResults(results);
    } catch (error) {
      console.error('Network scan failed:', error);
      setScanError(`Network scan failed: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectFromScan = async (ipAddress: string) => {
    // Close scan dialog immediately for better UX
    setScanDialogOpen(false);
    
    // Add to background connections set
    setBackgroundConnections(prev => new Set([...prev, ipAddress]));
    
    try {
      await connectVMix(ipAddress, 8088, 'Http');
      
      // Add success notification
      setConnectionNotifications(prev => [...prev, {
        host: ipAddress,
        success: true,
        message: `Successfully connected to ${ipAddress}`
      }]);
    } catch (error) {
      console.error('Failed to connect to scanned vMix:', error);
      
      // Add error notification
      setConnectionNotifications(prev => [...prev, {
        host: ipAddress,
        success: false,
        message: `Failed to connect to ${ipAddress}: ${error}`
      }]);
    } finally {
      // Remove from background connections
      setBackgroundConnections(prev => {
        const updated = new Set(prev);
        updated.delete(ipAddress);
        return updated;
      });
    }
  };

  const handleReconnect = async (connection: Connection) => {
    setError(null);
    
    // Add to background connections set
    setBackgroundConnections(prev => new Set([...prev, connection.host]));
    
    try {
      await connectVMix(connection.host, connection.port, connection.connectionType);
      
      // Add success notification
      setConnectionNotifications(prev => [...prev, {
        host: connection.host,
        success: true,
        message: `Successfully reconnected to ${connection.host}`
      }]);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      
      // Add error notification
      setConnectionNotifications(prev => [...prev, {
        host: connection.host,
        success: false,
        message: `Failed to reconnect to ${connection.host}: ${error}`
      }]);
    } finally {
      // Remove from background connections
      setBackgroundConnections(prev => {
        const updated = new Set(prev);
        updated.delete(connection.host);
        return updated;
      });
    }
  };

  const handleEditLabel = (connection: Connection) => {
    setEditingConnection(connection);
    setNewLabel(connection.label);
    setLabelDialogOpen(true);
  };

  const handleLabelSave = async () => {
    if (!editingConnection || !newLabel.trim()) return;
    
    try {
      // Use settings service to update label on backend (auto-saves config)
      await settingsService.updateConnectionLabel(editingConnection.host, newLabel);
      
      // Always close the modal after successful label update
      setLabelDialogOpen(false);
      setEditingConnection(null);
      setNewLabel('');
      
      // Only try to reconnect if the connection is connected or reconnecting
      if (editingConnection.status === 'Connected' || editingConnection.status === 'Reconnecting') {
        try {
          await connectVMix(editingConnection.host, editingConnection.port, editingConnection.connectionType);
        } catch (reconnectError) {
          console.error('Failed to reconnect after label update:', reconnectError);
          // Don't show error for reconnect failure as label was updated successfully
        }
      }
    } catch (error) {
      console.error('Failed to update label:', error);
      setError(`Failed to update label: ${error}`);
      // Even if there's an error, close the modal for disconnected connections
      if (editingConnection.status === 'Disconnected') {
        setLabelDialogOpen(false);
        setEditingConnection(null);
        setNewLabel('');
      }
    }
  };

  const handleLabelCancel = () => {
    setLabelDialogOpen(false);
    setEditingConnection(null);
    setNewLabel('');
  };


  // Loading screen component
  const LoadingScreen = () => (
    <Backdrop open={isInitialLoading} sx={{ zIndex: 1000 }}>
      <Card sx={{ p: 3, textAlign: 'center', minWidth: 300 }}>
        <CardContent>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            Loading vMix Connections
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {connections.length > 0 
              ? `Found ${connections.length} saved connection${connections.length > 1 ? 's' : ''}`
              : 'Checking for saved connections...'
            }
          </Typography>
        </CardContent>
      </Card>
    </Backdrop>
  );

  return (
    <Box sx={{ p: 3 }}>
      <LoadingScreen />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          vMix Connections
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<WifiIcon />}
            onClick={handleScanClick}
          >
            Auto Detect vMix
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
              <TableCell>Port</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Edition</TableCell>
              <TableCell>Preset</TableCell>
              <TableCell>Active Input</TableCell>
              <TableCell>Preview Input</TableCell>
              <TableCell>Auto-Refresh</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(globalLoading) && connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="textSecondary">
                      Loading connections and checking vMix status...
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : connections.length === 0 && backgroundConnections.size === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  <Typography color="textSecondary">
                    No vMix connections. Add a connection to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              [
                ...connections,
                // Add background connections that are being established
                ...Array.from(backgroundConnections).map((host, index) => ({
                  id: -(index + 1), // Temporary negative ID for background connections
                  host,
                  port: 8088, // Default port, will be updated when connection is established
                  label: `${host} (Connecting...)`,
                  status: 'Reconnecting' as const,
                  activeInput: 0,
                  previewInput: 0,
                  connectionType: 'Http' as const, // Default type, will be updated when connection is established
                  version: 'Connecting...',
                  edition: 'Connecting...',
                  preset: undefined,
                }))
              ].map((connection) => (
                <TableRow key={connection.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {connection.host}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {connection.label}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleEditLabel(connection)}
                        title="Edit Label"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{connection.port}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={connection.connectionType === 'Tcp' ? 'TCP (Experimental)' : connection.connectionType}
                      color={connection.connectionType === 'Tcp' ? 'primary' : 'default'}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {backgroundConnections.has(connection.host) ? (
                        <>
                          <Chip 
                            label="Connecting..."
                            color="warning"
                            variant="outlined"
                            size="small"
                          />
                          <CircularProgress size={16} />
                        </>
                      ) : (
                        <>
                          <Chip 
                            label={connection.status}
                            color={connection.status === 'Connected' ? 'success' : connection.status === 'Reconnecting' ? 'warning' : 'error'}
                            variant="outlined"
                            size="small"
                          />
                          {connection.status === 'Reconnecting' && (
                            <CircularProgress size={16} />
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{connection.version}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{connection.edition}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{connection.preset || '-'}</Typography>
                  </TableCell>
                  <TableCell>{connection.activeInput}</TableCell>
                  <TableCell>{connection.previewInput}</TableCell>
                  <TableCell>
                    {connection.status === 'Connected' && connection.connectionType === 'Http' && (() => {
                      const config = autoRefreshConfigs[connection.host] || { enabled: true, duration: 3 };
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Switch
                            checked={config.enabled}
                            onChange={async (e) => {
                              await setAutoRefreshConfig(connection.host, {
                                ...config,
                                enabled: e.target.checked
                              });
                            }}
                            size="small"
                          />
                          {config.enabled && (
                            <FormControl size="small" sx={{ minWidth: 70 }}>
                              <Select
                                value={config.duration}
                                onChange={async (e) => {
                                  await setAutoRefreshConfig(connection.host, {
                                    ...config,
                                    duration: Number(e.target.value)
                                  });
                                }}
                              >
                                <MenuItem value={1}>1s</MenuItem>
                                <MenuItem value={3}>3s</MenuItem>
                                <MenuItem value={5}>5s</MenuItem>
                                <MenuItem value={10}>10s</MenuItem>
                              </Select>
                            </FormControl>
                          )}
                        </Box>
                      );
                    })()}
                    {connection.status === 'Connected' && connection.connectionType === 'Tcp' && (() => {
                      const config = autoRefreshConfigs[connection.host] || { enabled: true, duration: 3 };
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Switch
                            checked={config.enabled}
                            onChange={async (e) => {
                              await setAutoRefreshConfig(connection.host, {
                                ...config,
                                enabled: e.target.checked
                              });
                            }}
                            size="small"
                          />
                          {config.enabled && (
                            <FormControl size="small" sx={{ minWidth: 70 }}>
                              <Select
                                value={config.duration}
                                onChange={async (e) => {
                                  await setAutoRefreshConfig(connection.host, {
                                    ...config,
                                    duration: Number(e.target.value)
                                  });
                                }}
                              >
                                <MenuItem value={1}>1s</MenuItem>
                                <MenuItem value={3}>3s</MenuItem>
                                <MenuItem value={5}>5s</MenuItem>
                                <MenuItem value={10}>10s</MenuItem>
                                <MenuItem value={30}>30s</MenuItem>
                              </Select>
                            </FormControl>
                          )}
                          <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                            XML
                          </Typography>
                        </Box>
                      );
                    })()}
                    {connection.connectionType === 'Tcp' && connection.status !== 'Connected' && (
                      <Typography variant="body2" color="textSecondary">
                        TCP Auto-refresh (Disconnected)
                      </Typography>
                    )}
                    {connection.connectionType === 'Http' && connection.status !== 'Connected' && (
                      <Typography variant="body2" color="textSecondary">
                        Auto-refresh (Disconnected)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {backgroundConnections.has(connection.host) ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="textSecondary">
                          Connecting...
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        {connection.status === 'Disconnected' ? (
                          <IconButton
                            color="primary"
                            onClick={() => handleReconnect(connection)}
                            title="Reconnect"
                          >
                            <ReconnectIcon />
                          </IconButton>
                        ) : (
                          <></>
                        )}
                        <IconButton 
                          color="error" 
                          onClick={() => handleDelete(connection.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            id="port"
            label="Port"
            type="number"
            fullWidth
            variant="outlined"
            value={newConnectionType === 'Tcp' ? 8099 : newPort}
            onChange={(e) => {
              if (newConnectionType === 'Http') {
                setNewPort(parseInt(e.target.value) || 8088);
              }
            }}
            placeholder={newConnectionType === 'Tcp' ? "8099" : "8088"}
            helperText={newConnectionType === 'Tcp' ? "TCP API port (fixed: 8099)" : "HTTP API port (default: 8088)"}
            disabled={newConnectionType === 'Tcp'}
            InputProps={{
              inputProps: {
                min: 1,
                max: 65535
              }
            }}
          />
          <FormControl component="fieldset" sx={{ mt: 2, mb: 1 }}>
            <FormLabel component="legend">Connection Type</FormLabel>
            <RadioGroup
              row
              value={newConnectionType}
              onChange={(e) => setNewConnectionType(e.target.value as 'Http' | 'Tcp')}
            >
              <FormControlLabel
                value="Http"
                control={<Radio />}
                label="HTTP API"
              />
              <FormControlLabel
                value="Tcp"
                control={<Radio />}
                label="TCP API (Experimental)"
              />
            </RadioGroup>
          </FormControl>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            variant="contained" 
            disabled={!newHost.trim()}
          >
            Add Connection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Label Edit Dialog */}
      <Dialog open={labelDialogOpen} onClose={handleLabelCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Connection Label</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Host: {editingConnection?.host}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            id="label"
            label="Label"
            type="text"
            fullWidth
            variant="outlined"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Enter a friendly name for this connection"
            helperText="Give this vMix connection a memorable name"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLabelCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleLabelSave} 
            variant="contained" 
            disabled={!newLabel.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Connection
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the connection to "{connectionToDelete?.label}" ({connectionToDelete?.host})?
            This will disconnect from the vMix instance and remove it from your saved connections.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Network Scan Dialog */}
      <Dialog 
        open={scanDialogOpen} 
        onClose={handleScanClose} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WifiIcon />
            Auto Detect vMix Instances
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Warning:</strong> This will scan your network for vMix instances. 
              The scan will attempt to connect to all IP addresses in the selected network interface's subnet.
              Only use this feature on networks you trust.
            </Typography>
          </Alert>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <FormLabel>Select Network Interface</FormLabel>
            <Select
              value={selectedInterface}
              onChange={(e) => setSelectedInterface(e.target.value)}
              disabled={isScanning}
            >
              {networkInterfaces.map((iface) => (
                <MenuItem key={iface.name} value={iface.name}>
                  {iface.name} ({iface.ip_address})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {scanError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {scanError}
            </Alert>
          )}

          {scanResults.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Scan Results ({scanResults.length} devices found)
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Port</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Response Time</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scanResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.ip_address}</TableCell>
                        <TableCell>{result.port}</TableCell>
                        <TableCell>
                          <Chip 
                            label={result.is_vmix ? 'vMix Found' : 'HTTP Service'} 
                            color={result.is_vmix ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{result.response_time}ms</TableCell>
                        <TableCell>
                          {result.is_vmix && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleConnectFromScan(result.ip_address)}
                              disabled={connections.some(conn => conn.host === result.ip_address)}
                            >
                              {connections.some(conn => conn.host === result.ip_address) ? 'Connected' : 'Connect'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleScanClose} disabled={isScanning}>
            Close
          </Button>
          <Button 
            onClick={handleScanNetwork} 
            variant="contained" 
            disabled={!selectedInterface || isScanning}
            startIcon={isScanning ? <CircularProgress size={16} /> : <SearchIcon />}
          >
            {isScanning ? 'Scanning...' : 'Start Scan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connection Notifications */}
      {connectionNotifications.length > 0 && (
        <Snackbar
          open={true}
          autoHideDuration={5000}
          onClose={() => setConnectionNotifications(prev => prev.slice(1))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert
            severity={connectionNotifications[0].success ? 'success' : 'error'}
            sx={{ mb: 1 }}
          >
            {connectionNotifications[0].message}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
};

export default Connections;