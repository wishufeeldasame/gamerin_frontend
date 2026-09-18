import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

let store: typeof import('@/lib/auth-store');
let mentoring: typeof import('@/lib/mentoring-api');
let mileage: typeof import('@/lib/mileage-api');
let ApiError: typeof import('@/lib/api-client').ApiError;
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
  ({ ApiError } = await import('@/lib/api-client'));
  store.setAccessToken('token-a');
});

describe('mentoring-api', () => {
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
    expect(error).not.toBeInstanceOf(mentoring.MentoringAuthError);
    expect((error as Error).message).toBe('멘토링 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    expect(api.count(PROGRAMS)).toBe(1);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('인증이 필요한 요청의 최종 401은 MentoringAuthError로 끝내고 세션을 종료한다', async () => {
    api.route('/api/v1/mentoring/mentors/me', () => json(401, {}), () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(200, { data: { accessToken: 'token-b' } }));

    const error = await mentoring.fetchMyMentorProfile().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(mentoring.MentoringAuthError);
    expect(mentoring.isMentoringAuthError(error)).toBe(true);
    expect(api.count('/api/v1/mentoring/mentors/me')).toBe(2);
    expect(store.getAccessToken()).toBeNull();
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

    expect(mentoring.isMentoringAuthError(error)).toBe(false);
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
  it('최종 401은 기존 인증 문구로 끝낸다', async () => {
    api.route('/api/v1/mileage/me/balance', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    await expect(mileage.fetchMyMileageBalance()).rejects.toThrow(
      'Authentication is required. Please sign in again.',
    );
  });

  it('서버 문구를 우선하고, 없으면 기존 기본 문구를 쓴다', async () => {
    api.route(
      '/api/v1/mileage/charge',
      () => json(400, { message: '충전 금액이 올바르지 않습니다.' }),
      () => json(500, {}),
    );

    await expect(mileage.chargeMileage(0)).rejects.toThrow('충전 금액이 올바르지 않습니다.');
    await expect(mileage.chargeMileage(0)).rejects.toThrow('Failed to process mileage request.');
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
