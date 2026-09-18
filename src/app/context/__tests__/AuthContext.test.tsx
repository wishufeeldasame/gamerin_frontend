import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
const authStore = vi.hoisted(() => ({
  AUTH_CLEARED_EVENT: 'gamerin_auth_cleared',
  AUTH_LOGOUT_STATE_EVENT: 'gamerin_auth_logout_state',
  AUTH_USER_KEY: 'gamerin_user',
  getAuthGeneration: vi.fn(() => 0),
  isCurrentAuthGeneration: vi.fn(() => true),
  isLogoutInProgress: vi.fn(() => false),
  logoutAuthSession: vi.fn<() => Promise<void>>(),
  refreshAccessTokenResult: vi.fn(async () => ({ status: 'failed', httpStatus: 0 })),
}));

const apiClient = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {},
  apiRequest: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));
vi.mock('@/lib/auth-store', () => authStore);
vi.mock('@/lib/api-client', () => apiClient);

import { AuthProvider, useAuth } from '../AuthContext';

function AuthHarness() {
  const { user, isAuthReady, login, logout } = useAuth();
  return (
    <div>
      <span>{isAuthReady ? 'ready' : 'loading'}</span>
      <span>{user?.nickname ?? 'no-user'}</span>
      <button
        type="button"
        onClick={() => login({
          id: 'admin-id',
          name: '운영자',
          nickname: '운영자',
          gameTier: '',
          role: 'ROLE_ADMIN',
          status: 'ACTIVE',
        })}
      >
        test login
      </button>
      <button type="button" onClick={() => void logout({ redirectTo: null })}>
        test logout
      </button>
    </div>
  );
}

describe('AuthProvider session clearing', () => {
  beforeEach(() => {
    window.localStorage.clear();
    router.replace.mockReset();
    authStore.logoutAuthSession.mockReset();
    authStore.logoutAuthSession.mockResolvedValue(undefined);
  });

  it('immediately clears the Context user when the shared auth-cleared event arrives', async () => {
    render(
      <AuthProvider><AuthHarness /></AuthProvider>,
    );

    expect(await screen.findByText('ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'test login' }));
    expect(screen.getByText('운영자')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(authStore.AUTH_CLEARED_EVENT));
    });
    expect(screen.getByText('no-user')).toBeInTheDocument();
  });

  it('clears the Context user before a delayed server logout finishes', async () => {
    let finishLogout: (() => void) | undefined;
    authStore.logoutAuthSession.mockImplementation(
      () => new Promise<void>((resolve) => {
        finishLogout = resolve;
      }),
    );
    render(
      <AuthProvider><AuthHarness /></AuthProvider>,
    );

    expect(await screen.findByText('ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'test login' }));
    fireEvent.click(screen.getByRole('button', { name: 'test logout' }));

    expect(screen.getByText('no-user')).toBeInTheDocument();
    expect(authStore.logoutAuthSession).toHaveBeenCalledWith({ notify: false });
    finishLogout?.();
  });

  describe('저장된 사용자 복원', () => {
    const savedUser = { id: 'user-id', name: '사용자', nickname: '사용자', gameTier: '' };

    beforeEach(() => {
      window.localStorage.setItem(authStore.AUTH_USER_KEY, JSON.stringify(savedUser));
      apiClient.apiRequest.mockReset();
    });

    it('refresh 일시 장애면 로그아웃하지 않고, 검증되지 않은 사용자도 복원하지 않는다', async () => {
      authStore.refreshAccessTokenResult.mockResolvedValueOnce({ status: 'failed', httpStatus: 503 });

      render(<AuthProvider><AuthHarness /></AuthProvider>);

      expect(await screen.findByText('ready')).toBeInTheDocument();
      expect(screen.getByText('no-user')).toBeInTheDocument();
      expect(authStore.logoutAuthSession).not.toHaveBeenCalled();
      expect(apiClient.apiRequest).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(authStore.AUTH_USER_KEY)).not.toBeNull();
    });

    it('계정 확인 요청이 일시 장애로 실패해도 로그아웃하지 않는다', async () => {
      authStore.refreshAccessTokenResult.mockResolvedValueOnce({
        status: 'refreshed',
        accessToken: 'token',
      } as never);
      apiClient.apiRequest.mockRejectedValueOnce(new Error('unavailable'));

      render(<AuthProvider><AuthHarness /></AuthProvider>);

      expect(await screen.findByText('ready')).toBeInTheDocument();
      expect(screen.getByText('no-user')).toBeInTheDocument();
      expect(authStore.logoutAuthSession).not.toHaveBeenCalled();
    });

    it('refresh와 계정 확인이 성공하면 서버 값으로 사용자를 복원한다', async () => {
      authStore.refreshAccessTokenResult.mockResolvedValueOnce({
        status: 'refreshed',
        accessToken: 'token',
      } as never);
      apiClient.apiRequest.mockResolvedValueOnce({
        userId: 'user-id',
        handle: 'user',
        nickname: '서버닉네임',
        status: 'ACTIVE',
      });

      render(<AuthProvider><AuthHarness /></AuthProvider>);

      expect(await screen.findByText('서버닉네임')).toBeInTheDocument();
      expect(apiClient.apiRequest).toHaveBeenCalledWith('/api/v1/auth/me', expect.anything());
    });

    it('차단 상태의 계정이면 세션을 종료한다', async () => {
      authStore.refreshAccessTokenResult.mockResolvedValueOnce({
        status: 'refreshed',
        accessToken: 'token',
      } as never);
      apiClient.apiRequest.mockResolvedValueOnce({
        userId: 'user-id',
        handle: 'user',
        nickname: '사용자',
        status: 'SUSPENDED',
      });

      render(<AuthProvider><AuthHarness /></AuthProvider>);

      expect(await screen.findByText('ready')).toBeInTheDocument();
      expect(screen.getByText('no-user')).toBeInTheDocument();
      expect(authStore.logoutAuthSession).toHaveBeenCalledWith({ notify: false });
    });
  });
});
