import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';

type TimerEntry = {
  expiresAtRef: MutableRefObject<number | null>;
  onExpireRef: MutableRefObject<() => void>;
  clearTimer: () => void;
};

const activeTimers = new Set<TimerEntry>();
let globalListenersAttached = false;

function dismissExpiredTimers() {
  for (const entry of activeTimers) {
    if (entry.expiresAtRef.current !== null && Date.now() >= entry.expiresAtRef.current) {
      entry.clearTimer();
      entry.onExpireRef.current();
    }
  }
}

function attachGlobalListeners() {
  if (globalListenersAttached) {
    return;
  }

  globalListenersAttached = true;
  document.addEventListener('visibilitychange', dismissExpiredTimers);
  window.addEventListener('focus', dismissExpiredTimers);
}

export function useBackgroundAwareTimeout(onExpire: () => void) {
  const expiresAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const clearTimer = useCallback(() => {
    expiresAtRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback((duration: number) => {
    clearTimer();
    expiresAtRef.current = Date.now() + duration;
    timeoutRef.current = setTimeout(() => {
      clearTimer();
      onExpireRef.current();
    }, duration);
  }, [clearTimer]);

  useEffect(() => {
    attachGlobalListeners();

    const entry: TimerEntry = { expiresAtRef, onExpireRef, clearTimer };
    activeTimers.add(entry);

    return () => {
      activeTimers.delete(entry);
      clearTimer();
    };
  }, [clearTimer]);

  return { startTimer, clearTimer };
}
