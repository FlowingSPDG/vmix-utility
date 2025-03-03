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
  TextField,
  Button,
  TableSortLabel,
  IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

interface Input {
  id: number;
  number: number;
  title: string;
  type: string;
  key: string;
}

type Order = 'asc' | 'desc';
type OrderBy = 'number' | 'title' | 'type';

const InputManager = () => {
  const [inputs, setInputs] = useState<Input[]>([
    { id: 1, number: 1, title: 'Camera 1', type: 'Camera', key: 'cam1' },
    { id: 2, number: 2, title: 'Camera 2', type: 'Camera', key: 'cam2' },
    { id: 3, number: 3, title: 'Lower Third', type: 'GT', key: 'lt1' },
    { id: 4, number: 4, title: 'Background', type: 'Still', key: 'bg1' },
  ]);
  
  // Track editing state for each input
  const [editingStates, setEditingStates] = useState<Record<number, string>>({});
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('number');

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

  const handleSaveClick = (id: number) => {
    const newTitle = editingStates[id];
    if (newTitle !== undefined) {
      setInputs(inputs.map(input =>
        input.id === id
          ? { ...input, title: newTitle }
          : input
      ));
      
      // Remove this input from editing state
      const newEditingStates = { ...editingStates };
      delete newEditingStates[id];
      setEditingStates(newEditingStates);
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
              <TableCell>Key</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedInputs.map((input) => {
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
                  <TableCell>{input.key}</TableCell>
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
            })}
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