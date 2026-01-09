import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  Grid2,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { settingsService, type LogEntry } from '../services/settingsService';

type LogType = 'app' | 'http_server';
type SortOrder = 'asc' | 'desc';
type SortField = 'timestamp' | 'level' | 'message';

const Logs = () => {
  const [logType, setLogType] = useState<LogType>('app');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [limit, setLimit] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const logEndRef = useRef<HTMLDivElement>(null);

  const loadLogs = useRef(async () => {
    setLoading(true);
    setError(null);
    try {
      const logData = logType === 'app'
        ? await settingsService.getAppLogs(limit, filter || undefined, levelFilter === 'all' ? undefined : levelFilter)
        : await settingsService.getHttpServerLogs(limit, filter || undefined, levelFilter === 'all' ? undefined : levelFilter);
      setLogs(logData);
      // Scroll to top after loading (since we sort newest first by default)
      setTimeout(() => {
        if (logEndRef.current) {
          logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  });

  // Update loadLogs function when dependencies change
  useEffect(() => {
    loadLogs.current = async () => {
      setLoading(true);
      setError(null);
      try {
        const logData = logType === 'app'
          ? await settingsService.getAppLogs(limit, filter || undefined, levelFilter === 'all' ? undefined : levelFilter)
          : await settingsService.getHttpServerLogs(limit, filter || undefined, levelFilter === 'all' ? undefined : levelFilter);
        setLogs(logData);
        setTimeout(() => {
          if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load logs');
        console.error('Failed to load logs:', err);
      } finally {
        setLoading(false);
      }
    };
  }, [logType, filter, levelFilter, limit]);

  useEffect(() => {
    if (autoRefresh) {
      // Initial load
      loadLogs.current();
      
      // Set up auto-refresh
      const interval = setInterval(() => {
        loadLogs.current();
      }, 1000); // Refresh every 1 second

      return () => clearInterval(interval);
    } else {
      // Manual refresh only
      loadLogs.current();
    }
  }, [autoRefresh, logType, filter, levelFilter, limit]);

  // Sort and filter logs based on current settings
  const sortedLogs = useMemo(() => {
    let filtered = [...logs];
    
    // Apply level filter (client-side as backup, though server-side also does it)
    if (levelFilter && levelFilter !== 'all') {
      filtered = filtered.filter(e => e.level.toLowerCase() === levelFilter.toLowerCase());
    }
    
    // Apply text filter (client-side as backup, though server-side also does it)
    if (filter) {
      const filterLower = filter.toLowerCase();
      filtered = filtered.filter(e => 
        e.message.toLowerCase().includes(filterLower) ||
        e.module?.toLowerCase().includes(filterLower)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'timestamp':
          comparison = a.timestamp.localeCompare(b.timestamp);
          break;
        case 'level':
          comparison = a.level.localeCompare(b.level);
          break;
        case 'message':
          comparison = a.message.localeCompare(b.message);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [logs, sortField, sortOrder, filter, levelFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getLevelColor = (level: string) => {
    const levelLower = level.toLowerCase();
    if (levelLower.includes('error')) return 'error';
    if (levelLower.includes('warn')) return 'warning';
    if (levelLower.includes('info')) return 'info';
    if (levelLower.includes('debug')) return 'default';
    return 'default';
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });
    } catch {
      return timestamp;
    }
  };

  const handleLogTypeChange = (newType: LogType) => {
    setLogType(newType);
    setLogs([]);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Logs Viewer
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Grid2 container spacing={2} sx={{ mb: 3 }}>
          <Grid2 size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel id="log-type-label">Log Type</InputLabel>
              <Select
                labelId="log-type-label"
                value={logType}
                onChange={(e) => handleLogTypeChange(e.target.value as LogType)}
                label="Log Type"
              >
                <MenuItem value="app">Application Logs</MenuItem>
                <MenuItem value="http_server">HTTP Server Logs</MenuItem>
              </Select>
            </FormControl>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="level-filter-label">Level</InputLabel>
              <Select
                labelId="level-filter-label"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                label="Level"
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="debug">Debug</MenuItem>
              </Select>
            </FormControl>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by text..."
              helperText="Filter by message or module"
            />
          </Grid2>

          <Grid2 size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              label="Limit"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              inputProps={{ min: 10, max: 1000, step: 10 }}
            />
          </Grid2>

          <Grid2 size={{ xs: 12, md: 2 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={() => loadLogs.current()}
              disabled={loading}
              sx={{ height: '56px' }}
            >
              Refresh
            </Button>
          </Grid2>
        </Grid2>

        <FormGroup sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => {
                  setAutoRefresh(e.target.checked);
                  if (e.target.checked) {
                    loadLogs.current();
                  }
                }}
              />
            }
            label="Auto-refresh (every 1 second)"
          />
        </FormGroup>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            maxHeight: '60vh',
            overflow: 'auto',
          }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Timestamp
                    <Tooltip title={sortField === 'timestamp' ? `Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}` : 'Sort by Timestamp'}>
                      <IconButton size="small" onClick={() => handleSort('timestamp')}>
                        {sortField === 'timestamp' ? (
                          sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                        ) : (
                          <ArrowDownwardIcon fontSize="small" color="disabled" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Level
                    <Tooltip title={sortField === 'level' ? `Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}` : 'Sort by Level'}>
                      <IconButton size="small" onClick={() => handleSort('level')}>
                        {sortField === 'level' ? (
                          sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                        ) : (
                          <ArrowDownwardIcon fontSize="small" color="disabled" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Message
                    <Tooltip title={sortField === 'message' ? `Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}` : 'Sort by Message'}>
                      <IconButton size="small" onClick={() => handleSort('message')}>
                        {sortField === 'message' ? (
                          sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                        ) : (
                          <ArrowDownwardIcon fontSize="small" color="disabled" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>Module</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && sortedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : sortedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No logs available
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedLogs.map((log, index) => (
                  <TableRow key={index} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.level}
                        color={getLevelColor(log.level) as any}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell sx={{ wordBreak: 'break-word', maxWidth: '500px' }}>
                      {log.message}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                      {log.module || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
              <div ref={logEndRef} />
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Showing {sortedLogs.length} log entries
          {filter && ` filtered by "${filter}"`}
          {levelFilter !== 'all' && ` (level: ${levelFilter})`}
        </Typography>
      </Paper>
    </Box>
  );
};

export default Logs;

