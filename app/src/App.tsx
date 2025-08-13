import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useMemo, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import Layout from './components/Layout';
import ListManager from './pages/ListManager';
import SingleVideoList from './pages/SingleVideoList';
import { VMixStatusProvider } from './hooks/useVMixStatus';
import { ThemeProvider as CustomThemeProvider, useTheme } from './hooks/useTheme';
import "./App.css";

function AppContent() {
  const { resolvedTheme, isLoading } = useTheme();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

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

  // Listen for path changes (for popup windows)
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    // Listen for popstate events (back/forward buttons)
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

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

  const renderContent = () => {
    if (currentPath === '/list-manager') {
      // Check if this is a single VideoList popup or full List Manager
      const urlParams = new URLSearchParams(window.location.search);
      const host = urlParams.get('host');
      const listKey = urlParams.get('listKey');
      
      if (host && listKey) {
        // Single VideoList popup window
        return <SingleVideoList host={host} listKey={listKey} />;
      } else {
        // Full List Manager popup window
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
              List Manager
            </Typography>
            <ListManager />
          </Box>
        );
      }
    }
    
    // Default main application layout
    return <Layout />;
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <VMixStatusProvider>
        {renderContent()}
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
