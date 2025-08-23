import { createContext, useContext, ReactNode } from 'react';

interface NavigationContextType {
  navigateToSettings: () => void;
  navigateToPage: (pageIndex: number) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export interface NavigationProviderProps {
  children: ReactNode;
  navigateToSettings: () => void;
  navigateToPage: (pageIndex: number) => void;
}

export const NavigationProvider = ({ children, navigateToSettings, navigateToPage }: NavigationProviderProps) => {
  return (
    <NavigationContext.Provider value={{ navigateToSettings, navigateToPage }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};