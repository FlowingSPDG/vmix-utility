import { useState } from 'react';
import type { SelectChangeEvent } from '@mui/material';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormGroup,
  Alert,
} from '@mui/material';

const Settings = () => {
  const [settings, setSettings] = useState({
    startupAutoLaunch: true,
    defaultVMixIP: '127.0.0.1',
    defaultVMixPort: 8088,
    refreshInterval: 1000,
    theme: 'light',
    logLevel: 'info',
    autoReconnect: true,
    autoReconnectInterval: 5000,
    saveLogsToFile: false,
    logFilePath: '',
    maxLogFileSize: 10,
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (name: string, value: unknown) => {
    setSettings({
      ...settings,
      [name]: value
    });
    setSaved(false);
  };

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(event.target.name, event.target.checked);
  };

  const handleSelectChange = (event: SelectChangeEvent) => {
    handleChange(event.target.name, event.target.value);
  };

  const handleApply = () => {
    // In a real application, this would save the settings to storage
    console.log('Saving settings:', settings);
    setSaved(true);
    
    // Hide the success message after 3 seconds
    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      
      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              General Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.startupAutoLaunch}
                    onChange={handleSwitchChange}
                    name="startupAutoLaunch"
                    color="primary"
                  />
                }
                label="Launch on system startup"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoReconnect}
                    onChange={handleSwitchChange}
                    name="autoReconnect"
                    color="primary"
                  />
                }
                label="Auto-reconnect to vMix when connection is lost"
              />
            </FormGroup>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Application Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="theme-select-label">Theme</InputLabel>
                <Select
                  labelId="theme-select-label"
                  name="theme"
                  value={settings.theme}
                  onChange={handleSelectChange}
                  label="Theme"
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="system">System Default</MenuItem>
                </Select>
              </FormControl>
            </Box>

          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary"
                size="large"
                onClick={handleApply}
              >
                Apply Settings
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Settings;