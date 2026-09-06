import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';

function PollingHarness({ callback }: { callback: () => void | Promise<void> }) {
  useVisiblePolling(callback, { intervalMs: 30_000 });
  return null;
}

describe('useVisiblePolling', () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  it('polls every 30 seconds only while the page is visible', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    render(<PollingHarness callback={callback} />);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(callback).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(callback).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not overlap pending polling requests', async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const callback = vi.fn(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    render(<PollingHarness callback={callback} />);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(callback).toHaveBeenCalledTimes(1);

    finish?.();
    await act(async () => {});
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
