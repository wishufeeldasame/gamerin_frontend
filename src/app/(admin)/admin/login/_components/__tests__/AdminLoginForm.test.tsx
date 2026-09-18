import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  push: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  isLoggingOut: false,
  login: vi.fn(),
}));
const authStore = vi.hoisted(() => ({
  assertCurrentAuthGeneration: vi.fn(),
  getAuthGeneration: vi.fn(),
  logoutAuthSession: vi.fn(),
  setAccessToken: vi.fn(),
  waitForLogoutCompletion: vi.fn(),
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

import { AdminLoginForm } from '../AdminLoginForm';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('아이디'), {
    target: { value: 'operator' },
  });
  fireEvent.change(screen.getByLabelText('비밀번호'), {
    target: { value: 'password123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
}

describe('AdminLoginForm', () => {
  beforeEach(() => {
    auth.isLoggingOut = false;
    authStore.assertCurrentAuthGeneration.mockImplementation(() => undefined);
    authStore.getAuthGeneration.mockReturnValue(0);
    authStore.logoutAuthSession.mockResolvedValue(undefined);
    authStore.waitForLogoutCompletion.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts ROLE_ADMIN, stores /me data, and moves to the admin dashboard', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { accessToken: 'admin-access-token' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            userId: 'admin-id',
            handle: 'operator',
            nickname: '운영자',
            role: 'ROLE_ADMIN',
            status: 'ACTIVE',
          },
        }),
      );

    render(<AdminLoginForm />);
    fillAndSubmit();

    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledWith({
        id: 'admin-id',
        name: '운영자',
        nickname: '운영자',
        gameTier: '',
        handle: 'operator',
        role: 'ROLE_ADMIN',
        status: 'ACTIVE',
      });
    });
    expect(authStore.setAccessToken).toHaveBeenCalledWith('admin-access-token');

    await waitFor(
      () => {
        expect(router.push).toHaveBeenCalledWith('/admin');
      },
      { timeout: 1_000 },
    );
  });

  it('rejects a USER role and clears the server/local session', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { accessToken: 'user-access-token' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            userId: 'user-id',
            handle: 'member',
            nickname: '일반회원',
            role: 'USER',
          },
        }),
      );

    render(<AdminLoginForm />);
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '관리자 권한이 있는 계정만 로그인할 수 있습니다.',
    );
    expect(authStore.logoutAuthSession).toHaveBeenCalledWith();
    expect(auth.login).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each(['SUSPENDED', 'DELETED'])(
    'rejects an administrator with the %s status',
    async (status) => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          jsonResponse(200, {
            success: true,
            data: { accessToken: 'blocked-admin-token' },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse(200, {
            success: true,
            data: {
              userId: 'blocked-admin-id',
              handle: 'blocked-admin',
              nickname: '차단 관리자',
              role: 'ROLE_ADMIN',
              status,
            },
          }),
        );

      render(<AdminLoginForm />);
      fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        '정지되었거나 비활성화된 계정입니다.',
      );
      expect(authStore.logoutAuthSession).toHaveBeenCalledWith();
      expect(auth.login).not.toHaveBeenCalled();
    },
  );

  it('clears authentication when /auth/me fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { accessToken: 'unverified-access-token' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          message: 'unauthorized',
        }),
      );

    render(<AdminLoginForm />);
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '관리자 권한이 있는 계정만 로그인할 수 있습니다.',
    );
    expect(authStore.logoutAuthSession).toHaveBeenCalledWith();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('blocks a new login while a previous logout is still in progress', () => {
    auth.isLoggingOut = true;
    render(<AdminLoginForm />);

    const submitButton = screen.getByRole('button', {
      name: '이전 세션 정리 중...',
    });
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(fetch).not.toHaveBeenCalled();
  });
});
