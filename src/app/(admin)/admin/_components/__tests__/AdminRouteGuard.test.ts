import { createElement } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authStore = vi.hoisted(() => ({
  logoutAuthSession: vi.fn(),
}));

const navigation = vi.hoisted(() => ({
  pathname: '/admin',
  router: {
    replace: vi.fn<(path: string) => void>(),
  },
}));

const authContext = vi.hoisted(() => ({
  useAuth: vi.fn<
    () => {
      user: { role?: string; status?: string } | null;
      isAuthReady: boolean;
    }
  >(),
}));

vi.mock('@/lib/auth-store', () => authStore);
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => navigation.router,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: authContext.useAuth,
}));

import {
  AdminRouteGuard,
  getAdminAuthorizationRedirect,
  handleAdminAuthorizationFailure,
} from '../AdminRouteGuard';

function renderGuard(childText = 'protected admin content') {
  return render(
    createElement(AdminRouteGuard, null, createElement('div', null, childText)),
  );
}

beforeEach(() => {
  navigation.pathname = '/admin';
  authContext.useAuth.mockReturnValue({ user: null, isAuthReady: true });
  authStore.logoutAuthSession.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdminRouteGuard authorization redirects', () => {
  it('redirects an unauthenticated request to the admin login', () => {
    expect(getAdminAuthorizationRedirect(401)).toBe('/admin/login');
  });

  it('redirects a forbidden request to the forbidden page', () => {
    expect(getAdminAuthorizationRedirect(403)).toBe('/admin/forbidden');
  });

  it('clears the authentication session before a 401 redirect', async () => {
    const replace = vi.fn();

    await handleAdminAuthorizationFailure(401, replace);

    expect(authStore.logoutAuthSession).toHaveBeenCalledWith();
    expect(replace).toHaveBeenCalledWith('/admin/login');
  });

  it('keeps the authentication session for a 403 redirect', async () => {
    const replace = vi.fn();

    await handleAdminAuthorizationFailure(403, replace);

    expect(authStore.logoutAuthSession).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/admin/forbidden');
  });
});

describe('AdminRouteGuard component access control', () => {
  it('redirects an unauthenticated /admin route to the admin login', async () => {
    renderGuard();

    expect(screen.queryByText('protected admin content')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(navigation.router.replace).toHaveBeenCalledWith('/admin/login');
    });
  });

  it('redirects a USER from /admin to the forbidden page', async () => {
    authContext.useAuth.mockReturnValue({
      user: { role: 'USER' },
      isAuthReady: true,
    });

    renderGuard();

    expect(screen.queryByText('protected admin content')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(navigation.router.replace).toHaveBeenCalledWith('/admin/forbidden');
    });
  });

  it.each(['ROLE_ADMIN', 'ADMIN'])('renders children for the %s role', (role) => {
    authContext.useAuth.mockReturnValue({
      user: { role },
      isAuthReady: true,
    });

    renderGuard();

    expect(screen.getByText('protected admin content')).toBeInTheDocument();
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });

  it.each(['SUSPENDED', 'DELETED'])(
    'clears and redirects a %s administrator',
    async (status) => {
      authContext.useAuth.mockReturnValue({
        user: { role: 'ROLE_ADMIN', status },
        isAuthReady: true,
      });

      renderGuard();

      expect(screen.queryByText('protected admin content')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(authStore.logoutAuthSession).toHaveBeenCalledWith();
        expect(navigation.router.replace).toHaveBeenCalledWith('/admin/login');
      });
    },
  );

  it('renders the public /admin/login route without authentication', () => {
    navigation.pathname = '/admin/login';
    authContext.useAuth.mockReturnValue({ user: null, isAuthReady: false });

    renderGuard('admin login form');

    expect(screen.getByText('admin login form')).toBeInTheDocument();
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });
});
