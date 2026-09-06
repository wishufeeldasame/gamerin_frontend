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
  refreshAccessToken: vi.fn(async () => null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));
vi.mock('@/lib/auth-store', () => authStore);

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
});
