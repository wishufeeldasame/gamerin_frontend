import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, flush, installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

let store: typeof import('@/lib/auth-store');
let notifications: typeof import('@/lib/notification-api');
let api: ReturnType<typeof installFetchRoutes>;

const UNREAD = '/api/v1/notifications/unread-count';
const LIST = '/api/v1/notifications?size=20';
const emptyPage = { success: true, data: { items: [], nextCursor: null, hasNext: false } };

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  notifications = await import('@/lib/notification-api');
  store.setAccessToken('token-a');
});

describe('notification-api', () => {
  it('헤더 폴링과 패널 조회가 함께 만료되면 refresh를 공유하고 각각 한 번씩만 다시 보낸다', async () => {
    const refresh = deferred<Response>();
    api.route(UNREAD, () => json(401, {}), () => json(200, { success: true, data: { unreadCount: 3 } }));
    api.route(LIST, () => json(401, {}), () => json(200, emptyPage));
    api.route('/api/v1/auth/refresh', () => refresh.promise);

    const unread = notifications.fetchUnreadNotificationCount();
    const list = notifications.fetchNotifications();
    await flush();
    refresh.resolve(json(200, { data: { accessToken: 'token-b' } }));

    await expect(unread).resolves.toBe(3);
    await expect(list).resolves.toEqual({ items: [], nextCursor: null, hasNext: false });
    expect(api.count('/api/v1/auth/refresh')).toBe(1);
    expect(api.count(UNREAD)).toBe(2);
    expect(api.count(LIST)).toBe(2);
  });

  it('폴링 중 세션이 끝나면 기존 인증 문구로 끝나고 로그아웃은 한 번만 한다', async () => {
    api.route(UNREAD, () => json(401, {}));
    api.route(LIST, () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    const results = await Promise.allSettled([
      notifications.fetchUnreadNotificationCount(),
      notifications.fetchNotifications(),
    ]);

    for (const result of results) {
      expect(result).toMatchObject({
        status: 'rejected',
        reason: { message: 'Authentication is required or the token has expired.' },
      });
    }
    expect(api.count('/api/v1/auth/logout')).toBe(1);
    expect(store.getAccessToken()).toBeNull();
  });

  it('5xx는 서버 문구 또는 기존 기본 문구로 끝나고 세션을 유지한다', async () => {
    api.route(UNREAD, () => json(503, {}));
    api.route('/api/v1/notifications/read-all', () => json(500, { message: '읽음 처리 실패' }));

    await expect(notifications.fetchUnreadNotificationCount()).rejects.toThrow('Notification request failed.');
    await expect(notifications.markAllNotificationsRead()).rejects.toThrow('읽음 처리 실패');
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('읽음 처리의 data: null을 성공으로 받고 PATCH로 보낸다', async () => {
    api.route('/api/v1/notifications/n%2F1/read', () => json(200, { success: true, data: null }));

    await expect(notifications.markNotificationRead('n/1')).resolves.toBeUndefined();
    expect(api.init(0)).toMatchObject({ method: 'PATCH', credentials: 'include' });
  });

  it('actor 이미지 주소를 요청 시점 base URL로 만들고 숫자가 아닌 미읽음 수는 0으로 바꾼다', async () => {
    api.route(LIST, () => json(200, {
      success: true,
      data: {
        items: [{
          notificationId: 'n-1',
          type: 'follow',
          actor: { userId: 'u', handle: 'h', nickname: 'n', profileImageUrl: '/uploads/a.png', verifiedBadge: 1 },
          read: 0,
          createdAt: '2026-09-23T00:00:00Z',
        }],
        nextCursor: null,
        hasNext: false,
      },
    }));
    api.route(UNREAD, () => json(200, { success: true, data: { unreadCount: 'x' } }));

    const page = await notifications.fetchNotifications();
    expect(page.items[0]).toMatchObject({
      actor: { profileImageUrl: 'http://api.test/uploads/a.png', verifiedBadge: true },
      postId: null,
      read: false,
    });
    await expect(notifications.fetchUnreadNotificationCount()).resolves.toBe(0);
  });

  it('사용자 전환 뒤 도착한 이전 사용자의 미읽음 수는 버린다', async () => {
    const late = deferred<Response>();
    api.route(UNREAD, () => late.promise);

    const request = notifications.fetchUnreadNotificationCount();
    await flush();
    store.setAccessToken('token-new-user');
    late.resolve(json(200, { success: true, data: { unreadCount: 9 } }));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.count('/api/v1/auth/logout')).toBe(0);
  });
});
