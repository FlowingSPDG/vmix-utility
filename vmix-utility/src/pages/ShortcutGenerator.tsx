import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useVMixStatus } from '../hooks/useVMixStatus';
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
  Alert
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import RefreshIcon from '@mui/icons-material/Refresh';

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

const ShortcutGenerator = () => {
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
      
      // Generate default shortcuts for all inputs using shared settings
      const defaultShortcuts = inputs.map((input, index) => ({
        id: index + 1,
        number: input.number,
        title: `${sharedFunctionName} to ${input.title}`,
        functionName: sharedFunctionName,
        queryParams: [
          { id: 1, key: 'Input', value: input.key },
          ...sharedQueryParams.map(param => ({ ...param, id: param.id + 1000 }))
        ]
      }));
      
      setInputs(defaultShortcuts);
      setInputTypeFilter('All');
    } else {
      setVmixInputs([]);
      setInputs([]);
    }
  }, [selectedConnection, vmixStatusInputs, sharedFunctionName, sharedQueryParams]);

  const handleConnectionChange = (host: string) => {
    setSelectedConnection(host);
  };
  
  // State for new query param
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');

  const handleAddSharedParam = () => {
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
  };

  const handleDeleteSharedParam = (paramId: number) => {
    setSharedQueryParams(sharedQueryParams.filter(param => param.id !== paramId));
  };

  const handleSharedParamChange = (paramId: number, key: string, value: string) => {
    setSharedQueryParams(sharedQueryParams.map(param => 
      param.id === paramId 
        ? { ...param, key, value }
        : param
    ));
  };

  // Update all inputs when shared settings change
  const updateAllInputsWithSharedSettings = () => {
    setInputs(inputs.map(input => {
      const vmixInput = vmixInputs.find(vi => vi.number === input.number);
      return {
        ...input,
        functionName: sharedFunctionName,
        title: `${sharedFunctionName} to ${vmixInput?.title || 'Unknown'}`,
        queryParams: [
          { id: 1, key: 'Input', value: vmixInput?.key || input.number.toString() },
          ...sharedQueryParams.map(param => ({ ...param, id: param.id + 1000 }))
        ]
      };
    }));
  };

  // Update inputs when shared settings change
  useEffect(() => {
    if (inputs.length > 0) {
      updateAllInputsWithSharedSettings();
    }
  }, [sharedFunctionName, sharedQueryParams]);


  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToast({open: true, message, severity});
  };

  const handleCloseToast = () => {
    setToast(prev => ({...prev, open: false}));
  };

  // Get unique input types from vmixInputs
  const getAvailableInputTypes = () => {
    const types = [...new Set(vmixInputs.map(input => input.input_type))]
      .filter(type => type && type !== 'Unknown')
      .sort();
    return ['All', ...types];
  };

  // Filter inputs based on selected type
  const getFilteredInputs = () => {
    if (inputTypeFilter === 'All') {
      return inputs;
    }
    return inputs.filter(input => {
      const vmixInput = vmixInputs.find(vi => vi.number === input.number);
      return vmixInput?.input_type === inputTypeFilter;
    });
  };

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

  const generateUrl = (input: Input) => {
    if (!selectedConnection) return '';
    
    let url = `http://${selectedConnection}:8088/api?Function=${input.functionName}`;
    
    if (input.queryParams.length > 0) {
      for (const param of input.queryParams) {
        url += `&${param.key}=${param.value}`;
      }
    }
    
    return url;
  };

  const generateScript = (input: Input) => {
    // Generate script in format for vMix Script API: Function=xxx&Input=xxx
    let script = `Function=${input.functionName}`;
    if (input.queryParams.length > 0) {
      for (const param of input.queryParams) {
        script += `&${param.key}=${param.value}`;
      }
    }
    return script;
  };

  const generateParamsObject = (input: Input) => {
    // Generate parameters as object for backend
    console.log('generateParamsObject input:', input);
    console.log('queryParams:', input.queryParams);
    
    const params: { [key: string]: string } = {};
    input.queryParams.forEach(param => {
      console.log(`Adding param: ${param.key} = ${param.value}`);
      params[param.key] = param.value;
    });
    
    console.log('Final params object:', params);
    return params;
  };

  const openTallyInBrowser = async () => {
    try {
      await openUrl('http://localhost:8088/tally/?key=230834ea-8be2-486f-847a-98cd4ae7b53b');
      showToast('Tally interface opened in browser', 'info');
    } catch (error) {
      console.error('Failed to open tally URL:', error);
      showToast('Failed to open tally URL in browser', 'error');
    }
  };

  const generateTally = (input: Input) => {
    return `TALLY:${input.functionName}:${input.queryParams.map(p => `${p.key}=${p.value}`).join(',')}`;
  };

  const tryCommand = async (input: Input) => {
    if (!selectedConnection) {
      showToast('Please select a vMix connection first', 'error');
      return;
    }

    try {
      const params = generateParamsObject(input);
      console.log(params);
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
  };

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
                {getAvailableInputTypes().map((type) => (
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
        
        {/* Function Name */}
        <TextField
          label="Function Name"
          value={sharedFunctionName}
          onChange={(e) => setSharedFunctionName(e.target.value)}
          size="small"
          sx={{ mb: 2, mr: 2, width: '200px' }}
        />
        
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

      <Paper>
        {getFilteredInputs().map((input, index) => (
          <Box key={input.id}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Input Info */}
              <Box sx={{ minWidth: '200px' }}>
                <Typography variant="body1" fontWeight="medium">
                  Input {input.number}: {vmixInputs.find(vi => vi.number === input.number)?.title || 'Unknown'}
                </Typography>
                <Typography variant="caption" color="textSecondary">
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
                    onClick={() => {
                      navigator.clipboard.writeText(generateUrl(input));
                      showToast('Script API command copied to clipboard!');
                    }}
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
                  onClick={() => {
                    navigator.clipboard.writeText(generateScript(input));
                    showToast('Function script copied to clipboard!');
                  }}
                  size="small"
                >
                  SCRIPT
                </Button>
                <Button
                  startIcon={<OpenInBrowserIcon />}
                  onClick={openTallyInBrowser}
                  size="small"
                >
                  TALLY
                </Button>
                <Button
                  startIcon={<PlayArrowIcon />}
                  color="primary"
                  onClick={() => tryCommand(input)}
                  size="small"
                >
                  TRY!
                </Button>
              </ButtonGroup>
            </Box>
            {index < getFilteredInputs().length - 1 && <Divider />}
          </Box>
        ))}
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