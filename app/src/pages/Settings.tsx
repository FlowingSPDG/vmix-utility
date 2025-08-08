import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  Snackbar,
} from '@mui/material';

const Settings = () => {
  const [settings, setSettings] = useState({
    defaultVMixIP: '127.0.0.1',
    defaultVMixPort: 8088,
    refreshInterval: 1000,
    theme: 'light',
    logLevel: 'info',
    saveLogsToFile: false,
    logFilePath: '',
    maxLogFileSize: 10,
  });

  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const handleChange = (name: string, value: unknown) => {
    setSettings({
      ...settings,
      [name]: value
    });
  };

  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(event.target.name, event.target.checked);
  };

  const handleSelectChange = (event: SelectChangeEvent) => {
    handleChange(event.target.name, event.target.value);
  };

  const handleApply = async () => {
    try {
      // Save app settings to backend
      await invoke('save_app_settings', {
        settings: {
          startup_auto_launch: false,
          default_vmix_ip: settings.defaultVMixIP,
          default_vmix_port: settings.defaultVMixPort,
          refresh_interval: settings.refreshInterval,
          theme: settings.theme,
          auto_reconnect: false,
          auto_reconnect_interval: 5000,
          max_log_file_size: settings.maxLogFileSize,
        }
      });

      // Save logging configuration to backend
      await invoke('set_logging_config', {
        level: settings.logLevel,
        saveToFile: settings.saveLogsToFile
      });
      
      showToast('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast(`Failed to save settings: ${error}`, 'error');
    }
  };

  // Load configuration on component mount
  useEffect(() => {
    const loadConfigurations = async () => {
      try {
        // Load app settings
        const appSettings = await invoke('get_app_settings');
        if (appSettings) {
          const settings_data = appSettings as any;
          setSettings(prev => ({
            ...prev,
            defaultVMixIP: settings_data.default_vmix_ip ?? '127.0.0.1',
            defaultVMixPort: settings_data.default_vmix_port ?? 8088,
            refreshInterval: settings_data.refresh_interval ?? 1000,
            theme: settings_data.theme ?? 'light',
            maxLogFileSize: settings_data.max_log_file_size ?? 10,
          }));
        }

        // Load logging configuration
        const loggingConfig = await invoke('get_logging_config');
        if (loggingConfig) {
          setSettings(prev => ({
            ...prev,
            logLevel: (loggingConfig as any).level || 'info',
            saveLogsToFile: (loggingConfig as any).save_to_file || false
          }));
        }
      } catch (error) {
        console.error('Failed to load configurations:', error);
        showToast('Failed to load settings', 'error');
      }
    };

    loadConfigurations();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          
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

          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Logging Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
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
                  <MenuItem value="trace">Trace</MenuItem>
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

      {/* Toast Notification */}
      <Snackbar 
        open={toast.open} 
        autoHideDuration={6000} 
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={toast.severity} 
          sx={{ width: '100%' }}
          variant="filled"
          onClose={handleCloseToast}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;