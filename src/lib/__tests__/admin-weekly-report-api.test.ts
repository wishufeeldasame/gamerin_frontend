import { beforeEach, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({ getApiBaseUrl: () => 'http://api.test' }));

let store: typeof import('@/lib/auth-store');
let weekly: typeof import('@/lib/admin-weekly-report-api');
let api: ReturnType<typeof installFetchRoutes>;

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  weekly = await import('@/lib/admin-weekly-report-api');
  store.setAccessToken('admin-token');
});

it('posts the Riot ID and region with admin authentication and cancellation', async () => {
  const report = {
    weekStart: '2026-11-02', weekEnd: '2026-11-08',
    previousWeekStart: '2026-10-26', previousWeekEnd: '2026-11-01', totalMatches: 0, games: [],
  };
  const controller = new AbortController();
  api.route('/api/v1/admin/weekly-reports/valorant', () => json(200, { success: true, data: report }));

  await expect(weekly.generateAdminValorantWeeklyReport('플레이어#TAG', 'AP', controller.signal)).resolves.toEqual(report);
  expect(api.authorization(0)).toBe('Bearer admin-token');
  expect(api.init(0)).toMatchObject({
    method: 'POST', body: JSON.stringify({ riotId: '플레이어#TAG', region: 'AP' }), signal: controller.signal,
  });
});

it('preserves rate-limit failures without replaying generation or clearing the session', async () => {
  api.route('/api/v1/admin/weekly-reports/valorant', () => json(429, { success: false, message: 'API 호출 제한' }));

  await expect(weekly.generateAdminValorantWeeklyReport('플레이어#TAG', 'KR'))
    .rejects.toMatchObject({ status: 429, message: 'API 호출 제한' });
  expect(api.count('/api/v1/admin/weekly-reports/valorant')).toBe(1);
  expect(store.getAccessToken()).toBe('admin-token');
});
