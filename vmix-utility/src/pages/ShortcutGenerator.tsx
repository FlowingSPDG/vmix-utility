import { useState } from 'react';
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
  // Mock vMix connections
  const [vmixConnections, setVmixConnections] = useState<VMixConnection[]>([
    { id: 1, name: 'Main vMix', ip: '127.0.0.1', port: 8088 },
    { id: 2, name: 'Backup vMix', ip: '192.168.1.100', port: 8088 },
  ]);
  
  const [selectedVMix, setSelectedVMix] = useState<number>(1);
  
  // Mock inputs
  const [inputs, setInputs] = useState<Input[]>([
    {
      id: 1,
      number: 1,
      title: 'Cut to Input 1',
      functionName: 'Cut',
      queryParams: [
        { id: 1, key: 'Input', value: '1' }
      ]
    },
    {
      id: 2,
      number: 2,
      title: 'Fade to Input 2',
      functionName: 'Fade',
      queryParams: [
        { id: 1, key: 'Input', value: '2' },
        { id: 2, key: 'Duration', value: '1000' }
      ]
    },
    {
      id: 3,
      number: 3,
      title: 'Start Recording',
      functionName: 'StartRecording',
      queryParams: []
    },
  ]);
  
  // State for new query param
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');

  const handleVMixChange = (event: SelectChangeEvent) => {
    setSelectedVMix(Number(event.target.value));
  };

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
    const selectedConnection = vmixConnections.find(conn => conn.id === selectedVMix);
    if (!selectedConnection) return '';
    
    let url = `http://${selectedConnection.ip}:${selectedConnection.port}/api?Function=${input.functionName}`;
    
    if (input.queryParams.length > 0) {
      for (const param of input.queryParams) {
        url += `&${param.key}=${param.value}`;
      }
    }
    
    return url;
  };

  const generateScript = (input: Input) => {
    return `Function=${input.functionName}`;
  };

  const generateTally = (input: Input) => {
    // This is a placeholder for tally generation logic
    return `TALLY:${input.functionName}`;
  };

  const tryCommand = (input: Input) => {
    const url = generateUrl(input);
    // This would typically make an actual API call to vMix
    console.log(`Trying command: ${url}`);
    alert(`Command would be sent to vMix: ${url}`);
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
            value={selectedVMix.toString()}
            label="Select vMix Connection"
            onChange={handleVMixChange}
          >
            {vmixConnections.map((conn) => (
              <MenuItem key={conn.id} value={conn.id}>
                {conn.name} ({conn.ip}:{conn.port})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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