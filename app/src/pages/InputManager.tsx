import { useState, useMemo, useCallback, memo } from 'react';
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
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Skeleton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

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
  isLoading: boolean;
  onEditClick: (input: Input) => void;
  onSaveClick: (key: string) => void;
  onCancelClick: (key: string) => void;
  onDeleteClick: (key: string) => void;
  onTitleChange: (key: string, value: string) => void;
  onCopyKey: (key: string) => void;
}

interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
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
  isLoading,
  onEditClick, 
  onSaveClick, 
  onCancelClick, 
  onDeleteClick, 
  onTitleChange,
  onCopyKey
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
            disabled={!isEditing || isLoading}
            variant={isEditing ? "outlined" : "standard"}
            sx={textFieldSx}
          />
          {isEditing ? (
            <>
              <IconButton
                size="small"
                color="primary"
                onClick={() => onSaveClick(input.key)}
                disabled={isLoading}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => onCancelClick(input.key)}
                disabled={isLoading}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </>
          ) : (
            <IconButton
              size="small"
              onClick={() => onEditClick(input)}
              disabled={isLoading}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="textSecondary">
            {input.key.substring(0, 8)}...
          </Typography>
          <IconButton size="small" onClick={() => onCopyKey(input.key)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Box>
      </TableCell>
      <TableCell>
        <IconButton
          color="error"
          size="small"
          onClick={() => onDeleteClick(input.key)}
          disabled={isLoading}
        >
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </TableRow>
  );
});

const InputRow = OptimizedInputRow;


const InputManager = () => {
  const { connections, inputs: globalInputs, sendVMixFunction, getVMixInputs } = useVMixStatus();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ open: false, message: '', severity: 'info' });
  
  // Single editing state to minimize re-renders
  const [editingData, setEditingData] = useState<{[key: string]: string}>({});
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('number');
  
  // Dialog state for deletion confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inputToDelete, setInputToDelete] = useState<Input | null>(null);
  
  // Loading states for operations
  const [operationLoading, setOperationLoading] = useState<{[key: string]: boolean}>({});

  // Connection state management
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const connectedConnections = useMemo(() => 
    connections.filter(conn => conn.status === 'Connected'), 
    [connections]
  );
  
  // Auto-select first available connection when connections change
  useEffect(() => {
    if (connectedConnections.length > 0 && !selectedConnection) {
      setSelectedConnection(connectedConnections[0].host);
    } else if (connectedConnections.length === 0) {
      setSelectedConnection('');
    } else if (selectedConnection && !connectedConnections.find(conn => conn.host === selectedConnection)) {
      // If current selection is no longer connected, switch to first available
      setSelectedConnection(connectedConnections[0].host);
    }
  }, [connectedConnections, selectedConnection]);
  
  // Derive inputs directly from globalInputs without useState
  const inputs = useMemo(() => {
    if (selectedConnection && globalInputs[selectedConnection]) {
      return globalInputs[selectedConnection].map((input) => ({
        number: input.number,
        title: input.title,
        type: input.input_type,
        key: input.key,
        state: input.state,
      }));
    }
    return [];
  }, [selectedConnection, globalInputs]);

  // Show loading if no connections or no data yet
  const isLoading = connections.length === 0 || (selectedConnection && !globalInputs[selectedConnection]);

  const handleConnectionChange = (event: any) => {
    setSelectedConnection(event.target.value);
  };

  const handleEditClick = useCallback((input: Input) => {
    setEditingData(prev => ({ ...prev, [input.key]: input.title }));
  }, []);

  const handleSaveClick = useCallback(async (key: string) => {
    const newTitle = editingData[key];
    const input = inputs.find((inp: Input) => inp.key === key);
    
    if (input && selectedConnection && newTitle !== undefined) {
      setOperationLoading(prev => ({ ...prev, [key]: true }));
      try {
        await sendVMixFunction(selectedConnection, 'SetInputName', {
          Input: input.number.toString(),
          Value: newTitle
        });

        // Refresh inputs to get latest XML data
        await getVMixInputs(selectedConnection);

        setToast({ open: true, message: 'Input title updated successfully', severity: 'success' });
        
        // Remove from editing data
        setEditingData(currentEditingData => {
          const { [key]: _, ...rest } = currentEditingData;
          return rest;
        });
      } catch (error) {
        console.error('Failed to update input title:', error);
        setToast({ open: true, message: 'Failed to update input title', severity: 'error' });
      } finally {
        setOperationLoading(prev => {
          const { [key]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  }, [editingData, inputs, selectedConnection, sendVMixFunction, getVMixInputs]);

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
    const input = inputs.find((inp: Input) => inp.key === key);
    if (input) {
      setInputToDelete(input);
      setDeleteDialogOpen(true);
    }
  }, [inputs]);

  const handleDeleteConfirm = async () => {
    if (inputToDelete && selectedConnection) {
      setOperationLoading(prev => ({ ...prev, [`delete_${inputToDelete.key}`]: true }));
      try {
        // delete input from vMix using RemoveInput function
        await sendVMixFunction(selectedConnection, 'RemoveInput', {
          Input: inputToDelete.key
        });

        // Refresh inputs to get latest XML data
        await getVMixInputs(selectedConnection);

        setToast({ open: true, message: 'Input deleted successfully', severity: 'success' });
      } catch (error) {
        console.error('Failed to delete input:', error);
        setError(`Failed to delete input: ${error}`);
        setToast({ open: true, message: 'Failed to delete input', severity: 'error' });
      } finally {
        setOperationLoading(prev => {
          const { [`delete_${inputToDelete.key}`]: _, ...rest } = prev;
          return rest;
        });
      }
    }
    setDeleteDialogOpen(false);
    setInputToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setInputToDelete(null);
  };

  const handleCopyKey = useCallback((key: string) => {
    navigator.clipboard.writeText(key);
    setToast({ open: true, message: 'Key copied to clipboard!', severity: 'success' });
  }, []);

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
      const isLoading = operationLoading[input.key] || false;
      return {
        input,
        isEditing,
        editingValue: editingData[input.key] ?? input.title,
        isLoading
      };
    });
  }, [sortedInputs, editingData, operationLoading]);

  // Show skeleton loading state while loading
  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" height={60} width={200} sx={{ mb: 3 }} />
        
        <Paper sx={{ p: 2, mb: 3 }}>
          <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
        </Paper>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {Array.from({ length: 6 }).map((_, index) => (
                  <TableCell key={index}>
                    <Skeleton variant="text" height={32} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: 6 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton variant="text" height={24} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>

      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="connection-select-label">vMix Connection</InputLabel>
          <Select
            labelId="connection-select-label"
            value={selectedConnection}
            label="vMix Connection"
            onChange={handleConnectionChange}
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
            {inputs.length === 0 ? (
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
                  isLoading={rowData.isLoading}
                  onEditClick={handleEditClick}
                  onSaveClick={handleSaveClick}
                  onCancelClick={handleCancelClick}
                  onDeleteClick={handleDeleteClick}
                  onTitleChange={handleTitleChange}
                  onCopyKey={handleCopyKey}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Toast Notification */}
      <Snackbar 
        open={toast.open} 
        autoHideDuration={3000} 
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={toast.severity} 
          sx={{ width: '100%' }}
          variant="filled"
        >
          {toast.message}
        </Alert>
      </Snackbar>
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
          <Button 
            onClick={handleDeleteCancel} 
            color="primary"
            disabled={inputToDelete ? operationLoading[`delete_${inputToDelete.key}`] : false}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={inputToDelete ? operationLoading[`delete_${inputToDelete.key}`] : false}
          >
            {inputToDelete && operationLoading[`delete_${inputToDelete.key}`] ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InputManager;