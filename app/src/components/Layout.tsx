import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type LazyExoticComponent, type ComponentType, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import MenuIcon from '@mui/icons-material/Menu';
import LinkIcon from '@mui/icons-material/Link';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import CreateIcon from '@mui/icons-material/Create';
import ViewListIcon from '@mui/icons-material/ViewList';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import SettingsIcon from '@mui/icons-material/Settings';
import CodeIcon from '@mui/icons-material/Code';

const pageModules = {
  connections: () => import('../pages/Connections'),
  shortcutGenerator: () => import('../pages/ShortcutGenerator'),
  blankGenerator: () => import('../pages/BlankGenerator'),
  inputManager: () => import('../pages/InputManager'),
  listManager: () => import('../pages/ListManager'),
  settings: () => import('../pages/Settings'),
  developer: () => import('../pages/Developer'),
} as const;

const Connections = lazy(pageModules.connections);
const ShortcutGenerator = lazy(pageModules.shortcutGenerator);
const BlankGenerator = lazy(pageModules.blankGenerator);
const InputManager = lazy(pageModules.inputManager);
const ListManager = lazy(pageModules.listManager);
const Settings = lazy(pageModules.settings);
const Developer = lazy(pageModules.developer);

const drawerWidth = 240;

interface NavItem {
  text: string;
  icon: ReactElement;
  Page: LazyExoticComponent<ComponentType>;
  preload: () => Promise<unknown>;
}

const Layout = () => {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visitedPages, setVisitedPages] = useState<Set<number>>(() => new Set([0]));

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDesktopOpen(!desktopOpen);
    }
  };

  const preloadPage = useCallback((preload: () => Promise<unknown>) => {
    void preload();
  }, []);

  const navItems: NavItem[] = useMemo(() => [
    {
      text: t('layout.nav.connections'),
      icon: <LinkIcon />,
      Page: Connections,
      preload: pageModules.connections,
    },
    {
      text: t('layout.nav.shortcutGenerator'),
      icon: <ShortcutIcon />,
      Page: ShortcutGenerator,
      preload: pageModules.shortcutGenerator,
    },
    {
      text: t('layout.nav.blankGenerator'),
      icon: <CreateIcon />,
      Page: BlankGenerator,
      preload: pageModules.blankGenerator,
    },
    {
      text: t('layout.nav.inputManager'),
      icon: <ViewListIcon />,
      Page: InputManager,
      preload: pageModules.inputManager,
    },
    {
      text: t('layout.nav.listManager'),
      icon: <PlaylistPlayIcon />,
      Page: ListManager,
      preload: pageModules.listManager,
    },
    {
      text: t('layout.nav.settings'),
      icon: <SettingsIcon />,
      Page: Settings,
      preload: pageModules.settings,
    },
    {
      text: t('layout.nav.about'),
      icon: <CodeIcon />,
      Page: Developer,
      preload: pageModules.developer,
    },
  ], [t]);

  useEffect(() => {
    setVisitedPages(prev => {
      if (prev.has(selectedIndex)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(selectedIndex);
      return next;
    });
  }, [selectedIndex]);

  const pageFallback = (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
      <CircularProgress aria-label={t('app.loadingTheme')} />
    </Box>
  );

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          {t('layout.appTitle')}
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {navItems.map((item, index) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={selectedIndex === index}
              onClick={() => {
                setSelectedIndex(index);
                if (isMobile) {
                  setMobileOpen(false);
                }
              }}
              onMouseEnter={() => preloadPage(item.preload)}
              onFocus={() => preloadPage(item.preload)}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${desktopOpen ? drawerWidth : 0}px)` },
          ml: { sm: `${desktopOpen ? drawerWidth : 0}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label={t('layout.toggleDrawer')}
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: desktopOpen ? drawerWidth : 0 }, flexShrink: { sm: 0 } }}
        aria-label="navigation"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="persistent"
          open={desktopOpen}
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${desktopOpen ? drawerWidth : 0}px)` },
          marginTop: '64px',
          height: 'calc(100vh - 64px)',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {navItems.map((item, index) => (
          visitedPages.has(index) ? (
            <Box
              key={item.text}
              sx={{
                display: selectedIndex === index ? 'block' : 'none',
                height: '100%',
                overflow: 'auto',
              }}
            >
              <Suspense fallback={pageFallback}>
                <item.Page />
              </Suspense>
            </Box>
          ) : null
        ))}
      </Box>
    </Box>
  );
};

export default Layout;
