'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  ADMIN_AUTHORIZATION_EVENT,
  ADMIN_FORBIDDEN_PATH,
  ADMIN_LOGIN_PATH,
  type AdminAuthorizationStatus,
  isAdminRole,
} from '@/lib/admin-auth';
import { logoutAuthSession } from '@/lib/auth-store';
import { isBlockedAccountStatus } from '@/lib/auth-session-policy';

export function getAdminAuthorizationRedirect(status: AdminAuthorizationStatus) {
  return status === 401 ? ADMIN_LOGIN_PATH : ADMIN_FORBIDDEN_PATH;
}

export async function handleAdminAuthorizationFailure(
  status: AdminAuthorizationStatus,
  replace: (path: string) => void,
) {
  if (status === 401) {
    const logoutRequest = logoutAuthSession();
    replace(getAdminAuthorizationRedirect(status));
    await logoutRequest;
    return;
  }

  replace(getAdminAuthorizationRedirect(status));
}

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthReady } = useAuth();
  const isPublicAdminRoute = pathname === ADMIN_LOGIN_PATH || pathname === ADMIN_FORBIDDEN_PATH;
  const isBlocked = isBlockedAccountStatus(user?.status);
  const isAllowed = isAuthReady && isAdminRole(user?.role) && !isBlocked;

  useEffect(() => {
    const handleAuthorizationFailure = (event: Event) => {
      void handleAdminAuthorizationFailure(
        (event as CustomEvent<AdminAuthorizationStatus>).detail,
        router.replace,
      );
    };

    window.addEventListener(ADMIN_AUTHORIZATION_EVENT, handleAuthorizationFailure);
    return () => window.removeEventListener(ADMIN_AUTHORIZATION_EVENT, handleAuthorizationFailure);
  }, [router]);

  useEffect(() => {
    if (!isAuthReady || isPublicAdminRoute) return;
    if (!user) {
      router.replace(ADMIN_LOGIN_PATH);
      return;
    }
    if (isBlocked) {
      void handleAdminAuthorizationFailure(401, router.replace);
      return;
    }
    if (!isAdminRole(user.role)) {
      router.replace(ADMIN_FORBIDDEN_PATH);
    }
  }, [isAuthReady, isBlocked, isPublicAdminRoute, router, user]);

  if (isPublicAdminRoute) return children;
  if (!isAllowed) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f6f7f9] p-6 text-sm text-[#667085]">
        관리자 권한을 확인하고 있습니다.
      </main>
    );
  }

  return children;
}
