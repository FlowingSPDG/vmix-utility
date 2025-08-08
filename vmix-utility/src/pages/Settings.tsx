import { useState, useEffect } from 'react';
import type { SelectChangeEvent } from '@mui/material';
import { useVMixStatus } from '../hooks/useVMixStatus';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Slider,
  FormGroup,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const Settings = () => {
  const { connections, autoRefreshConfigs, setAutoRefreshConfig } = useVMixStatus();
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

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(event.target.name, event.target.value);
  };

  const handleSelectChange = (event: SelectChangeEvent) => {
    handleChange(event.target.name, event.target.value);
  };

  const handleSliderChange = (name: string) => (_event: Event, newValue: number | number[]) => {
    handleChange(name, newValue);
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
              Connection Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography id="refresh-interval-slider" gutterBottom>
                Refresh Interval: {settings.refreshInterval}ms
              </Typography>
              <Slider
                value={settings.refreshInterval}
                onChange={handleSliderChange('refreshInterval')}
                aria-labelledby="refresh-interval-slider"
                valueLabelDisplay="auto"
                step={100}
                marks
                min={100}
                max={5000}
              />
            </Box>
            
            {settings.autoReconnect && (
              <Box sx={{ mb: 2 }}>
                <Typography id="reconnect-interval-slider" gutterBottom>
                  Auto-reconnect Interval: {settings.autoReconnectInterval / 1000} seconds
                </Typography>
                <Slider
                  value={settings.autoReconnectInterval}
                  onChange={handleSliderChange('autoReconnectInterval')}
                  aria-labelledby="reconnect-interval-slider"
                  valueLabelDisplay="auto"
                  step={1000}
                  marks
                  min={1000}
                  max={30000}
                />
              </Box>
            )}
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
            
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="log-level-select-label">Log Level</InputLabel>
                <Select
                  labelId="log-level-select-label"
                  name="logLevel"
                  value={settings.logLevel}
                  onChange={handleSelectChange}
                  label="Log Level"
                >
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="warn">Warning</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="debug">Debug</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.saveLogsToFile}
                    onChange={handleSwitchChange}
                    name="saveLogsToFile"
                    color="primary"
                  />
                }
                label="Save logs to file"
              />
            </FormGroup>
            
            {settings.saveLogsToFile && (
              <>
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Log File Path"
                    name="logFilePath"
                    value={settings.logFilePath}
                    onChange={handleTextChange}
                    margin="normal"
                    placeholder="C:/Logs/vmix-utility.log"
                  />
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography id="max-log-size-slider" gutterBottom>
                    Max Log File Size: {settings.maxLogFileSize} MB
                  </Typography>
                  <Slider
                    value={settings.maxLogFileSize}
                    onChange={handleSliderChange('maxLogFileSize')}
                    aria-labelledby="max-log-size-slider"
                    valueLabelDisplay="auto"
                    step={1}
                    marks
                    min={1}
                    max={100}
                  />
                </Box>
              </>
            )}
          </Grid>

          {/* vMix Auto-Refresh Settings */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="vmix-auto-refresh-content"
                id="vmix-auto-refresh-header"
              >
                <Typography variant="h6">vMix Auto-Refresh Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Configure automatic refresh settings for each vMix connection. Changes are saved automatically.
                </Typography>
                
                {connections.length === 0 ? (
                  <Alert severity="info">
                    No vMix connections found. Add connections in the Connections tab to configure auto-refresh settings.
                  </Alert>
                ) : (
                  <List>
                    {connections.map((connection) => (
                      <ListItem key={connection.host} divider>
                        <ListItemText
                          primary={`${connection.label} (${connection.host})`}
                          secondary={`Status: ${connection.status}`}
                        />
                        <ListItemSecondaryAction>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, minWidth: 200 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={autoRefreshConfigs[connection.host]?.enabled || false}
                                  onChange={async (e) => {
                                    const currentConfig = autoRefreshConfigs[connection.host] || { enabled: false, duration: 5 };
                                    const newConfig = { ...currentConfig, enabled: e.target.checked };
                                    await setAutoRefreshConfig(connection.host, newConfig);
                                  }}
                                  size="small"
                                />
                              }
                              label={autoRefreshConfigs[connection.host]?.enabled ? 'Enabled' : 'Disabled'}
                            />
                            {autoRefreshConfigs[connection.host]?.enabled && (
                              <Box sx={{ width: 150 }}>
                                <Typography variant="caption" gutterBottom>
                                  Refresh Interval: {autoRefreshConfigs[connection.host]?.duration}s
                                </Typography>
                                <Slider
                                  value={autoRefreshConfigs[connection.host]?.duration || 5}
                                  onChange={async (_, value) => {
                                    const currentConfig = autoRefreshConfigs[connection.host] || { enabled: true, duration: 5 };
                                    const newConfig = { ...currentConfig, duration: value as number };
                                    await setAutoRefreshConfig(connection.host, newConfig);
                                  }}
                                  min={1}
                                  max={30}
                                  step={1}
                                  valueLabelDisplay="auto"
                                  valueLabelFormat={(value) => `${value}s`}
                                  size="small"
                                />
                              </Box>
                            )}
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
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