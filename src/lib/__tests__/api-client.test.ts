import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, flush, installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

type AuthStore = typeof import('@/lib/auth-store');
type ApiClient = typeof import('@/lib/api-client');

let store: AuthStore;
let client: ApiClient;

const toError = vi.fn(({ reason, status, message }: { reason: string; status: number; message: string | null }) => {
  const error = new Error(message ?? reason) as Error & { reason: string; status: number };
  error.reason = reason;
  error.status = status;
  return error;
});
const config = { toError };

let api: ReturnType<typeof installFetchRoutes>;

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  client = await import('@/lib/api-client');
  store.setAccessToken('token-a');
  window.localStorage.setItem(store.AUTH_USER_KEY, JSON.stringify({ id: 'user-a' }));
});

describe('apiRequest 401 처리', () => {
  it('첫 401이면 refresh 후 새 토큰으로 한 번 다시 보낸다', async () => {
    api.route('/api/v1/items', () => json(401, {}), () => json(200, { success: true, data: ['ok'] }));
    api.route('/api/v1/auth/refresh', () => json(200, { success: true, data: { accessToken: 'token-b' } }));

    await expect(client.apiRequest('/api/v1/items', config)).resolves.toEqual(['ok']);

    expect(api.paths()).toEqual(['/api/v1/items', '/api/v1/auth/refresh', '/api/v1/items']);
    expect(api.authorization(0)).toBe('Bearer token-a');
    expect(api.authorization(2)).toBe('Bearer token-b');
    expect(store.getAccessToken()).toBe('token-b');
  });

  it('재시도한 요청도 401이면 더 재시도하지 않고 세션을 종료한다', async () => {
    api.route('/api/v1/items', () => json(401, {}), () => json(401, { message: '만료' }));
    api.route('/api/v1/auth/refresh', () => json(200, { data: { accessToken: 'token-b' } }));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'http',
      status: 401,
      message: '만료',
    });

    expect(api.count('/api/v1/items')).toBe(2);
    expect(api.count('/api/v1/auth/refresh')).toBe(1);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(store.AUTH_USER_KEY)).toBeNull();
  });

  it('refresh가 인증을 거절하면 세션을 종료하고 인증 오류로 끝낸다', async () => {
    api.route('/api/v1/items', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, { message: '만료된 리프레시 토큰입니다.' }));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'unauthenticated',
      status: 401,
    });

    expect(api.count('/api/v1/items')).toBe(1);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
  });

  it('메모리에 토큰이 없으면 먼저 refresh하고, 거절되면 요청을 보내지 않는다', async () => {
    store.removeAccessToken();
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'unauthenticated',
    });
    expect(api.count('/api/v1/items')).toBe(0);
  });
});

describe('일시 장애에서 세션 유지', () => {
  it.each([500, 503, 429])('보호 API의 %i 응답은 요청 실패만 전달한다', async (status) => {
    api.route('/api/v1/items', () => json(status, { message: 'busy' }));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'http',
      status,
      message: 'busy',
    });

    expect(store.getAccessToken()).toBe('token-a');
    expect(window.localStorage.getItem(store.AUTH_USER_KEY)).not.toBeNull();
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('보호 API의 네트워크 오류는 그대로 전달하고 세션을 유지한다', async () => {
    api.route('/api/v1/items', () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toBeInstanceOf(TypeError);
    expect(store.getAccessToken()).toBe('token-a');
  });

  it.each([
    ['네트워크 오류', () => {
      throw new TypeError('Failed to fetch');
    }, 0],
    ['500', () => json(500, {}), 500],
    ['429', () => json(429, {}), 429],
    ['토큰 없는 성공 응답', () => json(200, { success: true, data: {} }), 0],
  ] as const)('refresh의 %s는 unavailable로 끝내고 세션을 유지한다', async (_name, handler, status) => {
    api.route('/api/v1/items', () => json(401, {}));
    api.route('/api/v1/auth/refresh', handler);

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'unavailable',
      status,
    });

    expect(window.localStorage.getItem(store.AUTH_USER_KEY)).not.toBeNull();
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('refreshAccessTokenResult도 일시 장애에서 인증을 지우지 않는다', async () => {
    api.route('/api/v1/auth/refresh', () => json(503, {}));
    const generation = store.getAuthGeneration();

    await expect(store.refreshAccessTokenResult()).resolves.toEqual({ status: 'failed', httpStatus: 503 });

    expect(store.getAuthGeneration()).toBe(generation);
    expect(store.getAccessToken()).toBe('token-a');
    expect(window.localStorage.getItem(store.AUTH_USER_KEY)).not.toBeNull();
  });
});

describe('동시 요청', () => {
  it('refresh를 공유하고, 거절되면 로그아웃은 한 번만 하며 모든 요청이 인증 오류를 받는다', async () => {
    const refresh = deferred<Response>();
    api.route('/api/v1/a', () => json(401, {}));
    api.route('/api/v1/b', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => refresh.promise);

    const first = client.apiRequest('/api/v1/a', config);
    const second = client.apiRequest('/api/v1/b', config);
    await flush();
    refresh.resolve(json(401, {}));

    await expect(first).rejects.toMatchObject({ reason: 'unauthenticated' });
    await expect(second).rejects.toMatchObject({ reason: 'unauthenticated' });
    expect(api.count('/api/v1/auth/refresh')).toBe(1);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('둘 다 최종 401이면 로그아웃은 한 번이고 뒤의 요청도 인증 오류를 받는다', async () => {
    const lateRetry = deferred<Response>();
    api.route('/api/v1/a', () => json(401, {}), () => json(401, {}));
    api.route('/api/v1/b', () => json(401, {}), () => lateRetry.promise);
    api.route('/api/v1/auth/refresh', () => json(200, { data: { accessToken: 'token-b' } }));

    const first = client.apiRequest('/api/v1/a', config);
    const second = client.apiRequest('/api/v1/b', config);

    await expect(first).rejects.toMatchObject({ reason: 'http', status: 401 });
    lateRetry.resolve(json(401, {}));
    await expect(second).rejects.toMatchObject({ reason: 'unauthenticated', status: 401 });
    expect(api.count('/api/v1/auth/refresh')).toBe(1);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });
});

describe('사용자 전환·로그아웃 뒤에 도착한 응답', () => {
  it.each([
    ['성공', () => json(200, { data: 'old-user-data' })],
    ['401', () => json(401, {})],
    ['차단', () => json(403, { message: '정지된 계정입니다.' })],
  ] as const)('%s 응답은 AbortError로 버리고 새 사용자의 세션을 건드리지 않는다', async (_name, makeResponse) => {
    const late = deferred<Response>();
    api.route('/api/v1/items', () => late.promise);

    const request = client.apiRequest('/api/v1/items', config);
    await flush();
    store.setAccessToken('token-new-user');
    late.resolve(makeResponse());

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(toError).not.toHaveBeenCalled();
    expect(store.getAccessToken()).toBe('token-new-user');
    expect(api.count('/api/v1/auth/refresh')).toBe(0);
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('refresh 도중 사용자가 바뀌면 이전 요청의 refresh 결과로 인증을 덮어쓰거나 로그아웃하지 않는다', async () => {
    const refresh = deferred<Response>();
    api.route('/api/v1/items', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => refresh.promise);

    const request = client.apiRequest('/api/v1/items', config);
    await flush();
    store.setAccessToken('token-new-user');
    refresh.resolve(json(401, {}));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBe('token-new-user');
    expect(api.count('/api/v1/auth/logout')).toBe(0);
    expect(toError).not.toHaveBeenCalled();
  });

  it('이전 세션이 만료된 뒤 새 사용자가 로그인하면 이전 요청은 인증 오류가 아닌 AbortError로 끝난다', async () => {
    const late = deferred<Response>();
    api.route('/api/v1/a', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));
    api.route('/api/v1/b', () => late.promise);

    const pending = client.apiRequest('/api/v1/b', config);
    await expect(client.apiRequest('/api/v1/a', config)).rejects.toMatchObject({ reason: 'unauthenticated' });
    store.setAccessToken('token-new-user');
    late.resolve(json(401, {}));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBe('token-new-user');
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('로그아웃 진행 중과 그 뒤에는 새 로그인 전까지 refresh로 인증을 되살리지 않는다', async () => {
    const logout = deferred<Response>();
    api.route('/api/v1/auth/logout', () => logout.promise);

    const logoutRequest = store.logoutAuthSession({ notify: false });
    expect(store.isLogoutInProgress()).toBe(true);

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'unauthenticated',
    });
    logout.resolve(new Response(null, { status: 204 }));
    await logoutRequest;
    await expect(store.refreshAccessTokenResult()).resolves.toEqual({ status: 'rejected' });

    expect(api.count('/api/v1/auth/refresh')).toBe(0);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
  });
});

describe('다른 탭의 로그아웃', () => {
  it('다른 탭 로그아웃 진행 중에 새로 로그인한 세션이 만료되면 이 탭의 세션도 종료한다', async () => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: store.AUTH_SYNC_KEY,
      newValue: JSON.stringify({ type: 'logout-start', id: 'other-tab', expiresAt: Date.now() + 10_000 }),
    }));
    expect(store.isLogoutInProgress()).toBe(true);
    store.setAccessToken('token-new-login');
    api.route('/api/v1/items', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'unauthenticated',
    });
    expect(store.getAccessToken()).toBeNull();
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });
});

describe('로그아웃 요청이 끝나기 전의 새 로그인', () => {
  it('새 세션이 만료되면 진행 중인 로그아웃을 재사용하지 않고 새 토큰도 지운 뒤 서버 로그아웃을 이어서 보낸다', async () => {
    const firstLogout = deferred<Response>();
    api.route('/api/v1/auth/logout', () => firstLogout.promise);
    void store.logoutAuthSession({ notify: false });
    store.setAccessToken('token-new-login');
    api.route('/api/v1/items', () => json(401, {}), () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(200, { data: { accessToken: 'token-new-refreshed' } }));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({ reason: 'http', status: 401 });
    expect(store.getAccessToken()).toBeNull();
    expect(api.count('/api/v1/auth/logout')).toBe(1);

    firstLogout.resolve(new Response(null, { status: 204 }));
    await store.waitForLogoutCompletion();
    await flush();
    expect(api.count('/api/v1/auth/logout')).toBe(2);
  });

  it('로그인 화면이 기다리는 로그아웃 완료는 이어지는 서버 로그아웃까지 포함한다', async () => {
    const firstLogout = deferred<Response>();
    const secondLogout = deferred<Response>();
    api.route('/api/v1/auth/logout', () => firstLogout.promise, () => secondLogout.promise);
    void store.logoutAuthSession({ notify: false });
    store.setAccessToken('token-new-login');
    void store.logoutAuthSession({ notify: false });

    let completed = false;
    void store.waitForLogoutCompletion().then(() => {
      completed = true;
    });

    firstLogout.resolve(new Response(null, { status: 204 }));
    await flush();
    expect(api.count('/api/v1/auth/logout')).toBe(2);
    expect(completed).toBe(false);
    expect(store.isLogoutInProgress()).toBe(true);

    secondLogout.resolve(new Response(null, { status: 204 }));
    await flush();
    expect(completed).toBe(true);
    expect(store.isLogoutInProgress()).toBe(false);
  });

  it('이전 로그아웃이 끝나기 전에 또 로그인했으면 이어지는 서버 로그아웃을 보내지 않는다', async () => {
    const firstLogout = deferred<Response>();
    api.route('/api/v1/auth/logout', () => firstLogout.promise);
    void store.logoutAuthSession({ notify: false });
    store.setAccessToken('token-second');
    const chained = store.logoutAuthSession({ notify: false });
    store.setAccessToken('token-third');

    firstLogout.resolve(new Response(null, { status: 204 }));
    await chained;
    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBe('token-third');
  });
});

describe('403과 차단 계정', () => {
  it('일반 403은 권한 오류로 끝내고 세션을 유지한다', async () => {
    api.route('/api/v1/items', () => json(403, { message: '권한이 없습니다.' }));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'http',
      status: 403,
      message: '권한이 없습니다.',
    });
    expect(store.getAccessToken()).toBe('token-a');
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('차단 계정이면 refresh 없이 세션을 종료한다', async () => {
    api.route('/api/v1/items', () => json(403, { message: '활성 상태 계정이 아닙니다.' }));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'blocked',
      status: 403,
      message: '정지되었거나 비활성화된 계정입니다. 계정 상태를 확인해주세요.',
    });
    expect(api.count('/api/v1/auth/refresh')).toBe(0);
    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
  });

  it('401 응답이라도 차단 계정 코드면 refresh하지 않는다', async () => {
    api.route('/api/v1/items', () => json(401, { code: 'ACCOUNT_SUSPENDED' }));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({ reason: 'blocked' });
    expect(api.count('/api/v1/auth/refresh')).toBe(0);
  });

  it('성공 응답 데이터의 status 필드는 차단 계정으로 보지 않는다', async () => {
    api.route('/api/v1/items', () => json(200, { data: { status: 'INACTIVE' } }));

    await expect(client.apiRequest('/api/v1/items', config)).resolves.toEqual({ status: 'INACTIVE' });
    expect(store.getAccessToken()).toBe('token-a');
  });
});

describe('요청·응답 형식', () => {
  it('AbortSignal로 취소하면 AbortError로 끝내고 세션을 유지한다', async () => {
    const controller = new AbortController();
    api.route('/api/v1/items', (init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));

    const request = client.apiRequest('/api/v1/items', config, { signal: controller.signal });
    await flush();
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('refresh를 기다리는 동안 취소되면 다시 보내지 않는다', async () => {
    const controller = new AbortController();
    const refresh = deferred<Response>();
    api.route('/api/v1/items', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => refresh.promise);

    const request = client.apiRequest('/api/v1/items', config, { signal: controller.signal });
    await flush();
    controller.abort();
    refresh.resolve(json(200, { data: { accessToken: 'token-b' } }));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.count('/api/v1/items')).toBe(1);
  });

  it('envelope가 없는 성공 응답은 인증 거절과 구분해 invalid-response로 끝낸다', async () => {
    api.route('/api/v1/items', () => new Response('<html></html>', { status: 200 }));

    await expect(client.apiRequest('/api/v1/items', config)).rejects.toMatchObject({
      reason: 'invalid-response',
      status: 200,
    });
    expect(store.getAccessToken()).toBe('token-a');
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it("envelope: 'optional'이면 원문 응답을 그대로 반환한다", async () => {
    api.route('/api/v1/items', () => json(200, { currentBalance: 3 }));

    await expect(
      client.apiRequest('/api/v1/items', { ...config, envelope: 'optional' }),
    ).resolves.toEqual({ currentBalance: 3 });
  });

  it('data: null은 정상 성공값이다', async () => {
    api.route('/api/v1/items', () => json(200, { success: true, data: null }));

    await expect(client.apiRequest('/api/v1/items', config)).resolves.toBeNull();
  });

  it('JSON 본문에는 Content-Type을 붙이고 기존 헤더·credentials를 보존한다', async () => {
    api.route('/api/v1/items', () => json(200, { data: null }));

    await client.apiRequest('/api/v1/items', config, {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
      headers: { 'X-Trace': 't' },
    });

    const init = api.init(0);
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Trace')).toBe('t');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ a: 1 }), credentials: 'include' });
  });

  it('FormData에는 JSON Content-Type을 붙이지 않는다', async () => {
    api.route('/api/v1/items', () => json(200, { data: null }));
    const body = new FormData();
    body.append('file', new Blob(['x']), 'x.txt');

    await client.apiRequest('/api/v1/items', config, { method: 'POST', body });

    const init = api.init(0);
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
    expect(init?.body).toBe(body);
  });

  it('authRequired: false면 토큰이 없어도 미리 refresh하지 않고 보낸다', async () => {
    store.removeAccessToken();
    api.route('/api/v1/public', () => json(200, { data: 'ok' }));

    await expect(
      client.apiRequest('/api/v1/public', { ...config, authRequired: false }),
    ).resolves.toBe('ok');
    expect(api.authorization(0)).toBeNull();
    expect(api.count('/api/v1/auth/refresh')).toBe(0);
  });

  it('파일 요청은 URL을 그대로 쓰고 blob을 반환한다', async () => {
    api.route('http://files.test/a.png', () => new Response('png', { status: 200 }));

    const blob = await client.apiRequestBlob('http://files.test/a.png', config);

    await expect(blob.text()).resolves.toBe('png');
    expect(api.authorization(0)).toBe('Bearer token-a');
  });
});
