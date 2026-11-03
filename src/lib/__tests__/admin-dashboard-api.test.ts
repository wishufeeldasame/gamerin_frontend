import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({ getApiBaseUrl: () => 'http://api.test' }));

let store: typeof import('@/lib/auth-store');
let dashboard: typeof import('@/lib/admin-dashboard-api');
let api: ReturnType<typeof installFetchRoutes>;

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  dashboard = await import('@/lib/admin-dashboard-api');
  store.setAccessToken('admin-token');
});

describe('admin-dashboard-api', () => {
  it('loads actual statistics with the authenticated request and preserves zero counts', async () => {
    const stats = { receivedReportsCount: 0, inReviewReportsCount: 3, resolvedReportsCount: 401, rejectedReportsCount: 8, activePenaltiesCount: 7, hiddenContentsCount: 2 };
    api.route('/api/v1/admin/dashboard/stats', () => json(200, { success: true, data: stats }));

    await expect(dashboard.fetchAdminDashboardStats()).resolves.toEqual(stats);
    expect(api.authorization(0)).toBe('Bearer admin-token');
  });

  it('preserves a server failure without substituting statistics or clearing the session', async () => {
    api.route('/api/v1/admin/dashboard/stats', () => json(503, { success: false, message: '통계 조회 실패' }));
    await expect(dashboard.fetchAdminDashboardStats()).rejects.toMatchObject({ status: 503, message: '통계 조회 실패' });
    expect(store.getAccessToken()).toBe('admin-token');
  });

  it('honors cancellation', async () => {
    const controller = new AbortController();
    api.route('/api/v1/admin/dashboard/stats', (init) => {
      init?.signal?.throwIfAborted();
      return json(200, { success: true, data: {} });
    });
    controller.abort();
    await expect(dashboard.fetchAdminDashboardStats(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
