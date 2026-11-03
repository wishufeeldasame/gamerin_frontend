import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

let store: typeof import('@/lib/auth-store');
let mentoring: typeof import('@/lib/mentoring-api');
let mileage: typeof import('@/lib/mileage-api');
let ApiError: typeof import('@/lib/api-client').ApiError;
let isAuthError: typeof import('@/lib/api-client').isAuthError;
let api: ReturnType<typeof installFetchRoutes>;

const PROGRAMS = '/api/v1/mentoring/programs?page=0&size=10';
const page = { content: [], totalPages: 0, totalElements: 0, number: 0, size: 10 };

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  mentoring = await import('@/lib/mentoring-api');
  mileage = await import('@/lib/mileage-api');
  ({ ApiError, isAuthError } = await import('@/lib/api-client'));
  store.setAccessToken('token-a');
});

describe('mentoring-api', () => {
  it.each(['', '   ', null])('빈 서버 메시지(%j)는 상태를 보존한 한국어 fallback으로 처리한다', async (message) => {
    api.route('/api/v1/mentoring/mentors/me', () => json(500, { message }));
    api.route('/api/v1/mentoring/programs/p-1', () => json(404, { message }));

    await expect(mentoring.fetchMyMentorProfile()).rejects.toMatchObject({
      status: 500, reason: 'http', message: '멘토링 요청 처리에 실패했습니다.',
    });
    await expect(mentoring.fetchMentoringProgramDetail('p-1')).rejects.toMatchObject({
      status: 404, reason: 'http', message: '멘토링 정보를 찾을 수 없습니다.',
    });
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('네트워크 실패는 한국어 오류로 전달하고 세션을 유지한다', async () => {
    api.route('/api/v1/mentoring/mentors/me', () => { throw new TypeError('Failed to fetch'); });
    const error = await mentoring.fetchMyMentorProfile().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 0, reason: 'unavailable', message: '멘토링 요청 처리에 실패했습니다.',
    });
    expect(isAuthError(error)).toBe(false);
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('authRequired: false 조회는 토큰이 없어도 미리 refresh하지 않고 보낸다', async () => {
    store.removeAccessToken();
    api.route(PROGRAMS, () => json(200, { success: true, data: page }));

    await expect(mentoring.fetchMentoringPrograms({})).resolves.toEqual(page);
    expect(api.authorization(0)).toBeNull();
    expect(api.count('/api/v1/auth/refresh')).toBe(0);
  });

  it('authRequired: false 조회의 인증 거절은 기존 문구로 끝나고, 익명으로 세 번째 요청을 보내지 않는다', async () => {
    api.route(PROGRAMS, () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    const error = await mentoring.fetchMentoringPrograms({}).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, reason: 'unauthenticated' });
    expect(isAuthError(error)).toBe(true);
    expect(api.count(PROGRAMS)).toBe(1);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('인증이 필요한 요청의 최종 401은 공통 인증 오류로 세션을 종료한다', async () => {
    api.route('/api/v1/mentoring/mentors/me', () => json(401, {}), () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(200, { data: { userId: 'user-a', accessToken: 'token-b' } }));

    const error = await mentoring.fetchMyMentorProfile().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(mentoring.MentoringApiError);
    expect(error).toMatchObject({ status: 401, reason: 'http' });
    expect(isAuthError(error)).toBe(true);
    expect(api.count('/api/v1/mentoring/mentors/me')).toBe(2);
    expect(store.getAccessToken()).toBeNull();
  });

  it('fetchGames는 /api/v1/games를 토큰과 함께 조회한다', async () => {
    const games = [{ code: 'LOL', name: 'League of Legends' }];
    api.route('/api/v1/games', () => json(200, { success: true, data: games }));

    await expect(mentoring.fetchGames()).resolves.toEqual(games);
    expect(api.authorization(0)).toBe('Bearer token-a');
  });

  it('404는 MentoringApiError로 구분한다', async () => {
    api.route('/api/v1/mentoring/programs/p-1', () => json(404, { message: '프로그램이 없습니다.' }));

    const error = await mentoring.fetchMentoringProgramDetail('p-1').catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(mentoring.MentoringApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: 'MentoringApiError', status: 404, message: '프로그램이 없습니다.' });
    expect(mentoring.isMentoringNotFoundError(error)).toBe(true);
  });

  it('refresh 일시 장애는 인증 오류가 아니며 세션을 유지한다', async () => {
    api.route('/api/v1/mentoring/mentors/me', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(503, {}));

    const error = await mentoring.fetchMyMentorProfile().catch((reason: unknown) => reason);

    expect(isAuthError(error)).toBe(false);
    expect((error as Error).message).toBe('멘토링 요청 처리에 실패했습니다.');
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('envelope 없는 원문 응답과 data: null을 그대로 받는다', async () => {
    api.route('/api/v1/mentoring/mentors/me', () => json(200, { userId: 'u' }));
    api.route('/api/v1/mentoring/programs/p-1', () => json(200, { success: true, data: null }));

    await expect(mentoring.fetchMyMentorProfile()).resolves.toEqual({ userId: 'u' });
    await expect(mentoring.deleteMentoringProgram('p-1')).resolves.toBeUndefined();
  });
});

describe('mileage-api', () => {
  it.each(['', '   ', null])('빈 서버 메시지(%j)는 상태를 보존한 한국어 fallback으로 처리한다', async (message) => {
    api.route('/api/v1/mileage/me/balance', () => json(400, { message }));

    await expect(mileage.fetchMyMileageBalance()).rejects.toMatchObject({
      status: 400, reason: 'http', message: '마일리지 요청을 처리하지 못했습니다.',
    });
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('네트워크 실패는 한국어 ApiError로 전달하고 세션을 유지한다', async () => {
    api.route('/api/v1/mileage/me/balance', () => { throw new TypeError('Failed to fetch'); });
    const error = await mileage.fetchMyMileageBalance().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 0, reason: 'unavailable', message: '마일리지 요청을 처리하지 못했습니다.',
    });
    expect(isAuthError(error)).toBe(false);
    expect(store.getAccessToken()).toBe('token-a');
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('최종 401은 기존 인증 문구로 끝낸다', async () => {
    api.route('/api/v1/mileage/me/balance', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    await expect(mileage.fetchMyMileageBalance()).rejects.toMatchObject({
      name: 'ApiError', status: 401, reason: 'unauthenticated',
      message: '로그인이 필요하거나 인증이 만료되었습니다. 다시 로그인해주세요.',
    });
  });

  it('서버 문구를 우선하고, 없으면 기존 기본 문구를 쓴다', async () => {
    api.route(
      '/api/v1/mileage/me/balance',
      () => json(400, { message: '충전 금액이 올바르지 않습니다.' }),
      () => json(500, {}),
    );

    await expect(mileage.fetchMyMileageBalance()).rejects.toMatchObject({
      name: 'ApiError', status: 400, reason: 'http', message: '충전 금액이 올바르지 않습니다.',
    });
    await expect(mileage.fetchMyMileageBalance()).rejects.toMatchObject({
      name: 'ApiError', status: 500, reason: 'http', message: '마일리지 요청을 처리하지 못했습니다.',
    });
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('envelope가 있으면 data를, 없으면 원문을 반환한다', async () => {
    api.route(
      '/api/v1/mileage/me/balance',
      () => json(200, { success: true, data: { currentBalance: 10 } }),
      () => json(200, { currentBalance: 20 }),
    );

    await expect(mileage.fetchMyMileageBalance()).resolves.toEqual({ currentBalance: 10 });
    await expect(mileage.fetchMyMileageBalance()).resolves.toEqual({ currentBalance: 20 });
  });
});
