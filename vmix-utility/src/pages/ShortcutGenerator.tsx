import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { FixedSizeList as List } from 'react-window';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  ButtonGroup,
  Snackbar,
  Alert,
  Autocomplete,
  Chip
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import shortcuts from '../assets/shortcuts.json';

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

interface VMixConnection {
  id: number;
  name: string;
  ip: string;
  port: number;
}

interface QueryParam {
  id: number;
  key: string;
  value: string;
}

interface Input {
  id: number;
  number: number;
  title: string;
  functionName: string;
  queryParams: QueryParam[];
}

interface ShortcutData {
  Name: string;
  Description: string;
  Parameters: Array<string> | null;
}

// Virtualized row component for react-window
const VirtualizedInputItem = memo(({ index, style, data }: {
  index: number;
  style: React.CSSProperties;
  data: {
    filteredInputs: Input[];
    vmixInputs: VmixInput[];
    selectedConnection: string;
    showToast: (message: string, severity?: 'success' | 'error' | 'info') => void;
    onTryCommand: (input: Input) => void;
  };
}) => {
  const { filteredInputs, vmixInputs, selectedConnection, showToast, onTryCommand } = data;
  const input = filteredInputs[index];
  const vmixInput = vmixInputs.find(vi => vi.number === input.number);
  const isLastItem = index === filteredInputs.length - 1;
  const generateUrl = useCallback((input: Input) => {
    if (!selectedConnection) return '';
    
    let url = `http://${selectedConnection}:8088/api?Function=${input.functionName}`;
    
    if (input.queryParams.length > 0) {
      for (const param of input.queryParams) {
        url += `&${param.key}=${param.value}`;
      }
    }
    
    return url;
  }, [selectedConnection]);

  const generateScript = useCallback((input: Input) => {
    let script = `Function=${input.functionName}`;
    if (input.queryParams.length > 0) {
      for (const param of input.queryParams) {
        script += `&${param.key}=${param.value}`;
      }
    }
    return script;
  }, []);

  const openTallyInBrowser = useCallback(async (input: Input) => {
    try {
      const inputKey = input.queryParams.find(param => param.key === 'Input')?.value;
      if (!inputKey) {
        showToast('Input keyが見つかりません', 'error');
        return;
      }
      await openUrl(`http://${selectedConnection}:8088/tally/?key=${inputKey}`);
      showToast('Tallyインターフェースをブラウザで開きました', 'info');
    } catch (error) {
      console.error('Failed to open tally URL:', error);
      showToast('Tally URLのブラウザオープンに失敗しました', 'error');
    }
  }, [showToast, input]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(generateUrl(input));
    showToast('Script API command copied to clipboard!');
  }, [input, generateUrl, showToast]);

  const handleCopyScript = useCallback(() => {
    navigator.clipboard.writeText(generateScript(input));
    showToast('Function script copied to clipboard!');
  }, [input, generateScript, showToast]);

  const handleTryCommand = useCallback(() => {
    onTryCommand(input);
  }, [input, onTryCommand]);

  return (
    <Box style={style}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Input Info */}
        <Box sx={{ minWidth: '200px', maxWidth: '300px', overflow: 'hidden' }}>
          <Typography 
            variant="body1" 
            fontWeight="medium"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={`Input ${input.number}: ${vmixInput?.title || 'Unknown'}`}
          >
            Input {input.number}: {vmixInput?.title || 'Unknown'}
          </Typography>
          <Typography 
            variant="caption" 
            color="textSecondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block'
            }}
            title={`${input.functionName} | ${input.queryParams.map(p => `${p.key}=${p.value}`).join(', ')}`}
          >
            {input.functionName} | {input.queryParams.map(p => `${p.key}=${p.value}`).join(', ')}
          </Typography>
        </Box>
        
        {/* Generated URL */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f5f5f5', p: 1, borderRadius: 1 }}>
            <Typography 
              component="pre" 
              variant="caption" 
              sx={{ 
                fontFamily: 'monospace', 
                fontSize: '0.75rem',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
                flex: 1,
                margin: 0,
                overflow: 'hidden'
              }}
            >
              {generateUrl(input)}
            </Typography>
            <IconButton
              size="small"
              onClick={handleCopyUrl}
              sx={{ ml: 1 }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        
        {/* Action Buttons */}
        <ButtonGroup variant="outlined" size="small">
          <Button
            startIcon={<CodeIcon />}
            onClick={handleCopyScript}
            size="small"
          >
            SCRIPT
          </Button>
          <Button
            startIcon={<OpenInBrowserIcon />}
            onClick={() => openTallyInBrowser(input)}
            size="small"
          >
            TALLY
          </Button>
          <Button
            startIcon={<PlayArrowIcon />}
            color="primary"
            onClick={handleTryCommand}
            size="small"
          >
            TRY!
          </Button>
        </ButtonGroup>
      </Box>
      {!isLastItem && <Divider />}
    </Box>
  );
});

VirtualizedInputItem.displayName = 'VirtualizedInputItem';

const ShortcutGenerator = () => {
  // Process shortcuts data for autocomplete
  const shortcutsData: ShortcutData[] = Array.isArray(shortcuts) ? shortcuts : [];
  
  // Filter shortcuts based on search term
  const getFilteredShortcuts = (searchTerm: string) => {
    if (!searchTerm) return [];
    return shortcutsData.filter(shortcut => 
      shortcut.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.Description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  const { connections, inputs: vmixStatusInputs } = useVMixStatus();
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [vmixInputs, setVmixInputs] = useState<VmixInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'info'}>(
    {open: false, message: '', severity: 'info'}
  );
  const [inputTypeFilter, setInputTypeFilter] = useState<string>('All');
  
  
  // Shortcut generation state
  const [inputs, setInputs] = useState<Input[]>([]);
  
  // Shared function configuration
  const [sharedFunctionName, setSharedFunctionName] = useState('PreviewInput');
  const [sharedQueryParams, setSharedQueryParams] = useState<QueryParam[]>([]);

  // Auto-select first available connection and update inputs when connections change
  useEffect(() => {
    const connectedConnections = connections.filter(conn => conn.status === 'Connected');
    
    // Auto-select first available connection if none selected
    if (connectedConnections.length > 0 && !selectedConnection) {
      const firstConnection = connectedConnections[0].host;
      setSelectedConnection(firstConnection);
    }
  }, [connections, selectedConnection]);

  // Update vmixInputs when vmixStatusInputs changes for selected connection
  useEffect(() => {
    if (selectedConnection && vmixStatusInputs[selectedConnection]) {
      const inputs = vmixStatusInputs[selectedConnection];
      setVmixInputs(inputs);
      setInputTypeFilter('All');
    } else {
      setVmixInputs([]);
      setInputs([]);
    }
  }, [selectedConnection, vmixStatusInputs]);

  // Generate shortcuts separately using useMemo for performance
  const generatedInputs = useMemo(() => {
    if (vmixInputs.length === 0) return [];
    
    return vmixInputs.map((input, index) => ({
      id: index + 1,
      number: input.number,
      title: `${sharedFunctionName} to ${input.title}`,
      functionName: sharedFunctionName,
      queryParams: [
        { id: 1, key: 'Input', value: input.key },
        ...sharedQueryParams.map(param => ({ ...param, id: param.id + 1000 }))
      ]
    }));
  }, [vmixInputs, sharedFunctionName, sharedQueryParams]);

  // Update inputs when generated inputs change
  useEffect(() => {
    setInputs(generatedInputs);
  }, [generatedInputs]);

  const handleConnectionChange = (host: string) => {
    setSelectedConnection(host);
  };
  
  // State for new query param
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');

  const handleAddSharedParam = useCallback(() => {
    if (newParamKey && newParamValue) {
      const newId = sharedQueryParams.length > 0
        ? Math.max(...sharedQueryParams.map(p => p.id)) + 1
        : 1;
      
      setSharedQueryParams([
        ...sharedQueryParams,
        { id: newId, key: newParamKey, value: newParamValue }
      ]);
      
      setNewParamKey('');
      setNewParamValue('');
    }
  }, [newParamKey, newParamValue, sharedQueryParams]);

  const handleDeleteSharedParam = useCallback((paramId: number) => {
    setSharedQueryParams(prev => prev.filter(param => param.id !== paramId));
  }, []);

  const handleSharedParamChange = useCallback((paramId: number, key: string, value: string) => {
    setSharedQueryParams(prev => prev.map(param => 
      param.id === paramId 
        ? { ...param, key, value }
        : param
    ));
  }, []);



  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToast({open: true, message, severity});
  };

  const handleCloseToast = () => {
    setToast(prev => ({...prev, open: false}));
  };

  // Get unique input types from vmixInputs - memoized for performance
  const availableInputTypes = useMemo(() => {
    const types = [...new Set(vmixInputs.map(input => input.input_type))]
      .filter(type => type && type !== 'Unknown')
      .sort();
    return ['All', ...types];
  }, [vmixInputs]);

  // Filter inputs based on selected type - memoized for performance
  const filteredInputs = useMemo(() => {
    if (inputTypeFilter === 'All') {
      return inputs;
    }
    return inputs.filter(input => {
      const vmixInput = vmixInputs.find(vi => vi.number === input.number);
      return vmixInput?.input_type === inputTypeFilter;
    });
  }, [inputs, inputTypeFilter, vmixInputs]);

  const handleDeleteParam = (inputId: number, paramId: number) => {
    setInputs(inputs.map(input => {
      if (input.id === inputId) {
        return {
          ...input,
          queryParams: input.queryParams.filter(param => param.id !== paramId)
        };
      }
      return input;
    }));
  };

  const generateParamsObject = useCallback((input: Input) => {
    const params: { [key: string]: string } = {};
    input.queryParams.forEach(param => {
      params[param.key] = param.value;
    });
    return params;
  }, []);

  const tryCommand = useCallback(async (input: Input) => {
    if (!selectedConnection) {
      showToast('Please select a vMix connection first', 'error');
      return;
    }

    try {
      const params = generateParamsObject(input);
      await invoke('send_vmix_function', {
        host: selectedConnection,
        functionName: input.functionName,
        params: Object.keys(params).length > 0 ? params : null
      });
      showToast(`Command sent successfully: ${input.functionName}`, 'success');
    } catch (error) {
      console.error('Failed to send command:', error);
      showToast(`Failed to send command: ${error}`, 'error');
    }
  }, [selectedConnection, generateParamsObject, showToast]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Shortcut Generator
      </Typography>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="vmix-select-label">Select vMix Connection</InputLabel>
          <Select
            labelId="vmix-select-label"
            value={selectedConnection}
            label="Select vMix Connection"
            onChange={(e) => handleConnectionChange(e.target.value as string)}
          >
            <MenuItem value="">
              <em>Select a vMix connection</em>
            </MenuItem>
            {connections.filter(conn => conn.status === 'Connected').map((conn) => (
              <MenuItem key={conn.host} value={conn.host}>
                {conn.label} ({conn.host})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {error && (
          <Box sx={{ mb: 2 }}>
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          </Box>
        )}

        {loading && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              Loading inputs...
            </Typography>
          </Box>
        )}

        {/* Controls Row */}
        {vmixInputs.length > 0 && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {/* Input Type Filter */}
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel id="input-type-filter-label">Filter by Input Type</InputLabel>
              <Select
                labelId="input-type-filter-label"
                value={inputTypeFilter}
                label="Filter by Input Type"
                onChange={(e) => setInputTypeFilter(e.target.value as string)}
                size="small"
              >
                {availableInputTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type} {type === 'All' ? `(${inputs.length})` : `(${inputs.filter(input => {
                      const vmixInput = vmixInputs.find(vi => vi.number === input.number);
                      return vmixInput?.input_type === type;
                    }).length})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            
          </Box>
        )}
      </Paper>

      {/* Shared Function Configuration */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Function Configuration (applies to all inputs)
        </Typography>
        
        {/* Function Name with Autocomplete */}
        <Box sx={{ mb: 2 }}>
          <Autocomplete
            freeSolo
            options={shortcutsData}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.Name;
            }}
            inputValue={sharedFunctionName}
            onInputChange={(event, newInputValue) => {
              setSharedFunctionName(newInputValue);
            }}
            onChange={(event, newValue) => {
              if (newValue && typeof newValue !== 'string') {
                setSharedFunctionName(newValue.Name);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Function Name"
                size="small"
                sx={{ mb: 1, mr: 2, width: '300px' }}
                helperText="Type to search for vMix functions. Select from suggestions or enter custom function name."
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    {option.Name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.Description}
                  </Typography>
                  {option.Parameters && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Parameters: {option.Parameters.length} required: ({option.Parameters.join(', ')})
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
            filterOptions={(options, { inputValue }) => {
              const filtered = getFilteredShortcuts(inputValue);
              return filtered.slice(0, 10); // Limit to 10 suggestions
            }}
          />
          
          {/* Show selected function details */}
          {sharedFunctionName && (() => {
            const selectedShortcut = shortcutsData.find(s => s.Name === sharedFunctionName);
            if (selectedShortcut) {
              return (
                <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    <strong>Description:</strong> {selectedShortcut.Description}
                  </Typography>
                  {selectedShortcut.Parameters && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      <strong>Parameters:</strong> {selectedShortcut.Parameters.length} required: ({selectedShortcut.Parameters.join(', ')})
                    </Typography>
                  )}
                </Box>
              );
            }
            return null;
          })()}
        </Box>
        
        {/* Quick Function Selection */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Functions:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {['PreviewInput','Cut', 'Fade', 'Merge', 'Stinger1', 'Stinger2', 'Stinger3', 'Stinger4'].map((funcName) => (
              <Chip
                key={funcName}
                label={funcName}
                size="small"
                onClick={() => setSharedFunctionName(funcName)}
                color={sharedFunctionName === funcName ? 'primary' : 'default'}
                variant={sharedFunctionName === funcName ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>
        
        {/* Shared Query Parameters */}
        <Typography variant="subtitle2" gutterBottom>
          Additional Query Parameters:
        </Typography>
        
        {sharedQueryParams.map((param) => (
          <Box key={param.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TextField
              label="Key"
              value={param.key}
              onChange={(e) => handleSharedParamChange(param.id, e.target.value, param.value)}
              size="small"
              sx={{ mr: 1, width: '150px' }}
            />
            <TextField
              label="Value"
              value={param.value}
              onChange={(e) => handleSharedParamChange(param.id, param.key, e.target.value)}
              size="small"
              sx={{ mr: 1, width: '150px' }}
            />
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteSharedParam(param.id)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        
        {/* Add New Parameter */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <TextField
            label="New Parameter Key"
            value={newParamKey}
            onChange={(e) => setNewParamKey(e.target.value)}
            size="small"
            sx={{ mr: 1, width: '150px' }}
          />
          <TextField
            label="New Parameter Value"
            value={newParamValue}
            onChange={(e) => setNewParamValue(e.target.value)}
            size="small"
            sx={{ mr: 1, width: '150px' }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddSharedParam}
            disabled={!newParamKey || !newParamValue}
          >
            Add Parameter
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ height: '600px', width: '100%' }}>
        <List
          width={"100%"}
          height={600}
          itemCount={filteredInputs.length}
          itemSize={120}
          itemData={{
            filteredInputs,
            vmixInputs,
            selectedConnection,
            showToast,
            onTryCommand: tryCommand
          }}
        >
          {VirtualizedInputItem}
        </List>
      </Paper>

      {/* Toast Notification */}
      <Snackbar 
        open={toast.open} 
        autoHideDuration={3000} 
        onClose={handleCloseToast}
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
    </Box>
  );
};

export default ShortcutGenerator;