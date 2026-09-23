import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  login: vi.fn(),
}));
const authStore = vi.hoisted(() => ({
  logoutAuthSession: vi.fn<() => Promise<void>>(),
  setAccessToken: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));
vi.mock('@/lib/auth-store', () => authStore);

import OAuthSuccessPage from '../page';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OAuthSuccessPage', () => {
  beforeEach(() => {
    router.replace.mockReset();
    auth.login.mockReset();
    authStore.logoutAuthSession.mockReset();
    authStore.logoutAuthSession.mockResolvedValue(undefined);
    authStore.setAccessToken.mockReset();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('applies the expected font class while processing the login', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => undefined));

    render(<OAuthSuccessPage />);

    const heading = screen.getByRole('heading', { name: '로그인 처리 중' });
    const oauthScreen = heading.parentElement?.parentElement;
    expect(oauthScreen).toHaveClass('font-sans');
  });

  it('keeps the failure UI and redirects to login after three seconds', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(500, {
        success: false,
        message: 'server error',
      }),
    );

    render(<OAuthSuccessPage />);

    await act(async () => {
      await Promise.resolve();
    });

    const errorHeading = screen.getByRole('heading', { name: '오류 발생' });
    expect(screen.getByText('인증 세션 생성에 실패했습니다.')).toBeInTheDocument();
    expect(errorHeading.previousElementSibling).toHaveClass('justify-center');
    expect(authStore.logoutAuthSession).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('cancels the login redirect when the failure screen unmounts', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(500, {
        success: false,
        message: 'server error',
      }),
    );

    const { unmount } = render(<OAuthSuccessPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: '오류 발생' })).toBeInTheDocument();

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not schedule a redirect when unmounted while clearing the session', async () => {
    let resolveLogout: (() => void) | undefined;
    authStore.logoutAuthSession.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(500, {
        success: false,
        message: 'server error',
      }),
    );

    const { unmount } = render(<OAuthSuccessPage />);

    await waitFor(() => {
      expect(authStore.logoutAuthSession).toHaveBeenCalledTimes(1);
    });
    expect(resolveLogout).toBeTypeOf('function');

    vi.useFakeTimers();
    unmount();

    await act(async () => {
      resolveLogout?.();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('stores the access token, logs in, and redirects home on success', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { accessToken: 'oauth-access-token' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            userId: 'user-id',
            nickname: '게이머',
            handle: 'gamer',
          },
        }),
      );

    render(<OAuthSuccessPage />);

    await waitFor(() => {
      expect(authStore.setAccessToken).toHaveBeenCalledWith('oauth-access-token');
      expect(auth.login).toHaveBeenCalledWith({
        id: 'user-id',
        name: '게이머',
        nickname: '게이머',
        handle: 'gamer',
        gameTier: 'Unranked',
        bio: '',
      });
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
  });
});
