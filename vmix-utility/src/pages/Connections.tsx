import { useState } from 'react';
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
  status: 'Connected' | 'Disconnected';
  activeInput: number;
  previewInput: number;
}

const Connections: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([
    { id: 1, host: '192.168.1.100', status: 'Connected', activeInput: 1, previewInput: 2 },
    { id: 2, host: '192.168.1.101', status: 'Disconnected', activeInput: 0, previewInput: 0 },
  ]);
  
  const [open, setOpen] = useState(false);
  const [newHost, setNewHost] = useState('');

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setNewHost('');
  };

  const handleAdd = () => {
    if (newHost) {
      const newConnection: Connection = {
        id: connections.length > 0 ? Math.max(...connections.map(c => c.id)) + 1 : 1,
        host: newHost,
        status: 'Disconnected',
        activeInput: 0,
        previewInput: 0
      };
      setConnections([...connections, newConnection]);
      handleClose();
    }
  };

  const handleDelete = (id: number) => {
    setConnections(connections.filter(connection => connection.id !== id));
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