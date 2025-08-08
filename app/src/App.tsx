import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import { VMixStatusProvider } from './hooks/useVMixStatus';
import "./App.css";

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <VMixStatusProvider>
        <Layout />
      </VMixStatusProvider>
    </ThemeProvider>
  );
}

export default App;
