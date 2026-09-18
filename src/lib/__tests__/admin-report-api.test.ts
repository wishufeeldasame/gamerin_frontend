import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, flush, installFetchRoutes, json as jsonResponse } from '@/test/fetch-routes';

const authorizationMocks = vi.hoisted(() => ({
  notifyAdminAuthorizationFailure: vi.fn(),
}));

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));
vi.mock('@/lib/admin-auth', () => authorizationMocks);

let store: typeof import('@/lib/auth-store');
let fetchAdminReports: typeof import('@/lib/admin-report-api').fetchAdminReports;
let updateAdminReportStatus: typeof import('@/lib/admin-report-api').updateAdminReportStatus;
let AdminReportApiError: typeof import('@/lib/admin-report-api').AdminReportApiError;
let fetchAdminHiddenContents: typeof import('@/lib/admin-content-api').fetchAdminHiddenContents;
let restoreAdminHiddenContent: typeof import('@/lib/admin-content-api').restoreAdminHiddenContent;
let api: ReturnType<typeof installFetchRoutes>;

const REPORTS = '/api/v1/admin/reports?page=0&size=20&sort=createdAt%2Cdesc';
const HIDDEN = '/api/v1/admin/contents/hidden?page=0&size=100&sort=updatedAt%2Cdesc';
const emptyPage = { content: [], totalPages: 0, totalElements: 0, number: 0, size: 20 };

describe('admin API requests', () => {
  beforeEach(async () => {
    vi.resetModules();
    window.localStorage.clear();
    api = installFetchRoutes();
    store = await import('@/lib/auth-store');
    ({ fetchAdminReports, updateAdminReportStatus, AdminReportApiError } = await import('@/lib/admin-report-api'));
    ({ fetchAdminHiddenContents, restoreAdminHiddenContent } = await import('@/lib/admin-content-api'));
    store.setAccessToken('access-token');
  });

  it('notifies the guard, ends the session and rejects with 401 when refresh fails', async () => {
    api.route(REPORTS, () => jsonResponse(401, { success: false, message: 'expired' }));
    api.route('/api/v1/auth/refresh', () => jsonResponse(401, {}));

    const error = await fetchAdminReports({}).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(AdminReportApiError);
    expect(error).toMatchObject({ status: 401, message: '관리자 로그인이 필요합니다.' });
    expect(api.count('/api/v1/auth/refresh')).toBe(1);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(authorizationMocks.notifyAdminAuthorizationFailure).toHaveBeenCalledWith(401);
  });

  it('ends the session and notifies 401 when the retried request is still 401', async () => {
    api.route(REPORTS, () => jsonResponse(401, {}), () => jsonResponse(401, { message: 'expired' }));
    api.route('/api/v1/auth/refresh', () => jsonResponse(200, { data: { accessToken: 'refreshed-token' } }));

    await expect(fetchAdminReports({})).rejects.toMatchObject({ status: 401, message: 'expired' });

    expect(api.count(REPORTS)).toBe(2);
    expect(store.getAccessToken()).toBeNull();
    expect(authorizationMocks.notifyAdminAuthorizationFailure).toHaveBeenCalledWith(401);
  });

  it('notifies the guard and preserves a 403 response', async () => {
    api.route(REPORTS, () => jsonResponse(403, { success: false, message: 'forbidden' }));

    await expect(fetchAdminReports({})).rejects.toMatchObject({
      status: 403,
      message: 'forbidden',
    });

    expect(api.count('/api/v1/auth/refresh')).toBe(0);
    expect(store.getAccessToken()).toBe('access-token');
    expect(authorizationMocks.notifyAdminAuthorizationFailure).toHaveBeenCalledWith(403);
  });

  it('ends the session without refresh for a blocked account', async () => {
    api.route(REPORTS, () => jsonResponse(403, { success: false, message: '활성 상태 계정이 아닙니다.' }));

    await expect(fetchAdminReports({})).rejects.toMatchObject({
      status: 403,
      message: '정지되었거나 비활성화된 계정입니다. 계정 상태를 확인해주세요.',
    });

    expect(api.count('/api/v1/auth/refresh')).toBe(0);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(authorizationMocks.notifyAdminAuthorizationFailure).toHaveBeenCalledWith(401);
    expect(authorizationMocks.notifyAdminAuthorizationFailure).not.toHaveBeenCalledWith(403);
  });

  it('keeps the session and does not notify the guard on a temporary refresh failure', async () => {
    api.route(REPORTS, () => jsonResponse(401, {}));
    api.route('/api/v1/auth/refresh', () => jsonResponse(503, {}));

    await expect(fetchAdminReports({})).rejects.toMatchObject({
      message: '관리자 요청 처리에 실패했습니다.',
    });

    expect(store.getAccessToken()).toBe('access-token');
    expect(authorizationMocks.notifyAdminAuthorizationFailure).not.toHaveBeenCalled();
  });

  it.each([
    ['401', () => jsonResponse(401, {})],
    ['403', () => jsonResponse(403, { message: 'forbidden' })],
    ['blocked', () => jsonResponse(403, { message: '정지된 계정입니다.' })],
  ] as const)('does not notify or log out the next user for a late %s response', async (_name, makeResponse) => {
    const late = deferred<Response>();
    api.route(REPORTS, () => late.promise);

    const request = fetchAdminReports({});
    await flush();
    store.setAccessToken('next-admin-token');
    late.resolve(makeResponse());

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBe('next-admin-token');
    expect(api.count('/api/v1/auth/logout')).toBe(0);
    expect(authorizationMocks.notifyAdminAuthorizationFailure).not.toHaveBeenCalled();
  });

  it('sends the refreshed token after a recoverable 401', async () => {
    api.route(
      REPORTS,
      () => jsonResponse(401, { success: false }),
      () => jsonResponse(200, { success: true, data: emptyPage }),
    );
    api.route('/api/v1/auth/refresh', () => jsonResponse(200, { data: { accessToken: 'refreshed-token' } }));

    await expect(fetchAdminReports({})).resolves.toMatchObject({
      content: [],
    });

    expect(api.authorization(2)).toBe('Bearer refreshed-token');
    expect(authorizationMocks.notifyAdminAuthorizationFailure).not.toHaveBeenCalled();
  });

  it('rejects a response without the ApiResponse envelope without ending the session', async () => {
    api.route(REPORTS, () => jsonResponse(200, emptyPage));

    await expect(fetchAdminReports({})).rejects.toMatchObject({
      status: 200,
      message: '관리자 신고 API 응답 형식이 올바르지 않습니다.',
    });
    expect(store.getAccessToken()).toBe('access-token');
  });

  it('updates a report status with the backend report UUID', async () => {
    api.route('/api/v1/admin/reports/a9c79ce8-d1b5-4fba-a6e3-7f9c66212193/status', () =>
      jsonResponse(200, {
        success: true,
        data: {
          id: 'a9c79ce8-d1b5-4fba-a6e3-7f9c66212193',
          reportCode: 'RPT-20260831-0001',
          status: 'IN_REVIEW',
        },
      }),
    );

    await expect(
      updateAdminReportStatus('a9c79ce8-d1b5-4fba-a6e3-7f9c66212193', 'IN_REVIEW'),
    ).resolves.toMatchObject({ status: 'IN_REVIEW' });

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://api.test/api/v1/admin/reports/a9c79ce8-d1b5-4fba-a6e3-7f9c66212193/status',
    );
    expect(options).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_REVIEW' }),
      credentials: 'include',
    });
  });

  it('applies the same authorization policy to admin content requests', async () => {
    api.route(HIDDEN, () => jsonResponse(403, { message: 'forbidden' }));
    api.route(
      '/api/v1/admin/contents/POST/content-id/restore',
      () => jsonResponse(401, {}),
    );
    api.route('/api/v1/auth/refresh', () => jsonResponse(401, {}));

    await expect(fetchAdminHiddenContents()).rejects.toMatchObject({ status: 403 });
    expect(authorizationMocks.notifyAdminAuthorizationFailure).toHaveBeenLastCalledWith(403);
    expect(store.getAccessToken()).toBe('access-token');

    await expect(restoreAdminHiddenContent('POST', 'content-id')).rejects.toBeInstanceOf(AdminReportApiError);
    expect(authorizationMocks.notifyAdminAuthorizationFailure).toHaveBeenLastCalledWith(401);
    expect(store.getAccessToken()).toBeNull();
  });

  it('loads hidden content using the backend paging contract', async () => {
    api.route('/api/v1/admin/contents/hidden?page=0&size=25&sort=updatedAt%2Cdesc', () =>
      jsonResponse(200, {
        success: true,
        data: {
          content: [],
          totalPages: 0,
          totalElements: 0,
          number: 0,
          size: 25,
        },
      }),
    );

    await fetchAdminHiddenContents({ page: 0, size: 25, sort: 'updatedAt,desc' });

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://api.test/api/v1/admin/contents/hidden?page=0&size=25&sort=updatedAt%2Cdesc',
    );
    expect(options).toMatchObject({
      credentials: 'include',
    });
  });

  it('restores hidden content without sending an unsupported reason body', async () => {
    api.route('/api/v1/admin/contents/POST/content-id/restore', () =>
      jsonResponse(200, {
        success: true,
        data: {
          id: 'count-id',
          targetType: 'POST',
          targetId: 'content-id',
          reportCount: 5,
          isHidden: false,
          updatedAt: '2026-08-31T12:00:00+09:00',
        },
      }),
    );

    await restoreAdminHiddenContent('POST', 'content-id');

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://api.test/api/v1/admin/contents/POST/content-id/restore',
    );
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'include',
    });
    expect(options?.body).toBeUndefined();
  });
});
