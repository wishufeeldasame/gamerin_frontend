import { describe, expect, it, vi } from 'vitest';
import {
  createClientId,
  formatMessageDate,
  hideDeliveredPendingMessages,
  isSameLocalDate,
  mergeMessages,
  shouldShowMessageDateSeparator,
  type ChatMessage,
  type PendingChatMessage,
} from '@/lib/message-store';

function createMessage(id: string, createdAt: string): ChatMessage {
  return {
    id,
    senderId: 'me',
    text: id,
    createdAt,
    read: true,
    deliveryStatus: 'sent',
    attachments: [],
    sharedPost: null,
  };
}

describe('message date helpers', () => {
  it('formats dates relative to the local calendar date', () => {
    const now = new Date(2026, 9, 5, 0, 30);

    expect(formatMessageDate(new Date(2026, 9, 5, 0, 1).toISOString(), now)).toBe('오늘');
    expect(formatMessageDate(new Date(2026, 9, 4, 23, 59).toISOString(), now)).toBe('어제');
    expect(formatMessageDate(new Date(2026, 0, 2, 12).toISOString(), now)).toBe('1월 2일');
    expect(formatMessageDate(new Date(2025, 11, 31, 12).toISOString(), now)).toBe('2025년 12월 31일');
  });

  it('compares the local date instead of elapsed hours', () => {
    const lateYesterday = new Date(2026, 9, 4, 23, 59);
    const earlyToday = new Date(2026, 9, 5, 0, 1);

    expect(isSameLocalDate(lateYesterday, earlyToday)).toBe(false);
    expect(isSameLocalDate(earlyToday, new Date(2026, 9, 5, 22))).toBe(true);
  });

  it('shows a separator only when the date changes between messages', () => {
    const messages = [
      createMessage('first', new Date(2026, 9, 4, 10).toISOString()),
      createMessage('same-day', new Date(2026, 9, 4, 20).toISOString()),
      createMessage('next-day', new Date(2026, 9, 5, 9).toISOString()),
    ];

    expect(shouldShowMessageDateSeparator(messages, 0)).toBe(false);
    expect(shouldShowMessageDateSeparator(messages, 1)).toBe(false);
    expect(shouldShowMessageDateSeparator(messages, 2)).toBe(true);
  });
});

describe('mergeMessages', () => {
  it('keeps messages sorted and deduplicated after older and realtime messages are merged', () => {
    const current = [
      createMessage('middle', '2026-10-04T12:00:00.000Z'),
      createMessage('latest', '2026-10-05T12:00:00.000Z'),
    ];
    const incoming = [
      createMessage('oldest', '2026-10-03T12:00:00.000Z'),
      createMessage('latest', '2026-10-05T12:00:00.000Z'),
      createMessage('realtime', '2026-10-06T12:00:00.000Z'),
    ];

    expect(mergeMessages(current, incoming).map((message) => message.id)).toEqual([
      'oldest',
      'middle',
      'latest',
      'realtime',
    ]);
  });
});

function createPending(id: string, status: PendingChatMessage['status']): PendingChatMessage {
  return { id, text: 'hello', attachments: [], status, errorMessage: null, authGeneration: 0 };
}

describe('hideDeliveredPendingMessages', () => {
  it('clientMessageId가 임시 메시지 id와 같은 서버 메시지가 오면 상태와 관계없이 숨긴다', () => {
    const pending = [createPending('key-1', 'sending'), createPending('key-2', 'failed'), createPending('key-3', 'queued')];
    const delivered = ['key-1', 'key-2', 'key-3'].map((key, index) => ({
      ...createMessage(`server-${index}`, '2026-10-05T12:00:01.000Z'),
      clientMessageId: key,
    }));

    expect(hideDeliveredPendingMessages(pending, delivered)).toEqual([]);
  });

  it('본문이 같아도 clientMessageId가 없거나 다르면 서버 사본으로 보지 않는다', () => {
    const pending = [createPending('key-1', 'failed')];
    const otherTab = { ...createMessage('server-1', '2026-10-05T12:00:01.000Z'), text: 'hello', clientMessageId: 'key-9' };
    const legacy = { ...createMessage('server-2', '2026-10-05T12:00:02.000Z'), text: 'hello', clientMessageId: null };

    expect(hideDeliveredPendingMessages(pending, [otherTab, legacy])).toEqual(pending);
  });
});

describe('createClientId', () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('randomUUID가 없는 HTTP 환경에서도 UUID v4를 만든다', () => {
    const realCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) });

    let ids: string[];
    try {
      ids = [createClientId(), createClientId()];
    } finally {
      vi.unstubAllGlobals();
    }

    expect(ids[0]).toMatch(UUID_V4);
    expect(ids[1]).toMatch(UUID_V4);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
