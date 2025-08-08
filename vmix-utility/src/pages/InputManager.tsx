import { useState, useEffect } from 'react';
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
  TextField,
  Button,
  TableSortLabel,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

interface VmixConnection {
  host: string;
  label: string;
  status: 'Connected' | 'Disconnected';
  active_input: number;
  preview_input: number;
}

interface VmixInput {
  key: string;
  number: number;
  title: string;
  input_type: string;
  state: string;
}

interface Input {
  id: number;
  number: number;
  title: string;
  type: string;
  key: string;
  state: string;
}

type Order = 'asc' | 'desc';
type OrderBy = 'number' | 'title' | 'type';

const InputManager = () => {
  const { connections, inputs: globalInputs, getVMixInputs, sendVMixFunction } = useVMixStatus();
  const [inputs, setInputs] = useState<Input[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track editing state for each input
  const [editingStates, setEditingStates] = useState<Record<number, string>>({});
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('number');

  useEffect(() => {
    // Auto-select first available connected connection
    const connectedConnections = connections.filter(conn => conn.status === 'Connected');
    if (connectedConnections.length > 0 && selectedConnection === '') {
      const firstConnection = connectedConnections[0].host;
      setSelectedConnection(firstConnection);
    }
  }, [connections, selectedConnection]);

  // Update inputs when global inputs change or selected connection changes
  useEffect(() => {
    if (selectedConnection && globalInputs[selectedConnection]) {
      const vmixInputs = globalInputs[selectedConnection];
      setInputs(vmixInputs.map((input, index) => ({
        id: index + 1,
        number: input.number,
        title: input.title,
        type: input.input_type,
        key: input.key,
        state: input.state,
      })));
    } else {
      setInputs([]);
    }
  }, [selectedConnection, globalInputs]);

  const fetchInputs = async (host: string) => {
    setLoading(true);
    setError(null);
    try {
      const vmixInputs = await getVMixInputs(host);
      setInputs(vmixInputs.map((input: VmixInput, index: number) => ({
        id: index + 1,
        number: input.number,
        title: input.title,
        type: input.input_type,
        key: input.key,
        state: input.state,
      })));
    } catch (error) {
      console.error('Failed to fetch vMix inputs:', error);
      setError(`Failed to fetch inputs from ${host}: ${error}`);
      setInputs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionChange = (host: string) => {
    setSelectedConnection(host);
    if (host) {
      fetchInputs(host);
    } else {
      setInputs([]);
    }
  };

  const handleEditClick = (input: Input) => {
    setEditingStates({
      ...editingStates,
      [input.id]: input.title
    });
  };

  const handleTitleChange = (id: number, value: string) => {
    setEditingStates({
      ...editingStates,
      [id]: value
    });
  };

  const handleSaveClick = async (id: number) => {
    const newTitle = editingStates[id];
    const input = inputs.find(inp => inp.id === id);
    
    if (newTitle !== undefined && input && selectedConnection) {
      try {
        // Send SetInputName function to update input title in vMix
        await sendVMixFunction(selectedConnection, 'SetInputName', {
          Input: input.number.toString(),
          Value: newTitle
        });

        // Update local state
        setInputs(inputs.map(inp =>
          inp.id === id
            ? { ...inp, title: newTitle }
            : inp
        ));
        
        // Remove this input from editing state
        const newEditingStates = { ...editingStates };
        delete newEditingStates[id];
        setEditingStates(newEditingStates);
      } catch (error) {
        console.error('Failed to update input title:', error);
        setError(`Failed to update input title: ${error}`);
      }
    }
  };

  const handleCancelClick = (id: number) => {
    // Remove this input from editing state
    const newEditingStates = { ...editingStates };
    delete newEditingStates[id];
    setEditingStates(newEditingStates);
  };

  const handleDeleteClick = (id: number) => {
    setInputs(inputs.filter(input => input.id !== id));
  };

  const handleRequestSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedInputs = [...inputs].sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    const compareResult = typeof aValue === 'string' && typeof bValue === 'string'
      ? aValue.localeCompare(bValue)
      : (aValue as number) - (bValue as number);
      
    return order === 'asc' ? compareResult : -compareResult;
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Input Manager
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="connection-select-label">vMix Connection</InputLabel>
          <Select
            labelId="connection-select-label"
            value={selectedConnection}
            label="vMix Connection"
            onChange={(e) => handleConnectionChange(e.target.value as string)}
          >
            <MenuItem value="">
              <em>Select a vMix connection</em>
            </MenuItem>
            {connections
              .filter(conn => conn.status === 'Connected')
              .map((conn) => (
                <MenuItem key={conn.host} value={conn.host}>
                  {conn.label} ({conn.host})
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {selectedConnection && (
          <Button 
            variant="outlined" 
            onClick={() => fetchInputs(selectedConnection)}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Refresh Inputs
          </Button>
        )}
      </Paper>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'number'}
                  direction={orderBy === 'number' ? order : 'asc'}
                  onClick={() => handleRequestSort('number')}
                >
                  Number
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'title'}
                  direction={orderBy === 'title' ? order : 'asc'}
                  onClick={() => handleRequestSort('title')}
                >
                  Title
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'type'}
                  direction={orderBy === 'type' ? order : 'asc'}
                  onClick={() => handleRequestSort('type')}
                >
                  Type
                </TableSortLabel>
              </TableCell>
              <TableCell>State</TableCell>
              <TableCell>Key</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Loading inputs...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : inputs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="textSecondary">
                    {selectedConnection ? 'No inputs found' : 'Select a vMix connection to view inputs'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedInputs.map((input) => {
                const isEditing = editingStates[input.id] !== undefined;
                
                return (
                  <TableRow key={input.id}>
                    <TableCell>{input.number}</TableCell>
                    <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TextField
                        value={isEditing ? editingStates[input.id] : input.title}
                        onChange={(e) => handleTitleChange(input.id, e.target.value)}
                        size="small"
                        disabled={!isEditing}
                        variant={isEditing ? "outlined" : "standard"}
                        sx={{
                          mr: 1,
                          "& .MuiInputBase-input.Mui-disabled": {
                            WebkitTextFillColor: isEditing ? "rgba(0, 0, 0, 0.87)" : "rgba(0, 0, 0, 0.38)"
                          }
                        }}
                      />
                      {isEditing ? (
                        <>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleSaveClick(input.id)}
                          >
                            <SaveIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleCancelClick(input.id)}
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(input)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{input.type}</TableCell>
                  <TableCell>
                    <Chip 
                      label={input.state}
                      color={input.state === 'Running' ? 'success' : input.state === 'Paused' ? 'warning' : 'default'}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="textSecondary">
                      {input.key.substring(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => handleDeleteClick(input.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            // Apply all pending changes
            for (const [idStr, title] of Object.entries(editingStates)) {
              const id = Number.parseInt(idStr, 10);
              setInputs(inputs.map(input =>
                input.id === id
                  ? { ...input, title }
                  : input
              ));
            }
            // Clear all editing states
            setEditingStates({});
          }}
          disabled={Object.keys(editingStates).length === 0}
        >
          Apply All Changes
        </Button>
      </Box>
    </Box>
  );
};

export default InputManager;