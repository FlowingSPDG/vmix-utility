import React, { useState, useEffect, createContext, useContext } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type UIDensity = 'compact' | 'comfortable' | 'spacious';

interface UISettingsContextType {
  uiDensity: UIDensity;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const UISettingsContext = createContext<UISettingsContextType | undefined>(undefined);

export const UISettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [uiDensity, setUiDensity] = useState<UIDensity>('comfortable');
  const [isLoading, setIsLoading] = useState(true);


  // Load UI settings from backend
  const loadUISettings = async () => {
    try {
      setIsLoading(true);
      const appSettings = await invoke('get_app_settings');
      if (appSettings) {
        const settings = appSettings as any;
        setUiDensity(settings.ui_density ?? 'comfortable');
      }
    } catch (error) {
      console.error('Failed to load UI settings:', error);
      // Use defaults
      setUiDensity('comfortable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUISettings();
  }, []);

  const contextValue: UISettingsContextType = {
    uiDensity,
    isLoading,
    refreshSettings: loadUISettings,
  };

  return <UISettingsContext.Provider value={contextValue}>{children}</UISettingsContext.Provider>;
};

export const useUISettings = (): UISettingsContextType => {
  const context = useContext(UISettingsContext);
  if (!context) {
    throw new Error('useUISettings must be used within a UISettingsProvider');
  }
  return context;
};

// Utility function to get density-based spacing values
export const getDensitySpacing = (density: UIDensity) => {
  switch (density) {
    case 'compact':
      return {
        cardPadding: 0.5,
        listItemPadding: 0.25,
        chipSize: 'small' as const,
        iconSize: 'small' as const,
        fontSize: '0.75rem',
        lineHeight: 1.2,
        headerVariant: 'body2' as const,
        spacing: 0.25,
        itemHeight: 32,
        tableCellPadding: '4px 8px',
        buttonSize: 'small' as const,
      };
    case 'spacious':
      return {
        cardPadding: 2,
        listItemPadding: 1.5,
        chipSize: 'medium' as const,
        iconSize: 'medium' as const,
        fontSize: '0.875rem',
        lineHeight: 1.6,
        headerVariant: 'h6' as const,
        spacing: 1.5,
        itemHeight: 48,
        tableCellPadding: '16px',
        buttonSize: 'medium' as const,
      };
    default: // comfortable
      return {
        cardPadding: 1,
        listItemPadding: 0.5,
        chipSize: 'small' as const,
        iconSize: 'small' as const,
        fontSize: '0.75rem',
        lineHeight: 1.2,
        headerVariant: 'body1' as const,
        spacing: 0.5,
        itemHeight: 32,
        tableCellPadding: '8px 16px',
        buttonSize: 'small' as const,
      };
  }
};