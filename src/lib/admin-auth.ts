'use client';

export const ADMIN_LOGIN_PATH = '/admin/login';
export const ADMIN_FORBIDDEN_PATH = '/admin/forbidden';
export const ADMIN_AUTHORIZATION_EVENT = 'gamerin_admin_authorization_failure';

export type AdminAuthorizationStatus = 401 | 403;

export function normalizeRole(role: unknown): string | null {
  if (typeof role !== 'string') {
    return null;
  }

  const normalized = role.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return normalized.startsWith('ROLE_') ? normalized.slice('ROLE_'.length) : normalized;
}

export function isAdminRole(role: unknown): boolean {
  return normalizeRole(role) === 'ADMIN';
}

export function notifyAdminAuthorizationFailure(status: AdminAuthorizationStatus) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AdminAuthorizationStatus>(ADMIN_AUTHORIZATION_EVENT, {
      detail: status,
    }),
  );
}
