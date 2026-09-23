import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, flush, installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

let store: typeof import('@/lib/auth-store');
let search: typeof import('@/lib/community-search-api');
let api: ReturnType<typeof installFetchRoutes>;

const ACCOUNTS = '/api/v1/search/accounts?size=20&q=demo';
const OVERVIEW = '/api/v1/search?size=5&q=demo';

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  search = await import('@/lib/community-search-api');
  store.setAccessToken('token-a');
});

describe('community-search-api', () => {
  it('backend 계정 응답의 id를 userId로 옮기고 프로필 이미지 주소를 요청 시점 base URL로 만든다', async () => {
    api.route(ACCOUNTS, () => json(200, {
      success: true,
      data: {
        items: [{
          id: 'user-1',
          handle: 'demo01',
          nickname: '데모',
          profileImageUrl: '/uploads/profile.png',
          verifiedBadge: 0,
        }],
        nextCursor: null,
        hasNext: false,
      },
    }));

    await expect(search.fetchSearchAccounts('demo')).resolves.toEqual({
      items: [{
        userId: 'user-1',
        handle: 'demo01',
        nickname: '데모',
        bio: null,
        profileImageUrl: 'http://api.test/uploads/profile.png',
        verifiedBadge: false,
      }],
      nextCursor: null,
      hasNext: false,
    });
  });

  it('최종 401은 기존 인증 문구로 끝나고 세션을 종료한다', async () => {
    api.route(OVERVIEW, () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    await expect(search.fetchSearchOverview('demo')).rejects.toThrow(
      'Authentication is required or the token has expired.',
    );
    expect(store.getAccessToken()).toBeNull();
    expect(api.count('/api/v1/auth/logout')).toBe(1);
  });

  it('refresh 일시 장애는 인증 오류가 아닌 요청 실패로 끝나고 세션을 유지한다', async () => {
    api.route(OVERVIEW, () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(503, {}));

    await expect(search.fetchSearchOverview('demo')).rejects.toThrow('Community search request failed.');
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('서버 문구를 우선하고 5xx에서 세션을 유지한다', async () => {
    api.route(OVERVIEW, () => json(500, { message: '검색 서버 오류' }));

    await expect(search.fetchSearchOverview('demo')).rejects.toThrow('검색 서버 오류');
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('검색을 취소하면 AbortError로 끝난다', async () => {
    const controller = new AbortController();
    api.route(OVERVIEW, (init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));

    const request = search.fetchSearchOverview('demo', 5, { signal: controller.signal });
    await flush();
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('사용자 전환 뒤 도착한 이전 사용자의 검색 결과는 버린다', async () => {
    const late = deferred<Response>();
    api.route(OVERVIEW, () => late.promise);

    const request = search.fetchSearchOverview('demo');
    await flush();
    store.setAccessToken('token-new-user');
    late.resolve(json(200, {
      success: true,
      data: {
        query: 'demo',
        accounts: { items: [], hasMore: false },
        posts: { items: [], hasMore: false },
        hashtags: { items: [], hasMore: false },
      },
    }));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getAccessToken()).toBe('token-new-user');
  });
});
