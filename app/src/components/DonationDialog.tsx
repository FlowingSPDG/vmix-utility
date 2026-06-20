import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import Typography from '@mui/material/Typography';
import FavoriteOutlinedIcon from '@mui/icons-material/FavoriteOutlined';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';

const TwitchIcon = (props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M3 0 0 4v17h6v3h3l3-3h5l7-7V0H3zm18 11-3 3h-5l-3 3v-3H5V2h16v9zm-9-5h2v5h-2V6zm5 0h2v5h-2V6z" />
  </SvgIcon>
);

interface DonationDialogProps {
  open: boolean;
  onClose: (permanently: boolean) => void;
}

const DonationDialog = ({ open, onClose }: DonationDialogProps) => {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const openInBrowser = (url: string) => {
    openUrl(url);
  };

  const handleClose = () => {
    onClose(dontShowAgain);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FavoriteOutlinedIcon color="error" />
          <span>{t('donation.title')}</span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" gutterBottom>
          {t('donation.thanks')}
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          {t('donation.body1')}
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          <Trans
            i18nKey="donation.body2"
            components={{ strong: <strong /> }}
          />
        </Typography>

        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            sx={{
              backgroundColor: '#9146FF',
              '&:hover': { backgroundColor: '#772CE8' },
              height: '56px',
              fontSize: '1.1rem',
            }}
            startIcon={<TwitchIcon />}
            onClick={() => openInBrowser('https://subs.twitch.tv/flowingspdg')}
            fullWidth
          >
            {t('donation.subscribe')}
          </Button>
        </Box>

        <Box sx={{ mt: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                {t('donation.dontShowAgain')}
              </Typography>
            }
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {t('donation.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DonationDialog;
