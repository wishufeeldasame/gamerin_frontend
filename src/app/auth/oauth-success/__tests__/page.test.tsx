import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  login: vi.fn(),
}));
const authApi = vi.hoisted(() => ({
  completeOAuthSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('@/lib/auth-api', () => authApi);

import OAuthSuccessPage from '../page';

describe('OAuthSuccessPage', () => {
  beforeEach(() => {
    router.replace.mockReset();
    auth.login.mockReset();
    authApi.completeOAuthSession.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('applies the expected font class while processing the login', () => {
    authApi.completeOAuthSession.mockImplementation(() => new Promise(() => undefined));

    render(<OAuthSuccessPage />);

    const heading = screen.getByRole('heading', { name: '로그인 처리 중' });
    const oauthScreen = heading.parentElement?.parentElement;
    expect(oauthScreen).toHaveClass('font-sans');
  });

  it('keeps the failure UI and redirects to login after three seconds', async () => {
    vi.useFakeTimers();
    authApi.completeOAuthSession.mockRejectedValueOnce(new Error('인증 세션 생성에 실패했습니다.'));

    render(<OAuthSuccessPage />);

    await act(async () => {
      await Promise.resolve();
    });

    const errorHeading = screen.getByRole('heading', { name: '오류 발생' });
    expect(screen.getByText('인증 세션 생성에 실패했습니다.')).toBeInTheDocument();
    expect(errorHeading.previousElementSibling).toHaveClass('justify-center');
    expect(auth.login).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('cancels the login redirect when the failure screen unmounts', async () => {
    vi.useFakeTimers();
    authApi.completeOAuthSession.mockRejectedValueOnce(new Error('실패'));

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

  it('does not schedule a redirect when unmounted before the session is completed', async () => {
    let rejectSession: ((error: Error) => void) | undefined;
    authApi.completeOAuthSession.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSession = reject;
        }),
    );

    const { unmount } = render(<OAuthSuccessPage />);
    expect(rejectSession).toBeTypeOf('function');

    vi.useFakeTimers();
    unmount();

    await act(async () => {
      rejectSession?.(new Error('실패'));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(router.replace).not.toHaveBeenCalled();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('does not change the screen when the session is cancelled by a user switch', async () => {
    vi.useFakeTimers();
    authApi.completeOAuthSession.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));

    render(<OAuthSuccessPage />);

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.queryByRole('heading', { name: '오류 발생' })).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('logs in with the confirmed user and redirects home on success', async () => {
    const user = { id: 'user-id', name: '게이머', nickname: '게이머', handle: 'gamer', gameTier: 'Unranked', bio: '', role: 'USER', status: 'ACTIVE' };
    authApi.completeOAuthSession.mockResolvedValueOnce(user);

    render(<OAuthSuccessPage />);

    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledWith(user);
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
  });
});
