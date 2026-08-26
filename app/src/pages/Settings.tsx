import { useState, useEffect } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeMode } from '../hooks/useTheme';
import { useUISettings } from '../hooks/useUISettings.tsx';
import { settingsService, type CachedUpdateStatus, type UpdateInfo } from '../services/settingsService';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { applySavedLocale } from '../i18n/config';
import type { SettingsLocaleChoice } from '../i18n/locale';
import { parseStoredLocaleForSettings } from '../i18n/locale';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Grid2 from '@mui/material/Grid2';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import { useToast, ToastSnackbar } from '../hooks/useToast';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

function applyCachedUpdateStatus(
  status: CachedUpdateStatus,
  setUpdateInfo: (info: UpdateInfo | null) => void,
  setUpdateCheckError: (error: string | null) => void,
) {
  if (!status.checked) {
    return;
  }
  if (status.info) {
    setUpdateInfo(status.info);
    setUpdateCheckError(null);
    return;
  }
  if (status.error) {
    setUpdateInfo(null);
    setUpdateCheckError(status.error);
  }
}

const Settings = () => {
  const { t } = useTranslation();
  const { themeMode, setThemeMode, resolvedTheme } = useTheme();
  const { refreshSettings } = useUISettings();
  const [settings, setSettings] = useState({
    defaultVMixIP: '127.0.0.1',
    defaultVMixPort: 8088,
    theme: themeMode,
    logLevel: 'info',
    saveLogsToFile: false,
    logFilePath: '',
    uiDensity: 'comfortable' as 'compact' | 'comfortable' | 'spacious',
    locale: 'system' as SettingsLocaleChoice,
  });

  const [appInfo, setAppInfo] = useState<{
    version: string;
    git_commit_hash: string;
    git_branch: string;
    build_timestamp: string;
  } | null>(null);

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const { toast, showToast, hideToast } = useToast(6000);

  const handleChange = (name: string, value: unknown) => {
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOpenLogsDirectory = async () => {
    try {
      await settingsService.openLogsDirectory();
      showToast(t('settings.logsOpened'), 'info');
    } catch (error) {
      console.error('Failed to open logs directory:', error);
      showToast(t('settings.logsOpenFailed', { error: String(error) }), 'error');
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const result = await invoke<UpdateInfo>('check_for_updates');
      setUpdateInfo(result);
      setUpdateCheckError(null);
      if (result.available) {
        showToast(
          t('settings.updateAvailableToast', {
            current: result.current_version,
            latest: result.latest_version ?? '',
          }),
          'info'
        );
      } else {
        showToast(t('settings.latestToast'), 'success');
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setUpdateCheckError(String(error));
      showToast(t('settings.checkUpdateFailed', { error: String(error) }), 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await invoke('install_update');
      showToast(t('settings.installStarted'), 'info');
    } catch (error) {
      console.error('Failed to install update:', error);
      showToast(t('settings.installFailed', { error: String(error) }), 'error');
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
      if (settings.theme !== themeMode) {
        await setThemeMode(settings.theme as ThemeMode);
      }

      await Promise.all([
        settingsService.saveAppSettings({
          defaultVMixIP: settings.defaultVMixIP,
          defaultVMixPort: settings.defaultVMixPort,
          theme: settings.theme,
          uiDensity: settings.uiDensity,
          locale: settings.locale === 'system' ? '' : settings.locale,
        }),
        settingsService.setLoggingConfig(settings.logLevel, settings.saveLogsToFile),
      ]);

      await refreshSettings();

      applySavedLocale(settings.locale === 'system' ? '' : settings.locale);

      showToast(t('settings.saved'), 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast(t('settings.saveFailed', { error: String(error) }), 'error');
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const configPromise = Promise.all([
      settingsService.getAppSettings(),
      settingsService.getLoggingConfig(),
      settingsService.getAppInfo(),
    ]);

    const load = async () => {
      try {
        unlisten = await listen<CachedUpdateStatus>('update-status-changed', (event) => {
          applyCachedUpdateStatus(event.payload, setUpdateInfo, setUpdateCheckError);
        });
        if (cancelled) {
          unlisten();
          unlisten = undefined;
          return;
        }
        const status = await settingsService.getUpdateInfo();
        if (!cancelled) {
          applyCachedUpdateStatus(status, setUpdateInfo, setUpdateCheckError);
        }
      } catch (error) {
        console.error('Failed to load update status:', error);
      }

      try {
        const [appSettings, loggingConfig, info] = await configPromise;
        if (cancelled) {
          return;
        }

        if (appSettings || loggingConfig) {
          setSettings(prev => ({
            ...prev,
            ...(appSettings ? {
              defaultVMixIP: appSettings.default_vmix_ip ?? '127.0.0.1',
              defaultVMixPort: appSettings.default_vmix_port ?? 8088,
              theme: appSettings.theme as ThemeMode ?? 'Auto',
              uiDensity: appSettings.ui_density as 'compact' | 'comfortable' | 'spacious' ?? 'comfortable',
              locale: parseStoredLocaleForSettings(appSettings.locale),
            } : {}),
            ...(loggingConfig ? {
              logLevel: loggingConfig.level || 'info',
              saveLogsToFile: loggingConfig.save_to_file || false,
            } : {}),
          }));
        }

        if (info) {
          setAppInfo(info as {
            version: string;
            git_commit_hash: string;
            git_branch: string;
            build_timestamp: string;
          });
        }
      } catch (error) {
        console.error('Failed to load configurations:', error);
        showToast(t('settings.loadFailed'), 'error');
      }
    };

    void load();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Grid2 container spacing={3}>

          <Grid2 size={{ xs: 12, md: 6 }}>
            <Typography variant="h6" gutterBottom>
              {t('settings.applicationSettings')}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="locale-select-label">{t('settings.language')}</InputLabel>
                <Select
                  labelId="locale-select-label"
                  name="locale"
                  value={settings.locale}
                  onChange={handleSelectChange}
                  label={t('settings.language')}
                >
                  <MenuItem value="system">{t('settings.languageSystem')}</MenuItem>
                  <MenuItem value="ja">{t('settings.languageJa')}</MenuItem>
                  <MenuItem value="en">{t('settings.languageEn')}</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="theme-select-label">{t('settings.theme')}</InputLabel>
                <Select
                  labelId="theme-select-label"
                  name="theme"
                  value={settings.theme}
                  onChange={handleSelectChange}
                  label={t('settings.theme')}
                >
                  <MenuItem value="Light">{t('settings.themeLight')}</MenuItem>
                  <MenuItem value="Dark">{t('settings.themeDark')}</MenuItem>
                  <MenuItem value="Auto">{t('settings.themeAuto')}</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('settings.currentTheme', {
                  theme: resolvedTheme,
                  autoNote: themeMode === 'Auto' ? t('settings.followingSystem') : '',
                })}
              </Typography>
            </Box>

          </Grid2>

          <Grid2 size={{ xs: 12, md: 6 }}>
            <Typography variant="h6" gutterBottom>
              {t('settings.loggingSettings')}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="log-level-select-label">{t('settings.logLevel')}</InputLabel>
                <Select
                  labelId="log-level-select-label"
                  name="logLevel"
                  value={settings.logLevel}
                  onChange={handleSelectChange}
                  label={t('settings.logLevel')}
                >
                  <MenuItem value="error">{t('settings.logLevelError')}</MenuItem>
                  <MenuItem value="warn">{t('settings.logLevelWarn')}</MenuItem>
                  <MenuItem value="info">{t('settings.logLevelInfo')}</MenuItem>
                  <MenuItem value="debug">{t('settings.logLevelDebug')}</MenuItem>
                  <MenuItem value="trace">{t('settings.logLevelTrace')}</MenuItem>
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
                label={t('settings.saveLogsToFile')}
              />
            </FormGroup>

            {settings.saveLogsToFile ? (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('settings.openLogsDirectory')}
                </Typography>
                <IconButton
                  onClick={handleOpenLogsDirectory}
                  size="small"
                  color="primary"
                  title={t('settings.openLogsTitle')}
                >
                  <FolderOpenIcon />
                </IconButton>
              </Box>
            ) : null}
          </Grid2>

          <Grid2 size={12}>
            <Typography variant="h6" gutterBottom>
              {t('settings.uiSettings')}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="ui-density-select-label">{t('settings.uiDensity')}</InputLabel>
                <Select
                  labelId="ui-density-select-label"
                  name="uiDensity"
                  value={settings.uiDensity}
                  onChange={handleSelectChange}
                  label={t('settings.uiDensity')}
                >
                  <MenuItem value="compact">{t('settings.densityCompact')}</MenuItem>
                  <MenuItem value="comfortable">{t('settings.densityComfortable')}</MenuItem>
                  <MenuItem value="spacious">{t('settings.densitySpacious')}</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('settings.uiDensityHelper')}
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
                {t('settings.apply')}
              </Button>
            </Box>
          </Grid2>
        </Grid2>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          {t('settings.appInfo')}
        </Typography>

        {appInfo ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                {t('settings.version')}
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                {appInfo.version}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                {t('settings.gitCommit')}
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                {appInfo.git_commit_hash}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                {t('settings.gitBranch')}
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                {appInfo.git_branch}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                {t('settings.buildTime')}
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                {appInfo.build_timestamp}
              </Typography>
            </Box>
            <Divider />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                {t('settings.updateStatus')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {updateInfo ? (
                  updateInfo.available ? (
                    <Typography variant="body2" color="warning.main" fontWeight="medium">
                      {t('settings.updateAvailable', { version: updateInfo.latest_version ?? '' })}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="success.main" fontWeight="medium">
                      {t('settings.latestVersion')}
                    </Typography>
                  )
                ) : updateCheckError ? (
                  <Typography variant="body2" color="textSecondary">
                    {t('settings.updateCheckFailedStatus')}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    {t('settings.checkingUpdates')}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleCheckForUpdates}
                disabled={checkingUpdate}
                startIcon={checkingUpdate ? <CircularProgress size={16} /> : null}
              >
                {checkingUpdate ? t('settings.checkingUpdates') : t('settings.checkForUpdates')}
              </Button>
              {updateInfo?.available ? (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={handleInstallUpdate}
                >
                  {t('settings.installUpdate')}
                </Button>
              ) : null}
            </Box>
          </Box>
        ) : (
          <Typography variant="body1" color="textSecondary">
            {t('settings.loadingAppInfo')}
          </Typography>
        )}
      </Paper>

      <ToastSnackbar toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default Settings;
