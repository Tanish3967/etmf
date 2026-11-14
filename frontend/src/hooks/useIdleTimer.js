import { useEffect, useRef, useCallback } from 'react';

/**
 * 21 CFR Part 11 Compliant Idle Inactivity Timer Hook
 * Monitors user interaction across the document and invokes `onIdle` after `timeout` ms.
 *
 * @param {Object} params
 * @param {Function} params.onIdle - Callback fired when timeout duration elapses without activity
 * @param {number} [params.timeout=600000] - Inactivity duration in ms (default: 10 minutes per §11.10(k))
 * @param {boolean} [params.enabled=true] - Whether the timer is currently active
 */
export default function useIdleTimer({ onIdle, timeout = 10 * 60 * 1000, enabled = true }) {
  const timerRef = useRef(null);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (enabled && typeof window !== 'undefined') {
      timerRef.current = setTimeout(() => {
        if (onIdleRef.current) {
          onIdleRef.current();
        }
      }, timeout);
    }
  }, [timeout, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial countdown
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer]);

  return { resetTimer };
}
