import { useMemo } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import { useVMixStatus } from '../hooks/useVMixStatus';

interface ConnectionSelectorProps {
  selectedConnection: string;
  onConnectionChange: (connection: string) => void;
  label?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  sx?: object;
}

const ConnectionSelector = ({
  selectedConnection,
  onConnectionChange,
  label = 'vMix Connection',
  size = 'small',
  fullWidth = true,
  sx = {}
}: ConnectionSelectorProps) => {
  const { connections } = useVMixStatus();
  
  const connectedConnections = useMemo(() => 
    connections.filter(conn => conn.status === 'Connected'), 
    [connections]
  );

  const handleChange = (event: SelectChangeEvent<string>) => {
    onConnectionChange(event.target.value);
  };

  const labelId = `connection-select-label-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <FormControl fullWidth={fullWidth} sx={sx}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        value={selectedConnection}
        label={label}
        onChange={handleChange}
        size={size}
      >
        <MenuItem value="">
          <em>Select a vMix connection</em>
        </MenuItem>
        {connectedConnections.map((conn) => (
          <MenuItem key={conn.host} value={conn.host}>
            {conn.label} ({conn.host})
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ConnectionSelector;