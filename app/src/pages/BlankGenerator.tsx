import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { useConnectionSelection } from '../hooks/useConnectionSelection';
import ConnectionSelector from '../components/ConnectionSelector';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import { useToast, ToastSnackbar } from '../hooks/useToast';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const BlankGenerator = () => {
  const { t } = useTranslation();
  const { getVMixInputs, sendVMixFunction } = useVMixStatus();
  const [transparent, setTransparent] = useState(false);
  const [count, setCount] = useState(1);
  const [countError, setCountError] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { toast, showToast, hideToast } = useToast(6000);

  const { selectedConnection, setSelectedConnection, connectedConnections } = useConnectionSelection();

  const handleTransparentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTransparent(event.target.checked);
  };

  const handleCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;

    if (inputValue === '') {
      setCountError(true);
      return;
    }

    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value >= 1 && value <= 50) {
      setCount(value);
      setCountError(false);
    } else {
      setCountError(true);
    }
  };

  const handleGenerate = () => {
    if (selectedConnection === '') {
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmGenerate = async () => {
    if (!selectedConnection) {
      return;
    }

    setShowConfirmDialog(false);
    setGenerating(true);

    try {
      for (let i = 0; i < count; i++) {
        const params = transparent
          ? { Value: 'Colour|Transparent'}
          : { Value: 'Colour|Black'};

        await sendVMixFunction(selectedConnection, 'AddInput', params);
      }

      await getVMixInputs(selectedConnection);

      const bg = transparent ? t('common.transparent') : t('common.black');
      showToast(t('blank.success', { count, plural: count !== 1 ? 's' : '', bg }), 'success');
    } catch (error) {
      console.error('Failed to generate blanks:', error);
      showToast(t('blank.fail', { error: String(error) }), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelGenerate = () => {
    setShowConfirmDialog(false);
  };

  const bgWord = transparent ? t('common.transparent') : t('common.black');

  return (
    <Box sx={{ p: 3 }}>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('blank.title')}
        </Typography>

        <Box sx={{ mb: 3 }}>
          <ConnectionSelector
            selectedConnection={selectedConnection}
            onConnectionChange={setSelectedConnection}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={transparent}
                onChange={handleTransparentChange}
                color="primary"
              />
            }
            label={t('blank.transparent')}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            id="blank-count-input"
            label={t('blank.countLabel')}
            type="number"
            value={count}
            onChange={handleCountChange}
            inputProps={{
              min: 1,
              max: 50,
              step: 1
            }}
            error={countError}
            helperText={countError ? t('blank.countError') : t('blank.countHelper')}
            fullWidth
            variant="outlined"
          />
        </Box>

        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleGenerate}
          disabled={selectedConnection === '' || generating || countError || count < 1 || count > 50}
          startIcon={generating ? <CircularProgress size={20} /> : null}
        >
          {generating ? t('blank.generating') : t('blank.generate')}
        </Button>
      </Paper>

      <Dialog
        open={showConfirmDialog}
        onClose={handleCancelGenerate}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          {t('blank.confirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            {t('blank.confirmBody', { count, bg: bgWord, plural: count !== 1 ? 's' : '' })}
            <br />
            <br />
            <strong>{t('blank.typeLine')}</strong>{' '}
            {transparent ? t('blank.colourTransparent') : t('blank.colourBlack')}
            <br />
            <strong>{t('common.connection')}:</strong>{' '}
            {connectedConnections.find(c => c.host === selectedConnection)?.label}
            <br />
            <strong>{t('common.count')}:</strong> {count}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelGenerate}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirmGenerate} variant="contained" autoFocus>
            {t('blank.generateBtn')}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastSnackbar toast={toast} onClose={hideToast} variant="standard" />
    </Box>
  );
};

export default BlankGenerator;
