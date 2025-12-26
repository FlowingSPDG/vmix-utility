import { useState, useEffect, useCallback } from 'react';
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
  IconButton,
  MenuItem,
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
  Snackbar,
  Switch
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
  const { connections: vmixConnections, loading: globalLoading, connectVMix, disconnectVMix, autoRefreshConfigs, setAutoRefreshConfig, getAutoRefreshConfig, refreshConnections } = useVMixStatus();
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

  // Preset path display toggle
  const [showFullPresetPaths, setShowFullPresetPaths] = useState(false);

  // Helper function to get filename from path
  const getFileName = (filePath: string | undefined): string => {
    if (!filePath) return '-';
    return filePath.split(/[\\\/]/).pop() || filePath;
  };

  // Helper function to get auto-refresh config with lazy loading
  const getConfigForHost = useCallback(async (host: string) => {
    // Return from cache if available
    if (autoRefreshConfigs[host]) {
      return autoRefreshConfigs[host];
    }
    
    // Otherwise fetch and cache it
    try {
      const config = await getAutoRefreshConfig(host);
      await setAutoRefreshConfig(host, config);
      return config;
    } catch (error) {
      console.error(`Failed to load auto-refresh config for ${host}:`, error);
      // Return backend default - this will be consistent with the backend's AutoRefreshConfig::default()
      throw error;
    }
  }, [autoRefreshConfigs, getAutoRefreshConfig, setAutoRefreshConfig]);

  // Transform global connections to local format and eagerly load configs
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
    
    // Eagerly load missing auto-refresh configs
    vmixConnections.forEach(async (conn) => {
      if (!autoRefreshConfigs[conn.host]) {
        try {
          await getConfigForHost(conn.host);
        } catch (error) {
          // Error already logged in getConfigForHost
        }
      }
    });
    
    // Mark initial loading as complete when we have connections or after a shorter timeout
    if (isInitialLoading && (!globalLoading || newConnections.length > 0)) {
      setIsInitialLoading(false);
    }
  }, [vmixConnections, globalLoading, isInitialLoading, autoRefreshConfigs, getConfigForHost]);

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
    // Don't close dialog - allow connecting to multiple vMix instances
    // Add to background connections set
    setBackgroundConnections(prev => new Set([...prev, ipAddress]));
    
    try {
      await connectVMix(ipAddress, 8088, 'Http');
      
      // Refresh connections to update the UI
      await refreshConnections();
      
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

      {/* Preset path display toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showFullPresetPaths}
              onChange={(e) => setShowFullPresetPaths(e.target.checked)}
              size="small"
            />
          }
          label="Show full paths"
          labelPlacement="start"
          sx={{ ml: 0, mr: 0 }}
        />
      </Box>

      <TableContainer 
        component={Paper}
        sx={{
          borderRadius: 2,
          overflowX: 'auto',
          overflowY: 'hidden',
          boxShadow: (theme) => theme.palette.mode === 'dark' 
            ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Table size="small" sx={{ minWidth: 1200 }}>
          <TableHead>
            <TableRow sx={{ 
              backgroundColor: (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.05)' 
                : 'rgba(0, 0, 0, 0.02)',
            }}>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Host</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '50px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Port</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '50px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Type</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '70px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Status</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '80px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Version</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '60px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Edition</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '80px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Preset</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '120px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Update Interval</TableCell>
              <TableCell align="right" sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '50px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Active</TableCell>
              <TableCell align="right" sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '50px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Preview</TableCell>
              <TableCell align="right" sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '120px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>Actions</TableCell>
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
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
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
              ].map((connection, index) => (
                <TableRow 
                  key={connection.id}
                  sx={{
                    '&:hover': {
                      backgroundColor: (theme) => theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.05)' 
                        : 'rgba(0, 0, 0, 0.02)',
                      transition: 'background-color 0.2s ease',
                    },
                    backgroundColor: (theme) => index % 2 === 0 
                      ? 'transparent' 
                      : theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.02)' 
                        : 'rgba(0, 0, 0, 0.01)',
                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                    '&:last-child td': {
                      borderBottom: 'none',
                    },
                  }}
                >
                  <TableCell sx={{ 
                    py: 1.5,
                    borderBottom: 'none',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="body2" 
                          fontWeight="medium" 
                          sx={{ 
                            fontSize: '0.875rem',
                            lineHeight: 1.4,
                            color: 'text.primary',
                          }}
                        >
                          {connection.host}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color="textSecondary" 
                          sx={{ 
                            fontSize: '0.75rem',
                            lineHeight: 1.3,
                            display: 'block',
                            mt: 0.25,
                          }}
                        >
                          {connection.label}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleEditLabel(connection)}
                        title="Edit Label"
                        sx={{ 
                          padding: '4px',
                          opacity: 0.7,
                          '&:hover': {
                            opacity: 1,
                            backgroundColor: (theme) => theme.palette.mode === 'dark' 
                              ? 'rgba(255, 255, 255, 0.1)' 
                              : 'rgba(0, 0, 0, 0.05)',
                          },
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ 
                    py: 1.5,
                    borderBottom: 'none',
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.875rem',
                        color: 'text.primary',
                      }}
                    >
                      {connection.port}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ 
                    py: 1.5,
                    borderBottom: 'none',
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.75rem',
                        color: connection.connectionType === 'Tcp' ? 'primary.main' : 'text.primary',
                        fontWeight: 500,
                      }}
                    >
                      {connection.connectionType === 'Tcp' ? 'TCP' : 'HTTP'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ 
                    py: 1.5,
                    borderBottom: 'none',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {backgroundConnections.has(connection.host) ? (
                        <>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: '0.75rem',
                              color: 'warning.main',
                              fontWeight: 500,
                            }}
                          >
                            Connecting
                          </Typography>
                          <CircularProgress size={12} thickness={4} />
                        </>
                      ) : (
                        <>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: '0.75rem',
                              color: connection.status === 'Connected' 
                                ? 'success.main' 
                                : connection.status === 'Reconnecting' 
                                  ? 'warning.main' 
                                  : 'error.main',
                              fontWeight: 500,
                            }}
                          >
                            {connection.status === 'Reconnecting' ? 'Retrying' : connection.status}
                          </Typography>
                          {connection.status === 'Reconnecting' && (
                            <CircularProgress size={12} thickness={4} />
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ 
                    py: 1.5,
                    borderBottom: 'none',
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.875rem',
                        color: 'text.primary',
                      }}
                    >
                      {connection.version}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ 
                    py: 1.5,
                    borderBottom: 'none',
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.75rem',
                        color: 'text.primary',
                        fontWeight: 500,
                      }}
                    >
                      {connection.edition}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ 
                    py: 1.5,
                    borderBottom: 'none',
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.875rem',
                        color: connection.preset ? 'text.primary' : 'text.secondary',
                      }}
                      title={connection.preset || undefined}
                    >
                      {connection.preset 
                        ? (showFullPresetPaths ? connection.preset : getFileName(connection.preset))
                        : '-'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ 
                    py: 1.5,
                    borderBottom: 'none',
                  }}>
                    {connection.status === 'Connected' && (() => {
                      // Get config from state - load on focus if not available
                      const config = autoRefreshConfigs[connection.host];
                      
                      if (!config) {
                        // Show loading state and fetch config on mount
                        return (
                          <Typography 
                            variant="body2" 
                            color="textSecondary" 
                            sx={{ fontSize: '0.75rem' }}
                            onClick={async () => {
                              try {
                                await getConfigForHost(connection.host);
                              } catch (error) {
                                console.error('Failed to load config:', error);
                              }
                            }}
                          >
                            Loading...
                          </Typography>
                        );
                      }
                      
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextField
                            type="number"
                            size="small"
                            value={config.duration}
                            onChange={async (e) => {
                              const inputValue = Number(e.target.value);
                              if (inputValue >= 100 && inputValue <= 10000) {
                                await setAutoRefreshConfig(connection.host, {
                                  ...config,
                                  enabled: true,
                                  duration: inputValue
                                });
                              }
                            }}
                            onBlur={async (e) => {
                              const inputValue = Number(e.target.value);
                              if (inputValue < 100) {
                                await setAutoRefreshConfig(connection.host, {
                                  ...config,
                                  enabled: true,
                                  duration: 100
                                });
                              } else if (inputValue > 10000) {
                                await setAutoRefreshConfig(connection.host, {
                                  ...config,
                                  enabled: true,
                                  duration: 10000
                                });
                              }
                            }}
                            onFocus={async () => {
                              // Ensure config is loaded when field is focused
                              if (!autoRefreshConfigs[connection.host]) {
                                try {
                                  await getConfigForHost(connection.host);
                                } catch (error) {
                                  console.error('Failed to load config on focus:', error);
                                }
                              }
                            }}
                            inputProps={{
                              min: 100,
                              max: 10000,
                              step: 100,
                              style: { 
                                fontSize: '0.8125rem', 
                                padding: '6px 8px',
                                textAlign: 'right'
                              }
                            }}
                            sx={{ 
                              width: '70px',
                              '& .MuiOutlinedInput-root': {
                                height: '32px',
                                '&:hover fieldset': {
                                  borderColor: (theme) => theme.palette.primary.main,
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: (theme) => theme.palette.primary.main,
                                },
                              }
                            }}
                          />
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontSize: '0.75rem', 
                              color: 'text.secondary',
                              fontWeight: 500,
                            }}
                          >
                            ms
                          </Typography>
                        </Box>
                      );
                    })()}
                    {connection.status !== 'Connected' && (
                      <Typography 
                        variant="body2" 
                        color="textSecondary" 
                        sx={{ 
                          fontSize: '0.75rem',
                          fontStyle: 'italic',
                        }}
                      >
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      py: 1.5,
                      borderBottom: 'none',
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: 'text.primary',
                      }}
                    >
                      {connection.activeInput}
                    </Typography>
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      py: 1.5,
                      borderBottom: 'none',
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: 'text.primary',
                      }}
                    >
                      {connection.previewInput}
                    </Typography>
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      py: 1.5,
                      borderBottom: 'none',
                    }}
                  >
                    {backgroundConnections.has(connection.host) ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                        <CircularProgress size={16} thickness={4} />
                        <Typography 
                          variant="caption" 
                          color="textSecondary" 
                          sx={{ 
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          Connecting...
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {connection.status === 'Disconnected' && (
                          <IconButton
                            color="primary"
                            onClick={() => handleReconnect(connection)}
                            title="Reconnect"
                            size="small"
                            sx={{ 
                              padding: '6px',
                              '&:hover': {
                                backgroundColor: (theme) => theme.palette.mode === 'dark' 
                                  ? 'rgba(144, 202, 249, 0.1)' 
                                  : 'rgba(25, 118, 210, 0.08)',
                              },
                            }}
                          >
                            <ReconnectIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton 
                          color="error" 
                          onClick={() => handleDelete(connection.id)}
                          size="small"
                          title="Delete"
                          sx={{ 
                            padding: '6px',
                            '&:hover': {
                              backgroundColor: (theme) => theme.palette.mode === 'dark' 
                                ? 'rgba(244, 67, 54, 0.1)' 
                                : 'rgba(244, 67, 54, 0.08)',
                            },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
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
                      <TableCell>Preset</TableCell>
                      <TableCell>Response Time</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scanResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.ip_address}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{result.preset || '-'}</Typography>
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
            {isScanning ? 'Scanning...' : (scanResults.length > 0 ? 'Rescan' : 'Start Scan')}
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