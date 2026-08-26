import { useState, useMemo, useCallback, memo, useRef, useEffect, useTransition, forwardRef, useImperativeHandle, type ComponentType } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { useConnectionSelection } from '../hooks/useConnectionSelection';
import { useUISettings, getDensitySpacing } from '../hooks/useUISettings.tsx';
import { FixedSizeList, type ListChildComponentProps, type FixedSizeListProps } from 'react-window';
import ConnectionSelector from '../components/ConnectionSelector';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import { useToast, ToastSnackbar } from '../hooks/useToast';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
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

type VirtualizedInputItemData = {
  filteredInputs: Input[];
  vmixInputsByNumber: Map<number, VmixInput>;
  selectedConnection: string;
  showToast: (message: string, severity?: 'success' | 'error' | 'info') => void;
  onTryCommand: (input: Input) => void | Promise<void>;
  lastClickedInputId: number | null;
  onInputClick: (inputId: number) => void;
  spacing: ReturnType<typeof getDensitySpacing>;
  t: TFunction;
};

/** `react-window` class types vs React 18 JSX (refs) — align for TS */
const VirtualizedInputList = FixedSizeList as unknown as ComponentType<
  FixedSizeListProps<VirtualizedInputItemData>
>;

const FUNCTION_NAME_COMMIT_MS = 400;
const MAX_SHORTCUT_SUGGESTIONS = 50;
/** Extra bottom space so the toast snackbar does not cover TRY/Copy on the last visible row. */
const TOAST_FOOTER_SPACING = 8;

interface FunctionNameFieldHandle {
  commitAndGet: () => string;
}

interface FunctionNameFieldProps {
  value: string;
  onChange: (name: string) => void;
  shortcutsData: ShortcutData[];
  label: string;
  paramsLabel: string;
}

const FunctionNameField = memo(forwardRef<FunctionNameFieldHandle, FunctionNameFieldProps>(
  function FunctionNameField({ value, onChange, shortcutsData, label, paramsLabel }, ref) {
    const [draft, setDraft] = useState(value);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      setDraft(value);
    }, [value]);

    const commit = useCallback((name: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      onChange(name);
    }, [onChange]);

    const scheduleCommit = useCallback((name: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        onChange(name);
      }, FUNCTION_NAME_COMMIT_MS);
    }, [onChange]);

    useEffect(() => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      commitAndGet: () => {
        const name = draftRef.current;
        commit(name);
        return name;
      },
    }), [commit]);

    const filterOptions = useCallback((options: ShortcutData[], state: { inputValue: string }) => {
      const term = state.inputValue.trim().toLowerCase();
      if (!term) {
        return [];
      }

      const results: ShortcutData[] = [];
      for (const shortcut of options) {
        if (shortcut.Name.toLowerCase().includes(term)) {
          results.push(shortcut);
          if (results.length >= MAX_SHORTCUT_SUGGESTIONS) {
            break;
          }
        }
      }
      return results;
    }, []);

    return (
      <Autocomplete
        freeSolo
        options={shortcutsData}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.Name)}
        inputValue={draft}
        onInputChange={(_event, newInputValue, reason) => {
          if (reason !== 'input' && reason !== 'clear') {
            return;
          }
          setDraft(newInputValue);
          scheduleCommit(newInputValue);
        }}
        onChange={(_event, newValue) => {
          if (newValue && typeof newValue !== 'string') {
            setDraft(newValue.Name);
            commit(newValue.Name);
          }
        }}
        filterOptions={filterOptions}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            size="small"
            sx={{ width: '220px', flexShrink: 0 }}
            onBlur={() => {
              if (draftRef.current !== value) {
                commit(draftRef.current);
              }
            }}
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
              {option.Parameters ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  {paramsLabel} {option.Parameters.join(', ')}
                </Typography>
              ) : null}
            </Box>
          </Box>
        )}
      />
    );
  }
));

FunctionNameField.displayName = 'FunctionNameField';

// Virtualized row component for react-window
const VirtualizedInputItem = memo((props: ListChildComponentProps<VirtualizedInputItemData>) => {
  const { index, style, data } = props;
  const { filteredInputs, vmixInputsByNumber, selectedConnection, showToast, onTryCommand, lastClickedInputId, onInputClick, spacing, t } = data;
  const input = filteredInputs[index];
  const vmixInput = vmixInputsByNumber.get(input.number);
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
        showToast(t('shortcut.inputKeyNotFound'), 'error');
        return;
      }
      await openUrl(`http://${selectedConnection}:8088/tally/?key=${inputKey}`);
      showToast(t('shortcut.tallyOpened'), 'info');
    } catch (error) {
      console.error('Failed to open tally URL:', error);
      showToast(t('shortcut.tallyOpenFailed'), 'error');
    }
  }, [showToast, selectedConnection, onInputClick, t]);

  const handleCopyUrl = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInputClick(input.id);
    navigator.clipboard.writeText(generateUrl(input));
    showToast(t('shortcut.urlCopied'));
  }, [input, generateUrl, showToast, onInputClick, t]);

  const handleCopyScript = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInputClick(input.id);
    navigator.clipboard.writeText(generateScript(input));
    showToast(t('shortcut.scriptCopied'));
  }, [input, generateScript, showToast, onInputClick, t]);

  const handleTryCommand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInputClick(input.id);
    onTryCommand(input);
  }, [input, onTryCommand, onInputClick]);

  const handleCopyKey = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInputClick(input.id);
    if (!vmixInput?.key) {
      showToast(t('shortcut.inputKeyNotFound'), 'error');
      return;
    }
    navigator.clipboard.writeText(vmixInput.key);
    showToast(t('shortcut.inputKeyCopied'));
  }, [vmixInput, showToast, onInputClick, input.id, t]);

  return (
    <div style={style as React.CSSProperties}>
      <Box 
        sx={{ 
          px: spacing.listItemPadding,
          py: spacing.listItemPadding * 0.5,
          display: 'flex', 
          alignItems: 'center', 
          gap: spacing.spacing,
          flexWrap: 'nowrap',
          minHeight: spacing.itemHeight,
          boxSizing: 'border-box',
          bgcolor: isHighlighted ? 'action.selected' : 'transparent',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease'
        }}
        onClick={() => onInputClick(input.id)}
      >
        {/* Input Info */}
        <Box sx={{ 
          minWidth: '140px', 
          maxWidth: '200px', 
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <Typography 
            variant="body2" 
            fontWeight="medium"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: spacing.fontSize,
              lineHeight: spacing.lineHeight,
            }}
            title={isSpecialInput ? input.title.replace(`${input.functionName} to `, '') : t('shortcut.inputLine', { num: input.number, name: vmixInput?.short_title || vmixInput?.title || t('shortcut.unknownInput') })}
          >
            {isSpecialInput ? input.title.replace(`${input.functionName} to `, '') : t('shortcut.inputLine', { num: input.number, name: vmixInput?.short_title || vmixInput?.title || t('shortcut.unknownInput') })}
          </Typography>
          <Typography 
            variant="caption" 
            color="textSecondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              fontSize: `calc(${spacing.fontSize} - 0.05rem)`,
              lineHeight: spacing.lineHeight,
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
          gap: spacing.spacing,
          alignItems: 'center'
        }}>
          {/* Generated URL */}
          <Box sx={{ 
            flex: 1, 
            minWidth: 0,
            height: '100%',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'action.hover', borderRadius: 1, height: '100%' }}>
              <Box 
                sx={{ 
                  flex: 1, 
                  px: spacing.listItemPadding,
                  py: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Typography 
                  component="pre" 
                  variant="caption" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    fontSize: `calc(${spacing.fontSize} - 0.05rem)`,
                    whiteSpace: 'nowrap',
                    margin: 0,
                    lineHeight: spacing.lineHeight,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {generateUrl(input)}
                </Typography>
              </Box>
              <IconButton
                size={spacing.iconSize}
                onClick={(e) => handleCopyUrl(e)}
                aria-label={t('shortcut.copyUrl')}
                sx={{
                  p: spacing.listItemPadding,
                  flexShrink: 0,
                  minWidth: spacing.itemHeight,
                  minHeight: spacing.itemHeight,
                }}
              >
                <ContentCopyIcon fontSize={spacing.iconSize} />
              </IconButton>
            </Box>
          </Box>
          
          {/* Action Buttons */}
          <Box sx={{ flexShrink: 0, ml: spacing.spacing }}>
            <ButtonGroup 
              variant="outlined" 
              size="small"
              sx={{ 
                '& .MuiButton-root': { 
                  minWidth: 'auto', 
                  px: 0.75,
                  py: 0.25,
                  minHeight: 26,
                  fontSize: '0.6875rem',
                  lineHeight: 1.2,
                  textTransform: 'none',
                  '& .MuiButton-startIcon': {
                    marginRight: 0.375,
                    marginLeft: -0.125,
                    '& > *:nth-of-type(1)': {
                      fontSize: '0.875rem',
                    },
                  },
                },
              }}
            >
              <Button
                startIcon={<CodeIcon />}
                onClick={(e) => handleCopyScript(e)}
                size="small"
              >
                {t('shortcut.script')}
              </Button>
              <Button
                startIcon={<OpenInBrowserIcon />}
                onClick={(e) => openTallyInBrowser(e, input)}
                size="small"
                disabled={isSpecialInput}
              >
                {t('shortcut.tally')}
              </Button>
              <Button
                startIcon={<ContentCopyIcon />}
                onClick={(e) => handleCopyKey(e)}
                size="small"
                disabled={isSpecialInput}
              >
                {t('shortcut.keyBtn')}
              </Button>
              <Button
                startIcon={<PlayArrowIcon />}
                color="primary"
                onClick={(e) => handleTryCommand(e)}
                size="small"
              >
                {t('shortcut.try')}
              </Button>
            </ButtonGroup>
          </Box>
        </Box>
      </Box>
      {!isLastItem ? <Divider /> : null}
    </div>
  );
});

VirtualizedInputItem.displayName = 'VirtualizedInputItem';

const ShortcutGenerator = () => {
  const { t } = useTranslation();
  const { uiDensity } = useUISettings();
  const spacing = getDensitySpacing(uiDensity);
  
  // Process shortcuts data
  const shortcutsData: ShortcutData[] = Array.isArray(shortcuts) ? shortcuts : [];
  
  const functionNameFieldRef = useRef<FunctionNameFieldHandle>(null);
  const { inputs: vmixStatusInputs, connections } = useVMixStatus();
  
  // Use optimized connection selection hook
  const { selectedConnection, setSelectedConnection } = useConnectionSelection();
  const { sendVMixFunction } = useVMixStatus();
  
  // Derive vmixInputs directly from context
  const vmixInputs = useMemo(() => {
    return selectedConnection ? (vmixStatusInputs[selectedConnection] || []) : [];
  }, [selectedConnection, vmixStatusInputs]);

  const vmixInputsByNumber = useMemo(() => {
    const map = new Map<number, VmixInput>();
    for (const input of vmixInputs) {
      map.set(input.number, input);
    }
    return map;
  }, [vmixInputs]);

  const [, startTransition] = useTransition();

  // Get suggestions for parameter value based on parameter key
  const getParameterValueSuggestions = useCallback((paramKey: string): Array<{ value: string; label: string }> => {
    const key = paramKey.toLowerCase();
    
    // Input parameter - suggest vMix inputs (key, number, title)
    if (key === 'input') {
      const suggestions: Array<{ value: string; label: string }> = [];
      vmixInputs.forEach(input => {
        // Format: "Input N: INPUT_NAME"
        const label = t('shortcut.inputLine', { num: input.number, name: input.short_title || input.title });
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
        { value: '0', label: t('shortcut.inputPreview') },
        { value: '-1', label: t('shortcut.inputProgram') },
        { value: 'Dynamic1', label: t('shortcut.dynamicRaw1') },
        { value: 'Dynamic2', label: t('shortcut.dynamicRaw2') },
        { value: 'Dynamic3', label: t('shortcut.dynamicRaw3') },
        { value: 'Dynamic4', label: t('shortcut.dynamicRaw4') }
      );
      return suggestions;
    }
    
    // Mix parameter: vMix HTTP API uses 0-based index (Mix N in UI → Mix=N-1 in query).
    // Fixed range 2–16 regardless of connection/input state.
    if (key === 'mix') {
      const suggestions: Array<{ value: string; label: string }> = [];
      for (let i = 2; i <= 16; i++) {
        suggestions.push({ value: (i - 1).toString(), label: t('shortcut.mixN', { n: i }) });
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
  }, [vmixInputs, t]);

  // Check if parameter value should be numeric
  const isNumericParameter = useCallback((paramKey: string): boolean => {
    const key = paramKey.toLowerCase();
    return key === 'mix' || key === 'duration' || key.includes('volume') || key.includes('gain');
  }, []);
  const { toast, showToast, hideToast } = useToast();
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
      { type: 'None', value: '', title: t('shortcut.specialNone') },
      { type: 'Preview', value: '0', title: t('shortcut.specialPreview') },
      { type: 'Program', value: '-1', title: t('shortcut.specialProgram') },
      { type: 'Dynamic1', value: 'Dynamic1', title: t('shortcut.specialDynamic1') },
      { type: 'Dynamic2', value: 'Dynamic2', title: t('shortcut.specialDynamic2') },
      { type: 'Dynamic3', value: 'Dynamic3', title: t('shortcut.specialDynamic3') },
      { type: 'Dynamic4', value: 'Dynamic4', title: t('shortcut.specialDynamic4') }
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
  }, [vmixInputs, sharedFunctionName, sharedQueryParams, t]);

  // Reset filter when connection changes - memoized to avoid re-renders  
  const effectiveInputTypeFilter = useMemo(() => {
    return selectedConnection ? inputTypeFilter : 'All';
  }, [selectedConnection, inputTypeFilter]);

  // State for new query param
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');

  const handleAddSharedParam = useCallback(() => {
    if (newParamKey && newParamValue) {
      startTransition(() => {
        setSharedQueryParams(prev => {
          const newId = prev.length > 0 ? Math.max(...prev.map(p => p.id)) + 1 : 1;
          return [...prev, { id: newId, key: newParamKey, value: newParamValue }];
        });
      });

      setNewParamKey('');
      setNewParamValue('');
    }
  }, [newParamKey, newParamValue, startTransition]);

  const handleDeleteSharedParam = useCallback((paramId: number) => {
    startTransition(() => {
      setSharedQueryParams(prev => prev.filter(param => param.id !== paramId));
    });
  }, [startTransition]);

  const handleSharedParamChange = useCallback((paramId: number, key: string, value: string) => {
    startTransition(() => {
      setSharedQueryParams(prev => prev.map(param =>
        param.id === paramId
          ? { ...param, key, value }
          : param
      ));
    });
  }, [startTransition]);

  // Apply queries from scraper data
  const handleApplyQueries = useCallback(() => {
    const activeFunctionName = functionNameFieldRef.current?.commitAndGet() ?? sharedFunctionName;
    if (!activeFunctionName) {
      showToast(t('shortcut.selectFunctionFirst'), 'error');
      return;
    }

    const selectedShortcut = shortcutsData.find(s => s.Name === activeFunctionName);
    if (!selectedShortcut) {
      showToast(t('shortcut.functionNotInScraper'), 'error');
      return;
    }

    if (!selectedShortcut.Parameters || selectedShortcut.Parameters.length === 0) {
      showToast(t('shortcut.noParamsForFunction'), 'info');
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
      // Input is auto-added per input row; skip when applying scraper params
      if (paramKey.toLowerCase() === 'input') {
        return;
      }
      if (!existingKeys.has(paramKey)) {
        newParams.push({
          id: nextId++,
          key: paramKey,
          value: ''
        });
      }
    });

    if (newParams.length === 0) {
      showToast(t('shortcut.allParamsAdded'), 'info');
      return;
    }

    startTransition(() => {
      setSharedQueryParams(prev => [...prev, ...newParams]);
    });
    showToast(t('shortcut.addedParams', { count: newParams.length }), 'success');
  }, [sharedFunctionName, shortcutsData, sharedQueryParams, t, startTransition, showToast]);

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
      const vmixInput = vmixInputsByNumber.get(input.number);
      return vmixInput?.input_type === effectiveInputTypeFilter;
    });
  }, [regularInputs, effectiveInputTypeFilter, vmixInputsByNumber]);

  const inputTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const input of regularInputs) {
      const type = vmixInputsByNumber.get(input.number)?.input_type;
      if (type) {
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    return counts;
  }, [regularInputs, vmixInputsByNumber]);
  
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
      showToast(t('shortcut.selectConnectionFirst'), 'error');
      return;
    }

    try {
      const params = generateParamsObject(input);
      await sendVMixFunction(selectedConnection, input.functionName, Object.keys(params).length > 0 ? params : undefined);
      showToast(t('shortcut.commandSent', { name: input.functionName }), 'success');
    } catch (error) {
      console.error('Failed to send command:', error);
      showToast(t('shortcut.commandFailed', { error: String(error) }), 'error');
    }
  }, [selectedConnection, generateParamsObject, showToast, t]);
  
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
      pb: spacing.cardPadding * 3 + TOAST_FOOTER_SPACING,
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
            label={t('shortcut.selectConnectionLabel')}
            sx={{ flex: 1, minWidth: 250 }}
          />

          {vmixInputs.length > 0 ? (
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel id="input-type-filter-label">{t('shortcut.filterInputType')}</InputLabel>
              <Select
                labelId="input-type-filter-label"
                value={effectiveInputTypeFilter}
                label={t('shortcut.filterInputType')}
                onChange={(e) => {
                  startTransition(() => setInputTypeFilter(e.target.value as string));
                }}
                size={spacing.iconSize}
              >
                {availableInputTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {(type === 'All' ? t('common.all') : type)} {type === 'All' ? `(${regularInputs.length})` : `(${inputTypeCounts.get(type) ?? 0})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
        </Box>

        {connections.length === 0 ? (
          <Alert severity="info" sx={{ mb: spacing.spacing }}>
            {t('shortcut.noConnectionsAlert')}
          </Alert>
        ) : null}

        {vmixInputs.length === 0 && selectedConnection ? (
          <Typography variant="body2" color="text.secondary">
            {t('shortcut.loadingInputs')}
          </Typography>
        ) : null}
      </Paper>

      {connections.length === 0 ? (
        <Paper sx={{ p: spacing.cardPadding * 2, textAlign: 'center', flexShrink: 0 }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            {t('shortcut.noConnectionsTitle')}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {t('shortcut.noConnectionsBody')}
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Shared Function Configuration */}
          <Paper sx={{ p: spacing.cardPadding * 1.5, mb: spacing.spacing * 2, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing.spacing }}>
              <Typography variant={spacing.headerVariant} sx={{ fontSize: spacing.fontSize === '0.7rem' ? '0.9rem' : '1.1rem' }}>
                {t('shortcut.functionConfig')}
              </Typography>
              <IconButton
                size={spacing.iconSize}
                onClick={() => {
                  startTransition(() => setFunctionConfigExpanded(prev => !prev));
                }}
              >
                {functionConfigExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={functionConfigExpanded}>
            {/* Function Name with Apply queries button */}
            <Box sx={{ mb: spacing.spacing, display: 'flex', alignItems: 'center', gap: spacing.spacing, flexWrap: 'wrap' }}>
              <FunctionNameField
                ref={functionNameFieldRef}
                value={sharedFunctionName}
                onChange={setSharedFunctionName}
                shortcutsData={shortcutsData}
                label={t('shortcut.functionName')}
                paramsLabel={t('shortcut.paramsLabel')}
              />
              
              <Button
                variant="outlined"
                size="small"
                onClick={handleApplyQueries}
                disabled={!sharedFunctionName || !shortcutsData.find(s => s.Name === sharedFunctionName)?.Parameters}
                sx={{ flexShrink: 0 }}
              >
                {t('shortcut.applyQueries')}
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
                  {t('shortcut.queryParams')}
                </Typography>
                {sharedQueryParams.length > 0 ? (
                  <Chip 
                    label={t('shortcut.paramChip', { count: sharedQueryParams.length })}
                    size="small"
                    variant="outlined"
                  />
                ) : null}
              </Box>
              
              {sharedQueryParams.length > 0 ? (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: spacing.spacing }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, width: '40%' }}>{t('shortcut.tableKey')}</TableCell>
                        <TableCell sx={{ fontWeight: 600, width: '50%' }}>{t('shortcut.tableValue')}</TableCell>
                        <TableCell sx={{ width: '10%', textAlign: 'center' }}>{t('shortcut.tableAction')}</TableCell>
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
                              placeholder={t('shortcut.paramKeyPlaceholder')}
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
                              const isMixParam = param.key.toLowerCase() === 'mix';
                              
                              if (suggestions.length > 0) {
                                return (
                                  <Autocomplete
                                    freeSolo
                                    options={suggestions}
                                    getOptionLabel={(option) => {
                                      if (typeof option === 'string') return option;
                                      if (isMixParam) return option.value;
                                      return option.label || option.value;
                                    }}
                                    isOptionEqualToValue={(option, val) => {
                                      const optVal = typeof option === 'string' ? option : option.value;
                                      if (val == null) return false;
                                      if (typeof val === 'string') return optVal === val;
                                      return optVal === val.value;
                                    }}
                                    value={suggestions.find(s => s.value === param.value) || param.value}
                                    onInputChange={(_event, newValue, reason) => {
                                      if (reason === 'input') {
                                        handleSharedParamChange(param.id, param.key, newValue || '');
                                      } else if (reason === 'clear') {
                                        handleSharedParamChange(param.id, param.key, '');
                                      }
                                    }}
                                    onChange={(_event, newValue) => {
                                      if (typeof newValue === 'string') {
                                        handleSharedParamChange(param.id, param.key, newValue);
                                      } else if (newValue) {
                                        handleSharedParamChange(param.id, param.key, newValue.value);
                                      }
                                    }}
                                    renderInput={(params) => {
                                      const { inputProps, ...textFieldParams } = params;
                                      return (
                                        <TextField
                                          {...textFieldParams}
                                          size="small"
                                          placeholder={t('shortcut.paramValuePlaceholder')}
                                          variant="outlined"
                                          type="text"
                                          slotProps={{
                                            htmlInput: {
                                              ...inputProps,
                                              ...(isNumeric ? { inputMode: 'numeric' as const } : {}),
                                            },
                                          }}
                                          sx={{ 
                                            '& .MuiOutlinedInput-root': {
                                              fontSize: '0.875rem'
                                            }
                                          }}
                                        />
                                      );
                                    }}
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
                                  placeholder={t('shortcut.paramValuePlaceholder')}
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
                    {t('shortcut.noParamsHint')}
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
                          placeholder={t('shortcut.paramKeyPlaceholder')}
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
                          const isMixParam = newParamKey.toLowerCase() === 'mix';
                          
                          if (suggestions.length > 0) {
                            return (
                              <Autocomplete
                                freeSolo
                                options={suggestions}
                                getOptionLabel={(option) => {
                                  if (typeof option === 'string') return option;
                                  if (isMixParam) return option.value;
                                  return option.label || option.value;
                                }}
                                isOptionEqualToValue={(option, val) => {
                                  const optVal = typeof option === 'string' ? option : option.value;
                                  if (val == null) return false;
                                  if (typeof val === 'string') return optVal === val;
                                  return optVal === val.value;
                                }}
                                value={suggestions.find(s => s.value === newParamValue) || newParamValue}
                                onInputChange={(_event, newValue, reason) => {
                                  if (reason === 'input') {
                                    setNewParamValue(newValue || '');
                                  } else if (reason === 'clear') {
                                    setNewParamValue('');
                                  }
                                }}
                                onChange={(_event, newValue) => {
                                  if (typeof newValue === 'string') {
                                    setNewParamValue(newValue);
                                  } else if (newValue) {
                                    setNewParamValue(newValue.value);
                                  }
                                }}
                                renderInput={(params) => {
                                  const { inputProps, ...textFieldParams } = params;
                                  return (
                                    <TextField
                                      {...textFieldParams}
                                      placeholder={t('shortcut.paramValuePlaceholder')}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      slotProps={{
                                        htmlInput: {
                                          ...inputProps,
                                          ...(isNumeric ? { inputMode: 'numeric' as const } : {}),
                                        },
                                      }}
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
                                }}
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
                              placeholder={t('shortcut.paramValuePlaceholder')}
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
                          {t('shortcut.add')}
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
            {specialInputs.length > 0 ? (
              <Box sx={{ p: spacing.cardPadding * 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('shortcut.specialInputsHeader', { count: specialInputs.length })}
                </Typography>
                <IconButton
                  size={spacing.iconSize}
                  onClick={() => {
                    startTransition(() => setSpecialInputsExpanded(prev => !prev));
                  }}
                >
                  {specialInputsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
            ) : null}
            
            <Box ref={listContainerRef} sx={{ flex: 1, minHeight: 0 }}>
              <VirtualizedInputList
                width={"100%"}
                height={listHeight}
                itemCount={filteredInputs.length}
                itemSize={spacing.itemHeight + 8}
                itemData={useMemo(() => ({
                  filteredInputs,
                  vmixInputsByNumber,
                  selectedConnection,
                  showToast,
                  onTryCommand: tryCommand,
                  lastClickedInputId,
                  onInputClick: handleInputClick,
                  spacing,
                  t,
                }), [filteredInputs, vmixInputsByNumber, selectedConnection, showToast, tryCommand, lastClickedInputId, handleInputClick, spacing, t])}
              >
                {VirtualizedInputItem}
              </VirtualizedInputList>
            </Box>
          </Paper>
        </>
      )}

      <ToastSnackbar toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default ShortcutGenerator;