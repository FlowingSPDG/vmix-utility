import { useState, useEffect } from 'react';
import type { SelectChangeEvent } from '@mui/material';
import {
  Box,
  Typography,
  Paper,
  Button,
  Checkbox,
  FormControlLabel,
  Slider,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';

interface Connection {
  id: number;
  host: string;
  label: string;
  status: 'Connected' | 'Disconnected';
}

const BlankGenerator = () => {
  const [transparent, setTransparent] = useState(false);
  const [count, setCount] = useState(1);
  const [generated, setGenerated] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<number | ''>('');
  const [connections, setConnections] = useState<Connection[]>([]);

  // 接続一覧を取得
  useEffect(() => {
    // TODO: 実際のAPIから接続一覧を取得する
    setConnections([
      { id: 1, host: '192.168.1.100', label: 'Main vMix', status: 'Connected' },
      { id: 2, host: '192.168.1.101', label: 'Game vMix', status: 'Connected' },
    ]);
  }, []);

  const handleTransparentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTransparent(event.target.checked);
  };

  const handleCountChange = (_event: Event, newValue: number | number[]) => {
    setCount(newValue as number);
  };

  const handleConnectionChange = (event: SelectChangeEvent<number | ''>) => {
    setSelectedConnection(event.target.value as number);
  };

  const handleGenerate = () => {
    if (selectedConnection === '') {
      return;
    }

    const connection = connections.find(c => c.id === selectedConnection);
    if (!connection) {
      return;
    }

    // TODO: 選択されたvMix接続に対してブランク生成を実行
    console.log(`Generated ${count} blank${count !== 1 ? 's' : ''} with transparent=${transparent} on ${connection.host}`);
    
    setGenerated(true);
    setTimeout(() => {
      setGenerated(false);
    }, 3000);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Blank Generator
      </Typography>
      
      {generated && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Successfully generated {count} blank{count !== 1 ? 's' : ''} with {transparent ? 'transparent' : 'solid'} background on {connections.find(c => c.id === selectedConnection)?.label}!
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Generate Blank Inputs
        </Typography>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel id="vmix-connection-label">vMix Connection</InputLabel>
            <Select
              labelId="vmix-connection-label"
              id="vmix-connection"
              value={selectedConnection}
              label="vMix Connection"
              onChange={handleConnectionChange}
            >
              {connections.map((connection) => (
                <MenuItem
                  key={connection.id}
                  value={connection.id}
                  disabled={connection.status === 'Disconnected'}
                >
                  {connection.label} ({connection.host})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={transparent}
                onChange={handleTransparentChange}
                color="primary"
              />
            }
            label="Transparent Background"
          />
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography id="blank-count-slider" gutterBottom>
            Number of Blanks to Generate: {count}
          </Typography>
          <Slider
            value={count}
            onChange={handleCountChange}
            aria-labelledby="blank-count-slider"
            valueLabelDisplay="auto"
            step={1}
            marks
            min={1}
            max={10}
          />
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleGenerate}
          disabled={selectedConnection === ''}
        >
          Generate Blanks
        </Button>
      </Paper>
    </Box>
  );
};

export default BlankGenerator;