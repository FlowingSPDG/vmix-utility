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
  Chip,
  Collapse
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import shortcuts from '../assets/shortcuts.json';

interface VmixInput {
  key: string;
  number: number;
  title: string;
  input_type: string;
  state: string;
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
  const isSpecialInput = input.id < 0;
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
    showToast('Function URL copied to clipboard!');
  }, [input, generateUrl, showToast]);

  const handleCopyScript = useCallback(() => {
    navigator.clipboard.writeText(generateScript(input));
    showToast('Script API command copied to clipboard!');
  }, [input, generateScript, showToast]);

  const handleTryCommand = useCallback(() => {
    onTryCommand(input);
  }, [input, onTryCommand]);

  return (
    <Box style={style}>
      <Box sx={{ 
        p: 1.5, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        flexWrap: 'wrap',
        minHeight: '70px'
      }}>
        {/* Input Info */}
        <Box sx={{ 
          minWidth: '160px', 
          maxWidth: '220px', 
          overflow: 'hidden'
        }}>
          <Typography 
            variant="body2" 
            fontWeight="medium"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.875rem'
            }}
            title={isSpecialInput ? input.title.replace(`${input.functionName} to `, '') : `Input ${input.number}: ${vmixInput?.title || 'Unknown'}`}
          >
            {isSpecialInput ? input.title.replace(`${input.functionName} to `, '') : `Input ${input.number}: ${vmixInput?.title || 'Unknown'}`}
          </Typography>
          <Typography 
            variant="caption" 
            color="textSecondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              fontSize: '0.7rem'
            }}
            title={`${input.functionName} | ${input.queryParams.map(p => `${p.key}=${p.value}`).join(', ')}`}
          >
            {input.functionName} | {input.queryParams.map(p => `${p.key}=${p.value}`).join(', ')}
          </Typography>
        </Box>
        
        {/* Generated URL and Actions Container */}
        <Box sx={{ 
          flex: 1, 
          minWidth: 0,
          display: 'flex',
          gap: 1,
          alignItems: 'center'
        }}>
          {/* Generated URL */}
          <Box sx={{ 
            flex: 1, 
            minWidth: 0,
            minHeight: '36px'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'action.hover', borderRadius: 1, height: '100%' }}>
              <Box 
                sx={{ 
                  flex: 1, 
                  p: 0.75,
                  overflow: 'auto',
                  maxHeight: '60px',
                  '&::-webkit-scrollbar': {
                    height: '4px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'transparent',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '2px',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    background: 'rgba(0,0,0,0.3)',
                  }
                }}
              >
                <Typography 
                  component="pre" 
                  variant="caption" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    fontSize: '0.7rem',
                    whiteSpace: 'nowrap',
                    margin: 0,
                    lineHeight: 1.2
                  }}
                >
                  {generateUrl(input)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={handleCopyUrl}
                sx={{ p: 0.5, flexShrink: 0 }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          
          {/* Action Buttons */}
          <Box sx={{ flexShrink: 0 }}>
            <ButtonGroup 
              variant="outlined" 
              size="small"
              sx={{ 
                '& .MuiButton-root': { 
                  minWidth: 'auto', 
                  px: 1
                }
              }}
            >
              <Button
                startIcon={<CodeIcon fontSize="small" />}
                onClick={handleCopyScript}
                size="small"
              >
                SCRIPT
              </Button>
              <Button
                startIcon={<OpenInBrowserIcon fontSize="small" />}
                onClick={() => openTallyInBrowser(input)}
                size="small"
              >
                TALLY
              </Button>
              <Button
                startIcon={<PlayArrowIcon fontSize="small" />}
                color="primary"
                onClick={handleTryCommand}
                size="small"
              >
                TRY!
              </Button>
            </ButtonGroup>
          </Box>
        </Box>
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
      shortcut.Name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  const { connections, inputs: vmixStatusInputs, loading: globalLoading } = useVMixStatus();
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [vmixInputs, setVmixInputs] = useState<VmixInput[]>([]);
  const [toast, setToast] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'info'}>(
    {open: false, message: '', severity: 'info'}
  );
  const [inputTypeFilter, setInputTypeFilter] = useState<string>('All');
  
  // Collapse states
  const [functionConfigExpanded, setFunctionConfigExpanded] = useState(true);
  const [specialInputsExpanded, setSpecialInputsExpanded] = useState(true);
  
  
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
    const specialInputs: Input[] = [];
    
    // Add special input types at the beginning
    const specialTypes = [
      { type: 'None', value: '', title: 'None' },
      { type: 'Preview', value: '0', title: 'Preview' },
      { type: 'Program', value: '-1', title: 'Program' },
      { type: 'Dynamic1', value: 'Dynamic1', title: 'Dynamic 1' },
      { type: 'Dynamic2', value: 'Dynamic2', title: 'Dynamic 2' },
      { type: 'Dynamic3', value: 'Dynamic3', title: 'Dynamic 3' },
      { type: 'Dynamic4', value: 'Dynamic4', title: 'Dynamic 4' }
    ];
    
    specialTypes.forEach((special, index) => {
      const queryParams: QueryParam[] = [];
      
      // Add Input param only if not 'None'
      if (special.type !== 'None') {
        queryParams.push({ id: 1, key: 'Input', value: special.value });
      }
      
      // Add shared query params
      queryParams.push(...sharedQueryParams.map(param => ({ ...param, id: param.id + 1000 })));

      specialInputs.push({
        id: -(index + 1), // Use negative IDs for special inputs
        number: -1,
        title: `${sharedFunctionName} to ${special.title}`,
        functionName: sharedFunctionName,
        queryParams
      });
    });
    
    if (vmixInputs.length === 0) return specialInputs;
    
    // Add regular inputs
    const regularInputs = vmixInputs.map((input, index) => {
      const queryParams: QueryParam[] = [
        { id: 1, key: 'Input', value: input.key },
        ...sharedQueryParams.map(param => ({ ...param, id: param.id + 1000 }))
      ];

      return {
        id: index + 1,
        number: input.number,
        title: `${sharedFunctionName} to ${input.title}`,
        functionName: sharedFunctionName,
        queryParams
      };
    });
    
    return [...specialInputs, ...regularInputs];
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

  // Separate special inputs and regular inputs
  const { specialInputs, regularInputs } = useMemo(() => {
    const special = inputs.filter(input => input.id < 0);
    const regular = inputs.filter(input => input.id > 0);
    return { specialInputs: special, regularInputs: regular };
  }, [inputs]);

  // Filter regular inputs based on selected type
  const filteredRegularInputs = useMemo(() => {
    if (inputTypeFilter === 'All') {
      return regularInputs;
    }
    return regularInputs.filter(input => {
      const vmixInput = vmixInputs.find(vi => vi.number === input.number);
      return vmixInput?.input_type === inputTypeFilter;
    });
  }, [regularInputs, inputTypeFilter, vmixInputs]);
  
  // Combine inputs based on collapse states
  const filteredInputs = useMemo(() => {
    const result = [];
    if (specialInputsExpanded) {
      result.push(...specialInputs);
    }
    result.push(...filteredRegularInputs);
    return result;
  }, [specialInputs, filteredRegularInputs, specialInputsExpanded]);

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
      
      <Paper sx={{ p: 2, mb: 2 }}>
        {/* Connection and Filter Row */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
          <FormControl sx={{ flex: 1, minWidth: 250 }}>
            <InputLabel id="vmix-select-label">Select vMix Connection</InputLabel>
            <Select
              labelId="vmix-select-label"
              value={selectedConnection}
              label="Select vMix Connection"
              onChange={(e) => handleConnectionChange(e.target.value as string)}
              size="small"
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

          {vmixInputs.length > 0 && (
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
                    {type} {type === 'All' ? `(${regularInputs.length})` : `(${regularInputs.filter(input => {
                      const vmixInput = vmixInputs.find(vi => vi.number === input.number);
                      return vmixInput?.input_type === type;
                    }).length})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {globalLoading && (
          <Typography variant="body2" color="text.secondary">
            Loading inputs...
          </Typography>
        )}
      </Paper>

      {/* Shared Function Configuration */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
            Function Configuration
          </Typography>
          <IconButton
            size="small"
            onClick={() => setFunctionConfigExpanded(!functionConfigExpanded)}
          >
            {functionConfigExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        <Collapse in={functionConfigExpanded}>
        {/* Function Name with Autocomplete */}
        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Autocomplete
            freeSolo
            options={shortcutsData}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.Name;
            }}
            inputValue={sharedFunctionName}
            onInputChange={(_event, newInputValue) => {
              setSharedFunctionName(newInputValue);
            }}
            onChange={(_event, newValue) => {
              if (newValue && typeof newValue !== 'string') {
                setSharedFunctionName(newValue.Name);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Function Name"
                size="small"
                sx={{ width: '250px' }}
                helperText="Search functions or enter custom"
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
                      Params: {option.Parameters.join(', ')}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
            filterOptions={(_options, { inputValue }) => {
              const filtered = getFilteredShortcuts(inputValue);
              return filtered
            }}
          />
          
          {/* Quick Function Selection - moved to same row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              Quick:
            </Typography>
            {['PreviewInput','Cut', 'Fade', 'Merge', 'Stinger1', 'Stinger2'].map((funcName) => (
              <Chip
                key={funcName}
                label={funcName}
                size="small"
                onClick={() => setSharedFunctionName(funcName)}
                color={sharedFunctionName === funcName ? 'primary' : 'default'}
                variant={sharedFunctionName === funcName ? 'filled' : 'outlined'}
                sx={{ fontSize: '0.7rem', height: '24px' }}
              />
            ))}
          </Box>
        </Box>
        
        {/* Show selected function details - more compact */}
        {sharedFunctionName && (() => {
          const selectedShortcut = shortcutsData.find(s => s.Name === sharedFunctionName);
          if (selectedShortcut) {
            return (
              <Box sx={{ mb: 1.5, p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {selectedShortcut.Description}
                  {selectedShortcut.Parameters && ` | Params: ${selectedShortcut.Parameters.join(', ')}`}
                </Typography>
              </Box>
            );
          }
          return null;
        })()}
        
        {/* Shared Query Parameters - more compact */}
        {sharedQueryParams.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Additional Parameters:
            </Typography>
            {sharedQueryParams.map((param) => (
              <Box key={param.id} sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                <TextField
                  label="Key"
                  value={param.key}
                  onChange={(e) => handleSharedParamChange(param.id, e.target.value, param.value)}
                  size="small"
                  sx={{ width: '120px' }}
                />
                <TextField
                  label="Value"
                  value={param.value}
                  onChange={(e) => handleSharedParamChange(param.id, param.key, e.target.value)}
                  size="small"
                  sx={{ width: '120px' }}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteSharedParam(param.id)}
                  sx={{ p: 0.5 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
        
        {/* Add New Parameter - inline */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            label="Add Key"
            value={newParamKey}
            onChange={(e) => setNewParamKey(e.target.value)}
            size="small"
            sx={{ width: '120px' }}
          />
          <TextField
            label="Add Value"
            value={newParamValue}
            onChange={(e) => setNewParamValue(e.target.value)}
            size="small"
            sx={{ width: '120px' }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddSharedParam}
            disabled={!newParamKey || !newParamValue}
            sx={{ minWidth: 'auto', px: 1 }}
          >
            Add
          </Button>
        </Box>
        </Collapse>
      </Paper>

      <Paper sx={{ width: '100%' }}>
        {/* Special Inputs Header */}
        {specialInputs.length > 0 && (
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Special Inputs (None/Preview/Program/Dynamic) ({specialInputs.length})
            </Typography>
            <IconButton
              size="small"
              onClick={() => setSpecialInputsExpanded(!specialInputsExpanded)}
            >
              {specialInputsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        )}
        
        <Box sx={{ height: '600px' }}>
          <List
            width={"100%"}
            height={600}
            itemCount={filteredInputs.length}
            itemSize={100}
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
        </Box>
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