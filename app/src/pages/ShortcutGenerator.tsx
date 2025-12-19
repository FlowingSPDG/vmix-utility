import { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { useConnectionSelection } from '../hooks/useConnectionSelection';
import { useUISettings, getDensitySpacing } from '../hooks/useUISettings.tsx';
import { FixedSizeList as List } from 'react-window';
import ConnectionSelector from '../components/ConnectionSelector';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  IconButton,
  Divider,
  ButtonGroup,
  Snackbar,
  Alert,
  Autocomplete,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
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
  short_title?: string;
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
    lastClickedInputId: number | null;
    onInputClick: (inputId: number) => void;
  };
}) => {
  const { filteredInputs, vmixInputs, selectedConnection, showToast, onTryCommand, lastClickedInputId, onInputClick } = data;
  const input = filteredInputs[index];
  const vmixInput = vmixInputs.find(vi => vi.number === input.number);
  const isLastItem = index === filteredInputs.length - 1;
  const isSpecialInput = input.id < 0;
  const isHighlighted = lastClickedInputId === input.id;
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

  const openTallyInBrowser = useCallback(async (e: React.MouseEvent, input: Input) => {
    e.stopPropagation();
    onInputClick(input.id);
    try {
      const inputKey = input.queryParams.find(param => param.key === 'Input')?.value;
      if (!inputKey) {
        showToast('Input key not found', 'error');
        return;
      }
      await openUrl(`http://${selectedConnection}:8088/tally/?key=${inputKey}`);
      showToast('Opened Tally interface in browser', 'info');
    } catch (error) {
      console.error('Failed to open tally URL:', error);
      showToast('Failed to open Tally URL in browser', 'error');
    }
  }, [showToast, selectedConnection, onInputClick]);

  const handleCopyUrl = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInputClick(input.id);
    navigator.clipboard.writeText(generateUrl(input));
    showToast('Function URL copied to clipboard!');
  }, [input, generateUrl, showToast, onInputClick]);

  const handleCopyScript = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInputClick(input.id);
    navigator.clipboard.writeText(generateScript(input));
    showToast('Script API command copied to clipboard!');
  }, [input, generateScript, showToast, onInputClick]);

  const handleTryCommand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInputClick(input.id);
    onTryCommand(input);
  }, [input, onTryCommand, onInputClick]);

  const handleCopyKey = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInputClick(input.id);
    if (!vmixInput?.key) {
      showToast('Input key not found', 'error');
      return;
    }
    navigator.clipboard.writeText(vmixInput.key);
    showToast('Input key copied to clipboard!');
  }, [vmixInput, showToast, onInputClick, input.id]);

  return (
    <Box style={style}>
      <Box 
        sx={{ 
          p: 1, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          flexWrap: 'wrap',
          minHeight: '50px',
          bgcolor: isHighlighted ? 'action.selected' : 'transparent',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease'
        }}
        onClick={() => onInputClick(input.id)}
      >
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
            title={isSpecialInput ? input.title.replace(`${input.functionName} to `, '') : `Input ${input.number}: ${vmixInput?.short_title || vmixInput?.title || 'Unknown'}`}
          >
            {isSpecialInput ? input.title.replace(`${input.functionName} to `, '') : `Input ${input.number}: ${vmixInput?.short_title || vmixInput?.title || 'Unknown'}`}
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
                onClick={(e) => handleCopyUrl(e)}
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
                onClick={(e) => handleCopyScript(e)}
                size="small"
              >
                SCRIPT
              </Button>
              <Button
                startIcon={<OpenInBrowserIcon fontSize="small" />}
                onClick={(e) => openTallyInBrowser(e, input)}
                size="small"
                disabled={isSpecialInput}
              >
                TALLY
              </Button>
              <Button
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={(e) => handleCopyKey(e)}
                size="small"
                disabled={isSpecialInput}
              >
                KEY
              </Button>
              <Button
                startIcon={<PlayArrowIcon fontSize="small" />}
                color="primary"
                onClick={(e) => handleTryCommand(e)}
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
  const { uiDensity } = useUISettings();
  const spacing = getDensitySpacing(uiDensity);
  
  // Process shortcuts data
  const shortcutsData: ShortcutData[] = Array.isArray(shortcuts) ? shortcuts : [];
  
  // Filter shortcuts based on search term
  const getFilteredShortcuts = (searchTerm: string) => {
    if (!searchTerm) return [];
    return shortcutsData.filter(shortcut => 
      shortcut.Name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  const { inputs: vmixStatusInputs, connections } = useVMixStatus();
  
  // Use optimized connection selection hook
  const { selectedConnection, setSelectedConnection } = useConnectionSelection();
  const { sendVMixFunction } = useVMixStatus();
  
  // Derive vmixInputs directly from context
  const vmixInputs = useMemo(() => {
    return selectedConnection ? (vmixStatusInputs[selectedConnection] || []) : [];
  }, [selectedConnection, vmixStatusInputs]);

  // Get suggestions for parameter value based on parameter key
  const getParameterValueSuggestions = useCallback((paramKey: string): Array<{ value: string; label: string }> => {
    const key = paramKey.toLowerCase();
    
    // Input parameter - suggest vMix inputs (key, number, title)
    if (key === 'input') {
      const suggestions: Array<{ value: string; label: string }> = [];
      vmixInputs.forEach(input => {
        // Format: "Input N: INPUT_NAME"
        const label = `Input ${input.number}: ${input.short_title || input.title}`;
        suggestions.push({ value: input.key, label }); // UUID
        suggestions.push({ value: input.number.toString(), label }); // Number
        if (input.short_title && input.short_title !== input.title) {
          suggestions.push({ value: input.short_title, label });
        }
        if (input.title !== input.short_title) {
          suggestions.push({ value: input.title, label });
        }
      });
      // Add special inputs
      suggestions.push(
        { value: '0', label: 'Input 0: Preview' },
        { value: '-1', label: 'Input -1: Program' },
        { value: 'Dynamic1', label: 'Dynamic1' },
        { value: 'Dynamic2', label: 'Dynamic2' },
        { value: 'Dynamic3', label: 'Dynamic3' },
        { value: 'Dynamic4', label: 'Dynamic4' }
      );
      return suggestions;
    }
    
    // Mix parameter - suggest mix numbers only
    if (key === 'mix') {
      const suggestions: Array<{ value: string; label: string }> = [];
      for (let i = 1; i <= 4; i++) {
        suggestions.push({ value: i.toString(), label: `Mix ${i}` });
      }
      return suggestions;
    }
    
    // Duration parameter - suggest common durations (milliseconds)
    if (key === 'duration') {
      return [
        { value: '500', label: '500ms' },
        { value: '1000', label: '1000ms' },
        { value: '1500', label: '1500ms' },
        { value: '2000', label: '2000ms' },
        { value: '3000', label: '3000ms' },
        { value: '5000', label: '5000ms' },
        { value: '10000', label: '10000ms' }
      ];
    }
    
    // No suggestions for other parameters
    return [];
  }, [vmixInputs]);

  // Check if parameter value should be numeric
  const isNumericParameter = useCallback((paramKey: string): boolean => {
    const key = paramKey.toLowerCase();
    return key === 'mix' || key === 'duration' || key.includes('volume') || key.includes('gain');
  }, []);
  const [toast, setToast] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'info'}>(
    {open: false, message: '', severity: 'info'}
  );
  const [inputTypeFilter, setInputTypeFilter] = useState<string>('All');
  
  // Collapse states
  const [functionConfigExpanded, setFunctionConfigExpanded] = useState(true);
  const [specialInputsExpanded, setSpecialInputsExpanded] = useState(true);
  
  // Highlighted input state
  const [lastClickedInputId, setLastClickedInputId] = useState<number | null>(null);

  // List container ref and height state
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600);
  
  // Shared function configuration
  const [sharedFunctionName, setSharedFunctionName] = useState('PreviewInput');
  const [sharedQueryParams, setSharedQueryParams] = useState<QueryParam[]>([]);


  // Generate shortcuts directly with useMemo for performance - no separate state needed
  const inputs = useMemo(() => {
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
        title: `${sharedFunctionName} to ${input.short_title || input.title}`,
        functionName: sharedFunctionName,
        queryParams
      };
    });
    
    return [...specialInputs, ...regularInputs];
  }, [vmixInputs, sharedFunctionName, sharedQueryParams]);

  // Reset filter when connection changes - memoized to avoid re-renders  
  const effectiveInputTypeFilter = useMemo(() => {
    return selectedConnection ? inputTypeFilter : 'All';
  }, [selectedConnection, inputTypeFilter]);

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

  // Apply queries from scraper data
  const handleApplyQueries = useCallback(() => {
    if (!sharedFunctionName) {
      showToast('Please select a function first', 'error');
      return;
    }

    const selectedShortcut = shortcutsData.find(s => s.Name === sharedFunctionName);
    if (!selectedShortcut) {
      showToast('Function not found in scraper data', 'error');
      return;
    }

    if (!selectedShortcut.Parameters || selectedShortcut.Parameters.length === 0) {
      showToast('No parameters available for this function', 'info');
      return;
    }

    // Get existing parameter keys
    const existingKeys = new Set(sharedQueryParams.map(p => p.key));
    
    // Add new parameters that don't already exist
    const newParams: QueryParam[] = [];
    let nextId = sharedQueryParams.length > 0
      ? Math.max(...sharedQueryParams.map(p => p.id)) + 1
      : 1;

    selectedShortcut.Parameters.forEach(paramKey => {
      if (!existingKeys.has(paramKey)) {
        newParams.push({
          id: nextId++,
          key: paramKey,
          value: ''
        });
      }
    });

    if (newParams.length === 0) {
      showToast('All parameters are already added', 'info');
      return;
    }

    setSharedQueryParams(prev => [...prev, ...newParams]);
    showToast(`Added ${newParams.length} parameter(s) from scraper data`, 'success');
  }, [sharedFunctionName, shortcutsData, sharedQueryParams]);

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
    if (effectiveInputTypeFilter === 'All') {
      return regularInputs;
    }
    return regularInputs.filter(input => {
      const vmixInput = vmixInputs.find(vi => vi.number === input.number);
      return vmixInput?.input_type === effectiveInputTypeFilter;
    });
  }, [regularInputs, effectiveInputTypeFilter, vmixInputs]);
  
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
      await sendVMixFunction(selectedConnection, input.functionName, Object.keys(params).length > 0 ? params : undefined);
      showToast(`Command sent successfully: ${input.functionName}`, 'success');
    } catch (error) {
      console.error('Failed to send command:', error);
      showToast(`Failed to send command: ${error}`, 'error');
    }
  }, [selectedConnection, generateParamsObject, showToast]);
  
  // Handle input click to set highlight
  const handleInputClick = useCallback((inputId: number) => {
    setLastClickedInputId(inputId);
  }, []);

  // Calculate list height based on container size
  useEffect(() => {
    const updateListHeight = () => {
      if (listContainerRef.current) {
        const height = listContainerRef.current.clientHeight;
        setListHeight(height);
      }
    };

    updateListHeight();
    window.addEventListener('resize', updateListHeight);
    
    // Use ResizeObserver for more accurate size tracking
    const resizeObserver = new ResizeObserver(updateListHeight);
    if (listContainerRef.current) {
      resizeObserver.observe(listContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateListHeight);
      resizeObserver.disconnect();
    };
  }, [functionConfigExpanded, specialInputsExpanded, connections.length]);

  return (
    <Box sx={{ 
      p: spacing.cardPadding * 3,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      <Paper sx={{ p: spacing.cardPadding, mb: spacing.spacing * 2, flexShrink: 0 }}>
        {/* Connection and Filter Row */}
        <Box sx={{ display: 'flex', gap: spacing.spacing * 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: spacing.spacing * 2 }}>
          <ConnectionSelector
            selectedConnection={selectedConnection}
            onConnectionChange={setSelectedConnection}
            label="Select vMix Connection"
            sx={{ flex: 1, minWidth: 250 }}
          />

          {vmixInputs.length > 0 && (
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel id="input-type-filter-label">Filter by Input Type</InputLabel>
              <Select
                labelId="input-type-filter-label"
                value={effectiveInputTypeFilter}
                label="Filter by Input Type"
                onChange={(e) => setInputTypeFilter(e.target.value as string)}
                size={spacing.iconSize}
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

        {connections.length === 0 && (
          <Alert severity="info" sx={{ mb: spacing.spacing }}>
            No vMix connections available. Please connect to a vMix instance first.
          </Alert>
        )}

        {vmixInputs.length === 0 && selectedConnection && (
          <Typography variant="body2" color="text.secondary">
            Loading inputs...
          </Typography>
        )}
      </Paper>

      {connections.length === 0 ? (
        <Paper sx={{ p: spacing.cardPadding * 2, textAlign: 'center', flexShrink: 0 }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No vMix Connections Available
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Please connect to a vMix instance from the Connections page to generate shortcuts.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Shared Function Configuration */}
          <Paper sx={{ p: spacing.cardPadding * 1.5, mb: spacing.spacing * 2, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing.spacing }}>
              <Typography variant={spacing.headerVariant} sx={{ fontSize: spacing.fontSize === '0.7rem' ? '0.9rem' : '1.1rem' }}>
                Function Configuration
              </Typography>
              <IconButton
                size={spacing.iconSize}
                onClick={() => setFunctionConfigExpanded(!functionConfigExpanded)}
              >
                {functionConfigExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={functionConfigExpanded}>
            {/* Function Name with Apply queries button */}
            <Box sx={{ mb: spacing.spacing, display: 'flex', alignItems: 'center', gap: spacing.spacing, flexWrap: 'wrap' }}>
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
                    sx={{ width: '220px', flexShrink: 0 }}
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
              
              <Button
                variant="outlined"
                size="small"
                onClick={handleApplyQueries}
                disabled={!sharedFunctionName || !shortcutsData.find(s => s.Name === sharedFunctionName)?.Parameters}
                sx={{ flexShrink: 0 }}
              >
                Apply queries
              </Button>
              
              {/* Quick Function Selection - compact chips */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: spacing.spacing * 0.3, 
                flex: 1, 
                minWidth: 0,
                overflow: 'auto',
                '&::-webkit-scrollbar': { height: '4px' },
                scrollbarWidth: 'thin'
              }}>
                {['PreviewInput','Cut', 'Fade', 'Merge', 'Stinger1', 'Stinger2', 'OverlayInput1', 'OverlayInput2'].map((funcName) => (
                  <Chip
                    key={funcName}
                    label={funcName}
                    size="small"
                    onClick={() => setSharedFunctionName(funcName)}
                    color={sharedFunctionName === funcName ? 'primary' : 'default'}
                    variant={sharedFunctionName === funcName ? 'filled' : 'outlined'}
                    sx={{ flexShrink: 0 }}
                  />
                ))}
              </Box>
            </Box>
            
            {/* Query Parameters - Table format */}
            <Box sx={{ mb: spacing.spacing }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing.spacing * 0.5 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Query Parameters
                </Typography>
                {sharedQueryParams.length > 0 && (
                  <Chip 
                    label={`${sharedQueryParams.length} parameter${sharedQueryParams.length > 1 ? 's' : ''}`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
              
              {sharedQueryParams.length > 0 ? (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: spacing.spacing }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, width: '40%' }}>Key</TableCell>
                        <TableCell sx={{ fontWeight: 600, width: '50%' }}>Value</TableCell>
                        <TableCell sx={{ width: '10%', textAlign: 'center' }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sharedQueryParams.map((param) => (
                        <TableRow key={param.id} hover>
                          <TableCell sx={{ p: 1 }}>
                            <TextField
                              fullWidth
                              value={param.key}
                              onChange={(e) => handleSharedParamChange(param.id, e.target.value, param.value)}
                              size="small"
                              placeholder="Key"
                              variant="outlined"
                              sx={{ 
                                '& .MuiOutlinedInput-root': {
                                  fontSize: '0.875rem'
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ p: 1 }}>
                            {(() => {
                              const suggestions = getParameterValueSuggestions(param.key);
                              const isNumeric = isNumericParameter(param.key);
                              
                              if (suggestions.length > 0) {
                                return (
                                  <Autocomplete
                                    freeSolo
                                    options={suggestions}
                                    getOptionLabel={(option) => {
                                      if (typeof option === 'string') return option;
                                      return option.label || option.value;
                                    }}
                                    value={suggestions.find(s => s.value === param.value) || param.value}
                                    onInputChange={(_event, newValue) => {
                                      handleSharedParamChange(param.id, param.key, newValue || '');
                                    }}
                                    onChange={(_event, newValue) => {
                                      if (typeof newValue === 'string') {
                                        handleSharedParamChange(param.id, param.key, newValue);
                                      } else if (newValue) {
                                        handleSharedParamChange(param.id, param.key, newValue.value);
                                      }
                                    }}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        size="small"
                                        placeholder="Value"
                                        variant="outlined"
                                        type={isNumeric ? 'number' : 'text'}
                                        sx={{ 
                                          '& .MuiOutlinedInput-root': {
                                            fontSize: '0.875rem'
                                          }
                                        }}
                                      />
                                    )}
                                    renderOption={(props, option) => (
                                      <Box component="li" {...props}>
                                        <Typography variant="body2">
                                          {typeof option === 'string' ? option : option.label}
                                        </Typography>
                                      </Box>
                                    )}
                                    sx={{ width: '100%' }}
                                  />
                                );
                              }
                              
                              return (
                                <TextField
                                  fullWidth
                                  value={param.value}
                                  onChange={(e) => handleSharedParamChange(param.id, param.key, e.target.value)}
                                  size="small"
                                  placeholder="Value"
                                  variant="outlined"
                                  type={isNumeric ? 'number' : 'text'}
                                  sx={{ 
                                    '& .MuiOutlinedInput-root': {
                                      fontSize: '0.875rem'
                                    }
                                  }}
                                />
                              );
                            })()}
                          </TableCell>
                          <TableCell sx={{ p: 1, textAlign: 'center' }}>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteSharedParam(param.id)}
                              sx={{ p: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: spacing.spacing * 2, 
                    textAlign: 'center',
                    bgcolor: 'action.hover',
                    mb: spacing.spacing
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No parameters added. Use "Apply queries" or add manually below.
                  </Typography>
                </Paper>
              )}
              
              {/* Add New Parameter */}
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ p: 1, width: '40%' }}>
                        <TextField
                          fullWidth
                          placeholder="Key"
                          value={newParamKey}
                          onChange={(e) => setNewParamKey(e.target.value)}
                          size="small"
                          variant="outlined"
                          sx={{ 
                            '& .MuiOutlinedInput-root': {
                              fontSize: '0.875rem'
                            }
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && newParamKey && newParamValue) {
                              handleAddSharedParam();
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ p: 1, width: '50%' }}>
                        {(() => {
                          const suggestions = getParameterValueSuggestions(newParamKey);
                          const isNumeric = isNumericParameter(newParamKey);
                          
                          if (suggestions.length > 0) {
                            return (
                              <Autocomplete
                                freeSolo
                                options={suggestions}
                                getOptionLabel={(option) => {
                                  if (typeof option === 'string') return option;
                                  return option.label || option.value;
                                }}
                                value={suggestions.find(s => s.value === newParamValue) || newParamValue}
                                onInputChange={(_event, newValue) => {
                                  setNewParamValue(newValue || '');
                                }}
                                onChange={(_event, newValue) => {
                                  if (typeof newValue === 'string') {
                                    setNewParamValue(newValue);
                                  } else if (newValue) {
                                    setNewParamValue(newValue.value);
                                  }
                                }}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder="Value"
                                    size="small"
                                    variant="outlined"
                                    type={isNumeric ? 'number' : 'text'}
                                    sx={{ 
                                      '& .MuiOutlinedInput-root': {
                                        fontSize: '0.875rem'
                                      }
                                    }}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter' && newParamKey && newParamValue) {
                                        handleAddSharedParam();
                                      }
                                    }}
                                  />
                                )}
                                renderOption={(props, option) => (
                                  <Box component="li" {...props}>
                                    <Typography variant="body2">
                                      {typeof option === 'string' ? option : option.label}
                                    </Typography>
                                  </Box>
                                )}
                                sx={{ width: '100%' }}
                              />
                            );
                          }
                          
                          return (
                            <TextField
                              fullWidth
                              placeholder="Value"
                              value={newParamValue}
                              onChange={(e) => setNewParamValue(e.target.value)}
                              size="small"
                              variant="outlined"
                              type={isNumeric ? 'number' : 'text'}
                              sx={{ 
                                '& .MuiOutlinedInput-root': {
                                  fontSize: '0.875rem'
                                }
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && newParamKey && newParamValue) {
                                  handleAddSharedParam();
                                }
                              }}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell sx={{ p: 1, width: '10%', textAlign: 'center' }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={handleAddSharedParam}
                          disabled={!newParamKey || !newParamValue}
                          sx={{ flexShrink: 0 }}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
            </Collapse>
          </Paper>

          <Paper sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {/* Special Inputs Header */}
            {specialInputs.length > 0 && (
              <Box sx={{ p: spacing.cardPadding * 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Special Inputs (None/Preview/Program/Dynamic) ({specialInputs.length})
                </Typography>
                <IconButton
                  size={spacing.iconSize}
                  onClick={() => setSpecialInputsExpanded(!specialInputsExpanded)}
                >
                  {specialInputsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
            )}
            
            <Box ref={listContainerRef} sx={{ flex: 1, minHeight: 0 }}>
              <List
                width={"100%"}
                height={listHeight}
                itemCount={filteredInputs.length}
                itemSize={spacing.itemHeight + 46}
                itemData={useMemo(() => ({
                  filteredInputs,
                  vmixInputs,
                  selectedConnection,
                  showToast,
                  onTryCommand: tryCommand,
                  lastClickedInputId,
                  onInputClick: handleInputClick,
                  spacing
                }), [filteredInputs, vmixInputs, selectedConnection, showToast, tryCommand, lastClickedInputId, handleInputClick, spacing])}
              >
                {VirtualizedInputItem}
              </List>
            </Box>
          </Paper>
        </>
      )}

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