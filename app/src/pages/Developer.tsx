import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid2 from '@mui/material/Grid2';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import Typography from '@mui/material/Typography';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import FavoriteOutlinedIcon from '@mui/icons-material/FavoriteOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import PublicIcon from '@mui/icons-material/Public';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation, Trans } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import licenseText from 'virtual:app-license';

const TwitchIcon = (props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M3 0 0 4v17h6v3h3l3-3h5l7-7V0H3zm18 11-3 3h-5l-3 3v-3H5V2h16v9zm-9-5h2v5h-2V6zm5 0h2v5h-2V6z" />
  </SvgIcon>
);

const DiscordIcon = (props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </SvgIcon>
);

const Developer = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const repositoryUrl = 'https://github.com/MikanseiLaboratory/vmix-utility';
  const developerGitHub = 'https://github.com/MikanseiLaboratory';
  const mikanseiLaboratoryUrl = 'https://mikanseilaboratory.github.io/';
  const twitchSupportUrl = 'https://subs.twitch.tv/flowingspdg';
  const discordInviteUrl = 'https://discord.gg/YUbmg9Hq37';

  const openInBrowser = (url: string) => {
    openUrl(url);
  };

  return (
    <Box sx={{ p: 3 }}>

      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card elevation={3} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                  <GitHubIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="h2">
                    {t('developer.repository')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('developer.openSource')}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('developer.repoBody')}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={t('developer.licenseChip')} variant="outlined" size="small" />
                <Chip label="TypeScript" variant="outlined" size="small" />
                <Chip label="React" variant="outlined" size="small" />
                <Chip label="Tauri" variant="outlined" size="small" />
                <Chip label="Rust" variant="outlined" size="small" />
              </Box>

              <Button
                variant="contained"
                startIcon={<GitHubIcon />}
                onClick={() => openInBrowser(repositoryUrl)}
                fullWidth
              >
                {t('developer.viewGithub')}
              </Button>
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card elevation={3} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                  <CodeIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="h2">
                    {t('developer.orgTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('developer.orgSubtitle')}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('developer.orgBody')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<PublicIcon />}
                  onClick={() => openInBrowser(mikanseiLaboratoryUrl)}
                  fullWidth
                >
                  {t('developer.officialSite')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<GitHubIcon />}
                  onClick={() => openInBrowser(developerGitHub)}
                  fullWidth
                >
                  {t('developer.visitOrgGithub')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={12}>
          <Card elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FavoriteOutlinedIcon sx={{ mr: 1, color: 'error.main' }} />
                <Typography variant="h6" component="h2">
                  {t('developer.supportTitle')}
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('developer.supportBody')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <Trans i18nKey="developer.supportTip" components={{ strong: <strong /> }} />
              </Typography>

              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: '#9146FF',
                    '&:hover': { backgroundColor: '#772CE8' },
                    height: '56px',
                    fontSize: '1.1rem',
                  }}
                  startIcon={<TwitchIcon />}
                  onClick={() => openInBrowser(twitchSupportUrl)}
                  fullWidth
                >
                  {t('developer.subscribeTwitch')}
                </Button>
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: '#5865F2',
                    '&:hover': { backgroundColor: '#4752C4' },
                    height: '56px',
                    fontSize: '1.1rem',
                  }}
                  startIcon={<DiscordIcon />}
                  onClick={() => openInBrowser(discordInviteUrl)}
                  fullWidth
                >
                  {t('developer.joinDiscord')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DescriptionIcon sx={{ mr: 1 }} />
              <Typography variant="h6" component="h2">
                {t('developer.licenseTitle')}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('developer.licenseBody')}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{
              bgcolor: resolvedTheme === 'dark' ? 'grey.800' : 'grey.50',
              p: 2,
              borderRadius: 1,
              maxHeight: 360,
              overflow: 'auto',
            }}>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  m: 0,
                }}
              >
                {licenseText.trim()}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('developer.licenseMore')}{' '}
              <Link
                component="button"
                onClick={() => openInBrowser(`${repositoryUrl}/blob/master/LICENSE`)}
                sx={{ textDecoration: 'underline', cursor: 'pointer' }}
              >
                {t('developer.licenseFile')}
              </Link>{' '}
              {t('developer.licenseInRepo')}
            </Typography>
          </Paper>
        </Grid2>

        <Grid2 size={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('developer.specialThanks')}
            </Typography>

            <List>
              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <CodeIcon />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser('https://github.com/FlowingSPDG')}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Shugo &quot;FlowingSPDG&quot; Kawamura
                    </Link>
                  }
                  secondary={t('developer.thanksFlowingSecondary')}
                />
              </ListItem>
              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <CodeIcon />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser('https://x.com/guleruun')}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      GuleruuN
                    </Link>
                  }
                  secondary={t('developer.thanksGulerSecondary')}
                />
              </ListItem>
            </List>
          </Paper>
        </Grid2>

        <Grid2 size={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('developer.usefulLinks')}
            </Typography>

            <List>
              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <GitHubIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser(`${repositoryUrl}/issues`)}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {t('developer.reportIssues')}
                    </Link>
                  }
                  secondary={t('developer.reportIssuesSecondary')}
                />
              </ListItem>

              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <DiscordIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser(discordInviteUrl)}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {t('developer.joinDiscord')}
                    </Link>
                  }
                  secondary={t('developer.discordInviteSecondary')}
                />
              </ListItem>

              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser(`${repositoryUrl}`)}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {t('developer.documentation')}
                    </Link>
                  }
                  secondary={t('developer.documentationSecondary')}
                />
              </ListItem>

              <ListItem sx={{ pl: 0 }}>
                <ListItemIcon>
                  <CodeIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      component="button"
                      onClick={() => openInBrowser(`${repositoryUrl}/pulls`)}
                      sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {t('developer.contribute')}
                    </Link>
                  }
                  secondary={t('developer.contributeSecondary')}
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
