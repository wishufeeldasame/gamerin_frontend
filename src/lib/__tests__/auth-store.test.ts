import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

import {
  AUTH_USER_KEY,
  AUTH_CLEARED_EVENT,
  AUTH_SYNC_KEY,
  getAccessToken,
  isLogoutInProgress,
  logoutAuthSession,
  setAccessToken,
} from '@/lib/auth-store';

describe('logoutAuthSession', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears local authentication before the server logout response arrives', async () => {
    let finishRequest: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishRequest = resolve;
      }),
    );
    setAccessToken('secret-access-token');
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: 'admin-id' }));

    const logoutRequest = logoutAuthSession({ notify: false });

    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(isLogoutInProgress()).toBe(true);

    finishRequest?.(new Response(null, { status: 204 }));
    await logoutRequest;
    expect(isLogoutInProgress()).toBe(false);
  });

  it('calls the server logout endpoint and clears local authentication', async () => {
    setAccessToken('secret-access-token');
    window.localStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify({ id: 'admin-id', role: 'ADMIN' }),
    );
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    await logoutAuthSession({ notify: false });

    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/api/v1/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it('clears local authentication even when the server request fails', async () => {
    setAccessToken('secret-access-token');
    window.localStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify({ id: 'admin-id', role: 'ROLE_ADMIN' }),
    );
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network unavailable'));

    await expect(logoutAuthSession({ notify: false })).resolves.toBeUndefined();

    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it('uses a single server request for overlapping logout calls', async () => {
    let finishRequest: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishRequest = resolve;
      }),
    );

    const first = logoutAuthSession({ notify: false });
    const second = logoutAuthSession({ notify: false });

    expect(first).toBe(second);
    expect(fetch).toHaveBeenCalledTimes(1);

    finishRequest?.(new Response(null, { status: 204 }));
    await first;
  });

  it('finishes local logout when the server request times out', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementationOnce((_input, init) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      })
    ));

    const request = logoutAuthSession({ notify: false });
    await vi.advanceTimersByTimeAsync(5_000);
    await request;

    expect(isLogoutInProgress()).toBe(false);
  });

  it('clears authentication when another tab broadcasts logout', () => {
    const cleared = vi.fn();
    window.addEventListener(AUTH_CLEARED_EVENT, cleared);
    setAccessToken('other-tab-token');
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: 'admin-id' }));

    window.dispatchEvent(new StorageEvent('storage', {
      key: AUTH_SYNC_KEY,
      newValue: JSON.stringify({
        type: 'logout-start',
        id: 'other-tab',
        expiresAt: Date.now() + 10_000,
      }),
    }));

    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(cleared).toHaveBeenCalled();

    window.dispatchEvent(new StorageEvent('storage', {
      key: AUTH_SYNC_KEY,
      newValue: JSON.stringify({
        type: 'logout-complete',
        id: 'other-tab',
        expiresAt: Date.now() + 10_000,
      }),
    }));
    window.removeEventListener(AUTH_CLEARED_EVENT, cleared);
  });
});
