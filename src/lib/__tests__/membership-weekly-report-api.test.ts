import { beforeEach, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({ getApiBaseUrl: () => 'http://api.test' }));

let store: typeof import('@/lib/auth-store');
let membership: typeof import('@/lib/membership-api');
let api: ReturnType<typeof installFetchRoutes>;

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  membership = await import('@/lib/membership-api');
  store.setAccessToken('member-token');
});

it('reads the member report with its notice and cancellation without generating a report', async () => {
  const report = { weekStart: '2026-11-02', totalMatches: 4, games: [], notice: '일부 경기 정보를 불러오지 못했어요.' };
  api.route('/api/v1/memberships/weekly-report', () => json(200, { success: true, data: report }));
  const controller = new AbortController();

  await expect(membership.fetchMyWeeklyReport(controller.signal)).resolves.toEqual(report);

  expect(api.paths()).toEqual(['/api/v1/memberships/weekly-report']);
  expect(api.authorization(0)).toBe('Bearer member-token');
  expect(api.init(0)?.method ?? 'GET').toBe('GET');
  expect(api.init(0)?.signal).toBe(controller.signal);
});

it('preserves a non-member session on 403', async () => {
  api.route('/api/v1/memberships/weekly-report', () => json(403, { success: false, message: '멤버십 전용 콘텐츠입니다.' }));

  await expect(membership.fetchMyWeeklyReport()).rejects.toMatchObject({ status: 403 });
  expect(store.getAccessToken()).toBe('member-token');
});
