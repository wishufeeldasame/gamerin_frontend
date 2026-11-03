import { vi } from 'vitest';

export const TEST_API_BASE = 'http://api.test';

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

/**
 * 경로별 응답 큐로 fetch를 대체한다. 등록하지 않은 경로는 실패시키고, 로그아웃은 204로 응답한다.
 * `vi.mock('@/lib/api-base', () => ({ getApiBaseUrl: () => TEST_API_BASE }))`와 함께 쓴다.
 */
export function installFetchRoutes() {
  const routes: Record<string, Handler[]> = {};
  const strip = (url: unknown) => String(url).replace(TEST_API_BASE, '');

  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = strip(url);
    const handler = routes[path]?.shift();
    if (handler) return handler(init);
    if (path === '/api/v1/auth/logout') return new Response(null, { status: 204 });
    throw new Error(`unexpected fetch ${path}`);
  }));

  const calls = () => vi.mocked(fetch).mock.calls;

  return {
    route(path: string, ...handlers: Handler[]) {
      routes[path] = [...(routes[path] ?? []), ...handlers];
    },
    paths: () => calls().map(([url]) => strip(url)),
    count: (path: string) => calls().filter(([url]) => strip(url) === path).length,
    authorization: (index: number) => new Headers(calls()[index][1]?.headers).get('Authorization'),
    init: (index: number) => calls()[index][1],
  };
}
