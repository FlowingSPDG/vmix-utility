import { useState, useEffect } from 'react';
import type { SelectChangeEvent } from '@mui/material';
import { useTheme, type ThemeMode } from '../hooks/useTheme';
import { useUISettings } from '../hooks/useUISettings.tsx';
import { settingsService } from '../services/settingsService';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Grid2,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormGroup,
  Alert,
  Snackbar,
  IconButton,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const Settings = () => {
  const { themeMode, setThemeMode, resolvedTheme } = useTheme();
  const { refreshSettings } = useUISettings();
  const [settings, setSettings] = useState({
    defaultVMixIP: '127.0.0.1',
    defaultVMixPort: 8088,
    theme: themeMode,
    logLevel: 'info',
    saveLogsToFile: false,
    logFilePath: '',
    // New UI settings
    uiDensity: 'comfortable' as 'compact' | 'comfortable' | 'spacious',
  });

  const [appInfo, setAppInfo] = useState<{
    version: string;
    git_commit_hash: string;
    git_branch: string;
    build_timestamp: string;
  } | null>(null);

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

  const handleOpenLogsDirectory = async () => {
    try {
      await settingsService.openLogsDirectory();
      showToast('Logs directory opened', 'info');
    } catch (error) {
      console.error('Failed to open logs directory:', error);
      showToast(`Failed to open logs directory: ${error}`, 'error');
    }
  };

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(event.target.name, event.target.checked);
  };

  const handleSelectChange = (event: SelectChangeEvent) => {
    handleChange(event.target.name, event.target.value);
  };

  const handleApply = async () => {
    try {
      // Apply theme change first
      if (settings.theme !== themeMode) {
        await setThemeMode(settings.theme as ThemeMode);
      }
      
      // Save app settings to backend
      await settingsService.saveAppSettings({
        defaultVMixIP: settings.defaultVMixIP,
        defaultVMixPort: settings.defaultVMixPort,
        theme: settings.theme,
        uiDensity: settings.uiDensity,
      });

      // Save logging configuration to backend
      await settingsService.setLoggingConfig(settings.logLevel, settings.saveLogsToFile);
      
      // Refresh UI settings in context
      await refreshSettings();
      
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
        const appSettings = await settingsService.getAppSettings();
        if (appSettings) {
          setSettings(prev => ({
            ...prev,
            defaultVMixIP: appSettings.default_vmix_ip ?? '127.0.0.1',
            defaultVMixPort: appSettings.default_vmix_port ?? 8088,
            theme: appSettings.theme as ThemeMode ?? 'Auto',
            uiDensity: appSettings.ui_density as any ?? 'comfortable',
          }));
        }

        // Load logging configuration
        const loggingConfig = await settingsService.getLoggingConfig();
        if (loggingConfig) {
          setSettings(prev => ({
            ...prev,
            logLevel: loggingConfig.level || 'info',
            saveLogsToFile: loggingConfig.save_to_file || false
          }));
        }

        // Load application information
        const appInfo = await settingsService.getAppInfo();
        if (appInfo) {
          setAppInfo(appInfo as any);
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
      <Paper sx={{ p: 3 }}>
        <Grid2 container spacing={3}>
          
          <Grid2 size={{ xs: 12, md: 6 }}>
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
                  <MenuItem value="Light">Light</MenuItem>
                  <MenuItem value="Dark">Dark</MenuItem>
                  <MenuItem value="Auto">Auto (System Default)</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Current theme: {resolvedTheme}
                {themeMode === 'Auto' && ' (following system preference)'}
              </Typography>
            </Box>

          </Grid2>

          <Grid2 size={{ xs: 12, md: 6 }}>
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

            {settings.saveLogsToFile && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Open logs directory:
                </Typography>
                <IconButton 
                  onClick={handleOpenLogsDirectory}
                  size="small"
                  color="primary"
                  title="Open logs directory in file explorer"
                >
                  <FolderOpenIcon />
                </IconButton>
              </Box>
            )}
          </Grid2>

          <Grid2 size={12}>
            <Typography variant="h6" gutterBottom>
              UI Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="ui-density-select-label">UI Density</InputLabel>
                <Select
                  labelId="ui-density-select-label"
                  name="uiDensity"
                  value={settings.uiDensity}
                  onChange={handleSelectChange}
                  label="UI Density"
                >
                  <MenuItem value="compact">Compact</MenuItem>
                  <MenuItem value="comfortable">Comfortable</MenuItem>
                  <MenuItem value="spacious">Spacious</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Controls the spacing and size of UI elements in list views
              </Typography>
            </Box>

          </Grid2>

          <Grid2 size={12}>
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
          </Grid2>
        </Grid2>
      </Paper>

      {/* Application Information Section */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Application Information
        </Typography>
        
        {appInfo ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                Version:
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                {appInfo.version}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                Git Commit:
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                {appInfo.git_commit_hash}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                Git Branch:
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                {appInfo.git_branch}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                Build Time:
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                {appInfo.build_timestamp}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant="body1" color="textSecondary">
            Loading application information...
          </Typography>
        )}
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