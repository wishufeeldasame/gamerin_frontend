import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

let store: typeof import('@/lib/auth-store');
let report: typeof import('@/lib/report-api');
let gameStats: typeof import('@/lib/game-stats-api');
let ApiError: typeof import('@/lib/api-client').ApiError;
let api: ReturnType<typeof installFetchRoutes>;

const REASONS = '/api/v1/reports/reasons';
const request = {
  targetType: 'POST',
  targetId: 'post-1',
  reasonCode: 'SPAM',
} as const;

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  report = await import('@/lib/report-api');
  gameStats = await import('@/lib/game-stats-api');
  ({ ApiError } = await import('@/lib/api-client'));
  store.setAccessToken('token-a');
});

describe('report-api', () => {
  it('중복 신고 409는 ReportApiError의 status와 서버 문구로 구분한다', async () => {
    api.route('/api/v1/reports', () => json(409, { message: '이미 신고한 대상입니다.' }));

    const error = await report.createReport(request).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(report.ReportApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: 'ReportApiError', status: 409, message: '이미 신고한 대상입니다.' });
    expect(api.init(0)).toMatchObject({ method: 'POST', body: JSON.stringify(request) });
    expect(new Headers(api.init(0)?.headers).get('Content-Type')).toBe('application/json');
  });

  it('일반 403은 세션을 유지하고 차단 계정은 refresh 없이 세션을 종료한다', async () => {
    api.route(
      REASONS,
      () => json(403, { message: '권한이 없습니다.' }),
      () => json(403, { message: '활성 상태 계정이 아닙니다.' }),
    );

    await expect(report.fetchReportReasons()).rejects.toMatchObject({ status: 403, message: '권한이 없습니다.' });
    expect(store.getAccessToken()).toBe('token-a');

    await expect(report.fetchReportReasons()).rejects.toMatchObject({
      status: 403,
      message: '정지되었거나 비활성화된 계정입니다. 계정 상태를 확인해주세요.',
    });
    expect(api.count('/api/v1/auth/refresh')).toBe(0);
    expect(store.getAccessToken()).toBeNull();
  });

  it('refresh 거절은 기존 인증 문구와 401로 끝낸다', async () => {
    api.route(REASONS, () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    await expect(report.fetchReportReasons()).rejects.toMatchObject({
      status: 401,
      message: '로그인이 필요하거나 인증이 만료되었습니다.',
    });
  });

  it('envelope가 없으면 형식 오류로 끝낸다', async () => {
    api.route(REASONS, () => json(200, []));

    await expect(report.fetchReportReasons()).rejects.toMatchObject({
      message: '신고 API 응답 형식이 올바르지 않습니다.',
    });
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('AbortSignal을 전달한다', async () => {
    const controller = new AbortController();
    controller.abort();
    api.route(REASONS, (init) => {
      init?.signal?.throwIfAborted();
      return json(200, { data: [] });
    });

    await expect(report.fetchReportReasons(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('game-stats-api', () => {
  it('GameStatsApiError의 (status, message) 생성자와 기존 문구를 보존한다', async () => {
    api.route('/api/v1/pubg/me', () => json(404, {}), () => json(502, { message: 'PUBG API 오류' }));

    const first = await gameStats.fetchPubgSummary().catch((reason: unknown) => reason);
    expect(first).toBeInstanceOf(gameStats.GameStatsApiError);
    expect(first).toMatchObject({ name: 'GameStatsApiError', status: 404, message: '게임 전적 요청에 실패했습니다.' });
    await expect(gameStats.fetchPubgSummary()).rejects.toMatchObject({ status: 502, message: 'PUBG API 오류' });
    expect(new gameStats.GameStatsApiError(418, 'teapot')).toMatchObject({ status: 418, message: 'teapot' });
  });

  it('최종 401이면 세션을 종료한다', async () => {
    api.route('/api/v1/pubg/me', () => json(401, {}), () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(200, { data: { accessToken: 'token-b' } }));

    await expect(gameStats.fetchPubgSummary()).rejects.toMatchObject({ status: 401 });
    expect(store.getAccessToken()).toBeNull();
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('data: null은 성공이고 data가 없으면 형식 오류다', async () => {
    api.route('/api/v1/pubg/disconnect', () => json(200, { success: true, data: null }));
    api.route('/api/v1/r6/me/refresh', () => json(200, { success: true }));

    await expect(gameStats.disconnectGameStats('PUBG')).resolves.toBeNull();
    await expect(gameStats.refreshR6Summary()).rejects.toMatchObject({
      status: 200,
      message: '게임 전적 응답 형식이 올바르지 않습니다.',
    });
  });
});
