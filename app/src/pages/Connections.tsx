import { useState, useEffect } from 'react';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { invoke } from '@tauri-apps/api/core';
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
  DialogContentText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ReconnectIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';

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
}

const Connections: React.FC = () => {
  const { connections: vmixConnections, loading: globalLoading, connectVMix, disconnectVMix, autoRefreshConfigs, setAutoRefreshConfig, refreshConnections } = useVMixStatus();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState(8088);
  const [newConnectionType, setNewConnectionType] = useState<'Http' | 'Tcp'>('Http');
  const [connecting, setConnecting] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);

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
    }));
    
    setConnections(newConnections);
    
    // Mark initial loading as complete when we have connections or after a timeout
    if (isInitialLoading && (!globalLoading || newConnections.length > 0)) {
      setIsInitialLoading(false);
    }
  }, [vmixConnections, globalLoading, isInitialLoading]);

  // Auto-refresh connections when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshConnections();
    }, 500); // Wait a bit for initial load
    
    return () => clearTimeout(timer);
  }, [refreshConnections]);

  // Set a timeout for initial loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    }, 3000); // Max 3 seconds for initial loading

    return () => clearTimeout(timeout);
  }, [isInitialLoading]);

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
    
    setConnecting(true);
    setError(null);
    try {
      const portToUse = newConnectionType === 'Tcp' ? 8099 : newPort;
      await connectVMix(trimmedHost, portToUse, newConnectionType);
    } catch (error) {
      console.error('Failed to connect:', error);
      setError(`Failed to connect to ${trimmedHost}: ${error}`);
    } finally {
      setConnecting(false);
      handleClose();
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

  const handleReconnect = async (connection: Connection) => {
    setError(null);
    try {
      await connectVMix(connection.host, connection.port, connection.connectionType);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      setError(`Failed to reconnect to ${connection.host}: ${error}`);
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
      // Use Tauri invoke to update label on backend (auto-saves config)
      await invoke('update_connection_label', {
        host: editingConnection.host,
        label: newLabel.trim()
      });
      
      // Only try to reconnect if the connection is connected or reconnecting
      if (editingConnection.status === 'Connected' || editingConnection.status === 'Reconnecting') {
        await connectVMix(editingConnection.host, editingConnection.port, editingConnection.connectionType);
      }
      
      setLabelDialogOpen(false);
      setEditingConnection(null);
      setNewLabel('');
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
            Checking connection status and loading saved configurations...
          </Typography>
        </CardContent>
      </Card>
    </Backdrop>
  );

  return (
    <Box sx={{ p: 3 }}>
      <LoadingScreen />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          vMix Connections
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleClickOpen}
        >
          Add Connection
        </Button>
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
              <TableCell>Active Input</TableCell>
              <TableCell>Preview Input</TableCell>
              <TableCell>Auto-Refresh</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(globalLoading) && connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="textSecondary">
                      Loading connections and checking vMix status...
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography color="textSecondary">
                    No vMix connections. Add a connection to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              connections.map((connection) => (
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
                      label={connection.connectionType}
                      color={connection.connectionType === 'Tcp' ? 'primary' : 'default'}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip 
                        label={connection.status}
                        color={connection.status === 'Connected' ? 'success' : connection.status === 'Reconnecting' ? 'warning' : 'error'}
                        variant="outlined"
                        size="small"
                      />
                      {connection.status === 'Reconnecting' && (
                        <CircularProgress size={16} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{connection.version}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{connection.edition}</Typography>
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
                    {connection.connectionType === 'Tcp' && (
                      <Typography variant="body2" color="textSecondary">
                        Real-time
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
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
            disabled={connecting}
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
            disabled={connecting || newConnectionType === 'Tcp'}
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
                disabled={connecting}
              />
              <FormControlLabel
                value="Tcp"
                control={<Radio />}
                label="TCP API"
                disabled={connecting}
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
    </Box>
  );
};

export default Connections;