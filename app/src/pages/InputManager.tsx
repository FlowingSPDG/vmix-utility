import { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

interface Input {
  number: number;
  title: string;
  type: string;
  key: string;
  state: string;
}

type Order = 'asc' | 'desc';
type OrderBy = 'number' | 'title' | 'type';

interface InputRowProps {
  input: Input;
  isEditing: boolean;
  editingValue: string;
  onEditClick: (input: Input) => void;
  onSaveClick: (key: string) => void;
  onCancelClick: (key: string) => void;
  onDeleteClick: (key: string) => void;
  onTitleChange: (key: string, value: string) => void;
}


const textFieldSx = {
  mr: 1,
  "& .MuiInputBase-input.Mui-disabled": {
    WebkitTextFillColor: "unset",
    color: "text.primary"
  }
};

const boxSx = { display: 'flex', alignItems: 'center' };

const OptimizedInputRow = memo(({ 
  input, 
  isEditing, 
  editingValue,
  onEditClick, 
  onSaveClick, 
  onCancelClick, 
  onDeleteClick, 
  onTitleChange 
}: InputRowProps) => {
  return (
    <TableRow key={input.key}>
      <TableCell>{input.number}</TableCell>
      <TableCell>
        <Box sx={boxSx}>
          <TextField
            value={editingValue}
            onChange={isEditing ? (e) => onTitleChange(input.key, e.target.value) : undefined}
            size="small"
            disabled={!isEditing}
            variant={isEditing ? "outlined" : "standard"}
            sx={textFieldSx}
          />
          {isEditing ? (
            <>
              <IconButton
                size="small"
                color="primary"
                onClick={() => onSaveClick(input.key)}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => onCancelClick(input.key)}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </>
          ) : (
            <IconButton
              size="small"
              onClick={() => onEditClick(input)}
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
          onClick={() => onDeleteClick(input.key)}
        >
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </TableRow>
  );
});

const InputRow = OptimizedInputRow;


const InputManager = () => {
  const { connections, inputs: globalInputs, sendVMixFunction, loading: globalLoading } = useVMixStatus();
  const [inputs, setInputs] = useState<Input[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Single editing state to minimize re-renders
  const [editingData, setEditingData] = useState<{[key: string]: string}>({});
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('number');
  
  // Dialog state for deletion confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inputToDelete, setInputToDelete] = useState<Input | null>(null);

  const connectedConnections = useMemo(() => 
    connections.filter(conn => conn.status === 'Connected'), 
    [connections]
  );

  useEffect(() => {
    if (connectedConnections.length > 0 && selectedConnection === '') {
      const firstConnection = connectedConnections[0].host;
      setSelectedConnection(firstConnection);
    }
  }, [connectedConnections, selectedConnection]);

  // Update inputs when global inputs change or selected connection changes
  useEffect(() => {
    if (selectedConnection && globalInputs[selectedConnection]) {
      const vmixInputs = globalInputs[selectedConnection];
      setInputs(vmixInputs.map((input, _index) => ({
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

  const handleConnectionChange = (host: string) => {
    setSelectedConnection(host);
  };

  const handleEditClick = useCallback((input: Input) => {
    setEditingData(prev => ({ ...prev, [input.key]: input.title }));
  }, []);

  const handleSaveClick = useCallback(async (key: string) => {
    setEditingData(currentEditingData => {
      const newTitle = currentEditingData[key];
      
      setInputs(currentInputs => {
        const input = currentInputs.find(inp => inp.key === key);
        
        if (input && selectedConnection && newTitle !== undefined) {
          (async () => {
            try {
              await sendVMixFunction(selectedConnection, 'SetInputName', {
                Input: input.number.toString(),
                Value: newTitle
              });

              setInputs(prevInputs =>
                prevInputs.map(inp =>
                  inp.key === key ? { ...inp, title: newTitle } : inp
                )
              );
            } catch (error) {
              console.error('Failed to update input title:', error);
              setError(`Failed to update input title: ${error}`);
            }
          })();
        }
        
        return currentInputs;
      });
      
      const { [key]: _, ...rest } = currentEditingData;
      return rest;
    });
  }, [selectedConnection, sendVMixFunction]);

  const handleTitleChange = useCallback((key: string, value: string) => {
    setEditingData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleCancelClick = useCallback((key: string) => {
    setEditingData(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleDeleteClick = useCallback((key: string) => {
    setInputs(currentInputs => {
      const input = currentInputs.find(inp => inp.key === key);
      if (input) {
        setInputToDelete(input);
        setDeleteDialogOpen(true);
      }
      return currentInputs;
    });
  }, []);

  const handleDeleteConfirm = async () => {
    if (inputToDelete && selectedConnection) {
      try {
        // delete input from vMix using RemoveInput function
        await sendVMixFunction(selectedConnection, 'RemoveInput', {
          Input: inputToDelete.key
        });

        // update local state
        setInputs(prevInputs => prevInputs.filter(input => input.key !== inputToDelete.key));
      } catch (error) {
        console.error('Failed to delete input:', error);
        setError(`Failed to delete input: ${error}`);
      }
    }
    setDeleteDialogOpen(false);
    setInputToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setInputToDelete(null);
  };

  const handleRequestSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedInputs = useMemo(() => {
    return [...inputs].sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      
      const compareResult = typeof aValue === 'string' && typeof bValue === 'string'
        ? aValue.localeCompare(bValue)
        : (aValue as number) - (bValue as number);
        
      return order === 'asc' ? compareResult : -compareResult;
    });
  }, [inputs, order, orderBy]);

  const inputRowData = useMemo(() => {
    return sortedInputs.map(input => {
      const isEditing = input.key in editingData;
      return {
        input,
        isEditing,
        editingValue: editingData[input.key] ?? input.title
      };
    });
  }, [sortedInputs, editingData]);

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
            {connectedConnections.map((conn) => (
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
            {globalLoading ? (
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
              inputRowData.map((rowData) => (
                <InputRow
                  key={rowData.input.key}
                  input={rowData.input}
                  isEditing={rowData.isEditing}
                  editingValue={rowData.editingValue}
                  onEditClick={handleEditClick}
                  onSaveClick={handleSaveClick}
                  onCancelClick={handleCancelClick}
                  onDeleteClick={handleDeleteClick}
                  onTitleChange={handleTitleChange}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={async () => {
            for (const key of Object.keys(editingData)) {
              await handleSaveClick(key);
            }
            setEditingData({});
          }}
          disabled={Object.keys(editingData).length === 0}
        >
          Apply All Changes
        </Button>
      </Box>
      
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Input
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the input "{inputToDelete?.title}" (#{inputToDelete?.number})?
            This action cannot be undone.
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

export default InputManager;