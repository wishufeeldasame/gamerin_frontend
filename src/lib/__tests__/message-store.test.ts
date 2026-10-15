import { describe, expect, it } from 'vitest';
import {
  formatMessageDate,
  isSameLocalDate,
  mergeMessages,
  shouldShowMessageDateSeparator,
  type ChatMessage,
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
