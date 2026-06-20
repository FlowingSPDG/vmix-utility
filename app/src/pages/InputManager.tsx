import { useState, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { useConnectionSelection } from '../hooks/useConnectionSelection';
import { useUISettings, getDensitySpacing } from '../hooks/useUISettings.tsx';
import ConnectionSelector from '../components/ConnectionSelector';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import { useToast, ToastSnackbar } from '../hooks/useToast';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
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
  const { t } = useTranslation();
  const { uiDensity } = useUISettings();
  const spacing = getDensitySpacing(uiDensity);
  return (
    <TableRow key={input.key} sx={{ height: spacing.itemHeight + 8 }}>
      <TableCell sx={{ p: spacing.tableCellPadding, fontSize: spacing.fontSize, width: '60px' }}>
        {input.number}
      </TableCell>
      <TableCell sx={{ p: spacing.tableCellPadding, minWidth: '160px' }}>
        <Box sx={boxSx}>
          <TextField
            value={editingValue}
            onChange={isEditing ? (e) => onTitleChange(input.key, e.target.value) : undefined}
            size={spacing.buttonSize}
            disabled={!isEditing || isLoading}
            variant={isEditing ? "outlined" : "standard"}
            sx={{
              ...textFieldSx,
              flex: 1,
              '& .MuiInputBase-input': {
                fontSize: spacing.fontSize,
                py: spacing.listItemPadding,
              }
            }}
          />
          {isEditing ? (
            <>
              <IconButton
                size={spacing.iconSize}
                color="primary"
                onClick={() => onSaveClick(input.key)}
                disabled={isLoading}
                sx={{ p: spacing.listItemPadding }}
              >
                <SaveIcon fontSize={spacing.iconSize} />
              </IconButton>
              <IconButton
                size={spacing.iconSize}
                onClick={() => onCancelClick(input.key)}
                disabled={isLoading}
                sx={{ p: spacing.listItemPadding }}
              >
                <CancelIcon fontSize={spacing.iconSize} />
              </IconButton>
            </>
          ) : (
            <IconButton
              size={spacing.iconSize}
              onClick={() => onEditClick(input)}
              disabled={isLoading}
              sx={{ p: spacing.listItemPadding }}
            >
              <EditIcon fontSize={spacing.iconSize} />
            </IconButton>
          )}
        </Box>
      </TableCell>
      <TableCell sx={{ p: spacing.tableCellPadding, fontSize: spacing.fontSize, width: '120px' }}>
        {input.type}
      </TableCell>
      <TableCell sx={{ p: spacing.tableCellPadding, width: '100px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box 
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: input.state === 'Running' ? 'success.main' : 
                       input.state === 'Paused' ? 'warning.main' : 'grey.400',
              flexShrink: 0,
            }}
          />
          <Typography 
            variant="body2"
            sx={{ 
              fontSize: spacing.fontSize,
              fontWeight: input.state === 'Running' ? 600 : 400,
              color: input.state === 'Running' ? 'success.main' : 
                     input.state === 'Paused' ? 'warning.main' : 'text.secondary',
            }}
          >
            {input.state === 'Running' ? t('inputManager.stateRunning') :
             input.state === 'Paused' ? t('inputManager.statePaused') :
             input.state}
          </Typography>
        </Box>
      </TableCell>
      <TableCell sx={{ p: spacing.tableCellPadding, width: '140px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.spacing }}>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: spacing.fontSize }}>
            {input.key.substring(0, 8)}...
          </Typography>
          <IconButton 
            size={spacing.iconSize} 
            onClick={() => onCopyKey(input.key)}
            sx={{ p: spacing.listItemPadding }}
          >
            <ContentCopyIcon fontSize={spacing.iconSize} />
          </IconButton>
        </Box>
      </TableCell>
      <TableCell sx={{ p: spacing.tableCellPadding, width: '80px' }}>
        <IconButton
          color="error"
          size={spacing.iconSize}
          onClick={() => onDeleteClick(input.key)}
          disabled={isLoading}
          sx={{ p: spacing.listItemPadding }}
        >
          <DeleteIcon fontSize={spacing.iconSize} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
});

const InputRow = OptimizedInputRow;


const InputManager = () => {
  const { t } = useTranslation();
  const { connections, inputs: globalInputs, inputsLoading, sendVMixFunction, getVMixInputs } = useVMixStatus();
  const { uiDensity } = useUISettings();
  const spacing = getDensitySpacing(uiDensity);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();
  
  // Single editing state to minimize re-renders
  const [editingData, setEditingData] = useState<{[key: string]: string}>({});
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('number');
  
  // Dialog state for deletion confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inputToDelete, setInputToDelete] = useState<Input | null>(null);
  
  // Loading states for operations
  const [operationLoading, setOperationLoading] = useState<{[key: string]: boolean}>({});

  // Use optimized connection selection hook
  const { selectedConnection, setSelectedConnection } = useConnectionSelection();
  
  // Derive inputs directly from globalInputs without useState
  const inputs = useMemo(() => {
    if (selectedConnection && globalInputs[selectedConnection]) {
      return globalInputs[selectedConnection].map((input) => ({
        number: input.number,
        title: input.short_title || input.title, // Use shortTitle if available, fallback to title
        type: input.input_type,
        key: input.key,
        state: input.state,
      }));
    }
    return [];
  }, [selectedConnection, globalInputs]);

  // Show skeleton only while inputs are actively being fetched
  const isLoading = Boolean(
    selectedConnection &&
    !globalInputs[selectedConnection] &&
    inputsLoading[selectedConnection] !== false
  );


  const handleEditClick = useCallback((input: Input) => {
    const originalInput = globalInputs[selectedConnection!]?.find(inp => inp.key === input.key);
    const currentTitle = originalInput?.short_title || originalInput?.title || input.title;
    setEditingData(prev => ({ ...prev, [input.key]: currentTitle }));
  }, [globalInputs, selectedConnection]);

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

        showToast(t('inputManager.toastTitleUpdated'), 'success');
        
        // Remove from editing data
        setEditingData(currentEditingData => {
          const { [key]: _, ...rest } = currentEditingData;
          return rest;
        });
      } catch (error) {
        console.error('Failed to update input title:', error);
        showToast(t('inputManager.toastTitleFailed'), 'error');
      } finally {
        setOperationLoading(prev => {
          const { [key]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  }, [editingData, inputs, selectedConnection, sendVMixFunction, getVMixInputs, t]);

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

        showToast(t('inputManager.toastDeleted'), 'success');
      } catch (error) {
        console.error('Failed to delete input:', error);
        setError(t('inputManager.deleteFailedDetail', { error: String(error) }));
        showToast(t('inputManager.toastDeleteFailed'), 'error');
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
    showToast(t('inputManager.toastKeyCopied'), 'success');
  }, [t]);

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

  // Optimize row data generation with stable references
  const inputRowData = useMemo(() => {
    return sortedInputs.map(input => ({
      input,
      isEditing: input.key in editingData,
      editingValue: editingData[input.key] ?? input.title,
      isLoading: operationLoading[input.key] || false
    }));
  }, [sortedInputs, editingData, operationLoading]);

  // Show skeleton loading state only when we have a selected connection but no data yet
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
    <Box sx={{ p: spacing.cardPadding * 2 }}>

      <Paper sx={{ p: spacing.cardPadding, mb: spacing.spacing * 2 }}>
        <ConnectionSelector
          selectedConnection={selectedConnection}
          onConnectionChange={setSelectedConnection}
          sx={{ mb: spacing.spacing }}
        />

        {error ? (
          <Alert severity="error" sx={{ mb: spacing.spacing }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        {connections.length === 0 ? (
          <Alert severity="info" sx={{ mb: spacing.spacing }}>
            {t('inputManager.noConnectionsAlert')}
          </Alert>
        ) : null}

      </Paper>
      
      {connections.length === 0 ? (
        <Paper sx={{ p: spacing.cardPadding * 2, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            {t('inputManager.noConnectionsTitle')}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {t('inputManager.noConnectionsBody')}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '60px', minWidth: '60px' }}>
                  <TableSortLabel
                    active={orderBy === 'number'}
                    direction={orderBy === 'number' ? order : 'asc'}
                    onClick={() => handleRequestSort('number')}
                  >
                    {t('inputManager.sortNumber')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ minWidth: '160px' }}>
                  <TableSortLabel
                    active={orderBy === 'title'}
                    direction={orderBy === 'title' ? order : 'asc'}
                    onClick={() => handleRequestSort('title')}
                  >
                    {t('inputManager.sortTitle')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: '120px', minWidth: '120px' }}>
                  <TableSortLabel
                    active={orderBy === 'type'}
                    direction={orderBy === 'type' ? order : 'asc'}
                    onClick={() => handleRequestSort('type')}
                  >
                    {t('inputManager.sortType')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: '100px', minWidth: '100px' }}>{t('inputManager.colState')}</TableCell>
                <TableCell sx={{ width: '140px', minWidth: '140px' }}>{t('inputManager.colKey')}</TableCell>
                <TableCell sx={{ width: '80px', minWidth: '80px' }}>{t('inputManager.colActions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inputs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="textSecondary">
                      {selectedConnection ? t('inputManager.emptyNoInputs') : t('inputManager.emptySelect')}
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
      )}
      
      <ToastSnackbar toast={toast} onClose={hideToast} />
      {connections.length > 0 ? (
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
            {t('inputManager.applyAll')}
          </Button>
        </Box>
      ) : null}
      
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {t('inputManager.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {t('inputManager.deleteConfirm', { title: inputToDelete?.title ?? '', number: inputToDelete?.number ?? '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteCancel} 
            color="primary"
            disabled={inputToDelete ? operationLoading[`delete_${inputToDelete.key}`] : false}
          >
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={inputToDelete ? operationLoading[`delete_${inputToDelete.key}`] : false}
          >
            {inputToDelete && operationLoading[`delete_${inputToDelete.key}`] ? t('inputManager.deleting') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InputManager;