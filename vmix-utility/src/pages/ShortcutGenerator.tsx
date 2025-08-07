import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SelectChangeEvent } from '@mui/material';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Divider,
  ButtonGroup
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import CodeIcon from '@mui/icons-material/Code';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

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
  const [connections, setConnections] = useState<VmixConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [vmixInputs, setVmixInputs] = useState<VmixInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Shortcut generation state
  const [inputs, setInputs] = useState<Input[]>([]);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const vmixConnections = await invoke<VmixConnection[]>('get_vmix_statuses');
        setConnections(vmixConnections.filter(conn => conn.status === 'Connected'));
      } catch (error) {
        console.error('Failed to fetch vMix connections:', error);
        setConnections([]);
      }
    };

    fetchConnections();
  }, []);

  const fetchInputs = async (host: string) => {
    setLoading(true);
    setError(null);
    try {
      const inputs = await invoke<VmixInput[]>('get_vmix_inputs', { host });
      setVmixInputs(inputs);
      
      // Generate default shortcuts for all inputs
      const defaultShortcuts = inputs.map((input, index) => ({
        id: index + 1,
        number: input.number,
        title: `Cut to ${input.title}`,
        functionName: 'Cut',
        queryParams: [
          { id: 1, key: 'Input', value: input.number.toString() }
        ]
      }));
      
      setInputs(defaultShortcuts);
    } catch (error) {
      console.error('Failed to fetch vMix inputs:', error);
      setError(`Failed to fetch inputs: ${error}`);
      setVmixInputs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionChange = (host: string) => {
    setSelectedConnection(host);
    if (host) {
      fetchInputs(host);
    } else {
      setVmixInputs([]);
      setInputs([]);
    }
  };

  // State for new query param
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');

  const handleAddParam = (inputId: number) => {
    if (newParamKey && newParamValue) {
      setInputs(inputs.map(input => {
        if (input.id === inputId) {
          const newId = input.queryParams.length > 0
            ? Math.max(...input.queryParams.map(p => p.id)) + 1
            : 1;
          
          return {
            ...input,
            queryParams: [
              ...input.queryParams,
              { id: newId, key: newParamKey, value: newParamValue }
            ]
          };
        }
        return input;
      }));
      
      setNewParamKey('');
      setNewParamValue('');
    }
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
    
    let url = `http://${selectedConnection}:8088/api/?Function=${input.functionName}`;
    
    if (input.queryParams.length > 0) {
      for (const param of input.queryParams) {
        url += `&${param.key}=${param.value}`;
      }
    }
    
    return url;
  };

  const generateScript = (input: Input) => {
    let script = `Function=${input.functionName}`;
    if (input.queryParams.length > 0) {
      for (const param of input.queryParams) {
        script += `&${param.key}=${param.value}`;
      }
    }
    return script;
  };

  const generateTally = (input: Input) => {
    return `TALLY:${input.functionName}:${input.queryParams.map(p => `${p.key}=${p.value}`).join(',')}`;
  };

  const tryCommand = async (input: Input) => {
    if (!selectedConnection) {
      alert('Please select a vMix connection first');
      return;
    }

    try {
      const functionString = generateScript(input);
      await invoke('send_vmix_function', {
        host: selectedConnection,
        function: functionString
      });
      alert(`Command sent successfully: ${functionString}`);
    } catch (error) {
      console.error('Failed to send command:', error);
      alert(`Failed to send command: ${error}`);
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
            {connections.map((conn) => (
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
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Generated URL</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inputs.map((input) => (
              <TableRow key={input.id}>
                <TableCell>{input.number}</TableCell>
                <TableCell>{input.title}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mr: 1
                      }}
                    >
                      {generateUrl(input)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        navigator.clipboard.writeText(generateUrl(input));
                        alert('URL copied to clipboard!');
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell>
                  <ButtonGroup variant="outlined" size="small">
                    <Button
                      startIcon={<CodeIcon />}
                      onClick={() => {
                        navigator.clipboard.writeText(generateScript(input));
                        alert('Script copied to clipboard!');
                      }}
                    >
                      Script
                    </Button>
                    <Button
                      startIcon={<SignalCellularAltIcon />}
                      onClick={() => {
                        navigator.clipboard.writeText(generateTally(input));
                        alert('Tally code copied to clipboard!');
                      }}
                    >
                      TALLY
                    </Button>
                    <Button
                      startIcon={<PlayArrowIcon />}
                      color="primary"
                      onClick={() => tryCommand(input)}
                    >
                      Try!
                    </Button>
                  </ButtonGroup>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ShortcutGenerator;