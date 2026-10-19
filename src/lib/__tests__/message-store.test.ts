import { describe, expect, it } from 'vitest';
import {
  formatMessageDate,
  hideDeliveredPendingMessages,
  isSameLocalDate,
  latestCreatedAt,
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

function createPending(
  id: string,
  text: string,
  status: PendingChatMessage['status'],
  afterCreatedAt: string | null,
): PendingChatMessage {
  return { id, text, attachments: [], status, errorMessage: null, afterCreatedAt, authGeneration: 0 };
}

describe('hideDeliveredPendingMessages', () => {
  it('요청 중인 임시 메시지는 기준 시각 이후 같은 내용의 내 메시지가 오면 숨긴다', () => {
    const pending = [createPending('pending-1', 'hello', 'sending', '2026-10-05T12:00:00.000Z')];
    const delivered = { ...createMessage('server-1', '2026-10-05T12:00:01.000Z'), text: 'hello' };

    expect(hideDeliveredPendingMessages(pending, [delivered])).toEqual([]);
  });

  it('기준 시각 이전 메시지, 상대 메시지, 대기·실패 상태는 서버 사본으로 보지 않는다', () => {
    const older = { ...createMessage('older', '2026-10-05T11:59:59.000Z'), text: 'hello' };
    const fromRecipient = { ...createMessage('other', '2026-10-05T12:00:01.000Z'), text: 'hello', senderId: 'user-2' };
    const pending = [
      createPending('sending', 'hello', 'sending', '2026-10-05T12:00:00.000Z'),
      createPending('queued', 'hello', 'queued', null),
      createPending('failed', 'hello', 'failed', null),
    ];

    expect(hideDeliveredPendingMessages(pending, [older, fromRecipient]).map((item) => item.id)).toEqual([
      'sending',
      'queued',
      'failed',
    ]);
  });

  it('기준 시각을 모르면(이력 로딩 전 제출) 같은 내용의 과거 메시지가 와도 숨기지 않는다', () => {
    const pending = [createPending('unknown-baseline', 'hello', 'sending', null)];
    const history = { ...createMessage('old', '2026-01-01T00:00:00.000Z'), text: 'hello' };

    expect(hideDeliveredPendingMessages(pending, [history])).toEqual(pending);
  });

  it('첨부 종류·개수가 같아도 파일명이 다르면 서버 사본으로 보지 않는다', () => {
    const pending: PendingChatMessage = {
      ...createPending('photo', '', 'sending', '2026-10-05T12:00:00.000Z'),
      attachments: [{ id: 'a', type: 'image', name: 'mine.png', file: new File(['a'], 'mine.png'), previewUrl: 'blob:a' }],
    };
    const otherTab = {
      ...createMessage('server-1', '2026-10-05T12:00:01.000Z'),
      text: '',
      attachments: [{ id: 'x', type: 'image' as const, name: 'other.png', url: '/x' }],
    };
    const same = { ...otherTab, id: 'server-2', attachments: [{ ...otherTab.attachments[0], name: 'mine.png' }] };

    expect(hideDeliveredPendingMessages([pending], [otherTab])).toEqual([pending]);
    expect(hideDeliveredPendingMessages([pending], [otherTab, same])).toEqual([]);
  });

  it('서버 메시지 하나는 임시 메시지 하나만 숨긴다', () => {
    const delivered = { ...createMessage('server-1', '2026-10-05T12:00:01.000Z'), text: 'ㅋ' };
    const pending = [
      createPending('first', 'ㅋ', 'sending', '2026-10-05T12:00:00.000Z'),
      createPending('second', 'ㅋ', 'sending', '2026-10-05T12:00:00.000Z'),
    ];

    expect(hideDeliveredPendingMessages(pending, [delivered]).map((item) => item.id)).toEqual(['second']);
  });
});

describe('latestCreatedAt', () => {
  it('비어 있지 않은 값 중 가장 늦은 시각을 고른다', () => {
    expect(latestCreatedAt(null, '2026-10-05T12:00:00.000Z', undefined, '2026-10-04T12:00:00.000Z')).toBe(
      '2026-10-05T12:00:00.000Z'
    );
    expect(latestCreatedAt(null, undefined)).toBeNull();
  });
});
