import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({ getApiBaseUrl: () => 'http://api.test' }));
let audit: typeof import('@/lib/admin-audit-api');
let api: ReturnType<typeof installFetchRoutes>;

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  const store = await import('@/lib/auth-store');
  audit = await import('@/lib/admin-audit-api');
  store.setAccessToken('admin-token');
});

describe('admin-audit-api', () => {
  it('uses the backend page and supported UUID/action/target filters', async () => {
    const path = '/api/v1/admin/audit-logs?adminId=admin-id&actionType=USER_BAN&targetType=USER&page=2&size=20&sort=createdAt%2Cdesc';
    const page = { content: [], number: 2, size: 20, totalElements: 44, totalPages: 3 };
    api.route(path, () => json(200, { success: true, data: page }));

    await expect(audit.fetchAdminAuditLogs({ adminId: 'admin-id', actionType: 'USER_BAN', targetType: 'USER', page: 2 })).resolves.toEqual(page);
    expect(api.paths()).toEqual([path]);
    expect(api.authorization(0)).toBe('Bearer admin-token');
  });

  it('defaults to the newest first page and forwards cancellation', async () => {
    const controller = new AbortController();
    const path = '/api/v1/admin/audit-logs?page=0&size=20&sort=createdAt%2Cdesc';
    api.route(path, () => json(200, { success: true, data: { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 } }));
    await audit.fetchAdminAuditLogs({}, controller.signal);
    expect(api.init(0)?.signal).toBe(controller.signal);
  });

  it('rejects a page without the envelope', async () => {
    api.route('/api/v1/admin/audit-logs?page=0&size=20&sort=createdAt%2Cdesc', () => json(200, { content: [] }));
    await expect(audit.fetchAdminAuditLogs()).rejects.toMatchObject({ status: 200 });
  });
});
