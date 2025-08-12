import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useMediaQuery } from '@mui/material';

// Theme mode types matching Rust backend
export type ThemeMode = 'Light' | 'Dark' | 'Auto';
export type ResolvedTheme = 'light' | 'dark';

interface AppSettings {
  default_vmix_ip: string;
  default_vmix_port: number;
  refresh_interval: number;
  theme: ThemeMode;
  auto_reconnect: boolean;
  auto_reconnect_interval: number;
  max_log_file_size: number;
}

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('Auto');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [isLoading, setIsLoading] = useState(true);
  
  // Detect system theme preference using CSS media query
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  
  // Function to resolve theme based on mode and system preference
  const resolveTheme = useCallback((mode: ThemeMode, systemDark: boolean): ResolvedTheme => {
    switch (mode) {
      case 'Light':
        return 'light';
      case 'Dark':
        return 'dark';
      case 'Auto':
        return systemDark ? 'dark' : 'light';
      default:
        return 'light';
    }
  }, []);

  // Load initial theme setting from backend
  const loadThemeSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const settings = await invoke<AppSettings>('get_app_settings');
      setThemeModeState(settings.theme);
      
      const resolved = resolveTheme(settings.theme, prefersDarkMode);
      setResolvedTheme(resolved);
      
      // Set initial document theme
      document.documentElement.setAttribute('data-theme', resolved);
    } catch (error) {
      console.error('Failed to load theme settings:', error);
      // Fallback to Auto mode
      setThemeModeState('Auto');
      const fallbackTheme = resolveTheme('Auto', prefersDarkMode);
      setResolvedTheme(fallbackTheme);
      document.documentElement.setAttribute('data-theme', fallbackTheme);
    } finally {
      setIsLoading(false);
    }
  }, [prefersDarkMode, resolveTheme]);

  // Save theme setting to backend
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      // First get current settings
      const currentSettings = await invoke<AppSettings>('get_app_settings');
      
      // Update theme mode
      const updatedSettings: AppSettings = {
        ...currentSettings,
        theme: mode,
      };
      
      // Save to backend
      await invoke('save_app_settings', { settings: updatedSettings });
      
      // Update local state
      setThemeModeState(mode);
      const resolved = resolveTheme(mode, prefersDarkMode);
      setResolvedTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    } catch (error) {
      console.error('Failed to save theme settings:', error);
      throw error;
    }
  }, [prefersDarkMode, resolveTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (themeMode === 'Auto') {
      const resolved = resolveTheme('Auto', prefersDarkMode);
      setResolvedTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }, [prefersDarkMode, themeMode, resolveTheme]);

  // Listen for Tauri window theme changes (if supported)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupTauriThemeListener = async () => {
      try {
        // Try to get initial theme from Tauri
        const tauriTheme = await getCurrentWindow().theme();
        console.log('Tauri theme detected:', tauriTheme);

        // Listen for theme changes
        unlisten = await getCurrentWindow().onThemeChanged(({ payload: theme }) => {
          console.log('Tauri theme changed to:', theme);
          if (themeMode === 'Auto') {
            const systemDark = theme === 'dark';
            const newTheme = systemDark ? 'dark' : 'light';
            setResolvedTheme(newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
          }
        });
      } catch (error) {
        // Tauri theme API might not be available on all platforms
        console.log('Tauri theme API not available:', error);
      }
    };

    setupTauriThemeListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [themeMode]);

  // Initial load
  useEffect(() => {
    loadThemeSettings();
  }, [loadThemeSettings]);

  const contextValue: ThemeContextType = {
    themeMode,
    resolvedTheme,
    setThemeMode,
    isLoading,
  };

  return React.createElement(ThemeContext.Provider, { value: contextValue }, children);
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};