import { useState, useEffect, useCallback } from 'react';
import { useVMixStatus } from '../hooks/useVMixStatus';
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
  MenuItem
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
  status: 'Connected' | 'Disconnected' | 'Reconnecting';
  activeInput: number;
  previewInput: number;
}

const Connections: React.FC = () => {
  const { connections: vmixConnections, loading: globalLoading, connectVMix, disconnectVMix, sendVMixFunction } = useVMixStatus();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [newHost, setNewHost] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

  // Transform global connections to local format
  useEffect(() => {
    const newConnections = vmixConnections.map((conn, index) => ({
      id: index + 1,
      host: conn.host,
      label: conn.label,
      status: conn.status as 'Connected' | 'Disconnected' | 'Reconnecting',
      activeInput: conn.active_input,
      previewInput: conn.preview_input,
    }));
    
    setConnections(newConnections);
  }, [vmixConnections]);

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
      await connectVMix(newHost.trim());
      handleClose();
    } catch (error) {
      console.error('Failed to connect:', error);
      setError(`Failed to connect to ${newHost}: ${error}`);
      setConnecting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const connection = connections.find(c => c.id === id);
    if (!connection) return;
    
    try {
      await disconnectVMix(connection.host);
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
      await sendVMixFunction(selectedConnection.host, functionName);
      handleMenuClose();
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
            disabled={globalLoading}
          >
            {globalLoading ? 'Auto-Refreshing...' : 'Auto-Refresh Active'}
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
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="textSecondary">
                    No vMix connections. Add a connection to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              connections.map((connection) => (
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
                      color={connection.status === 'Connected' ? 'success' : connection.status === 'Reconnecting' ? 'warning' : 'error'}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{connection.activeInput}</TableCell>
                  <TableCell>{connection.previewInput}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={(e) => handleMenuClick(e, connection)}
                      disabled={connection.status !== 'Connected'}
                    >
                      <MoreVertIcon />
                    </IconButton>
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