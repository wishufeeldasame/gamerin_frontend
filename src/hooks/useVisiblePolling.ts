'use client';

import { useEffect, useRef } from 'react';

type VisiblePollingOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

export function useVisiblePolling(
  callback: () => void | Promise<void>,
  { enabled = true, intervalMs = 30_000 }: VisiblePollingOptions = {},
) {
  const callbackRef = useRef(callback);
  const runningRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (document.hidden || runningRef.current) return;

      runningRef.current = true;
      void Promise.resolve(callbackRef.current()).finally(() => {
        runningRef.current = false;
      });
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) run();
    };

    const intervalId = window.setInterval(run, intervalMs);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
