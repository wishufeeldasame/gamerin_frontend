import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({ getApiBaseUrl: () => 'http://api.test' }));

let store: typeof import('@/lib/auth-store');
let mentoring: typeof import('@/lib/admin-mentoring-api');
let settings: typeof import('@/lib/admin-settings-api');
let routes: ReturnType<typeof installFetchRoutes>;
const base = '/api/v1/admin/mentoring';
const emptyPage = { content: [], totalPages: 0, totalElements: 0, number: 0, size: 20 };

describe('admin mentoring and settings API contracts', () => {
  beforeEach(async () => {
    vi.resetModules();
    routes = installFetchRoutes();
    store = await import('@/lib/auth-store');
    mentoring = await import('@/lib/admin-mentoring-api');
    settings = await import('@/lib/admin-settings-api');
    store.setAccessToken('admin-access-token');
  });

  it('loads summary and server pages with backend enum filters and trimmed keyword', async () => {
    routes.route(base + '/summary', () => json(200, { success: true, data: { monthlySessionCount: 8, escrowHeldAmount: 900 } }));
    routes.route(base + '/mentors?page=2&size=20&sort=createdAt%2Cdesc&status=PENDING_APPROVAL', () => json(200, { success: true, data: emptyPage }));
    routes.route(base + '/programs?page=1&size=20&sort=createdAt%2Casc&status=CLOSED&keyword=%EA%B2%8C%EC%9E%84', () => json(200, { success: true, data: emptyPage }));

    await expect(mentoring.fetchAdminMentoringSummary()).resolves.toMatchObject({ monthlySessionCount: 8, escrowHeldAmount: 900 });
    await expect(mentoring.fetchAdminMentors({ page: 2, status: 'PENDING_APPROVAL' })).resolves.toEqual(emptyPage);
    await expect(mentoring.fetchAdminMentoringPrograms({ page: 1, status: 'CLOSED', sort: 'createdAt,asc', keyword: ' 게임 ' })).resolves.toEqual(emptyPage);
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => new Headers(options?.headers).get('Authorization') === 'Bearer admin-access-token')).toBe(true);
  });

  it('approves using the user UUID without a body and rejects with only a trimmed reason', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    routes.route(base + '/mentors/' + userId + '/approve', () => json(200, { success: true, data: { userId, status: 'ACTIVE' } }));
    routes.route(base + '/mentors/' + userId + '/reject', () => json(200, { success: true, data: { userId, status: 'INACTIVE' } }));

    await mentoring.approveAdminMentor(userId);
    await mentoring.rejectAdminMentor(userId, ' 근거 미확인 ');

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(calls[0][1]?.body).toBeUndefined();
    expect(calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ reason: '근거 미확인' }) });
  });

  it('changes program status independently of hide with backend UUIDs and request bodies', async () => {
    const programId = '22222222-2222-4222-8222-222222222222';
    routes.route(base + '/programs/' + programId + '/status', () => json(200, { success: true, data: { id: programId, status: 'CLOSED', isHidden: false } }));
    routes.route(base + '/programs/' + programId + '/hide', () => json(200, { success: true, data: { id: programId, status: 'CLOSED', isHidden: true } }));

    await expect(mentoring.updateAdminProgramStatus(programId, 'CLOSED')).resolves.toMatchObject({ status: 'CLOSED', isHidden: false });
    await expect(mentoring.hideAdminMentoringProgram(programId, ' 운영 정책 위반 ')).resolves.toMatchObject({ status: 'CLOSED', isHidden: true });

    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ status: 'CLOSED' }) });
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ reason: '운영 정책 위반' }) });
  });

  it('loads settings and PUTs a flat string map, including false and the sanction enum', async () => {
    const response = [{ configKey: 'AUTO_HIDE_ENABLED', configValue: 'false', description: '자동 숨김', updatedAt: '2026-10-07T00:00:00Z' }];
    routes.route('/api/v1/admin/settings',
      () => json(200, { success: true, data: response }),
      () => json(200, { success: true, data: response }),
    );
    await expect(settings.fetchAdminSettings()).resolves.toEqual(response);
    await expect(settings.updateAdminSettings({ AUTO_HIDE_ENABLED: 'false', DEFAULT_SANCTION_LEVEL: 'SUSPENSION_3D' })).resolves.toEqual(response);
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ AUTO_HIDE_ENABLED: 'false', DEFAULT_SANCTION_LEVEL: 'SUSPENSION_3D' }),
    });
  });

  it('keeps the shared administrator error policy for a forbidden settings request', async () => {
    routes.route('/api/v1/admin/settings', () => json(403, { success: false, message: '관리자 권한이 필요합니다.' }));
    await expect(settings.fetchAdminSettings()).rejects.toMatchObject({ status: 403, message: '관리자 권한이 필요합니다.' });
    expect(store.getAccessToken()).toBe('admin-access-token');
    expect(routes.count('/api/v1/auth/refresh')).toBe(0);
  });
});
