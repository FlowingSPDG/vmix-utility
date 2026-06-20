import { useCallback, useRef, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { SnackbarOrigin } from '@mui/material/Snackbar';
import { useBackgroundAwareTimeout } from './useBackgroundAwareTimeout';

export type ToastSeverity = 'success' | 'error' | 'info';

export interface ToastState {
  open: boolean;
  message: string;
  severity: ToastSeverity;
  pulseId: number;
}

const DEFAULT_DURATION = 3000;
const RETRIGGER_GAP_MS = 120;

export function useToast(duration = DEFAULT_DURATION) {
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'info',
    pulseId: 0,
  });

  const toastOpenRef = useRef(false);
  const pulseIdRef = useRef(0);
  const reopenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    toastOpenRef.current = false;
    setToast(prev => ({ ...prev, open: false }));
  }, []);

  const { startTimer, clearTimer } = useBackgroundAwareTimeout(hideToast);

  const showToast = useCallback(
    (message: string, severity: ToastSeverity = 'success', customDuration?: number) => {
      clearTimer();

      if (reopenTimeoutRef.current) {
        clearTimeout(reopenTimeoutRef.current);
        reopenTimeoutRef.current = null;
      }

      const nextPulseId = ++pulseIdRef.current;
      const timerDuration = customDuration ?? duration;
      const nextToast: ToastState = {
        open: true,
        message,
        severity,
        pulseId: nextPulseId,
      };

      const openToast = () => {
        toastOpenRef.current = true;
        setToast(nextToast);
        startTimer(timerDuration);
      };

      if (toastOpenRef.current) {
        toastOpenRef.current = false;
        setToast(prev => ({ ...prev, open: false }));
        reopenTimeoutRef.current = setTimeout(() => {
          reopenTimeoutRef.current = null;
          openToast();
        }, RETRIGGER_GAP_MS);
        return;
      }

      openToast();
    },
    [duration, startTimer, clearTimer]
  );

  const handleCloseToast = useCallback(() => {
    if (reopenTimeoutRef.current) {
      clearTimeout(reopenTimeoutRef.current);
      reopenTimeoutRef.current = null;
    }
    clearTimer();
    hideToast();
  }, [clearTimer, hideToast]);

  return { toast, showToast, hideToast: handleCloseToast };
}

interface ToastSnackbarProps {
  toast: ToastState;
  onClose: () => void;
  anchorOrigin?: SnackbarOrigin;
  variant?: 'filled' | 'standard' | 'outlined';
}

export function ToastSnackbar({
  toast,
  onClose,
  anchorOrigin = { vertical: 'bottom', horizontal: 'right' },
  variant = 'filled',
}: ToastSnackbarProps) {
  return (
    <Snackbar
      key={toast.pulseId}
      open={toast.open}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
    >
      <Alert
        severity={toast.severity}
        sx={{
          width: '100%',
          animation: toast.open ? 'toastPulse 220ms ease-out' : 'none',
          '@keyframes toastPulse': {
            '0%': { transform: 'scale(0.96)', opacity: 0.7 },
            '100%': { transform: 'scale(1)', opacity: 1 },
          },
        }}
        variant={variant}
        onClose={onClose}
      >
        {toast.message}
      </Alert>
    </Snackbar>
  );
}
