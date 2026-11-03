import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, flush, installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({ getApiBaseUrl: () => 'http://api.test' }));
let reports: typeof import('@/lib/report-api');
let store: typeof import('@/lib/auth-store');
let api: ReturnType<typeof installFetchRoutes>;
const path = '/api/v1/reports/my?page=0&size=20&sort=createdAt%2Cdesc';
const page = { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 };

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  reports = await import('@/lib/report-api');
  store.setAccessToken('user-token');
});

describe('fetchMyReports', () => {
  it('loads the authenticated own-report Page with the default size and sort', async () => {
    api.route(path, () => json(200, { success: true, data: page }));
    await expect(reports.fetchMyReports()).resolves.toEqual(page);
    expect(api.authorization(0)).toBe('Bearer user-token');
    expect(api.paths()).toEqual([path]);
  });

  it('sends a zero-based page and forwards the AbortSignal', async () => {
    const controller = new AbortController();
    api.route('/api/v1/reports/my?page=1&size=20&sort=createdAt%2Cdesc', () => json(200, { success: true, data: { ...page, number: 1 } }));
    await reports.fetchMyReports({ page: 1 }, controller.signal);
    expect(api.init(0)?.signal).toBe(controller.signal);
  });

  it('discards a previous user response after the authentication generation changes', async () => {
    const response = deferred<Response>();
    api.route(path, () => response.promise);
    const request = reports.fetchMyReports();
    await flush();
    store.setAccessToken('next-user-token');
    response.resolve(json(200, { success: true, data: page }));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBe('next-user-token');
  });

  it('keeps errors distinct from an empty own-report page', async () => {
    api.route(path, () => json(500, { success: false, message: '내 신고 조회 실패' }));
    await expect(reports.fetchMyReports()).rejects.toMatchObject({ status: 500, message: '내 신고 조회 실패' });
    expect(store.getAccessToken()).toBe('user-token');
  });
});
