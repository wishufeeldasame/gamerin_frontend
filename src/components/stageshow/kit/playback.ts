import { createContext, useCallback, useContext } from 'react';

// 데모별 시계. 전역 타이머와 인증 Provider를 멈추지 않고 현재 장면만 정지한다.
export class Playback {
  private pausedAt: number | null = null;
  private excluded = 0;
  private timers = new Set<{ remaining: number; started: number; id: number; fire: () => void }>();
  private listeners = new Set<() => void>();

  now() {
    return (this.pausedAt ?? performance.now()) - this.excluded;
  }

  setPaused(paused: boolean) {
    if (paused === (this.pausedAt !== null)) return;
    if (paused) {
      this.pausedAt = performance.now();
      for (const timer of this.timers) {
        window.clearTimeout(timer.id);
        timer.remaining = Math.max(0, timer.remaining - (this.pausedAt - timer.started));
      }
    } else {
      this.excluded += performance.now() - this.pausedAt!;
      this.pausedAt = null;
      for (const timer of this.timers) {
        timer.started = performance.now();
        timer.id = window.setTimeout(timer.fire, timer.remaining);
      }
      for (const listener of this.listeners) listener();
    }
  }

  timeout(callback: () => void, milliseconds: number) {
    const timer = { remaining: milliseconds, started: performance.now(), id: 0, fire: () => {
      this.timers.delete(timer);
      callback();
    } };
    this.timers.add(timer);
    if (this.pausedAt === null) timer.id = window.setTimeout(timer.fire, milliseconds);
    return () => { window.clearTimeout(timer.id); this.timers.delete(timer); };
  }

  wait(milliseconds: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason);
      const cancel = this.timeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
      const abort = () => { cancel(); signal.removeEventListener('abort', abort); reject(signal.reason); };
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  ready(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(signal.reason);
    if (this.pausedAt === null) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => { this.listeners.delete(resume); signal.removeEventListener('abort', abort); };
      const resume = () => { cleanup(); resolve(); };
      const abort = () => { cleanup(); reject(signal.reason); };
      this.listeners.add(resume);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
}

export const PlaybackContext = createContext<Playback | null>(null);
export function usePlaybackTimeout() {
  const playback = useContext(PlaybackContext);
  return useCallback((callback: () => void, milliseconds: number) => {
    if (playback) return playback.timeout(callback, milliseconds);
    const id = window.setTimeout(callback, milliseconds);
    return () => window.clearTimeout(id);
  }, [playback]);
}
