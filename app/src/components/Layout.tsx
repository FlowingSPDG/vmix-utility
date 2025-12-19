import { useState } from 'react';
import { 
  Box, 
  Drawer, 
  AppBar, 
  Toolbar, 
  Typography, 
  Divider, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText,
  IconButton,
  CssBaseline,
  useTheme,
  useMediaQuery
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LinkIcon from '@mui/icons-material/Link';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import CreateIcon from '@mui/icons-material/Create';
import ViewListIcon from '@mui/icons-material/ViewList';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import SettingsIcon from '@mui/icons-material/Settings';
import CodeIcon from '@mui/icons-material/Code';

import Connections from '../pages/Connections';
import ShortcutGenerator from '../pages/ShortcutGenerator';
import BlankGenerator from '../pages/BlankGenerator';
import InputManager from '../pages/InputManager';
import ListManager from '../pages/ListManager';
import Settings from '../pages/Settings';
import Developer from '../pages/Developer';

const drawerWidth = 240;

interface NavItem {
  text: string;
  icon: JSX.Element;
  component: JSX.Element;
}

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDesktopOpen(!desktopOpen);
    }
  };

  const navItems: NavItem[] = [
    { 
      text: 'Connections', 
      icon: <LinkIcon />, 
      component: <Connections /> 
    },
    { 
      text: 'Shortcut Generator', 
      icon: <ShortcutIcon />, 
      component: <ShortcutGenerator /> 
    },
    { 
      text: 'Blank Generator', 
      icon: <CreateIcon />, 
      component: <BlankGenerator /> 
    },
    { 
      text: 'Input Manager', 
      icon: <ViewListIcon />, 
      component: <InputManager /> 
    },
    { 
      text: 'List Manager', 
      icon: <PlaylistPlayIcon />, 
      component: <ListManager /> 
    },
    { 
      text: 'Settings', 
      icon: <SettingsIcon />, 
      component: <Settings /> 
    },
    { 
      text: 'Developer', 
      icon: <CodeIcon />, 
      component: <Developer /> 
    },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          vMix Utility
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
            aria-label="toggle drawer"
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
          overflow: 'auto',
          boxSizing: 'border-box'
        }}
      >
        {navItems[selectedIndex].component}
      </Box>
    </Box>
  );
};

export default Layout;
