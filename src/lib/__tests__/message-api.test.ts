import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, flush, installFetchRoutes, json } from '@/test/fetch-routes';

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

let store: typeof import('@/lib/auth-store');
let message: typeof import('@/lib/message-api');
let api: ReturnType<typeof installFetchRoutes>;

const eventSources: string[] = [];

class FakeEventSource {
  constructor(public readonly url: string) {
    eventSources.push(url);
  }
}

const STREAM_TOKEN = '/api/v1/messages/stream-token';
const streamTokenOk = () => json(200, { success: true, data: { expiresAt: '2026-09-18T00:00:00Z' } });

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  eventSources.length = 0;
  vi.stubGlobal('EventSource', FakeEventSource);
  api = installFetchRoutes();
  store = await import('@/lib/auth-store');
  message = await import('@/lib/message-api');
  store.setAccessToken('token-a');
});

describe('message-api 요청', () => {
  it('최종 401은 기존 인증 문구로 끝나 isMessageAuthError로 판별된다', async () => {
    api.route('/api/v1/messages/conversations', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    const error = await message.fetchConversationList().catch((reason: unknown) => reason);

    expect((error as Error).message).toBe('Authentication is required or the token has expired.');
    expect(message.isMessageAuthError(error)).toBe(true);
    expect(store.getAccessToken()).toBeNull();
  });

  it('일시 장애는 인증 오류로 판별되지 않고 세션을 유지한다', async () => {
    api.route('/api/v1/messages/conversations', () => json(503, {}));

    const error = await message.fetchConversationList().catch((reason: unknown) => reason);

    expect((error as Error).message).toBe('Message request failed.');
    expect(message.isMessageAuthError(error)).toBe(false);
    expect(store.getAccessToken()).toBe('token-a');
  });

  it('첨부가 있으면 FormData로 보내고 JSON Content-Type을 붙이지 않는다', async () => {
    api.route('/api/v1/messages/conversations/c-1/messages', () => json(200, {
      success: true,
      data: {
        id: 'm-1',
        senderId: 'me',
        text: '',
        createdAt: '2026-09-18T00:00:00Z',
        read: false,
        deliveryStatus: 'sent',
        attachments: [{ id: 'a-1', type: 'image', name: 'a.png', url: '/uploads/message-attachments/a.png' }],
        sharedPost: null,
      },
    }));

    const sent = await message.sendConversationMessage({
      conversationId: 'c-1',
      attachments: [new File(['x'], 'a.png', { type: 'image/png' })],
    });

    expect(api.init(0)?.body).toBeInstanceOf(FormData);
    expect(new Headers(api.init(0)?.headers).has('Content-Type')).toBe(false);
    expect(sent.attachments[0].url).toBe('http://api.test/uploads/message-attachments/a.png');
  });
});

describe('DM 첨부', () => {
  const ATTACHMENT = 'http://api.test/api/v1/messages/attachments/a-1';

  it('인증 fetch 후 blob을 반환하고 첫 401이면 refresh 후 다시 받는다', async () => {
    api.route('/api/v1/messages/attachments/a-1', () => json(401, {}), () => new Response('bytes'));
    api.route('/api/v1/auth/refresh', () => json(200, { data: { accessToken: 'token-b' } }));

    const blob = await message.fetchMessageAttachmentBlob(ATTACHMENT);

    await expect(blob.text()).resolves.toBe('bytes');
    expect(api.authorization(2)).toBe('Bearer token-b');
  });

  it('실패 문구와 인증 문구를 보존한다', async () => {
    api.route('/api/v1/messages/attachments/a-1', () => json(404, { message: 'not found' }));
    await expect(message.fetchMessageAttachmentBlob(ATTACHMENT)).rejects.toThrow(
      'Message attachment request failed.',
    );

    api.route('/api/v1/messages/attachments/a-1', () => json(401, {}));
    api.route('/api/v1/auth/refresh', () => json(401, {}));
    await expect(message.fetchMessageAttachmentBlob(ATTACHMENT)).rejects.toThrow(
      'Authentication is required or the token has expired.',
    );
  });

  it('사용자 전환 뒤 도착한 첨부는 AbortError로 버린다', async () => {
    const late = deferred<Response>();
    api.route('/api/v1/messages/attachments/a-1', () => late.promise);

    const request = message.fetchMessageAttachmentBlob(ATTACHMENT);
    await flush();
    store.setAccessToken('token-new-user');
    late.resolve(new Response('old-user-bytes'));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('백엔드가 준 상대경로는 API base URL로 바꿔 인증 요청한다', async () => {
    api.route('/api/v1/messages/attachments/a-1', () => new Response('bytes'));

    const blob = await message.fetchMessageAttachmentBlob('/api/v1/messages/attachments/a-1');

    await expect(blob.text()).resolves.toBe('bytes');
    expect(api.paths()).toEqual(['/api/v1/messages/attachments/a-1']);
    expect(api.authorization(0)).toBe('Bearer token-a');
    expect(api.init(0)).toMatchObject({ credentials: 'include' });
  });

  describe('다른 origin', () => {
    const EXTERNAL = 'https://cdn.test/a.png';

    it('토큰과 쿠키 없이 받고 blob을 반환한다', async () => {
      api.route(EXTERNAL, () => new Response('external-bytes'));

      const blob = await message.fetchMessageAttachmentBlob(` ${EXTERNAL} `);

      await expect(blob.text()).resolves.toBe('external-bytes');
      expect(api.authorization(0)).toBeNull();
      expect(api.init(0)).toMatchObject({ credentials: 'omit' });
    });

    it('//host 주소도 다른 origin이면 토큰을 보내지 않는다', async () => {
      api.route('http://cdn.test/a.png', () => new Response('x'));

      await message.fetchMessageAttachmentBlob('//cdn.test/a.png');

      expect(api.authorization(0)).toBeNull();
      expect(api.init(0)).toMatchObject({ credentials: 'omit' });
    });

    it('401·네트워크 실패는 첨부 실패로 끝나고 refresh나 로그아웃을 하지 않는다', async () => {
      api.route(EXTERNAL, () => json(401, {}), () => Promise.reject(new TypeError('Failed to fetch')));

      for (let i = 0; i < 2; i += 1) {
        await expect(message.fetchMessageAttachmentBlob(EXTERNAL)).rejects.toThrow('Message attachment request failed.');
      }
      expect(api.paths()).toEqual([EXTERNAL, EXTERNAL]);
      expect(store.getAccessToken()).toBe('token-a');
    });

    it('사용자 전환 뒤 도착한 응답은 AbortError로 버린다', async () => {
      const late = deferred<Response>();
      api.route(EXTERNAL, () => late.promise);

      const request = message.fetchMessageAttachmentBlob(EXTERNAL);
      await flush();
      store.setAccessToken('token-new-user');
      late.resolve(new Response('old-user-bytes'));

      await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});

describe('SSE 연결 준비', () => {
  it('stream-token을 발급받은 뒤 EventSource를 연다', async () => {
    api.route(STREAM_TOKEN, streamTokenOk);

    await message.openMessageEventSource();

    expect(api.init(0)).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(eventSources).toEqual(['http://api.test/api/v1/messages/stream']);
  });

  it('stream-token 발급 중 사용자가 바뀌면 연결을 시작하지 않는다', async () => {
    const token = deferred<Response>();
    api.route(STREAM_TOKEN, () => token.promise);

    const opening = message.openMessageEventSource();
    await flush();
    store.setAccessToken('token-new-user');
    token.resolve(streamTokenOk());

    await expect(opening).rejects.toMatchObject({ name: 'AbortError' });
    expect(eventSources).toEqual([]);
  });

  it('강제 refresh 중 사용자가 바뀌면 stream-token을 요청하지 않는다', async () => {
    const refresh = deferred<Response>();
    api.route('/api/v1/auth/refresh', () => refresh.promise);

    const opening = message.openMessageEventSource({ forceRefresh: true });
    await flush();
    store.setAccessToken('token-new-user');
    refresh.resolve(json(200, { data: { accessToken: 'old-user-token' } }));

    await expect(opening).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.count(STREAM_TOKEN)).toBe(0);
    expect(store.getAccessToken()).toBe('token-new-user');
    expect(eventSources).toEqual([]);
  });

  it('강제 refresh 후 새 토큰으로 stream-token을 발급받는다', async () => {
    api.route('/api/v1/auth/refresh', () => json(200, { data: { accessToken: 'token-b' } }));
    api.route(STREAM_TOKEN, streamTokenOk);

    await message.openMessageEventSource({ forceRefresh: true });

    expect(api.paths()).toEqual(['/api/v1/auth/refresh', STREAM_TOKEN]);
    expect(api.authorization(1)).toBe('Bearer token-b');
    expect(eventSources).toHaveLength(1);
  });

  it('강제 refresh의 일시 장애는 재연결 가능한 오류로 끝나고 세션을 유지한다', async () => {
    api.route('/api/v1/auth/refresh', () => json(503, {}));

    const error = await message.openMessageEventSource({ forceRefresh: true }).catch((reason: unknown) => reason);

    expect(message.isMessageAuthError(error)).toBe(false);
    expect(store.getAccessToken()).toBe('token-a');
    expect(eventSources).toEqual([]);
  });

  it('강제 refresh가 거절되면 인증 오류로 끝나고 세션을 종료한다', async () => {
    api.route('/api/v1/auth/refresh', () => json(401, {}));

    const error = await message.openMessageEventSource({ forceRefresh: true }).catch((reason: unknown) => reason);

    expect(message.isMessageAuthError(error)).toBe(true);
    expect(store.getAccessToken()).toBeNull();
    expect(api.count(STREAM_TOKEN)).toBe(0);
  });
});
