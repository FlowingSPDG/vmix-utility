import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useMemo } from 'react';
import Layout from './components/Layout';
import { VMixStatusProvider } from './hooks/useVMixStatus';
import { ThemeProvider as CustomThemeProvider, useTheme } from './hooks/useTheme';
import "./App.css";

function AppContent() {
  const { resolvedTheme, isLoading } = useTheme();

  const theme = useMemo(() => createTheme({
    palette: {
      mode: resolvedTheme,
      primary: {
        main: resolvedTheme === 'dark' ? '#90caf9' : '#1976d2',
      },
      secondary: {
        main: resolvedTheme === 'dark' ? '#f48fb1' : '#dc004e',
      },
    },
  }), [resolvedTheme]);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading theme...
      </div>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <VMixStatusProvider>
        <Layout />
      </VMixStatusProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <CustomThemeProvider>
      <AppContent />
    </CustomThemeProvider>
  );
}

export default App;
