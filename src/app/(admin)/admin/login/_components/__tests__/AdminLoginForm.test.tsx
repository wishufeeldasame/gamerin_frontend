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
  logoutAuthSession: vi.fn(),
}));
const authApi = vi.hoisted(() => ({
  loginWithPassword: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('@/lib/auth-store', () => authStore);
vi.mock('@/lib/auth-api', () => authApi);

import { AdminLoginForm } from '../AdminLoginForm';

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('아이디'), {
    target: { value: 'operator' },
  });
  fireEvent.change(screen.getByLabelText('비밀번호'), {
    target: { value: 'password123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
}

const adminUser = {
  id: 'admin-id',
  name: '운영자',
  nickname: '운영자',
  gameTier: 'Unranked',
  bio: '',
  handle: 'operator',
  role: 'ROLE_ADMIN',
  status: 'ACTIVE',
};

describe('AdminLoginForm', () => {
  beforeEach(() => {
    auth.isLoggingOut = false;
    auth.login.mockReset();
    router.push.mockReset();
    authStore.logoutAuthSession.mockReset();
    authStore.logoutAuthSession.mockResolvedValue(undefined);
    authApi.loginWithPassword.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts ROLE_ADMIN, stores the confirmed user, and moves to the admin dashboard', async () => {
    authApi.loginWithPassword.mockResolvedValueOnce(adminUser);

    render(<AdminLoginForm />);
    fillAndSubmit();

    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledWith(adminUser);
    });
    expect(authApi.loginWithPassword).toHaveBeenCalledWith('operator', 'password123!');

    await waitFor(
      () => {
        expect(router.push).toHaveBeenCalledWith('/admin');
      },
      { timeout: 1_000 },
    );
  });

  it('rejects a USER role and clears the server/local session', async () => {
    authApi.loginWithPassword.mockResolvedValueOnce({ ...adminUser, role: 'USER' });

    render(<AdminLoginForm />);
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '관리자 권한이 있는 계정만 로그인할 수 있습니다.',
    );
    expect(authStore.logoutAuthSession).toHaveBeenCalledTimes(1);
    expect(auth.login).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows the login error without logging out (the session is cleaned by loginWithPassword)', async () => {
    authApi.loginWithPassword.mockRejectedValueOnce(
      new Error('정지되었거나 비활성화된 계정입니다. 계정 상태를 확인해주세요.'),
    );

    render(<AdminLoginForm />);
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('정지되었거나 비활성화된 계정입니다.');
    expect(authStore.logoutAuthSession).not.toHaveBeenCalled();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('allows retrying after a failed login', async () => {
    authApi.loginWithPassword
      .mockRejectedValueOnce(new Error('아이디 또는 비밀번호가 올바르지 않습니다.'))
      .mockResolvedValueOnce(adminUser);

    render(<AdminLoginForm />);
    fillAndSubmit();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledWith(adminUser);
    });
    expect(authApi.loginWithPassword).toHaveBeenCalledTimes(2);
  });

  it('ignores a login cancelled by a user switch', async () => {
    authApi.loginWithPassword.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));

    render(<AdminLoginForm />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '로그인' })).toBeEnabled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(authStore.logoutAuthSession).not.toHaveBeenCalled();
  });

  it('blocks a new login while a previous logout is still in progress', () => {
    auth.isLoggingOut = true;
    render(<AdminLoginForm />);

    const submitButton = screen.getByRole('button', {
      name: '이전 세션 정리 중...',
    });
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(authApi.loginWithPassword).not.toHaveBeenCalled();
  });
});
