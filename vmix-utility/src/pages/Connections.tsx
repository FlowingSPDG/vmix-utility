import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
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
  DialogTitle
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface Connection {
  id: number;
  host: string;
  label: string;
  status: 'Connected' | 'Disconnected';
  activeInput: number;
  previewInput: number;
}

const Connections: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        // TODO: 実際の接続情報を取得するロジックを実装
        const initialConnections = await invoke<VmixConnection[]>('get_vmix_statuses');
        setConnections(initialConnections.map((conn, index) => ({
          id: index + 1,
          host: conn.host,
          label: conn.label,
          status: conn.status,
          activeInput: conn.active_input,
          previewInput: conn.preview_input,
        })));
      } catch (error) {
        console.error('Failed to fetch connections:', error);
      }
    };

    fetchConnections();
  }, []);
  
  const [open, setOpen] = useState(false);
  const [newHost, setNewHost] = useState('');

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setNewHost('');
  };

  const handleAdd = async () => {
    if (newHost) {
      try {
        const newConnection = await invoke<VmixConnection>('connect_vmix', { host: newHost });
        setConnections([...connections, {
          id: connections.length > 0 ? Math.max(...connections.map(c => c.id)) + 1 : 1,
          host: newConnection.host,
          label: newConnection.label,
          status: newConnection.status,
          activeInput: newConnection.active_input,
          previewInput: newConnection.preview_input
        }]);
        handleClose();
      } catch (error) {
        console.error('Failed to connect:', error);
        alert(`接続に失敗しました: ${error}`);
      }
    }
  };

  const handleDelete = async (id: number) => {
    const connection = connections.find(c => c.id === id);
    if (connection) {
      try {
        await invoke('disconnect_vmix', { host: connection.host });
        setConnections(connections.filter(connection => connection.id !== id));
      } catch (error) {
        console.error('Failed to disconnect:', error);
        alert(`切断に失敗しました: ${error}`);
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Host</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Active Input</TableCell>
              <TableCell>Preview Input</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {connections.map((connection) => (
              <TableRow key={connection.id}>
                <TableCell>{connection.host}</TableCell>
                <TableCell>
                  <Box 
                    component="span" 
                    sx={{ 
                      color: connection.status === 'Connected' ? 'success.main' : 'error.main',
                      fontWeight: 'bold'
                    }}
                  >
                    {connection.status}
                  </Box>
                </TableCell>
                <TableCell>{connection.activeInput}</TableCell>
                <TableCell>{connection.previewInput}</TableCell>
                <TableCell>
                  <Button 
                    color="error" 
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(connection.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Add New vMix Connection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="ip"
            label="Host"
            type="text"
            fullWidth
            variant="outlined"
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Connections;