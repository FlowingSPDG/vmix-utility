import {
  Box,
  Typography,
  Paper,
  Grid2,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
  Link,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  GitHub,
  Code,
  FavoriteOutlined,
  Description,
  Star,
} from '@mui/icons-material';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useTheme } from '../hooks/useTheme';

const Developer = () => {
  const { resolvedTheme } = useTheme();
  const repositoryUrl = 'https://github.com/FlowingSPDG/vmix-utility';
  const developerGitHub = 'https://github.com/FlowingSPDG';
  const sponsorUrl = 'https://github.com/sponsors/FlowingSPDG';
  const fanboxUrl = 'https://flowingspdg.fanbox.cc/';

  const openInBrowser = (url: string) => {
    openUrl(url);
  };


  return (
    <Box sx={{ p: 3 }}>

      <Grid2 container spacing={3}>
        {/* Repository Information */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card elevation={3} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                  <GitHub />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="h2">
                    Repository
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Open Source Project
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                This project is open source and available on GitHub.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label="MIT License" variant="outlined" size="small" />
                <Chip label="TypeScript" variant="outlined" size="small" />
                <Chip label="React" variant="outlined" size="small" />
                <Chip label="Tauri" variant="outlined" size="small" />
                <Chip label="Rust" variant="outlined" size="small" />
              </Box>
              
              <Button
                variant="contained"
                startIcon={<GitHub />}
                onClick={() => openInBrowser(repositoryUrl)}
                fullWidth
              >
                View on GitHub
              </Button>
            </CardContent>
          </Card>
        </Grid2>

        {/* Developer Information */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card elevation={3} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                  <Code />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="h2">
                    Shugo "FlowingSPDG" Kawamura
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Developer & Maintainer
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" gutterBottom>
                Creator and main developer of vmix-utility. Passionate about broadcasting technology and creating tools to enhance live streaming workflows.
              </Typography>
              
              <Button
                variant="outlined"
                startIcon={<GitHub />}
                onClick={() => openInBrowser(developerGitHub)}
                fullWidth
                sx={{ mt: 2 }}
              >
                Visit GitHub Profile
              </Button>
            </CardContent>
          </Card>
        </Grid2>

        {/* Support & Donations */}
        <Grid2 size={12}>
          <Card elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FavoriteOutlined sx={{ mr: 1, color: 'error.main' }} />
                <Typography variant="h6" component="h2">
                  Support the Project
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                If you find this project helpful, consider supporting its development!
              </Typography>
              
              <Grid2 container spacing={2} sx={{ mt: 1 }}>
                <Grid2 size={{ xs: 12, sm: 4 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<Star />}
                    onClick={() => openInBrowser(repositoryUrl)}
                    fullWidth
                  >
                    Star on GitHub
                  </Button>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 4 }}>
                  <Button
                    variant="contained"
                    sx={{ 
                      backgroundColor: '#13C3FF',
                      '&:hover': { backgroundColor: '#0FA8CC' }
                    }}
                    startIcon={<FavoriteOutlined />}
                    onClick={() => openInBrowser(sponsorUrl)}
                    fullWidth
                  >
                    GitHub Sponsors
                  </Button>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 4 }}>
                  <Button
                    variant="contained"
                    sx={{ 
                      backgroundColor: '#0096FA',
                      '&:hover': { backgroundColor: '#0078CC' }
                    }}
                    startIcon={<FavoriteOutlined />}
                    onClick={() => openInBrowser(fanboxUrl)}
                    fullWidth
                  >
                    Support on FANBOX
                  </Button>
                </Grid2>
              </Grid2>
            </CardContent>
          </Card>
        </Grid2>

        {/* License Information */}
        <Grid2 size={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Description sx={{ mr: 1 }} />
              <Typography variant="h6" component="h2">
                License
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This project is licensed under the MIT License.
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ 
              bgcolor: resolvedTheme === 'dark' ? 'grey.800' : 'grey.50', 
              p: 2, 
              borderRadius: 1 
            }}>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {`MIT License

Copyright (c) 2020 Shugo Kawamura

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              For more information, see the{' '}
              <Link
                component="button"
                onClick={() => openInBrowser(`${repositoryUrl}/blob/master/LICENSE`)}
                sx={{ textDecoration: 'underline', cursor: 'pointer' }}
              >
                LICENSE file
              </Link>{' '}
              in the repository.
            </Typography>
          </Paper>
        </Grid2>

        {/* Additional Links */}
        <Grid2 size={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Useful Links
            </Typography>
            
            <List>
              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <GitHub />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser(`${repositoryUrl}/issues`)}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Report Issues
                    </Link>
                  }
                  secondary="Found a bug or have a feature request?"
                />
              </ListItem>
              
              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <Description />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser(`${repositoryUrl}/wiki`)}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Documentation
                    </Link>
                  }
                  secondary="Learn more about using vmix-utility"
                />
              </ListItem>
              
              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <Code />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser(`${repositoryUrl}/pulls`)}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Contribute
                    </Link>
                  }
                  secondary="Help improve the project with pull requests"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid2>
      </Grid2>
    </Box>
  );
};

export default Developer;