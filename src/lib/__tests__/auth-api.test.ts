import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, flush, installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

type AuthStore = typeof import('@/lib/auth-store');
type AuthApi = typeof import('@/lib/auth-api');

let store: AuthStore;
let auth: AuthApi;
let api: ReturnType<typeof installFetchRoutes>;

const loginOk = () =>
  json(200, {
    success: true,
    // handle/nickname은 쓰지 않지만 userId는 `/me` 계정과 일치하는지 검증한다.
    data: { userId: 'user-id', handle: 'login-handle', nickname: '로그인닉', accessToken: 'token-a', accessTokenExpiresIn: 900 },
  });
const meOk = (overrides: Record<string, unknown> = {}) =>
  json(200, {
    success: true,
    data: { userId: 'user-id', handle: 'demo', nickname: '데모', role: 'USER', status: 'ACTIVE', ...overrides },
  });
const refreshOk = () => json(200, { success: true, data: { accessToken: 'token-r', userId: 'user-id' } });

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  window.sessionStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  auth = await import('@/lib/auth-api');
});

describe('toAuthUser', () => {
  it('/me 값으로 사용자를 만들고 role/status를 채운다', () => {
    expect(auth.toAuthUser({ userId: 'u', handle: 'h', nickname: '닉', role: 'ROLE_ADMIN', status: 'ACTIVE' })).toEqual({
      id: 'u',
      name: '닉',
      nickname: '닉',
      handle: 'h',
      gameTier: 'Unranked',
      bio: '',
      role: 'ROLE_ADMIN',
      status: 'ACTIVE',
    });
  });

  it('저장된 사용자(base)의 서버가 주지 않는 값은 보존하고 서버가 주는 값은 덮어쓴다', () => {
    const user = auth.toAuthUser(
      { userId: 'new-id', handle: 'h', nickname: '새닉' },
      { id: 'old-id', name: '저장이름', nickname: '옛닉', gameTier: 'Gold', bio: '소개', role: 'ADMIN', status: 'ACTIVE' },
    );

    expect(user).toMatchObject({ id: 'new-id', name: '저장이름', nickname: '새닉', gameTier: 'Gold', bio: '소개' });
    expect(user?.role).toBeUndefined();
    expect(user?.status).toBeUndefined();
  });

  it.each([null, 'x', {}, { userId: 1, handle: 'h', nickname: 'n' }, { userId: 'u', handle: 'h' }])(
    '형식이 맞지 않으면 null이다: %j',
    (me) => {
      expect(auth.toAuthUser(me)).toBeNull();
    },
  );
});

describe('loginWithPassword', () => {
  it('로그인 뒤 /me로 사용자를 확정한다(로그인 응답의 사용자 정보는 쓰지 않는다)', async () => {
    api.route('/api/v1/auth/login', loginOk);
    api.route('/api/v1/auth/me', () => meOk());

    const user = await auth.loginWithPassword('demo', 'pw');

    expect(api.paths()).toEqual(['/api/v1/auth/login', '/api/v1/auth/me']);
    expect(JSON.parse(String(api.init(0)?.body))).toEqual({ handle: 'demo', password: 'pw' });
    expect(api.authorization(1)).toBe('Bearer token-a');
    expect(user).toEqual({
      id: 'user-id',
      name: '데모',
      nickname: '데모',
      handle: 'demo',
      gameTier: 'Unranked',
      bio: '',
      role: 'USER',
      status: 'ACTIVE',
    });
  });

  it('비밀번호 오류는 서버 메시지로 거절하고 세션·다른 탭 인증을 건드리지 않는다', async () => {
    api.route('/api/v1/auth/login', () => json(401, { success: false, message: '비밀번호가 틀렸습니다.' }));

    await expect(auth.loginWithPassword('demo', 'bad')).rejects.toThrow('비밀번호가 틀렸습니다.');

    expect(api.paths()).toEqual(['/api/v1/auth/login']);
    expect(store.getAccessToken()).toBeNull();
  });

  it('차단 계정 응답이면 세션을 정리하고 차단 오류로 거절한다', async () => {
    api.route('/api/v1/auth/login', () => json(403, { success: false, code: 'ACCOUNT_SUSPENDED' }));

    await expect(auth.loginWithPassword('demo', 'pw')).rejects.toBeInstanceOf(auth.BlockedAccountError);

    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('토큰이 없는 성공 응답은 거절한다', async () => {
    api.route('/api/v1/auth/login', () => json(200, { success: true, data: {} }));

    await expect(auth.loginWithPassword('demo', 'pw')).rejects.toThrow('로그인 응답에 인증 토큰이 없습니다.');
    expect(api.count('/api/v1/auth/me')).toBe(0);
  });

  it('/me가 실패하면 세션을 정리한다', async () => {
    api.route('/api/v1/auth/login', loginOk);
    api.route('/api/v1/auth/me', () => json(500, { success: false, message: 'server error' }));

    await expect(auth.loginWithPassword('demo', 'pw')).rejects.toThrow('server error');

    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
  });

  it('로그인 응답과 /me의 userId가 다르면 서버 logout 없이 현재 탭만 재인증한다', async () => {
    api.route('/api/v1/auth/login', loginOk);
    api.route('/api/v1/auth/me', () => meOk({ userId: 'other-user' }));

    await expect(auth.loginWithPassword('demo', 'pw')).rejects.toMatchObject({ name: 'AbortError' });

    expect(store.getAccessToken()).toBeNull();
    expect(store.isLocalReauthenticationRequired()).toBe(true);
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('/me가 재시도 뒤에도 401이면 세션을 한 번만 종료한다', async () => {
    api.route('/api/v1/auth/login', loginOk);
    api.route('/api/v1/auth/me', () => json(401, {}), () => json(401, { message: '만료' }));
    api.route('/api/v1/auth/refresh', refreshOk);

    await expect(auth.loginWithPassword('demo', 'pw')).rejects.toThrow('만료');

    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
  });

  it('다른 로그인으로 세대가 바뀐 뒤 /me가 네트워크 오류로 실패해도 새 세션을 지우지 않고 AbortError로 버린다', async () => {
    api.route('/api/v1/auth/login', loginOk);
    let failMe!: (error: Error) => void;
    api.route('/api/v1/auth/me', () => new Promise<Response>((_, reject) => {
      failMe = reject;
    }));

    const pending = auth.loginWithPassword('demo', 'pw');
    await vi.waitFor(() => expect(api.count('/api/v1/auth/me')).toBe(1));
    store.setAccessToken('other-user-token');
    failMe(new TypeError('Failed to fetch'));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBe('other-user-token');
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('/me가 차단 상태를 알려 주면 세션을 정리하고 차단 오류로 거절한다', async () => {
    api.route('/api/v1/auth/login', loginOk);
    api.route('/api/v1/auth/me', () => meOk({ status: 'SUSPENDED' }));

    await expect(auth.loginWithPassword('demo', 'pw')).rejects.toBeInstanceOf(auth.BlockedAccountError);

    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
  });

  it('로그인 응답을 기다리는 동안 사용자가 바뀌면 AbortError로 버리고 토큰을 저장하지 않는다', async () => {
    const login = deferred<Response>();
    api.route('/api/v1/auth/login', () => login.promise);

    const pending = auth.loginWithPassword('demo', 'pw');
    await flush();
    store.removeAccessToken();
    login.resolve(loginOk());

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBeNull();
    expect(api.paths()).toEqual(['/api/v1/auth/login']);
  });
});

describe('completeOAuthSession', () => {
  it('refresh 쿠키로 토큰을 받고 /me로 사용자를 확정한다', async () => {
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => meOk());

    const user = await auth.completeOAuthSession();

    expect(api.paths()).toEqual(['/api/v1/auth/refresh', '/api/v1/auth/me']);
    expect(api.init(0)).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(api.authorization(1)).toBe('Bearer token-r');
    expect(user).toMatchObject({ id: 'user-id', handle: 'demo', role: 'USER', status: 'ACTIVE', gameTier: 'Unranked' });
  });

  it('성공하면 인증 세대를 올려 같은 시점의 앱 시작 복원이 이 로그인을 덮어쓰지 못하게 한다', async () => {
    const before = store.getAuthGeneration();
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => meOk());

    await auth.completeOAuthSession();

    expect(store.isCurrentAuthGeneration(before)).toBe(false);
    expect(store.getAccessToken()).toBe('token-r');
  });

  it('같은 시점의 호출은 한 작업으로 합쳐 refresh를 한 번만 보내고 같은 결과를 받는다(StrictMode)', async () => {
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => meOk());

    const [first, second] = await Promise.all([auth.completeOAuthSession(), auth.completeOAuthSession()]);

    expect(second).toBe(first);
    expect(api.count('/api/v1/auth/refresh')).toBe(1);
    expect(api.count('/api/v1/auth/me')).toBe(1);
  });

  it('토큰 획득 뒤 /me 확인 세대로 바뀐 동안의 중복 호출도 같은 작업을 공유한다', async () => {
    const me = deferred<Response>();
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => me.promise);

    const first = auth.completeOAuthSession();
    await vi.waitFor(() => expect(api.count('/api/v1/auth/me')).toBe(1));
    const second = auth.completeOAuthSession();
    expect(second).toBe(first);
    me.resolve(meOk());

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(api.count('/api/v1/auth/refresh')).toBe(1);
    expect(api.count('/api/v1/auth/me')).toBe(1);
  });

  it('OAuth 획득 중 일반 refresh는 활성 OAuth 요청을 공유하지 않는다', async () => {
    const refresh = deferred<Response>();
    api.route('/api/v1/auth/refresh', () => refresh.promise);
    api.route('/api/v1/auth/me', () => meOk());

    const oauth = auth.completeOAuthSession();
    await vi.waitFor(() => expect(api.count('/api/v1/auth/refresh')).toBe(1));
    await expect(store.refreshAccessTokenResult(store.getAuthGeneration())).resolves.toEqual({ status: 'stale' });
    expect(api.count('/api/v1/auth/refresh')).toBe(1);

    refresh.resolve(refreshOk());
    await expect(oauth).resolves.toMatchObject({ id: 'user-id' });
  });

  it('외부 세대 변경으로 무효화된 OAuth 작업은 다음 명시적 OAuth 호출에서 재사용하지 않는다', async () => {
    const firstRefresh = deferred<Response>();
    api.route('/api/v1/auth/refresh', () => firstRefresh.promise, refreshOk);
    api.route('/api/v1/auth/me', () => meOk());

    const first = auth.completeOAuthSession();
    await vi.waitFor(() => expect(api.count('/api/v1/auth/refresh')).toBe(1));
    store.setAccessToken('external-token');
    const second = auth.completeOAuthSession();
    expect(second).not.toBe(first);
    await expect(second).resolves.toMatchObject({ id: 'user-id' });

    firstRefresh.resolve(refreshOk());
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.count('/api/v1/auth/refresh')).toBe(2);
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('/me 첫 401 뒤 refresh가 다른 userId를 주면 다른 계정 토큰을 수용하지 않는다', async () => {
    api.route(
      '/api/v1/auth/refresh',
      refreshOk,
      () => json(200, { success: true, data: { accessToken: 'token-other', userId: 'other-user' } }),
    );
    api.route('/api/v1/auth/me', () => json(401, {}));

    await expect(auth.completeOAuthSession()).rejects.toMatchObject({ name: 'AbortError' });

    expect(store.getAccessToken()).toBeNull();
    expect(store.isLocalReauthenticationRequired()).toBe(true);
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('합쳐진 호출이 일시 장애로 실패해도 모든 호출이 AbortError가 아닌 같은 오류로 끝난다', async () => {
    api.route('/api/v1/auth/refresh', () => json(503, {}));

    const results = await Promise.allSettled([auth.completeOAuthSession(), auth.completeOAuthSession()]);

    for (const result of results) {
      expect(result).toMatchObject({ status: 'rejected', reason: { message: '인증 세션 생성에 실패했습니다.' } });
    }
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('작업이 끝나면 다음 호출은 새로 시작한다', async () => {
    api.route('/api/v1/auth/refresh', refreshOk, refreshOk);
    api.route('/api/v1/auth/me', () => meOk(), () => meOk());

    await auth.completeOAuthSession();
    await auth.completeOAuthSession();

    expect(api.count('/api/v1/auth/refresh')).toBe(2);
  });

  it('refresh가 인증을 거절하면 세션을 한 번만 정리하고 실패한다', async () => {
    api.route('/api/v1/auth/refresh', () => json(401, { success: false, message: 'expired' }));

    await expect(auth.completeOAuthSession()).rejects.toThrow('인증 세션 생성에 실패했습니다.');

    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(api.count('/api/v1/auth/me')).toBe(0);
  });

  it('refresh가 일시 장애여도 새 세션이라 정리하고 실패한다', async () => {
    api.route('/api/v1/auth/refresh', () => json(500, { success: false }));

    await expect(auth.completeOAuthSession()).rejects.toThrow('인증 세션 생성에 실패했습니다.');

    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('/me가 차단 상태를 알려 주면 세션을 정리하고 차단 오류로 거절한다', async () => {
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => meOk({ status: 'BANNED' }));

    await expect(auth.completeOAuthSession()).rejects.toBeInstanceOf(auth.BlockedAccountError);

    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });
});

describe('completeOAuthSession 차단 계정', () => {
  it('refresh가 비활성 계정으로 거절하면 차단 오류로 거절하고 세션을 한 번만 정리한다', async () => {
    api.route('/api/v1/auth/refresh', () =>
      json(401, { success: false, message: '사용자 계정이 활성 상태가 아닙니다.' }));

    await expect(auth.completeOAuthSession()).rejects.toBeInstanceOf(auth.BlockedAccountError);

    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(api.count('/api/v1/auth/me')).toBe(0);
  });
});

describe('confirmAuthSession', () => {
  it('토큰을 받는 사이 세대가 바뀌었으면 오래된 토큰을 저장하지 않고 AbortError로 끝난다', async () => {
    const generation = store.getAuthGeneration();
    store.setAccessToken('other-user-token');

    await expect(auth.confirmAuthSession('stale-token', generation)).rejects.toMatchObject({ name: 'AbortError' });

    expect(store.getAccessToken()).toBe('other-user-token');
    expect(api.count('/api/v1/auth/me')).toBe(0);
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });
});

describe('refreshAccessTokenResult의 거절 형태', () => {
  it('일반 401 거절은 blocked 속성 없이 { status: rejected }다', async () => {
    api.route('/api/v1/auth/refresh', () => json(401, { message: '만료된 리프레시 토큰입니다.' }));

    await expect(store.refreshAccessTokenResult()).resolves.toEqual({ status: 'rejected' });
  });

  it('차단·비활성 계정 거절만 blocked: true를 담는다', async () => {
    api.route('/api/v1/auth/refresh', () => json(401, { message: '사용자 계정이 활성 상태가 아닙니다.' }));

    await expect(store.refreshAccessTokenResult()).resolves.toEqual({ status: 'rejected', blocked: true });
  });
});

describe('completeSocialSignup', () => {
  const params = { signupToken: 'signup-token', handle: 'demo_01', nickname: '데모' };
  const signupOk = () =>
    json(200, { success: true, data: { userId: 'user-id', handle: 'signup-handle', nickname: '가입닉', accessToken: 'token-s' } });

  it('가입 뒤 /me로 사용자를 확정한다(가입 응답의 사용자 정보는 쓰지 않는다)', async () => {
    api.route('/api/v1/auth/social-signup', signupOk);
    api.route('/api/v1/auth/me', () => meOk());

    const user = await auth.completeSocialSignup(params);

    expect(api.paths()).toEqual(['/api/v1/auth/social-signup', '/api/v1/auth/me']);
    expect(JSON.parse(String(api.init(0)?.body))).toEqual({ ...params, agreedToTerms: true, agreedToPrivacy: true });
    expect(api.init(0)).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(api.authorization(1)).toBe('Bearer token-s');
    expect(user).toMatchObject({ id: 'user-id', handle: 'demo', role: 'USER', status: 'ACTIVE', gameTier: 'Unranked', bio: '' });
  });

  it('서버가 거절하면 서버 메시지로 거절하고 세션을 건드리지 않는다', async () => {
    api.route('/api/v1/auth/social-signup', () => json(409, { success: false, message: '이미 사용 중인 아이디입니다.' }));

    await expect(auth.completeSocialSignup(params)).rejects.toThrow('이미 사용 중인 아이디입니다.');

    expect(api.paths()).toEqual(['/api/v1/auth/social-signup']);
    expect(store.getAccessToken()).toBeNull();
  });

  it('토큰이 없는 성공 응답은 거절한다', async () => {
    api.route('/api/v1/auth/social-signup', () => json(200, { success: true, data: { userId: 'u' } }));

    await expect(auth.completeSocialSignup(params)).rejects.toThrow('로그인 정보가 올바르지 않습니다.');
    expect(api.count('/api/v1/auth/me')).toBe(0);
  });

  it('가입은 성공했지만 /me가 실패하면 세션을 정리하고 가입 완료 오류로 거절한다', async () => {
    api.route('/api/v1/auth/social-signup', signupOk);
    api.route('/api/v1/auth/me', () => json(500, { success: false, message: 'server error' }));

    await expect(auth.completeSocialSignup(params)).rejects.toBeInstanceOf(auth.SignupCompletedError);

    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
  });

  it('가입 응답을 기다리는 동안 사용자가 바뀌면 AbortError로 버리고 토큰을 저장하지 않는다', async () => {
    const signup = deferred<Response>();
    api.route('/api/v1/auth/social-signup', () => signup.promise);

    const pending = auth.completeSocialSignup(params);
    await flush();
    store.removeAccessToken();
    signup.resolve(signupOk());

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBeNull();
    expect(api.paths()).toEqual(['/api/v1/auth/social-signup']);
  });
});

describe('restoreAuthUser', () => {
  const stored = { id: 'user-id', name: '저장이름', nickname: '옛닉', gameTier: 'Gold', bio: '소개' };

  it('refresh와 /me가 성공하면 서버 값으로 갱신하고 저장된 값은 보존한다', async () => {
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => meOk({ nickname: '새닉' }));

    const user = await auth.restoreAuthUser(stored, store.getAuthGeneration());

    expect(user).toMatchObject({ id: 'user-id', name: '저장이름', nickname: '새닉', gameTier: 'Gold', bio: '소개', role: 'USER' });
  });

  it('refresh가 일시 장애면 세션을 유지하고 null만 반환한다', async () => {
    api.route('/api/v1/auth/refresh', () => json(503, {}));

    await expect(auth.restoreAuthUser(stored, store.getAuthGeneration())).resolves.toBeNull();

    expect(api.count('/api/v1/auth/me')).toBe(0);
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('bootstrap refresh가 저장 사용자와 다른 userId를 주면 공유 저장값을 유지하고 현재 탭만 재인증한다', async () => {
    window.localStorage.setItem(store.AUTH_USER_KEY, JSON.stringify(stored));
    api.route('/api/v1/auth/refresh', () => json(200, {
      success: true,
      data: { accessToken: 'other-token', userId: 'other-user' },
    }));

    await expect(auth.restoreAuthUser(stored, store.getAuthGeneration())).resolves.toBeNull();

    expect(api.count('/api/v1/auth/me')).toBe(0);
    expect(api.count('/api/v1/auth/logout')).toBe(0);
    expect(store.isLocalReauthenticationRequired()).toBe(true);
    expect(window.localStorage.getItem(store.AUTH_USER_KEY)).toContain('user-id');
  });

  it('/me가 일시 장애여도 세션을 유지한다', async () => {
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => json(503, {}));

    await expect(auth.restoreAuthUser(stored, store.getAuthGeneration())).resolves.toBeNull();

    expect(api.count('/api/v1/auth/logout')).toBe(0);
    expect(store.getAccessToken()).toBe('token-r');
  });

  it('저장 이벤트보다 먼저 끝난 이전 계정 복원도 새 계정 저장값을 덮어쓰지 않는다', async () => {
    const me = deferred<Response>();
    window.localStorage.setItem(store.AUTH_USER_KEY, JSON.stringify(stored));
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => me.promise);

    const pending = auth.restoreAuthUser(stored, store.getAuthGeneration());
    await vi.waitFor(() => expect(api.count('/api/v1/auth/me')).toBe(1));
    // 다른 탭의 로그인은 끝났지만 이 탭의 storage 이벤트는 아직 전달되지 않았다.
    window.localStorage.setItem(store.AUTH_USER_KEY, JSON.stringify({ id: 'other-user' }));
    me.resolve(meOk());

    await expect(pending).resolves.toBeNull();
    expect(store.getAccessToken()).toBeNull();
    expect(store.isLocalReauthenticationRequired()).toBe(true);
    expect(window.localStorage.getItem(store.AUTH_USER_KEY)).toContain('other-user');
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('/me 형식 오류는 세션을 유지하고 null을 반환한다', async () => {
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => json(200, { success: true, data: { userId: 1 } }));

    await expect(auth.restoreAuthUser(stored, store.getAuthGeneration())).resolves.toBeNull();

    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('차단 계정이면 차단 오류를 던지고 세션 종료는 호출한 쪽에 맡긴다', async () => {
    api.route('/api/v1/auth/refresh', refreshOk);
    api.route('/api/v1/auth/me', () => meOk({ status: 'SUSPENDED' }));

    await expect(auth.restoreAuthUser(stored, store.getAuthGeneration())).rejects.toBeInstanceOf(auth.BlockedAccountError);

    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });

  it('복원 도중 사용자가 바뀌면 null을 반환하고 세션을 건드리지 않는다', async () => {
    const refresh = deferred<Response>();
    api.route('/api/v1/auth/refresh', () => refresh.promise);

    const pending = auth.restoreAuthUser(stored, store.getAuthGeneration());
    await flush();
    store.setAccessToken('other-user-token');
    refresh.resolve(refreshOk());

    await expect(pending).resolves.toBeNull();
    expect(api.count('/api/v1/auth/me')).toBe(0);
    expect(store.getAccessToken()).toBe('other-user-token');
  });
});
