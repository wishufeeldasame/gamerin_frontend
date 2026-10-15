import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
const authStore = vi.hoisted(() => ({
  AUTH_CLEARED_EVENT: 'gamerin_auth_cleared',
  AUTH_LOGOUT_STATE_EVENT: 'gamerin_auth_logout_state',
  AUTH_REAUTH_REQUIRED_EVENT: 'gamerin_auth_reauthentication_required',
  AUTH_USER_KEY: 'gamerin_user',
  beginExplicitOAuthAuthentication: vi.fn(),
  commitAuthenticatedUser: vi.fn(() => true),
  finishExplicitOAuthAuthentication: vi.fn(),
  getAuthGeneration: vi.fn(() => 0),
  isExplicitOAuthAttemptCurrent: vi.fn(() => true),
  isCurrentAuthGeneration: vi.fn(() => true),
  isExpiredAuthGeneration: vi.fn(() => false),
  isLocalReauthenticationRequired: vi.fn(() => false),
  isLogoutInProgress: vi.fn(() => false),
  logoutAuthSession: vi.fn<() => Promise<void>>(),
  markExplicitOAuthConfirmation: vi.fn(),
  refreshAccessTokenResult: vi.fn(async () => ({ status: 'failed', httpStatus: 0 })),
  requireLocalReauthentication: vi.fn(),
  setAccessToken: vi.fn(),
  setAuthConfirmationOwner: vi.fn(() => true),
  waitForLogoutCompletion: vi.fn(() => Promise.resolve()),
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
    window.sessionStorage.clear();
    router.replace.mockReset();
    authStore.logoutAuthSession.mockReset();
    authStore.logoutAuthSession.mockResolvedValue(undefined);
    authStore.isLocalReauthenticationRequired.mockReturnValue(false);
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

  it('현재 탭 재인증 이벤트가 오면 공유 저장 사용자를 지우지 않고 Context 사용자만 비운다', async () => {
    render(<AuthProvider><AuthHarness /></AuthProvider>);

    expect(await screen.findByText('ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'test login' }));
    expect(screen.getByText('운영자')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(authStore.AUTH_REAUTH_REQUIRED_EVENT));
    });

    expect(screen.getByText('no-user')).toBeInTheDocument();
    expect(window.localStorage.getItem(authStore.AUTH_USER_KEY)).toContain('admin-id');
    expect(authStore.logoutAuthSession).not.toHaveBeenCalled();
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

    it('탭별 재인증 마커가 있으면 bootstrap API를 한 번도 호출하지 않는다', async () => {
      authStore.isLocalReauthenticationRequired.mockReturnValue(true);

      render(<AuthProvider><AuthHarness /></AuthProvider>);

      expect(await screen.findByText('ready')).toBeInTheDocument();
      expect(screen.getByText('no-user')).toBeInTheDocument();
      expect(authStore.refreshAccessTokenResult).not.toHaveBeenCalled();
      expect(apiClient.apiRequest).not.toHaveBeenCalled();
      expect(authStore.logoutAuthSession).not.toHaveBeenCalled();
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
        userId: 'user-id',
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
        userId: 'user-id',
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

    it('저장 사용자의 프로필 이미지 상대경로를 복원 시점의 API 주소로 바꾸고 커버 이미지는 버린다', async () => {
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', ' https://api.gamerin.test/ ');
      onTestFinished(() => {
        vi.unstubAllEnvs();
      });
      window.localStorage.setItem(authStore.AUTH_USER_KEY, JSON.stringify({
        ...savedUser,
        profileImageUrl: ' /uploads/p.png ',
        coverImageUrl: '/uploads/c.png',
      }));
      authStore.refreshAccessTokenResult.mockResolvedValueOnce({
        status: 'refreshed',
        accessToken: 'token',
        userId: 'user-id',
      } as never);
      apiClient.apiRequest.mockResolvedValueOnce({ userId: 'user-id', handle: 'user', nickname: '서버닉네임' });

      render(<AuthProvider><AuthHarness /></AuthProvider>);
      expect(await screen.findByText('서버닉네임')).toBeInTheDocument();

      const stored = JSON.parse(window.localStorage.getItem(authStore.AUTH_USER_KEY) ?? '{}');
      expect(stored.profileImageUrl).toBe('https://api.gamerin.test/uploads/p.png');
      expect(stored).not.toHaveProperty('coverImageUrl');
    });

    it('복원 도중 로그인·로그아웃으로 세대가 바뀌면 복원 결과로 사용자를 덮어쓰지 않는다', async () => {
      let finishRefresh: ((result: { status: 'refreshed'; accessToken: string; userId: string }) => void) | undefined;
      authStore.refreshAccessTokenResult.mockImplementationOnce(
        () => new Promise((resolve) => {
          finishRefresh = resolve as typeof finishRefresh;
        }) as never,
      );
      apiClient.apiRequest.mockResolvedValue({ userId: 'user-id', handle: 'user', nickname: '서버닉네임' });
      onTestFinished(() => {
        authStore.isCurrentAuthGeneration.mockReturnValue(true);
      });

      render(<AuthProvider><AuthHarness /></AuthProvider>);
      fireEvent.click(screen.getByRole('button', { name: 'test login' }));
      authStore.isCurrentAuthGeneration.mockReturnValue(false);
      await act(async () => {
        finishRefresh?.({ status: 'refreshed', accessToken: 'token', userId: 'user-id' });
      });

      expect(await screen.findByText('ready')).toBeInTheDocument();
      expect(screen.getByText('운영자')).toBeInTheDocument();
      expect(authStore.logoutAuthSession).not.toHaveBeenCalled();
    });

    it('복원 중 차단 계정으로 확인되면 이미 반영된 화면 사용자 상태도 비운다', async () => {
      let finishRefresh: ((result: { status: 'refreshed'; accessToken: string; userId: string }) => void) | undefined;
      authStore.refreshAccessTokenResult.mockImplementationOnce(
        () => new Promise((resolve) => {
          finishRefresh = resolve as typeof finishRefresh;
        }) as never,
      );
      apiClient.apiRequest.mockResolvedValueOnce({
        userId: 'user-id',
        handle: 'user',
        nickname: '사용자',
        status: 'SUSPENDED',
      });

      render(<AuthProvider><AuthHarness /></AuthProvider>);
      fireEvent.click(screen.getByRole('button', { name: 'test login' }));
      expect(screen.getByText('운영자')).toBeInTheDocument();
      await act(async () => {
        finishRefresh?.({ status: 'refreshed', accessToken: 'token', userId: 'user-id' });
      });

      expect(await screen.findByText('ready')).toBeInTheDocument();
      expect(screen.getByText('no-user')).toBeInTheDocument();
      expect(authStore.logoutAuthSession).toHaveBeenCalledWith({ notify: false });
    });

    it('차단 상태의 계정이면 세션을 종료한다', async () => {
      authStore.refreshAccessTokenResult.mockResolvedValueOnce({
        status: 'refreshed',
        accessToken: 'token',
        userId: 'user-id',
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
