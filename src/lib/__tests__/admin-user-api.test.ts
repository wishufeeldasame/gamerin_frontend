import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

const authorization = vi.hoisted(() => ({ notifyAdminAuthorizationFailure: vi.fn() }));
vi.mock('@/lib/api-base', () => ({ getApiBaseUrl: () => 'http://api.test' }));
vi.mock('@/lib/admin-auth', () => authorization);

let api: ReturnType<typeof installFetchRoutes>;
let users: typeof import('@/lib/admin-user-api');
let store: typeof import('@/lib/auth-store');
const userId = '00000000-0000-4000-8000-000000000001';
const penaltyId = '00000000-0000-4000-8000-000000000002';
const user = {
  id: userId, handle: 'gamer', nickname: '사용자', email: 'user@example.test',
  profileImageUrl: '/uploads/avatar.jpg', role: 'USER', status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z', reportsReceivedCount: 2, activeSanction: '경고', activePenaltyId: penaltyId,
};
const penalty = {
  id: penaltyId, userId, userNickname: '사용자', reportId: null,
  penaltyType: 'WARNING', reason: '운영 정책 안내', startAt: '2026-10-01T00:00:00Z',
  endAt: null, isActive: true, administeredByAdminId: null,
  administeredByAdminNickname: null, createdAt: '2026-10-01T00:00:00Z',
};
const page = <T,>(content: T[]) => ({ content, totalPages: 1, totalElements: content.length, number: 0, size: 10 });

describe('관리자 사용자 API 계약', () => {
  beforeEach(async () => {
    vi.resetModules();
    api = installFetchRoutes();
    users = await import('@/lib/admin-user-api');
    store = await import('@/lib/auth-store');
    store.setAccessToken('test-admin-token');
  });

  it('검색, 상태, 제재 없음(false), 페이지와 정렬을 서버에 전달한다', async () => {
    const path = '/api/v1/admin/users?query=gamer&status=DELETED&hasSanction=false&page=2&size=6&sort=createdAt%2Casc';
    api.route(path, () => json(200, { success: true, data: page([user]) }));
    const controller = new AbortController();
    const result = await users.fetchAdminUsers({ query: ' @gamer ', status: 'DELETED', hasSanction: false, page: 2, size: 6, sort: 'createdAt,asc' }, controller.signal);
    expect(api.paths()).toEqual([path]);
    expect(result.content[0].profileImageUrl).toBe('http://api.test/uploads/avatar.jpg');
    expect(api.authorization(0)).toBe('Bearer test-admin-token');
    expect(api.init(0)?.signal).toBe(controller.signal);
  });

  it('기본 페이지 파라미터를 적용하고 빈 검색과 미선택 필터를 생략한다', async () => {
    const path = '/api/v1/admin/users?page=0&size=20&sort=createdAt%2Cdesc';
    api.route(path, () => json(200, { success: true, data: page([]) }));
    await users.fetchAdminUsers({ query: '  ' });
    expect(api.paths()).toEqual([path]);
  });

  it('핸들 상세와 UUID 상세를 각각의 실제 경로로 조회한다', async () => {
    api.route('/api/v1/admin/users/by-handle/%ED%95%9C%2F%EA%B8%80', () => json(200, { success: true, data: user }));
    api.route('/api/v1/admin/users/' + userId, () => json(200, { success: true, data: user }));
    expect((await users.fetchAdminUserByHandle('한/글')).id).toBe(userId);
    expect((await users.fetchAdminUser(userId)).id).toBe(userId);
    expect(api.paths()).toEqual(['/api/v1/admin/users/by-handle/%ED%95%9C%2F%EA%B8%80', '/api/v1/admin/users/' + userId]);
  });

  it('제재 목록 Page를 실제 DTO 그대로 반환한다', async () => {
    const path = '/api/v1/admin/users/' + userId + '/penalties?page=1&size=5&sort=createdAt%2Cdesc';
    api.route(path, () => json(200, { success: true, data: page([penalty]) }));
    const response = await users.fetchAdminUserPenalties(userId, { page: 1, size: 5 });
    expect(response.content[0]).toEqual(penalty);
    expect(response.content[0].endAt).toBeNull();
  });

  it.each([
    ['WARNING', undefined], ['SUSPENSION_3D', 3], ['SUSPENSION_7D', 7],
    ['SUSPENSION_30D', 30], ['PERMANENT_BAN', undefined],
  ] as const)('%s 제재 요청에 실제 유형과 사유 및 선택 기간을 전송한다', async (penaltyType, durationDays) => {
    api.route('/api/v1/admin/users/' + userId + '/penalties', () => json(200, { success: true, data: penalty }));
    const request = { penaltyType, reason: '제재 근거', ...(durationDays ? { durationDays } : {}), reportId: '00000000-0000-4000-8000-000000000003' };
    await users.createAdminUserPenalty(userId, request);
    expect(api.init(0)).toMatchObject({ method: 'POST', body: JSON.stringify(request) });
  });

  it('선택한 사용자·제재 UUID 한 건을 DELETE하고 가짜 해제 사유를 보내지 않는다', async () => {
    const path = '/api/v1/admin/users/' + userId + '/penalties/' + penaltyId;
    api.route(path, () => json(200, { success: true, data: { ...penalty, isActive: false } }));
    await expect(users.revokeAdminUserPenalty(userId, penaltyId)).resolves.toMatchObject({ isActive: false });
    expect(api.init(0)).toMatchObject({ method: 'DELETE' });
    expect(api.init(0)?.body).toBeUndefined();
  });

  it('서버의 보호 거절 오류를 보존하고 상태를 성공으로 처리하지 않는다', async () => {
    api.route('/api/v1/admin/users/' + userId + '/penalties', () => json(400, { success: false, message: '관리자 계정에는 제재할 수 없습니다.' }));
    await expect(users.createAdminUserPenalty(userId, { penaltyType: 'WARNING', reason: '사유' })).rejects.toMatchObject({ status: 400, message: '관리자 계정에는 제재할 수 없습니다.' });
    expect(store.getAccessToken()).toBe('test-admin-token');
  });
});
