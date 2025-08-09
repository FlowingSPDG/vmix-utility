import {
  Box,
  Typography,
  Paper,
  Grid,
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
  CoffeeOutlined,
  Description,
  Star,
} from '@mui/icons-material';

const Developer = () => {
  const repositoryUrl = 'https://github.com/FlowingSPDG/vmix-utility';
  const developerGitHub = 'https://github.com/FlowingSPDG';
  const sponsorUrl = 'https://github.com/sponsors/FlowingSPDG';
  const koFiUrl = 'https://ko-fi.com/flowingpsdg';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Developer
      </Typography>

      <Grid container spacing={3}>
        {/* Repository Information */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <GitHub sx={{ mr: 1 }} />
                <Typography variant="h6" component="h2">
                  Repository
                </Typography>
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
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                fullWidth
              >
                View on GitHub
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Developer Information */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
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
                href={developerGitHub}
                target="_blank"
                rel="noopener noreferrer"
                fullWidth
                sx={{ mt: 2 }}
              >
                Visit GitHub Profile
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Support & Donations */}
        <Grid item xs={12}>
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
              
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<Star />}
                    href={repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    fullWidth
                  >
                    Star on GitHub
                  </Button>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="contained"
                    sx={{ 
                      backgroundColor: '#13C3FF',
                      '&:hover': { backgroundColor: '#0FA8CC' }
                    }}
                    startIcon={<FavoriteOutlined />}
                    href={sponsorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    fullWidth
                  >
                    GitHub Sponsors
                  </Button>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="contained"
                    sx={{ 
                      backgroundColor: '#FF5E5B',
                      '&:hover': { backgroundColor: '#E54B47' }
                    }}
                    startIcon={<CoffeeOutlined />}
                    href={koFiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    fullWidth
                  >
                    Buy me a coffee
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* License Information */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Description sx={{ mr: 1 }} />
              <Typography variant="h6" component="h2">
                License
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              This project is licensed under the MIT License.
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
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
                href={`${repositoryUrl}/blob/master/LICENSE`}
                target="_blank"
                rel="noopener noreferrer"
              >
                LICENSE file
              </Link>{' '}
              in the repository.
            </Typography>
          </Paper>
        </Grid>

        {/* Additional Links */}
        <Grid item xs={12}>
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
                      href={`${repositoryUrl}/issues`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                      href={`${repositoryUrl}/wiki`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                      href={`${repositoryUrl}/pulls`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Contribute
                    </Link>
                  }
                  secondary="Help improve the project with pull requests"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Developer;