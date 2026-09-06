import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_AUTHORIZATION_EVENT,
  isAdminRole,
  normalizeRole,
  notifyAdminAuthorizationFailure,
} from '@/lib/admin-auth';

describe('admin role normalization', () => {
  it.each([
    ['ADMIN', 'ADMIN'],
    ['ROLE_ADMIN', 'ADMIN'],
    [' admin ', 'ADMIN'],
    ['role_admin', 'ADMIN'],
  ])('normalizes %s to %s', (role, expected) => {
    expect(normalizeRole(role)).toBe(expected);
  });

  it.each(['ADMIN', 'ROLE_ADMIN', ' admin ', 'role_admin'])(
    'accepts %s as an administrator',
    (role) => {
      expect(isAdminRole(role)).toBe(true);
    },
  );

  it.each(['USER', 'ROLE_USER', 'SUPER_ADMIN', '', null, undefined])(
    'rejects %s as an administrator',
    (role) => {
      expect(isAdminRole(role)).toBe(false);
    },
  );
});

describe('admin authorization failures', () => {
  it.each([401, 403] as const)('dispatches status %s to the admin guard', (status) => {
    const listener = vi.fn();
    window.addEventListener(ADMIN_AUTHORIZATION_EVENT, listener);

    notifyAdminAuthorizationFailure(status);

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe(status);

    window.removeEventListener(ADMIN_AUTHORIZATION_EVENT, listener);
  });
});
