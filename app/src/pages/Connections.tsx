import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { settingsService } from '../services/settingsService';
import { NetworkScannerService, type NetworkInterface, type VmixScanResult } from '../services/networkScannerService';
import Alert from '@mui/material/Alert';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import { useBackgroundAwareTimeout } from '../hooks/useBackgroundAwareTimeout';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
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
  version: string;
  edition: string;
  preset?: string;
}

const Connections: React.FC = () => {
  const { t } = useTranslation();
  const { connections: vmixConnections, loading: globalLoading, connectVMix, disconnectVMix, autoRefreshConfigs, setAutoRefreshConfig, refreshConnections } = useVMixStatus();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState(8088);
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

  const dismissNextNotification = useCallback(() => {
    setConnectionNotifications(prev => prev.slice(1));
  }, []);

  const { startTimer, clearTimer } = useBackgroundAwareTimeout(dismissNextNotification);

  useEffect(() => {
    if (connectionNotifications.length === 0) {
      clearTimer();
      return;
    }

    startTimer(5000);
  }, [connectionNotifications, startTimer, clearTimer]);

  // Preset path display toggle
  const [showFullPresetPaths, setShowFullPresetPaths] = useState(false);

  // Helper function to get filename from path
  const getFileName = (filePath: string | undefined): string => {
    if (!filePath) return '-';
    return filePath.split(/[\\\/]/).pop() || filePath;
  };

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

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setNewHost('');
    setNewPort(8088);
    setError(null);
  };

  const handleAdd = async () => {
    if (!newHost.trim()) return;
    
    // Check for duplicate IP on frontend
    const trimmedHost = newHost.trim();
    const isDuplicate = connections.some(conn => conn.host === trimmedHost);
    
    if (isDuplicate) {
      setError(t('connections.duplicateHost', { host: trimmedHost }));
      return;
    }
    
    // Close dialog immediately for better UX
    handleClose();
    
    // Add to background connections set
    setBackgroundConnections(prev => new Set([...prev, trimmedHost]));
    
    // Start background connection process
    try {
      await connectVMix(trimmedHost, newPort);
      
      // Add success notification
      setConnectionNotifications(prev => [...prev, {
        host: trimmedHost,
        success: true,
        message: t('connections.successConnect', { host: trimmedHost })
      }]);
    } catch (error) {
      console.error('Failed to connect:', error);
      
      // Add error notification
      setConnectionNotifications(prev => [...prev, {
        host: trimmedHost,
        success: false,
        message: t('connections.failConnect', { host: trimmedHost, error: String(error) })
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
        setError(t('connections.failDisconnect', { host: connectionToDelete.host, error: String(error) }));
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
      setError(t('connections.failInterfaces', { error: String(error) }));
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
      setScanError(t('connections.failScan', { error: String(error) }));
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectFromScan = async (ipAddress: string) => {
    // Don't close dialog - allow connecting to multiple vMix instances
    // Add to background connections set
    setBackgroundConnections(prev => new Set([...prev, ipAddress]));
    
    try {
      await connectVMix(ipAddress, 8088);
      
      // Refresh connections to update the UI
      await refreshConnections();
      
      // Add success notification
      setConnectionNotifications(prev => [...prev, {
        host: ipAddress,
        success: true,
        message: t('connections.successConnect', { host: ipAddress })
      }]);
    } catch (error) {
      console.error('Failed to connect to scanned vMix:', error);
      
      // Add error notification
      setConnectionNotifications(prev => [...prev, {
        host: ipAddress,
        success: false,
        message: t('connections.failConnect', { host: ipAddress, error: String(error) })
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
      await connectVMix(connection.host, connection.port);
      
      // Add success notification
      setConnectionNotifications(prev => [...prev, {
        host: connection.host,
        success: true,
        message: t('connections.successReconnect', { host: connection.host })
      }]);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      
      // Add error notification
      setConnectionNotifications(prev => [...prev, {
        host: connection.host,
        success: false,
        message: t('connections.failReconnect', { host: connection.host, error: String(error) })
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
          await connectVMix(editingConnection.host, editingConnection.port);
        } catch (reconnectError) {
          console.error('Failed to reconnect after label update:', reconnectError);
          // Don't show error for reconnect failure as label was updated successfully
        }
      }
    } catch (error) {
      console.error('Failed to update label:', error);
      setError(t('connections.failLabel', { error: String(error) }));
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
            {t('connections.loadingBackdrop')}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {connections.length > 0
              ? t(connections.length > 1 ? 'connections.foundConnections_plural' : 'connections.foundConnections', { count: connections.length })
              : t('connections.checkingSaved')
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
          {t('connections.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<WifiIcon />}
            onClick={handleScanClick}
          >
            {t('connections.autoDetect')}
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleClickOpen}
          >
            {t('connections.addConnection')}
          </Button>
        </Box>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

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
          label={t('connections.showFullPaths')}
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
        <Table size="small" sx={{ minWidth: 1120 }}>
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
              }}>{t('connections.host')}</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '50px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.port')}</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '70px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.status')}</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '80px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.version')}</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '60px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.edition')}</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '80px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.preset')}</TableCell>
              <TableCell sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '120px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.updateInterval')}</TableCell>
              <TableCell align="right" sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '50px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.active')}</TableCell>
              <TableCell align="right" sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '50px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.preview')}</TableCell>
              <TableCell align="right" sx={{ 
                fontSize: '0.75rem', 
                py: 1.5, 
                width: '120px',
                fontWeight: 600,
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              }}>{t('connections.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(globalLoading && connections.length === 0) ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="textSecondary">
                      {t('connections.loadingRow')}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : connections.length === 0 && backgroundConnections.size === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    {t('connections.empty')}
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
                  label: t('connections.connectingLabel', { host }),
                  status: 'Reconnecting' as const,
                  activeInput: 0,
                  previewInput: 0,
                  version: t('connections.connectingEllipsis'),
                  edition: t('connections.connectingEllipsis'),
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
                        title={t('connections.editLabel')}
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
                            {t('connections.connecting')}
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
                            {connection.status === 'Reconnecting' ? t('connections.retrying') : (
                              connection.status === 'Connected' ? t('connections.statusConnected') :
                              connection.status === 'Disconnected' ? t('connections.statusDisconnected') :
                              connection.status
                            )}
                          </Typography>
                          {connection.status === 'Reconnecting' ? (
                            <CircularProgress size={12} thickness={4} />
                          ) : null}
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
                    {(() => {
                      const config = autoRefreshConfigs[connection.host] || { enabled: true, duration: 3000 };
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
                            {t('common.ms')}
                          </Typography>
                        </Box>
                      );
                    })()}
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
                          {t('connections.connectingEllipsis')}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {connection.status === 'Disconnected' ? (
                          <IconButton
                            color="primary"
                            onClick={() => handleReconnect(connection)}
                            title={t('connections.reconnect')}
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
                        ) : null}
                        <IconButton 
                          color="error" 
                          onClick={() => handleDelete(connection.id)}
                          size="small"
                          title={t('connections.delete')}
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
        <DialogTitle>{t('connections.dialogAddTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="host"
            label={t('connections.hostFieldLabel')}
            type="text"
            fullWidth
            variant="outlined"
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
            placeholder={t('connections.hostPlaceholder')}
            helperText={t('connections.hostHelper')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            id="port"
            label={t('connections.portFieldLabel')}
            type="number"
            fullWidth
            variant="outlined"
            value={newPort}
            onChange={(e) => {
              setNewPort(parseInt(e.target.value) || 8088);
            }}
            placeholder={t('connections.portPlaceholderHttp')}
            helperText={t('connections.portHelperHttp')}
            InputProps={{
              inputProps: {
                min: 1,
                max: 65535
              }
            }}
          />
          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleAdd} 
            variant="contained" 
            disabled={!newHost.trim()}
          >
            {t('connections.addConnection')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Label Edit Dialog */}
      <Dialog open={labelDialogOpen} onClose={handleLabelCancel} maxWidth="sm" fullWidth>
        <DialogTitle>{t('connections.labelDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {t('connections.hostPrefix')} {editingConnection?.host}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            id="label"
            label={t('common.label')}
            type="text"
            fullWidth
            variant="outlined"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t('connections.labelPlaceholder')}
            helperText={t('connections.labelHelper')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLabelCancel}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleLabelSave} 
            variant="contained" 
            disabled={!newLabel.trim()}
          >
            {t('common.save')}
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
          {t('connections.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {t('connections.deleteConfirm', { label: connectionToDelete?.label ?? '', host: connectionToDelete?.host ?? '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {t('common.delete')}
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
            {t('connections.scanTitle')}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t('connections.scanWarning')}
            </Typography>
          </Alert>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <FormLabel>{t('connections.selectInterface')}</FormLabel>
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

          {scanError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {scanError}
            </Alert>
          ) : null}

          {scanResults.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {t('connections.scanResults', { count: scanResults.length })}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('connections.ipAddress')}</TableCell>
                      <TableCell>{t('connections.preset')}</TableCell>
                      <TableCell>{t('connections.responseTime')}</TableCell>
                      <TableCell>{t('connections.action')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scanResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.ip_address}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{result.preset || '-'}</Typography>
                        </TableCell>
                        <TableCell>{result.response_time}{t('common.ms')}</TableCell>
                        <TableCell>
                          {result.is_vmix ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleConnectFromScan(result.ip_address)}
                              disabled={connections.some(conn => conn.host === result.ip_address)}
                            >
                              {connections.some(conn => conn.host === result.ip_address) ? t('connections.connected') : t('connections.connect')}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleScanClose} disabled={isScanning}>
            {t('common.close')}
          </Button>
          <Button 
            onClick={handleScanNetwork} 
            variant="contained" 
            disabled={!selectedInterface || isScanning}
            startIcon={isScanning ? <CircularProgress size={16} /> : <SearchIcon />}
          >
            {isScanning ? t('connections.scanning') : (scanResults.length > 0 ? t('connections.rescan') : t('connections.startScan'))}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connection Notifications */}
      {connectionNotifications.length > 0 ? (
        <Snackbar
          open={true}
          onClose={dismissNextNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert
            severity={connectionNotifications[0].success ? 'success' : 'error'}
            sx={{ mb: 1 }}
          >
            {connectionNotifications[0].message}
          </Alert>
        </Snackbar>
      ) : null}
    </Box>
  );
};

export default Connections;