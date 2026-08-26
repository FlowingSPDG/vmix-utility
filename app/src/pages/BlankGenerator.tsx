import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVMixStatus } from '../hooks/useVMixStatus';
import { useConnectionSelection } from '../hooks/useConnectionSelection';
import ConnectionSelector from '../components/ConnectionSelector';
import Alert from '@mui/material/Alert';
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

const MIN_BLANK_COUNT = 1;
const MAX_TOTAL_INPUTS = 999;

const BlankGenerationWarnings = () => {
  const { t } = useTranslation();

  return (
    <Box component="ul" sx={{ m: 0, pl: 2 }}>
      <li>{t('blank.warningUnresponsive')}</li>
      <li>{t('blank.warningCrashLimit')}</li>
      <li>{t('blank.warningCountMismatch')}</li>
    </Box>
  );
};

const BlankGenerator = () => {
  const { t } = useTranslation();
  const { getVMixInputs, sendVMixFunction, inputs } = useVMixStatus();
  const [transparent, setTransparent] = useState(false);
  const [count, setCount] = useState(MIN_BLANK_COUNT);
  const [countError, setCountError] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { toast, showToast, hideToast } = useToast(6000);

  const { selectedConnection, setSelectedConnection, connectedConnections } = useConnectionSelection();
  const currentInputCount = selectedConnection ? (inputs[selectedConnection]?.length ?? 0) : 0;
  const maxGeneratable = Math.max(0, MAX_TOTAL_INPUTS - currentInputCount);
  const countOutOfRange = maxGeneratable < MIN_BLANK_COUNT || count < MIN_BLANK_COUNT || count > maxGeneratable;
  const hasCountError = countError || countOutOfRange;

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
    if (!isNaN(value) && value >= MIN_BLANK_COUNT && value <= maxGeneratable) {
      setCount(value);
      setCountError(false);
    } else {
      setCountError(true);
    }
  };

  const handleGenerate = () => {
    if (selectedConnection === '' || hasCountError) {
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmGenerate = async () => {
    if (!selectedConnection || countOutOfRange) {
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

        <Alert severity="warning" sx={{ mb: 3 }}>
          <BlankGenerationWarnings />
        </Alert>

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
              min: MIN_BLANK_COUNT,
              max: maxGeneratable,
              step: 1
            }}
            error={hasCountError}
            helperText={
              maxGeneratable < MIN_BLANK_COUNT
                ? t('blank.countAtLimit', { max: MAX_TOTAL_INPUTS })
                : hasCountError
                  ? t('blank.countError', { max: maxGeneratable })
                  : t('blank.countHelper', { max: maxGeneratable })
            }
            fullWidth
            variant="outlined"
          />
        </Box>

        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleGenerate}
          disabled={selectedConnection === '' || generating || hasCountError}
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
          <Alert severity="warning" sx={{ mb: 2 }}>
            <BlankGenerationWarnings />
          </Alert>
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
