import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

import {
  AUTH_REAUTH_REQUIRED_EVENT,
  AUTH_USER_KEY,
  AUTH_CLEARED_EVENT,
  AUTH_SYNC_KEY,
  beginExplicitOAuthAuthentication,
  clearStoredAuth,
  commitAuthenticatedUser,
  finishExplicitOAuthAuthentication,
  getAccessToken,
  getAuthGeneration,
  isLocalReauthenticationRequired,
  isLogoutInProgress,
  logoutAuthSession,
  refreshAccessTokenResult,
  setAuthConfirmationOwner,
  setAccessToken,
} from '@/lib/auth-store';

describe('logoutAuthSession', () => {
  beforeEach(() => {
    clearStoredAuth({ notify: false, broadcast: false });
    window.localStorage.clear();
    window.sessionStorage.clear();
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

describe('교차 탭 계정 소유자 검증', () => {
  beforeEach(() => {
    clearStoredAuth({ notify: false, broadcast: false });
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    setAccessToken('token-a');
    commitAuthenticatedUser('user-a');
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: 'user-a' }));
  });

  it('다른 탭이 같은 계정을 저장하면 현재 세션을 유지한다', () => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: AUTH_USER_KEY,
      newValue: JSON.stringify({ id: 'user-a', nickname: '변경된 닉네임' }),
    }));

    expect(getAccessToken()).toBe('token-a');
    expect(isLocalReauthenticationRequired()).toBe(false);
  });

  it('다른 탭이 다른 계정을 저장하면 공유 저장값과 서버 쿠키를 건드리지 않고 현재 탭만 재인증한다', () => {
    const reauth = vi.fn();
    window.addEventListener(AUTH_REAUTH_REQUIRED_EVENT, reauth);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: 'user-b' }));

    window.dispatchEvent(new StorageEvent('storage', {
      key: AUTH_USER_KEY,
      newValue: JSON.stringify({ id: 'user-b' }),
    }));

    expect(getAccessToken()).toBeNull();
    expect(isLocalReauthenticationRequired()).toBe(true);
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toContain('user-b');
    expect(fetch).not.toHaveBeenCalled();
    expect(reauth).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_REAUTH_REQUIRED_EVENT, reauth);
  });

  it('일반 refresh의 userId가 기대 계정과 다르면 토큰을 저장하지 않고 로컬 재인증한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      data: { accessToken: 'token-b', userId: 'user-b' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(refreshAccessTokenResult()).resolves.toEqual({ status: 'stale' });

    expect(getAccessToken()).toBeNull();
    expect(isLocalReauthenticationRequired()).toBe(true);
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toContain('user-a');
  });

  it('refresh 성공 응답에 userId가 없으면 기존 세션과 세대를 유지한다', async () => {
    const generation = getAuthGeneration();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      data: { accessToken: 'token-without-owner' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(refreshAccessTokenResult()).resolves.toEqual({ status: 'failed', httpStatus: 0 });

    expect(getAuthGeneration()).toBe(generation);
    expect(getAccessToken()).toBe('token-a');
    expect(isLocalReauthenticationRequired()).toBe(false);
  });

  it('refresh 요청을 만든 시점의 기대 userId를 응답 때까지 고정한다', async () => {
    let finishRefresh: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((resolve) => {
      finishRefresh = resolve;
    }));

    const request = refreshAccessTokenResult();
    setAuthConfirmationOwner(getAuthGeneration(), 'later-owner');
    finishRefresh?.(new Response(JSON.stringify({
      success: true,
      data: { accessToken: 'token-a-refreshed', userId: 'user-a' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(request).resolves.toEqual({
      status: 'refreshed',
      accessToken: 'token-a-refreshed',
      userId: 'user-a',
    });
    expect(isLocalReauthenticationRequired()).toBe(false);
  });

  it('명시적 OAuth 획득 세대에는 일반 refresh를 합치지 않는다', async () => {
    const attempt = beginExplicitOAuthAuthentication();

    await expect(refreshAccessTokenResult(attempt.generation)).resolves.toEqual({ status: 'stale' });
    expect(fetch).not.toHaveBeenCalled();
    finishExplicitOAuthAuthentication(attempt.id);
  });
});


describe('auth-store 로드 시 동기화 메시지', () => {
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it('남아 있는 auth-cleared 메시지로 방금 로그인한 저장 사용자를 지우지 않는다', async () => {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: 'user-id' }));
    window.localStorage.setItem(
      AUTH_SYNC_KEY,
      JSON.stringify({ type: 'auth-cleared', id: 'old', expiresAt: Date.now() + 10_000 }),
    );

    vi.resetModules();
    await import('@/lib/auth-store');

    expect(window.localStorage.getItem(AUTH_USER_KEY)).not.toBeNull();
  });
});
